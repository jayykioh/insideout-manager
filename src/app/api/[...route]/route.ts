import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { operationsRoute } from '@/lib/operations-server';
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
async function loginShop() {
  const service = supabase(undefined, true);
  const configuredShop = process.env.DEFAULT_SHOP_ID;
  if (configuredShop) {
    const { data, error } = await service
      .from("shops")
      .select("id")
      .eq("id", configuredShop)
      .single();
    if (error || !data) throw Error("Cửa hàng chưa được cấu hình đúng trên hệ thống.");
    return { id: null, shop_id: data.id };
  }
  const { data, error } = await service.from("shops").select("id").limit(1);
  if (error || !data.length)
    throw Error(
      "Hệ thống chưa được khởi tạo. Vui lòng thêm cửa hàng vào cơ sở dữ liệu hoặc cấu hình DEFAULT_SHOP_ID.",
    );
  return { id: null, shop_id: data[0].id };
}
async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ route: string[] }> },
) {
  try {
    const route = (await params).route.join("/");
    if (req.method === "POST") {
      const origin = req.headers.get("origin");
      const reqOrigin = new URL(req.url).origin;
      if (
        !origin ||
        (origin !== reqOrigin &&
          origin.replace("127.0.0.1", "localhost") !==
          reqOrigin.replace("127.0.0.1", "localhost"))
      )
        return okError("Yêu cầu không hợp lệ.", 403);
    }
    const p = req.method === "POST" && route !== 'assets' ? await req.json() : {};
    if (route === "auth/profiles" && req.method === "GET") {
      const d = await loginShop();
      const { data, error } = await supabase(undefined, true)
        .from("members")
        .select("id,name,role,active,color")
        .eq("shop_id", d.shop_id)
        .eq("active", true);
      if (error) throw error;
      return ok(data);
    }
    if (route === "auth/register" && req.method === "POST") {
      const input = z
        .object({
          name: z.string().trim().min(1).max(100),
          pin: z.string().regex(/^\d{4,6}$/),
        })
        .parse(p);
      const d = await loginShop();
      const service = supabase(undefined, true);
      // Start hashing PIN immediately — runs concurrently with createUser
      const hashPromise = hash(input.pin, 10);
      const created = await service.auth.admin.createUser({
        email: `${randomBytes(16).toString("hex")}@insideout.local`,
        password: randomBytes(32).toString("hex"),
        email_confirm: true,
      });
      if (created.error) throw Error("Không tạo được tài khoản.");

      const memberErr = await service.from("members").insert({
        id: created.data.user.id,
        shop_id: d.shop_id,
        name: input.name,
        role: "staff",
        hourly_rate: 25000,
      });
      if (memberErr.error) {
        await service.auth.admin.deleteUser(created.data.user.id);
        throw memberErr.error;
      }
      const pinErr = await service.from("staff_pins").insert({
        user_id: created.data.user.id,
        shop_id: d.shop_id,
        hash: await hashPromise,
      });
      if (pinErr.error) {
        await service.auth.admin.deleteUser(created.data.user.id);
        throw pinErr.error;
      }
      return ok({ ok: true });
    }
    if (route === "auth/pin" && req.method === "POST") {
      const input = z
        .object({ id: z.uuid(), pin: z.string().regex(/^\d{4,6}$/) })
        .parse(p);
      const d = await loginShop();
      const service = supabase(undefined, true);
      // verify_profile_pin already checks member existence + active — skip redundant member query
      const result = await service.rpc("verify_profile_pin", {
        p_shop: d.shop_id,
        p_user: input.id,
        p_pin: input.pin,
      });
      if (result.error || !result.data?.ok)
        throw Error(result.data?.message || "PIN chưa đúng hoặc hồ sơ đã bị khóa.");
      // getUserById + generateLink are sequential by Supabase design
      const { data: userData, error: userError } =
        await service.auth.admin.getUserById(input.id);
      if (userError || !userData.user.email)
        throw Error("Tài khoản PIN chưa được khởi tạo đúng.");
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
      return ok({ id: input.id });
    }
    if (route === "auth/change-pin" && req.method === "POST") {
      const input = z
        .object({
          old_pin: z.string().regex(/^\d{4,6}$/),
          new_pin: z.string().regex(/^\d{4,6}$/),
        })
        .parse(p);
      const auth = await authenticated();
      if (!auth) throw Error("Không có quyền.");
      const d = await loginShop();
      const service = supabase(undefined, true);
      // Start hashing new PIN concurrently with PIN verification
      const newHashPromise = hash(input.new_pin, 10);
      const result = await service.rpc("verify_profile_pin", {
        p_shop: d.shop_id,
        p_user: auth.user.id,
        p_pin: input.old_pin,
      });
      if (result.error || !result.data?.ok)
        throw Error("Mã PIN hiện tại không đúng.");
      const { error } = await service
        .from("staff_pins")
        .update({ hash: await newHashPromise })
        .eq("user_id", auth.user.id)
        .eq("shop_id", d.shop_id);
      if (error) throw Error("Không thể cập nhật mã PIN.");
      return ok({ ok: true });
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
    const extra = await operationsRoute(route, req, p, { client, member, user }); if (extra) return extra;
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
            pin: z.string().regex(/^\d{4,6}$/),
            hourly_rate: z.number().int().min(0).max(10000000),
            role: z.enum(["admin", "staff"]),
          })
          .parse(command.payload);
        // Start hashing PIN concurrently with createUser network call
        const service = supabase(undefined, true);
        const hashPromise = hash(input.pin, 10);
        const created = await service.auth.admin.createUser({
          email: `${randomBytes(16).toString("hex")}@insideout.local`,
          password: randomBytes(32).toString("hex"),
          email_confirm: true,
        });
        if (created.error)
          throw Error("Không tạo được tài khoản PIN.");
        const memberResult = await service.rpc("provision_member", {
          p_user: created.data.user.id,
          p_shop: member.shop_id,
          p_actor: member.id,
          p_name: input.name,
          p_role: input.role,
          p_rate: input.hourly_rate,
          p_hash: await hashPromise,
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
    // Treat missing Supabase config on protected routes the same as AUTH_REQUIRED
    const isAuthError =
      message === "AUTH_REQUIRED" ||
      message.startsWith("Chưa kết nối Supabase");
    return okError(
      isAuthError ? "AUTH_REQUIRED" : message,
      isAuthError ? 401 : message === "FORBIDDEN" ? 403 : 400,
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