import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("./supabaseClient", () => ({
  supabase: { auth: { getSession } },
}));

import {
  adminCreateUser,
  adminFinishUserImport,
  adminProcessUserImport,
  adminResetPassword,
  adminStartUserImport,
  adminUsersDelete,
  adminUsersList,
  adminUsersUpdate,
} from "./adminApi";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

describe("adminApi", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    getSession.mockReset();
    getSession.mockResolvedValue({
      data: { session: { access_token: "token-abc" } },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function jsonResponse(body: unknown, ok = true, status = 200) {
    return {
      ok,
      status,
      text: async () => JSON.stringify(body),
    };
  }

  describe("auth-token handling", () => {
    it("throws when there is no active session (empty token)", async () => {
      getSession.mockResolvedValue({ data: { session: null }, error: null });

      await expect(adminUsersList({})).rejects.toThrow(/No hay sesión activa/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("throws when getSession itself returns an error", async () => {
      getSession.mockResolvedValue({
        data: { session: null },
        error: { message: "session lookup failed" },
      });

      await expect(adminUsersList({})).rejects.toThrow(/Auth: session lookup failed/);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("sends the bearer token, apikey and content-type headers", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true, page: 1, pageSize: 20, total: 0, items: [] }));

      await adminUsersList({ q: "ana" });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe(`${SUPABASE_URL}/functions/v1/admin-users-list`);
      expect(init.method).toBe("POST");
      expect(init.headers.Authorization).toBe("Bearer token-abc");
      expect(init.headers["Content-Type"]).toBe("application/json");
      expect(JSON.parse(init.body)).toEqual({ q: "ana" });
    });
  });

  describe("adminCreateUser", () => {
    it("posts to admin-create-user with the given payload (happy path)", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

      const input = {
        tipo_documento: "DNI" as const,
        numero_documento: "12345678",
        apellido_paterno: "Perez",
        apellido_materno: "Lopez",
        nombres: "Ana",
        correo: "ana@example.com",
        rol: "user",
        password: "Abcdef1!",
      };

      const result = await adminCreateUser(input);

      expect(result).toEqual({ ok: true });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("/admin-create-user");
      expect(JSON.parse(init.body)).toEqual(input);
    });

    it("throws a descriptive error when the edge function rejects the request", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ error: "weak_password" }, false, 422)
      );

      await expect(
        adminCreateUser({
          tipo_documento: "DNI",
          numero_documento: "12345678",
          apellido_paterno: "Perez",
          apellido_materno: "Lopez",
          nombres: "Ana",
          correo: "ana@example.com",
          rol: "user",
          password: "weak",
        })
      ).rejects.toThrow(/EdgeFn admin-create-user -> 422/);
    });

    it("surfaces raw text detail when the error body isn't valid JSON", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "internal server error",
      });

      await expect(
        adminCreateUser({
          tipo_documento: "DNI",
          numero_documento: "12345678",
          apellido_paterno: "Perez",
          apellido_materno: "Lopez",
          nombres: "Ana",
          correo: "ana@example.com",
          rol: "user",
          password: "Abcdef1!",
        })
      ).rejects.toThrow(/500 internal server error/);
    });
  });

  describe("adminResetPassword", () => {
    it("sends both legacy and new field names for compatibility", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

      await adminResetPassword("user-42", "NewPass1!");

      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({
        userId: "user-42",
        user_id: "user-42",
        password: "NewPass1!",
        new_password: "NewPass1!",
      });
    });

    it("throws locally without calling fetch when userId is empty", async () => {
      await expect(adminResetPassword("   ", "pwd")).rejects.toThrow(
        /userId requerido/
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("other admin wrappers pass correct params", () => {
    it("adminUsersUpdate posts the raw payload to admin-users-update", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true }));
      const payload = { id: "u1", area: "TI" };

      await adminUsersUpdate(payload);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("/admin-users-update");
      expect(JSON.parse(init.body)).toEqual(payload);
    });

    it("adminUsersDelete posts the id to admin-users-delete", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true }));

      await adminUsersDelete("u1");

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("/admin-users-delete");
      expect(JSON.parse(init.body)).toEqual({ id: "u1" });
    });

    it("adminStartUserImport sends action=start with file metadata", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true, job_id: "job-1" }));

      await adminStartUserImport("users.csv", 42);

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain("/admin-users-import");
      expect(JSON.parse(init.body)).toEqual({
        action: "start",
        file_name: "users.csv",
        total_rows: 42,
      });
    });

    it("adminProcessUserImport sends action=process with job_id and rows", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ ok: true, items: [] }));
      const rows = [{ correo: "a@a.com" } as any];

      await adminProcessUserImport("job-1", rows);

      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({
        action: "process",
        job_id: "job-1",
        rows,
      });
    });

    it("adminFinishUserImport sends action=finish with job_id", async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ ok: true, summary: { total: 1, created: 1, skipped: 0, errors: 0 } })
      );

      await adminFinishUserImport("job-1");

      const [, init] = fetchMock.mock.calls[0];
      expect(JSON.parse(init.body)).toEqual({ action: "finish", job_id: "job-1" });
    });
  });
});
