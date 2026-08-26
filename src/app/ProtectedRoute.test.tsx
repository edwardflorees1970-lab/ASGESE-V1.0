import { MemoryRouter, Route, Routes } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock("./AuthProvider", () => ({
  useAuth: useAuthMock,
}));

import { ProtectedRoute } from "./ProtectedRoute";

function baseAuthValue(overrides: Record<string, any> = {}) {
  return {
    loading: false,
    profileLoading: false,
    user: { id: "user-1" },
    session: {},
    profile: { role: "user", must_change_password: false },
    profileError: null,
    modulePermissions: {},
    permissionsLoading: false,
    canViewModule: () => true,
    canManageModule: () => true,
    signOut: vi.fn(),
    refreshProfile: vi.fn(),
    ...overrides,
  };
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderAt(
    path: string,
    routeProps: { requireAdmin?: boolean; allowedRoles?: string[]; requireModule?: string } = {}
  ) {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<ProtectedRoute {...routeProps} />}>
            <Route path="/target" element={<div>protected-content</div>} />
          </Route>
          {/* Ungated destinations: everything ProtectedRoute redirects to
              (requireAdmin/allowedRoles/requireModule -> /app,
              must_change_password -> /setup-password, no user -> /login).
              Kept outside ProtectedRoute so a redirect can't recurse back
              through the same guard. */}
          <Route path="/app" element={<div>fallback-app</div>} />
          <Route path="/setup-password" element={<div>setup-password-page</div>} />
          <Route path="/login" element={<div>login-page</div>} />
        </Routes>
      </MemoryRouter>
    );
    return screen;
  }

  it("shows a loading state while the session is resolving", () => {
    useAuthMock.mockReturnValue(baseAuthValue({ loading: true, user: null }));

    renderAt("/target");

    expect(screen.getByText(/Verificando sesión/)).toBeInTheDocument();
  });

  it("redirects to /login when there is no authenticated user", () => {
    useAuthMock.mockReturnValue(baseAuthValue({ user: null }));

    renderAt("/target");

    expect(screen.getByText("login-page")).toBeInTheDocument();
  });

  it("renders the protected content for an authenticated user on an open route", () => {
    useAuthMock.mockReturnValue(baseAuthValue());

    renderAt("/target");

    expect(screen.getByText("protected-content")).toBeInTheDocument();
  });

  it("redirects to /setup-password when the profile requires a password change", () => {
    useAuthMock.mockReturnValue(
      baseAuthValue({ profile: { role: "user", must_change_password: true } })
    );

    renderAt("/target");

    expect(screen.getByText("setup-password-page")).toBeInTheDocument();
  });

  it("shows a permissions-loading state while the profile is still loading on a gated route", () => {
    useAuthMock.mockReturnValue(
      baseAuthValue({ profile: null, profileLoading: true })
    );

    renderAt("/target", { requireAdmin: true });

    expect(screen.getByText(/Validando permisos/)).toBeInTheDocument();
  });

  it("does not block on profileLoading for an open (non-gated) route", () => {
    useAuthMock.mockReturnValue(
      baseAuthValue({ profile: null, profileLoading: true })
    );

    renderAt("/target");

    expect(screen.getByText("protected-content")).toBeInTheDocument();
  });

  it("shows a retry panel when the profile failed to load on a gated route", () => {
    useAuthMock.mockReturnValue(
      baseAuthValue({ profile: null, profileError: "network error" })
    );

    renderAt("/target", { requireAdmin: true });

    expect(screen.getByText(/No se pudo cargar tu perfil/)).toBeInTheDocument();
    expect(screen.getByText("network error")).toBeInTheDocument();
  });

  describe("role/permission checks", () => {
    it("blocks a non-admin user from an admin-only route and redirects to /app", () => {
      useAuthMock.mockReturnValue(baseAuthValue({ profile: { role: "user", must_change_password: false } }));

      renderAt("/target", { requireAdmin: true });

      expect(screen.getByText("fallback-app")).toBeInTheDocument();
    });

    it("allows an admin user through an admin-only route", () => {
      useAuthMock.mockReturnValue(baseAuthValue({ profile: { role: "admin", must_change_password: false } }));

      renderAt("/target", { requireAdmin: true });

      expect(screen.getByText("protected-content")).toBeInTheDocument();
    });

    it("allows access when the user's role is in allowedRoles", () => {
      useAuthMock.mockReturnValue(baseAuthValue({ profile: { role: "director", must_change_password: false } }));

      renderAt("/target", { allowedRoles: ["director", "admin"] });

      expect(screen.getByText("protected-content")).toBeInTheDocument();
    });

    it("denies access when the user's role is not in allowedRoles", () => {
      const canViewModule = vi.fn();
      useAuthMock.mockReturnValue(
        baseAuthValue({
          profile: { role: "user", must_change_password: false },
          canViewModule,
        })
      );

      renderAt("/target", { allowedRoles: ["director", "admin"] });

      expect(screen.getByText("fallback-app")).toBeInTheDocument();
      // The role check short-circuits before any module check would run.
      expect(canViewModule).not.toHaveBeenCalled();
    });

    it("denies access when requireModule is set and canViewModule returns false", () => {
      const canViewModule = vi.fn().mockReturnValue(false);
      useAuthMock.mockReturnValue(
        baseAuthValue({
          profile: { role: "user", must_change_password: false },
          canViewModule,
        })
      );

      renderAt("/target", { requireModule: "reportes" });

      expect(screen.getByText("fallback-app")).toBeInTheDocument();
      expect(canViewModule).toHaveBeenCalledWith("reportes");
    });

    it("allows access when requireModule is set and canViewModule returns true", () => {
      const canViewModule = vi.fn().mockReturnValue(true);
      useAuthMock.mockReturnValue(
        baseAuthValue({
          profile: { role: "user", must_change_password: false },
          canViewModule,
        })
      );

      renderAt("/target", { requireModule: "reportes" });

      expect(screen.getByText("protected-content")).toBeInTheDocument();
    });

    it("does not gate on requireModule yet while permissions are still loading", () => {
      const canViewModule = vi.fn().mockReturnValue(false);
      useAuthMock.mockReturnValue(
        baseAuthValue({
          profile: { role: "user", must_change_password: false },
          permissionsLoading: true,
          canViewModule,
        })
      );

      renderAt("/target", { requireModule: "reportes" });

      // permissionsLoading=true means the requireModule check is skipped,
      // so the user is let through rather than bounced while data loads.
      expect(screen.getByText("protected-content")).toBeInTheDocument();
    });
  });
});
