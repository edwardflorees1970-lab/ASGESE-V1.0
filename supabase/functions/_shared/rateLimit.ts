import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

type EnforceRateLimitArgs = {
  supabaseUrl: string;
  serviceRoleKey: string;
  scope: string;
  identifier: string;
  maxHits: number;
  windowSeconds: number;
};

type RawRateLimitRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
  reset_at: string;
};

export type RateLimitDecision = {
  allowed: boolean;
  headers: Record<string, string>;
};

export function readPositiveIntEnv(name: string, fallback: number) {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const n = Math.floor(parsed);
  return n > 0 ? n : fallback;
}

export function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const forwardedIp = forwarded
    .split(",")
    .map((v) => v.trim())
    .find(Boolean);
  const directIp = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "";
  const ip = (forwardedIp || directIp || "unknown").trim();
  return ip.slice(0, 100);
}

export async function enforceRateLimit(args: EnforceRateLimitArgs): Promise<RateLimitDecision> {
  const supaAdmin = createClient(args.supabaseUrl, args.serviceRoleKey);
  const key = `${args.scope}:${args.identifier}`;

  const { data, error } = await supaAdmin.rpc("enforce_edge_rate_limit", {
    p_key: key,
    p_max_hits: args.maxHits,
    p_window_seconds: args.windowSeconds,
  });

  if (error) throw new Error(`Rate limit RPC error: ${error.message}`);

  const row = (Array.isArray(data) ? data[0] : data) as RawRateLimitRow | null;
  if (!row) throw new Error("Rate limit RPC returned empty row");

  const retryAfter = Math.max(1, Number(row.retry_after_seconds ?? 1));
  const remaining = Math.max(0, Number(row.remaining ?? 0));
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(args.maxHits),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(row.reset_at ?? ""),
  };

  if (!row.allowed) headers["Retry-After"] = String(retryAfter);

  return {
    allowed: Boolean(row.allowed),
    headers,
  };
}
