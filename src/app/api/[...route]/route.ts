import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {operationsRoute} from '@/lib/operations-server';
import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { supabase, authenticated, saveSession } from "@/lib/server";
import { checkoutSchema, productSchema, settingsSchema } from "@/lib/domain";
export const dynamic = "force-dynamic";
const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const ok = (data: unknown) =>
  NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
async function device() {
  const token = (await cookies()).get("io-device")?.value;
  if (!token) throw Error("Thiết bị chưa được quản lý đăng ký.");
  const { data, error } = await supabase(undefined, true)
    .from("device_sessions")
    .select("id,shop_id")
    .eq("token_hash", digest(token))
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();
  if (error || !data)
    throw Error("Phiên thiết bị đã hết hạn. Quản lý cần đăng nhập lại.");
  return data;
}
async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ route: string[] }> },
) {
  try {
    const route = (await params).route.join("/");
    if (req.method === "POST") {
      const origin = req.headers.get("origin");
      if (!origin || origin !== new URL(req.url).origin)
        return okError("Yêu cầu không hợp lệ.", 403);
    }
    const p = req.method === "POST" && route !== 'assets' ? await req.json() : {};
    if (route === "auth/login" && req.method === "POST") {
      const input = z
        .object({
          email: z.string().min(3).max(254),
          password: z.string().min(6).max(128),
        })
        .parse(p);
      const credentials = input.email.includes("@")
        ? { email: input.email, password: input.password }
        : { phone: input.email, password: input.password };
      const { data, error } =
        await supabase().auth.signInWithPassword(credentials);
      if (error || !data.session)
        throw Error("Thông tin đăng nhập chưa đúng. Vui lòng thử lại.");
      const client = supabase(data.session.access_token);
      const { data: member } = await client
        .from("members")
        .select("id,shop_id,role")
        .eq("id", data.user.id)
        .eq("active", true)
        .single();
      if (!member) throw Error("Tài khoản chưa được cấp quyền cửa hàng.");
      await saveSession(data.session);
      (await cookies()).delete('io-bound-device');
      if (member.role === "admin") {
        const token = randomBytes(32).toString("hex");
        const { error: deviceError } = await supabase(undefined, true)
          .from("device_sessions")
          .insert({
            shop_id: member.shop_id,
            token_hash: digest(token),
            label: "Quầy bán hàng",
            enrolled_by: member.id,
            expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          });
        if (deviceError) throw Error("Không đăng ký được thiết bị.");
        (await cookies()).set("io-device", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          maxAge: 30 * 86400,
        });
      }
      return ok({ id: data.user.id });
    }
    if (route === "auth/profiles" && req.method === "GET") {
      const d = await device();
      const { data, error } = await supabase(undefined, true)
        .from("members")
        .select("id,name,role,active,color")
        .eq("shop_id", d.shop_id)
        .eq("active", true);
      if (error) throw error;
      return ok(data);
    }
    if (route === "auth/pin" && req.method === "POST") {
      const input = z
        .object({ id: z.uuid(), pin: z.string().regex(/^\d{4,6}$/) })
        .parse(p);
      const d = await device();
      const service = supabase(undefined, true);
      const result = await service.rpc("verify_profile_pin", {
        p_shop: d.shop_id,
        p_user: input.id,
        p_pin: input.pin,
      });
      if (result.error || !result.data?.ok)
        throw Error(
          result.data?.message || "PIN chưa đúng hoặc hồ sơ đã bị khóa.",
        );
      const { data: userData, error: userError } =
        await service.auth.admin.getUserById(input.id);
      if (userError || !userData.user.email)
        throw Error("Tài khoản PIN cần có email.");
      const link = await service.auth.admin.generateLink({
        type: "magiclink",
        email: userData.user.email,
      });
      if (link.error) throw Error("Không tạo được phiên.");
      const verified = await supabase().auth.verifyOtp({
        token_hash: link.data.properties.hashed_token,
        type: "magiclink",
      });
      if (
        verified.error ||
        !verified.data.session ||
        verified.data.user?.id !== input.id
      )
        throw Error("Không xác minh được phiên.");
      await saveSession(verified.data.session);
      (await cookies()).set('io-bound-device',d.id,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:30*86400});
      return ok({ id: input.id });
    }
    if (route === "auth/lock" && req.method === "POST") {
      const jar = await cookies();
      const access = jar.get("io-access")?.value;
      if (access)
        await supabase(undefined, true).auth.admin.signOut(access, "local");
      jar.delete("io-access");
      jar.delete("io-refresh");
      return ok({ ok: true });
    }
    const { client, member, user } = await authenticated();
    const extra=await operationsRoute(route,req,p,{client,member,user});if(extra)return extra;
    if (route === "state" && req.method === "GET") {
      const { data, error } = await client.rpc("manager_state");
      if (error) throw error;
      return ok(data);
    }
    if (route === "command" && req.method === "POST") {
      const command = z
        .object({
          type: z.string(),
          payload: z.record(z.string(), z.unknown()),
        })
        .parse(p);
      if (command.type === "checkout")
        command.payload = checkoutSchema.parse(command.payload);
      if (command.type === "product")
        command.payload = productSchema.parse(command.payload);
      if (command.type === "settings")
        command.payload = settingsSchema.parse(command.payload);
      if (command.type === "member" && !command.payload.id) {
        if (member.role !== "admin") throw Error("FORBIDDEN");
        const input = z
          .object({
            name: z.string().trim().min(1).max(100),
            email: z.email(),
            pin: z.string().regex(/^\d{4,6}$/),
            hourly_rate: z.number().int().min(0).max(10000000),
            role: z.enum(["admin", "staff"]),
          })
          .parse(command.payload);
        const service = supabase(undefined, true);
        const created = await service.auth.admin.createUser({
          email: input.email,
          password: randomBytes(32).toString("hex"),
          email_confirm: true,
        });
        if (created.error)
          throw Error(
            "Không tạo được tài khoản. Email có thể đã được sử dụng.",
          );
        const memberResult = await service.rpc("provision_member", {
          p_user: created.data.user.id,
          p_shop: member.shop_id,
          p_actor: member.id,
          p_name: input.name,
          p_role: input.role,
          p_rate: input.hourly_rate,
          p_hash: await hash(input.pin, 12),
        });
        if (memberResult.error) {
          await service.auth.admin.deleteUser(created.data.user.id);
          throw memberResult.error;
        }
        return ok({ ok: true });
      }
      const { data, error } = await client.rpc("manager_command", {
        p_type: command.type,
        p: command.payload,
      });
      if (error) throw error;
      return ok(data || { ok: true });
    }
    return okError("Không tìm thấy thao tác.", 404);
  } catch (e) {
    const message =
      e instanceof z.ZodError
        ? "Dữ liệu chưa hợp lệ. Kiểm tra lại các trường."
        : e instanceof Error
          ? e.message
          : typeof e === "object" && e && "message" in e
            ? String(e.message)
            : "Không thể hoàn thành. Vui lòng thử lại.";
    return okError(
      message,
      message === "AUTH_REQUIRED" ? 401 : message === "FORBIDDEN" ? 403 : 400,
    );
  }
}
function okError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export const GET = handler;
export const POST = handler;
