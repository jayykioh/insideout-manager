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
    let title = "Thông báo mới";
    let bodyText = "";

    if (table === "orders") {
      // Don't notify the person who created it
      if (payload.user_id) {
        subscriptions.filter(sub => sub.user_id !== payload.user_id);
      }
      bodyText = `Đơn hàng mới: ${new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(payload.total)}`;
    } else if (table === "expenses") {
      // For expenses, the created by actor is usually stored via audit_logs or we might not have it in expenses directly.
      // But we can just broadcast.
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

    const sendPromises = subscriptions.map((sub: any) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };
      
      return webPush.sendNotification(pushSubscription, notificationPayload)
        .catch(async (err: any) => {
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
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
