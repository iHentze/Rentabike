import { describe, expect, it } from "vitest";
import { adminEnabled, currentStaff, login, requireStaff, STAFF_COOKIE } from "./auth";

const req = (cookie?: string, headers: Record<string, string> = {}) => new Request("https://rentabike.fo/admin", { headers: { ...(cookie ? { cookie } : {}), ...headers } });

describe("the password door", () => {
  const env = { APP_ENV: "production", ADMIN_PASSWORD: "hunter2" };

  it("is closed in production until something is configured", () => {
    expect(adminEnabled({ APP_ENV: "production" })).toBe(false);
    expect(adminEnabled(env)).toBe(true);
    expect(adminEnabled({ APP_ENV: "production", ACCESS_TEAM_DOMAIN: "https://t.cloudflareaccess.com", ACCESS_AUD: "aud" })).toBe(true);
  });

  it("issues a signed cookie for the right password and nothing for the wrong one", async () => {
    expect(await login(env, "wrong", "Berit")).toBeNull();
    const cookie = await login(env, "hunter2", "Berit");
    expect(cookie).toMatch(new RegExp(`^${STAFF_COOKIE}=\\d+\\.Berit\\.[A-Za-z0-9_-]+; Path=/; HttpOnly; Secure`));
    const value = cookie!.split(";")[0]!;
    expect(await currentStaff(req(value), env)).toEqual({ actor: "Berit", via: "password" });
  });

  it("rejects a tampered or expired cookie", async () => {
    const cookie = (await login(env, "hunter2", "Berit"))!.split(";")[0]!;
    const [k, exp, who, sig] = cookie.split(/[=.]/);
    expect(await currentStaff(req(`${k}=${exp}.Someone.${sig}`), env)).toBeNull();
    expect(await currentStaff(req(`${k}=${Number(exp) - 20 * 3_600_000}.${who}.${sig}`), env)).toBeNull();
    expect(await currentStaff(req(`${k}=${exp}.${who}.${sig}x`), env)).toBeNull();
    expect(await currentStaff(req(cookie), { ...env, ADMIN_PASSWORD: "other" })).toBeNull();
  });

  it("requireStaff redirects to the login page with the way back", async () => {
    try {
      await requireStaff(new Request("https://rentabike.fo/admin/bookings?q=x"), env);
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(Response);
      expect((e as Response).status).toBe(302);
      expect((e as Response).headers.get("location")).toBe("/admin/login?next=%2Fadmin%2Fbookings%3Fq%3Dx");
    }
  });

  it("opens as dev outside production only when nothing is configured", async () => {
    expect(await currentStaff(req(), { APP_ENV: "development" })).toEqual({ actor: "dev", via: "dev" });
    expect(await currentStaff(req(), { APP_ENV: "development", ADMIN_PASSWORD: "x" })).toBeNull();
    expect(await currentStaff(req(), { APP_ENV: "production" })).toBeNull();
  });

  it("ignores an Access header when Access is not configured", async () => {
    expect(await currentStaff(req(undefined, { "cf-access-jwt-assertion": "a.b.c" }), { APP_ENV: "production", ADMIN_PASSWORD: "x" })).toBeNull();
  });
});
