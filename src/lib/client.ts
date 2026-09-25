import { openDB } from "idb";
import { seed, reduceCommand, staffSnapshot } from "./demo";
import type { Snapshot, Command, Member, Checkout } from "./types";
const db = () =>
  openDB("insideout-v1", 1, {
    upgrade(db) {
      db.createObjectStore("kv");
      db.createObjectStore("outbox", { keyPath: "id" });
    },
  });
export async function request(path: string, body?: unknown) {
  const r = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(Error(data.error || "Không kết nối được máy chủ."), {status:r.status});
  return data;
}
export function isDemo() {
  return (
    typeof window !== "undefined" &&
    sessionStorage.getItem("io-demo") === "true"
  );
}
export async function demoLogin(memberId: string) {
  const store = await db();
  const s: Snapshot = (await store.get("kv", "demo")) || seed();
  const user = s.members.find((x) => x.id === memberId && x.active);
  if (!user) throw Error("Hồ sơ không hoạt động.");
  s.user = user;
  await store.put("kv", s, "demo");
  sessionStorage.setItem("io-demo", "true");
  sessionStorage.setItem("io-user", user.id);
  return user;
}
export async function profiles(): Promise<Member[]> {
  if (isDemo()) {
    const store = await db();
    return ((await store.get("kv", "demo")) || seed()).members;
  }
  return request("auth/profiles");
}
export async function snapshot(): Promise<Snapshot> {
  const store = await db();
  if (isDemo()) {
    const s: Snapshot = (await store.get("kv", "demo")) || seed();
    const user=s.members.find(m=>m.id===sessionStorage.getItem("io-user")&&m.active);
    if (!user) throw Error("AUTH_REQUIRED");
    s.user=user;
    return staffSnapshot(s);
  }
  try {
    const s = await request("state");
    const safe:Snapshot={...s,members:[s.user],products:s.products.map(({cost,...p}:Snapshot['products'][number])=>{void cost;return p;}),orders:s.orders.filter((o:Snapshot['orders'][number])=>o.user_id===s.user.id).map(({cost_total,...o}:Snapshot['orders'][number])=>{void cost_total;return o;}),shifts:s.shifts.filter((sh:Snapshot['shifts'][number])=>sh.user_id===s.user.id),expenses:[],audit:[],movements:[],pay_rules:[],payroll_periods:[],devices:[]};
    await store.put("kv", safe, "cache");
    return s;
  } catch (e) {
    if (!navigator.onLine) {
      const cached = await store.get("kv", "cache");
      if (cached && sessionStorage.getItem("io-user") === cached.user.id)
        return cached;
    }
    throw e;
  }
}
export async function execute(command: Command) {
  if (isDemo()) {
    const store = await db();
    const tx=store.transaction('kv','readwrite');
    const s: Snapshot = (await tx.store.get("demo")) || seed();
    const user=s.members.find(m=>m.id===sessionStorage.getItem('io-user')&&m.active);
    if (!user) {tx.abort();throw Error("AUTH_REQUIRED");}
    s.user=user;
    const updated = reduceCommand(s, command);
    await tx.store.put(updated, "demo");
    await tx.done;
    return;
  }
  await request("command", command);
}
export type Pending = {
  id: string;
  shop_id: string;
  actor_id: string;
  payload: Checkout;
  status: "pending" | "attention";
  error?: string;
  created_at: string;
};
export async function pending(): Promise<Pending[]> {
  return (await db()).getAll("outbox");
}
export async function queueCheckout(s: Snapshot, payload: Checkout) {
  await (
    await db()
  ).put("outbox", {
    id: payload.id,
    shop_id: s.shop_id,
    actor_id: s.user.id,
    payload,
    status: "pending",
    created_at: new Date().toISOString(),
  });
  if('serviceWorker' in navigator){navigator.serviceWorker.ready.then(reg=>{const sync=(reg as ServiceWorkerRegistration & {sync?:{register:(tag:string)=>Promise<void>}}).sync;return sync?.register('insideout-orders');}).catch(()=>{});}
}
let syncing = false;
export async function syncQueue(s: Snapshot) {
  if (syncing || isDemo() || !navigator.onLine) return;
  syncing = true;
  try {
    const store = await db();
    const items = await pending();
    for (const item of items
      .filter(
        (x) =>
          x.shop_id === s.shop_id &&
          x.actor_id === s.user.id &&
          x.status === "pending",
      )
      .sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      try {
        await execute({ type: "checkout", payload: item.payload });
        await store.delete("outbox", item.id);
      } catch (e) {
        const status=(e as Error & {status?:number}).status;
        if (!navigator.onLine || !status || status>=500 || status===401) break;
        await store.put("outbox", {
          ...item,
          status: "attention",
          error: (e as Error).message,
        });
        break;
      }
    }
  } finally {
    syncing = false;
  }
}
export async function submitCheckout(s:Snapshot,payload:Checkout){
 if(isDemo()){await execute({type:'checkout',payload});return true;}
 await queueCheckout(s,payload);
 await syncQueue(s);
 return !(await pending()).some(x=>x.id===payload.id);
}
export async function retryPending(id: string) {
  const store = await db();
  const item = await store.get("outbox", id);
  if (item)
    await store.put("outbox", { ...item, status: "pending", error: undefined });
}
export async function resolvePending(item:Pending,reason:string){
 await execute({type:'resolve_order',payload:{checkout:item.payload,actor_id:item.actor_id,reason}});
 await (await db()).delete('outbox',item.id);
}
export async function lock() {
  sessionStorage.removeItem("io-user");
  await (await db()).delete("kv", "cache");
  if (!isDemo()) await request("auth/lock", {});
}
