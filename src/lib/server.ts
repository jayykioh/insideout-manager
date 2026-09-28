import "server-only";
import { createClient, type Session } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";

// ── Supabase client factory ──────────────────────────────────────────────────
// Re-use a module-level singleton for service_role to avoid creating a new
// HTTP connection on every request (especially relevant in dev / edge runtime).
let _serviceClient: ReturnType<typeof createClient> | null = null;

export function supabase(token?: string, privileged = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = privileged
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw Error(
      "Chưa kết nối Supabase. Cấu hình biến môi trường để đăng nhập cửa hàng, hoặc chọn trải nghiệm dữ liệu mẫu.",
    );

  // Reuse privileged singleton — it has no user-specific state
  if (privileged && !token) {
    if (!_serviceClient) {
      _serviceClient = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    return _serviceClient;
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: token ? { headers: { Authorization: "Bearer " + token } } : undefined,
  });
}

export async function saveSession(session: Session) {
  const jar = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
  };
  jar.set("io-access", session.access_token, {
    ...options,
    maxAge: session.expires_in,
  });
  jar.set("io-refresh", session.refresh_token, {
    ...options,
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function authenticated() {
  const jar = await cookies();
  let token = jar.get("io-access")?.value;
  let client = supabase(token);
  let result = token ? await client.auth.getUser(token) : null;

  if (!result?.data.user) {
    const refresh = jar.get("io-refresh")?.value;
    if (!refresh) throw Error("AUTH_REQUIRED");
    const refreshed = await supabase().auth.refreshSession({ refresh_token: refresh });
    if (refreshed.error || !refreshed.data.session) throw Error("AUTH_REQUIRED");
    await saveSession(refreshed.data.session);
    token = refreshed.data.session.access_token;
    client = supabase(token);
    result = await client.auth.getUser(token);
  }
  if (!result!.data.user) throw Error("AUTH_REQUIRED");

  // Fetch membership + device check in parallel
  const bound = jar.get("io-bound-device")?.value;
  const enrollment = jar.get("io-device")?.value;

  const [membership, deviceRow] = await Promise.all([
    client
      .from("members")
      .select("*")
      .eq("id", result!.data.user.id)
      .eq("active", true)
      .single(),
    bound && enrollment
      ? supabase(undefined, true)
          .from("device_sessions")
          .select("id")
          .eq("id", bound)
          .eq("token_hash", createHash("sha256").update(enrollment).digest("hex"))
          .is("revoked_at", null)
          .gt("expires_at", new Date().toISOString())
          .single()
      : Promise.resolve(null),
  ]);

  if (membership.error || !membership.data) throw Error("AUTH_REQUIRED");
  if (bound) {
    // deviceRow is null when no enrollment cookie → block
    if (!deviceRow || deviceRow.error) throw Error("AUTH_REQUIRED");
  }

  return { client, user: result!.data.user, member: membership.data };
}
