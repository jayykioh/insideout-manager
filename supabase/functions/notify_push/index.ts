import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "npm:web-push";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

webPush.setVapidDetails(
  "mailto:innoir.store@gmail.com",
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const payload = body.record;
    
    if (!payload || !payload.shop_id) {
      return new Response("Invalid payload", { status: 400 });
    }

    const { data: subscriptions, error } = await supabaseClient
      .from("push_subscriptions")
      .select("*")
      .eq("shop_id", payload.shop_id);

    if (error) {
      throw error;
    }

    // Identify if it's an order or expense based on the table name
    const table = body.table;
    const title = "Thông báo mới";
    let bodyText = "";

    // Filter out the person who created the action (Disabled for testing)
    const notifySubs = subscriptions; /* .filter((sub: { user_id: string }) => {
      if (payload.user_id && sub.user_id === payload.user_id) return false;
      return true;
    }); */

    if (table === "orders") {
      const moneyFmt = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(payload.total);
      
      let methodText = "Khác";
      if (payload.payment_method === "cash") methodText = "Tiền mặt";
      if (payload.payment_method === "bank_transfer" || payload.payment_method === "transfer") methodText = "Chuyển khoản";
      if (payload.payment_method === "card") methodText = "Quẹt thẻ";

      bodyText = `Đơn hàng mới: ${moneyFmt}\nThanh toán: ${methodText}\nMã đơn: ${payload.number || payload.id.slice(0,8).toUpperCase()}`;
    } else if (table === "expenses") {
      bodyText = `Chi phí mới: ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(payload.amount)} - ${payload.note}`;
    }

    const notificationPayload = JSON.stringify({
      title,
      options: {
        body: bodyText,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
      }
    });

    const sendPromises = notifySubs.map((sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };
      
      return webPush.sendNotification(pushSubscription, notificationPayload)
        .catch(async (err: Error & { statusCode?: number }) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            // Subscription expired or invalid
            await supabaseClient.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error("Error sending push notification:", err);
          }
        });
    });

    await Promise.all(sendPromises);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
