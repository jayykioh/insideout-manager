import "server-only";
import { createClient, type Session } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import {createHash} from 'node:crypto';
export function supabase(token?: string, privileged = false) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = privileged
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw Error(
      "Chưa kết nối Supabase. Cấu hình biến môi trường để đăng nhập cửa hàng, hoặc chọn trải nghiệm dữ liệu mẫu.",
    );
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: token
      ? { headers: { Authorization: "Bearer " + token } }
      : undefined,
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
    const refreshed = await supabase().auth.refreshSession({
      refresh_token: refresh,
    });
    if (refreshed.error || !refreshed.data.session)
      throw Error("AUTH_REQUIRED");
    await saveSession(refreshed.data.session);
    token = refreshed.data.session.access_token;
    client = supabase(token);
    result = await client.auth.getUser(token);
  }
  if (!result.data.user) throw Error("AUTH_REQUIRED");
  const membership = await client
    .from("members")
    .select("*")
    .eq("id", result.data.user.id)
    .eq("active", true)
    .single();
  if (membership.error || !membership.data) throw Error("AUTH_REQUIRED");
  const bound=jar.get('io-bound-device')?.value;
  if(bound){const enrollment=jar.get('io-device')?.value;if(!enrollment)throw Error('AUTH_REQUIRED');const d=await supabase(undefined,true).from('device_sessions').select('id').eq('id',bound).eq('shop_id',membership.data.shop_id).eq('token_hash',createHash('sha256').update(enrollment).digest('hex')).is('revoked_at',null).gt('expires_at',new Date().toISOString()).single();if(d.error)throw Error('AUTH_REQUIRED');}
  return { client, user: result.data.user, member: membership.data };
}
