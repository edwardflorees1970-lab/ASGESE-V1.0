import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---- Mock the supabase client used by AuthProvider ----
const {
  getSession,
  onAuthStateChange,
  signOut,
  signInWithPassword,
  rpc,
  fromMock,
  maybeSingle,
  eqMock,
  selectMock,
} = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  signInWithPassword: vi.fn(),
  rpc: vi.fn(),
  fromMock: vi.fn(),
  maybeSingle: vi.fn(),
  eqMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession,
      onAuthStateChange,
      signOut,
      signInWithPassword,
    },
    rpc,
    from: fromMock,
  },
}));

function wireFromChain() {
  fromMock.mockReturnValue({ select: selectMock });
  selectMock.mockReturnValue({ eq: eqMock });
  eqMock.mockReturnValue({ maybeSingle });
}

function makeUnsubscribeHandle() {
  return { data: { subscription: { unsubscribe: vi.fn() } } };
}

const SAMPLE_PROFILE = {
  id: "user-1",
  email: "user1@example.com",
  correo: "user1@example.com",
  role: "user",
  nombres: "Ana",
  apellido_paterno: "Perez",
  apellido_materno: "Lopez",
  numero_documento: "12345678",
  tipo_documento: "DNI",
  area: null,
  ugel: null,
  rei: null,
  can_create_monitoreo: false,
  must_change_password: false,
};

