/** Browser-side PWA notification utility.
 *  Keeps all notification logic in one place so components stay clean.
 */

export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

/** Return current permission state (or 'unsupported' if API unavailable). */
export function getPermission(): NotifPermission {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission as NotifPermission;
}

/** Ask the user for permission and return the resulting state. */
export async function requestPermission(shopId?: string): Promise<NotifPermission> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      return "denied";
    }
  }
  
  if (Notification.permission === "granted") {
    // If we have shopId, subscribe to push
    if (shopId) {
      await subscribeToPush(shopId);
    }
    return "granted";
  }
  return "denied";
}

async function subscribeToPush(shopId: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: "BFM5wkoyrQiiJddM1PIuyEXBsw0jdIK-rYBDkK7fd-xjxqaZ0A6EVT7k5IWKi9utNo54d7KYLBrW2IWTc2f3sKI"
      });
    }
    
    const subData = sub.toJSON();
    if (subData.endpoint && subData.keys?.p256dh && subData.keys?.auth) {
      await fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subData.endpoint,
          p256dh: subData.keys.p256dh,
          auth: subData.keys.auth,
          shop_id: shopId
        })
      });
    }
  } catch (e) {
    console.error("Push API error", e);
  }
}

export type NotifPayload = {
  title: string;
  body: string;
  /** Optional URL to open on click (defaults to current origin). */
  url?: string;
  /** One of the named icons below. */
  icon?: "sale" | "cancel" | "shift" | "sync" | "expense";
};

const ICONS: Record<string, string> = {
  sale: "/icons/icon-192.png",
  cancel: "/icons/icon-192.png",
  shift: "/icons/icon-192.png",
  sync: "/icons/icon-192.png",
  expense: "/icons/icon-192.png",
};

/** Show a local notification via the service worker (supports vibrate, click-to-focus). */
export async function notify(payload: NotifPayload): Promise<void> {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const options: NotificationOptions = {
    body: payload.body,
    icon: ICONS[payload.icon ?? "sale"] ?? "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: payload.url ?? "/" },
    silent: false,
  };

  // Prefer service worker showNotification (keeps notifications when tab is backgrounded)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(payload.title, options);
      return;
    } catch {
      // fallback to Notification constructor
    }
  }

  // Fallback for browsers without service worker
  new Notification(payload.title, options);
}

/** Convenience wrappers for each transaction type. */
export const notifyCheckout = (total: string, method: string) =>
  notify({
    title: "Thanh toán thành công ✓",
    body: `${total} · ${method}`,
    icon: "sale",
    url: "/orders",
  });

export const notifyCancel = (number: string) =>
  notify({
    title: "Đơn hàng đã hủy",
    body: `${number} đã được hủy thành công.`,
    icon: "cancel",
    url: "/orders",
  });

export const notifyShiftOpen = () =>
  notify({
    title: "Ca làm việc bắt đầu",
    body: "Chúc một ngày làm việc hiệu quả!",
    icon: "shift",
    url: "/shift",
  });

export const notifyShiftClose = (totalSales: string) =>
  notify({
    title: "Ca làm việc kết thúc",
    body: `Doanh thu ca: ${totalSales}. Đang chờ quản lý phê duyệt.`,
    icon: "shift",
    url: "/shift",
  });

export const notifyExpense = (note: string, amount: string) =>
  notify({
    title: "Chi phí đã ghi nhận",
    body: `${note} · ${amount}`,
    icon: "expense",
    url: "/finance",
  });

export const notifySync = (count: number) =>
  notify({
    title: "Đã đồng bộ dữ liệu",
    body: `${count} đơn hàng đã được xác nhận với máy chủ.`,
    icon: "sync",
    url: "/orders",
  });