describe("AuthProvider", () => {
  let authStateCallback: ((event: string, session: any) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    wireFromChain();
    authStateCallback = null;

    // The repo's local .env sets VITE_LOCAL_PREVIEW=true for local dev
    // convenience; without this stub that value leaks into every test via
    // Vite's loadEnv and silently activates the dev-bypass gate. Default to
    // "false" here so tests exercise the real Supabase auth flow; the
    // dedicated "VITE_LOCAL_PREVIEW dev-bypass gate" tests below override it.
    vi.stubEnv("VITE_LOCAL_PREVIEW", "false");

    onAuthStateChange.mockImplementation((cb: any) => {
      authStateCallback = cb;
      return makeUnsubscribeHandle();
    });

    rpc.mockResolvedValue({ data: [], error: null });
    maybeSingle.mockResolvedValue({ data: SAMPLE_PROFILE, error: null });
    signInWithPassword.mockResolvedValue({ data: { session: null, user: null }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function renderProvider() {
    // Ensure the module's top-level `const LOCAL_PREVIEW = ...` is
    // re-evaluated against whatever env has been stubbed for this test.
    vi.resetModules();
    const { AuthProvider, useAuth } = await import("./AuthProvider");
    let latest: ReturnType<typeof useAuth> | null = null;

    function Consumer() {
      latest = useAuth();
      return null;
    }

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    return {
      getValue: () => latest as unknown as ReturnType<typeof useAuth>,
    };
  }

  it("loads the session and profile on mount (happy path)", async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });

    const { getValue } = await renderProvider();

    await waitFor(() => expect(getValue().loading).toBe(false));
    await waitFor(() => expect(getValue().profile).toEqual(SAMPLE_PROFILE));

    expect(getValue().user?.id).toBe("user-1");
    expect(getValue().profileError).toBeNull();
  });

  it("clears loading and profile when there is no session", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });

    const { getValue } = await renderProvider();

    await waitFor(() => expect(getValue().loading).toBe(false));

    expect(getValue().user).toBeNull();
    expect(getValue().profile).toBeNull();
  });

  it("surfaces a profile fetch error without throwing", async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });

    const { getValue } = await renderProvider();

    await waitFor(() => expect(getValue().profileError).toBe("boom"));
    expect(getValue().profile).toBeNull();
  });

  it("logs a warning but does not throw when getSession itself errors", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    getSession.mockResolvedValue({
      data: { session: null },
      error: { message: "network down" },
    });

    const { getValue } = await renderProvider();

    await waitFor(() => expect(getValue().loading).toBe(false));

    expect(getValue().user).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      "AuthProvider getSession error:",
      "network down"
    );
    warnSpy.mockRestore();
  });

  it("signOut clears session, user, profile and permissions", async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
      error: null,
    });
    signOut.mockResolvedValue({ error: null });

    const { getValue } = await renderProvider();

    await waitFor(() => expect(getValue().user).not.toBeNull());
    await waitFor(() => expect(getValue().profile).toEqual(SAMPLE_PROFILE));

    await act(async () => {
      await getValue().signOut();
    });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(getValue().user).toBeNull();
    expect(getValue().session).toBeNull();
    expect(getValue().profile).toBeNull();
    expect(getValue().modulePermissions).toEqual({});
  });

  describe("race-condition guard (currentUserId.current)", () => {
    it("discards a stale profile response for a user that is no longer current", async () => {
      getSession.mockResolvedValue({
        data: { session: { user: { id: "user-1" } } },
        error: null,
      });

      // Make the first profile fetch (for user-1) resolve only after we
      // simulate the user switching to user-2 via an auth state change.
      let resolveStaleFetch!: (v: any) => void;
      maybeSingle.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStaleFetch = resolve;
          })
      );
      // Any subsequent profile fetch (for user-2) resolves immediately.
      maybeSingle.mockResolvedValue({
        data: { ...SAMPLE_PROFILE, id: "user-2", nombres: "Segundo" },
        error: null,
      });

      const { getValue } = await renderProvider();

      await waitFor(() => expect(getValue().user?.id).toBe("user-1"));

      // Simulate the user switching to user-2 before the stale fetch resolves.
      await act(async () => {
        authStateCallback?.("SIGNED_IN", { user: { id: "user-2" } });
      });

      await waitFor(() => expect(getValue().user?.id).toBe("user-2"));
      await waitFor(() => expect(getValue().profile?.id).toBe("user-2"));

      // Now resolve the stale user-1 fetch — it must be discarded because
      // currentUserId.current is now "user-2".
      await act(async () => {
        resolveStaleFetch({ data: SAMPLE_PROFILE, error: null });
      });

      expect(getValue().user?.id).toBe("user-2");
      expect(getValue().profile?.id).toBe("user-2");
      expect(getValue().profile?.nombres).toBe("Segundo");
    });
  });

  describe("VITE_LOCAL_PREVIEW dev auto-login gate", () => {
    it("no-ops (uses the real Supabase session flow) when the env var is unset", async () => {
      vi.stubEnv("VITE_LOCAL_PREVIEW", undefined as unknown as string);
      getSession.mockResolvedValue({ data: { session: null }, error: null });

      const { getValue } = await renderProvider();

      await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
      expect(signInWithPassword).not.toHaveBeenCalled();
      expect(getValue().user).toBeNull();
      expect(getValue().profile).toBeNull();
    });

    it("no-ops when the env var is explicitly 'false'", async () => {
      vi.stubEnv("VITE_LOCAL_PREVIEW", "false");
      getSession.mockResolvedValue({ data: { session: null }, error: null });

      const { getValue } = await renderProvider();

      await waitFor(() => expect(getSession).toHaveBeenCalledTimes(1));
      expect(signInWithPassword).not.toHaveBeenCalled();
      expect(getValue().user).toBeNull();
    });

    it("signs in with the dedicated preview account when 'true' and no session exists yet", async () => {
      vi.stubEnv("VITE_LOCAL_PREVIEW", "true");
      vi.stubEnv("VITE_LOCAL_PREVIEW_EMAIL", "dev-preview@asgese.local");
      vi.stubEnv("VITE_LOCAL_PREVIEW_PASSWORD", "test-password-not-real");

      // First getSession call (pre-login check) finds nothing; after the
      // mocked sign-in, the second getSession call (the normal flow's own
      // check) returns the real session it produced.
      const previewSession = { user: { id: "preview-user-1" } };
      getSession
        .mockResolvedValueOnce({ data: { session: null }, error: null })
        .mockResolvedValueOnce({ data: { session: previewSession }, error: null });
      signInWithPassword.mockResolvedValue({ data: { session: previewSession, user: previewSession.user }, error: null });
      maybeSingle.mockResolvedValue({
        data: { ...SAMPLE_PROFILE, id: "preview-user-1", role: "admin" },
        error: null,
      });

      const { getValue } = await renderProvider();

      await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith({
        email: "dev-preview@asgese.local",
        password: "test-password-not-real",
      }));
      await waitFor(() => expect(getValue().user?.id).toBe("preview-user-1"));
      await waitFor(() => expect(getValue().profile?.role).toBe("admin"));
    });

    it("does not attempt sign-in when a real session already exists", async () => {
      vi.stubEnv("VITE_LOCAL_PREVIEW", "true");
      vi.stubEnv("VITE_LOCAL_PREVIEW_EMAIL", "dev-preview@asgese.local");
      vi.stubEnv("VITE_LOCAL_PREVIEW_PASSWORD", "test-password-not-real");

      const existingSession = { user: { id: "already-logged-in" } };
      getSession.mockResolvedValue({ data: { session: existingSession }, error: null });

      const { getValue } = await renderProvider();

      await waitFor(() => expect(getValue().user?.id).toBe("already-logged-in"));
      expect(signInWithPassword).not.toHaveBeenCalled();
    });

    it("warns and falls through to the normal (logged-out) flow when credentials are missing", async () => {
      vi.stubEnv("VITE_LOCAL_PREVIEW", "true");
      vi.stubEnv("VITE_LOCAL_PREVIEW_EMAIL", undefined as unknown as string);
      vi.stubEnv("VITE_LOCAL_PREVIEW_PASSWORD", undefined as unknown as string);
      getSession.mockResolvedValue({ data: { session: null }, error: null });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { getValue } = await renderProvider();

      await waitFor(() => expect(getValue().loading).toBe(false));
      expect(signInWithPassword).not.toHaveBeenCalled();
      expect(getValue().user).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("faltan VITE_LOCAL_PREVIEW_EMAIL"));
      warnSpy.mockRestore();
    });
  });
});
