-- Inside Out Manager. Apply to a fresh Supabase project.
create extension if not exists pgcrypto with schema extensions;
create table public.shops (id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now());
create table public.members (
 id uuid primary key references auth.users(id), shop_id uuid not null references public.shops(id),
 name text not null check(length(name) between 1 and 100), role text not null default 'staff' check(role in ('admin','staff')),
 active boolean not null default true, hourly_rate bigint not null default 25000 check(hourly_rate>=0),
 color text not null default '#9cabbc', unique(shop_id,id)
);
create table public.shop_settings (
 shop_id uuid primary key references public.shops(id), name text not null default 'Inside Out', address text not null default '',
 phone text not null default '', receipt_footer text not null default 'Cảm ơn đã chọn Inside Out. Hẹn gặp lại!',
 idle_minutes integer not null default 10 check(idle_minutes between 1 and 120),
 allow_staff_cancel boolean not null default false, theme text not null default 'dark' check(theme in ('dark','light')),
 bonus_percent numeric not null default 1 check(bonus_percent between 0 and 100)
);
create table public.products (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.shops(id), name text not null,
 sku text not null, category text not null, variant text not null, price bigint not null check(price between 0 and 1000000000),
 stock integer not null default 0, active boolean not null default true, color text not null default '#676b63',
 kind text not null default 'tee' check(kind in ('tee','hoodie','pants','bag','cap')), unique(shop_id,sku),unique(shop_id,id)
);
create table public.product_costs (
 product_id uuid primary key references public.products(id),shop_id uuid not null references public.shops(id),
 cost bigint not null check(cost between 0 and 1000000000),foreign key(shop_id,product_id) references public.products(shop_id,id)
);
create table public.shifts (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),user_id uuid not null,
 started_at timestamptz not null default now(),ended_at timestamptz,opening_cash bigint not null check(opening_cash>=0),
 expected_cash bigint,actual_cash bigint check(actual_cash>=0),note text not null default '',
 status text not null default 'open' check(status in ('open','submitted','approved')),
 foreign key(shop_id,user_id) references public.members(shop_id,id),unique(shop_id,id)
);
create unique index one_open_shift on public.shifts(user_id) where status='open';
create table public.orders (
 id uuid primary key,shop_id uuid not null references public.shops(id), number bigint generated always as identity,
 user_id uuid not null,shift_id uuid not null,created_at timestamptz not null default now(),received_at timestamptz not null default now(),
 total bigint not null check(total>=0),cash bigint not null check(cash>=0),transfer bigint not null check(transfer>=0),
 status text not null default 'completed' check(status in ('completed','cancelled')),reason text,
 cancelled_by uuid references auth.users(id),cancelled_at timestamptz,payload_hash text not null,
 check(total=cash+transfer),foreign key(shop_id,user_id) references public.members(shop_id,id),
 foreign key(shop_id,shift_id) references public.shifts(shop_id,id),unique(shop_id,id)
);
create table public.order_items (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,order_id uuid not null,product_id uuid not null,
 name text not null,variant text not null,price bigint not null check(price>=0),quantity integer not null check(quantity between 1 and 999),
 foreign key(shop_id,order_id) references public.orders(shop_id,id),foreign key(shop_id,product_id) references public.products(shop_id,id)
);
create table public.order_costs (
 item_id uuid primary key references public.order_items(id),shop_id uuid not null references public.shops(id),
 cost bigint not null check(cost>=0)
);
create table public.inventory_movements (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null,product_id uuid not null,order_id uuid,
 quantity integer not null,reason text not null,actor_id uuid not null references auth.users(id),created_at timestamptz not null default now(),
 foreign key(shop_id,product_id) references public.products(shop_id,id),foreign key(shop_id,order_id) references public.orders(shop_id,id)
);
create table public.transactions (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),order_id uuid,shift_id uuid,
 method text not null check(method in ('cash','bank_transfer','expense')),amount bigint not null,kind text not null check(kind in ('sale','reversal','expense')),
 created_at timestamptz not null default now(),foreign key(shop_id,order_id) references public.orders(shop_id,id),
 foreign key(shop_id,shift_id) references public.shifts(shop_id,id)
);
create table public.expenses (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),amount bigint not null check(amount>0),
 category text not null,note text not null,created_at timestamptz not null default now(),actor_id uuid not null references auth.users(id)
);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),actor_id uuid references auth.users(id),
 action text not null,detail text not null,created_at timestamptz not null default now()
);
create table public.device_sessions (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),token_hash text unique not null,
 label text not null,enrolled_by uuid not null references auth.users(id),expires_at timestamptz not null,revoked_at timestamptz
);
create table public.staff_pins (
 user_id uuid primary key references auth.users(id),shop_id uuid not null references public.shops(id),hash text not null,
 attempt_count integer not null default 0,window_start timestamptz not null default now(),locked_until timestamptz,
 requires_unlock boolean not null default false,changed_at timestamptz not null default now()
);
create table public.user_preferences (
 user_id uuid primary key references auth.users(id),theme text not null default 'dark' check(theme in ('dark','light'))
);
create index orders_shop_date on public.orders(shop_id,created_at desc);
create index orders_staff_shift on public.orders(shop_id,user_id,shift_id);
create index shifts_shop_status on public.shifts(shop_id,status,started_at desc);
create index movement_shop_product on public.inventory_movements(shop_id,product_id,created_at desc);
create index items_order on public.order_items(order_id);
create index transactions_shift on public.transactions(shop_id,shift_id);
create index expenses_shop_date on public.expenses(shop_id,created_at desc);

create function public.my_shop() returns uuid language sql stable security definer set search_path='' as $$
 select shop_id from public.members where id=auth.uid() and active;
$$;
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select role='admin' from public.members where id=auth.uid() and active),false);
$$;
create function public.own_open_shift(p_shift uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.shifts where id=p_shift and user_id=auth.uid() and shop_id=public.my_shop() and status='open');
$$;
-- No browser DML grants: commands below are the only transactional write interface.
do $$ declare t text; begin
 foreach t in array array['shops','members','shop_settings','products','product_costs','shifts','orders','order_items','order_costs','inventory_movements','transactions','expenses','audit_logs','device_sessions','staff_pins','user_preferences'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
grant select on public.shops,public.members,public.shop_settings,public.products,public.product_costs,public.shifts,public.orders,public.order_items,public.order_costs,public.inventory_movements,public.transactions,public.expenses,public.audit_logs,public.user_preferences to authenticated;
create policy shop_read on public.shops for select to authenticated using(id=public.my_shop());
create policy member_read on public.members for select to authenticated using(shop_id=public.my_shop() and (id=auth.uid() or public.is_admin()));
create policy settings_read on public.shop_settings for select to authenticated using(shop_id=public.my_shop());
create policy product_read on public.products for select to authenticated using(shop_id=public.my_shop());
create policy cost_read on public.product_costs for select to authenticated using(shop_id=public.my_shop() and public.is_admin());
create policy shifts_read on public.shifts for select to authenticated using(shop_id=public.my_shop() and (public.is_admin() or (user_id=auth.uid() and status='open')));
create policy order_read on public.orders for select to authenticated using(shop_id=public.my_shop() and (public.is_admin() or (user_id=auth.uid() and public.own_open_shift(shift_id))));
create policy item_read on public.order_items for select to authenticated using(shop_id=public.my_shop() and exists(select 1 from public.orders o where o.id=order_id));
create policy order_cost_read on public.order_costs for select to authenticated using(shop_id=public.my_shop() and public.is_admin());
create policy movement_read on public.inventory_movements for select to authenticated using(shop_id=public.my_shop() and public.is_admin());
create policy transaction_read on public.transactions for select to authenticated using(shop_id=public.my_shop() and public.is_admin());
create policy expense_read on public.expenses for select to authenticated using(shop_id=public.my_shop() and public.is_admin());
create policy audit_read on public.audit_logs for select to authenticated using(shop_id=public.my_shop() and public.is_admin());
create policy preference_read on public.user_preferences for select to authenticated using(user_id=auth.uid());

-- Invoker mode intentionally preserves RLS when assembling the UI snapshot.
create function public.manager_state() returns jsonb language plpgsql security invoker set search_path='' as $$
declare s uuid:=public.my_shop(); result jsonb;
begin
 if s is null then raise exception 'AUTH_REQUIRED'; end if;
 select jsonb_build_object(
 'shop_id',s,'user',(select to_jsonb(m) from public.members m where id=auth.uid()),
 'members',coalesce((select jsonb_agg(to_jsonb(m)) from public.members m),'[]'::jsonb),
 'products',coalesce((select jsonb_agg(to_jsonb(p)||case when public.is_admin() then jsonb_build_object('cost',c.cost) else '{}'::jsonb end order by p.name) from public.products p left join public.product_costs c on c.product_id=p.id),'[]'::jsonb),
 'orders',coalesce((select jsonb_agg(to_jsonb(o)||jsonb_build_object('number','IO-'||lpad(o.number::text,5,'0'),'payment_method',case when o.card>0 then 'card' when o.transfer>0 then 'bank_transfer' else 'cash' end,'discount',o.discount,'note',o.note,'lines',coalesce((select jsonb_agg(to_jsonb(i)) from public.order_items i where i.order_id=o.id),'[]'::jsonb)) order by o.created_at desc) from public.orders o),'[]'::jsonb),
 'shifts',coalesce((select jsonb_agg(to_jsonb(x) order by started_at desc) from public.shifts x),'[]'::jsonb),
 'expenses',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from public.expenses x),'[]'::jsonb),
 'movements',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from public.inventory_movements x),'[]'::jsonb),
 'audit',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from public.audit_logs x),'[]'::jsonb),
 'settings',(select to_jsonb(x)-'shop_id' from public.shop_settings x where shop_id=s)
 ) into result;
 return result;
end $$;

create function public.manager_command(p_type text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=auth.uid(); s uuid:=public.my_shop(); a boolean:=public.is_admin(); v_id uuid;
 sh public.shifts%rowtype; ord public.orders%rowtype; prod public.products%rowtype;
 l jsonb; q integer; price_value bigint; total_value bigint:=0; cash_value bigint; transfer_value bigint;
 item_id uuid; cost_value bigint; expected bigint; actual bigint; reason_value text; hash_value text;
begin
 if u is null or s is null then raise exception 'AUTH_REQUIRED'; end if;
 if p_type not in ('checkout','cancel','open_shift','close_shift') and not a then raise exception 'FORBIDDEN'; end if;
 if p_type='checkout' then
  v_id:=(p->>'id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(v_id::text,0));
  hash_value:=encode(extensions.digest(p::text,'sha256'),'hex');
  select * into ord from public.orders where id=v_id;
  if found then
   if ord.shop_id<>s or ord.user_id<>u or ord.payload_hash<>hash_value then raise exception 'Mã giao dịch đã được dùng cho dữ liệu khác.'; end if;
   return jsonb_build_object('id',ord.id,'duplicate',true);
  end if;
  select * into sh from public.shifts where id=(p->>'shift_id')::uuid and shop_id=s and user_id=u for update;
  if not found or sh.status<>'open' then raise exception 'Ca làm không còn mở. Liên hệ quản lý để xử lý đơn chờ.'; end if;
  if jsonb_typeof(p->'lines')<>'array' or jsonb_array_length(p->'lines') not between 1 and 100 then raise exception 'Giỏ hàng không hợp lệ.'; end if;
  if (select count(*) from jsonb_array_elements(p->'lines'))<>(select count(distinct x->>'product_id') from jsonb_array_elements(p->'lines') x) then raise exception 'Sản phẩm bị trùng.'; end if;
  -- Lock in stable order to avoid deadlocks across simultaneous carts.
  perform 1 from public.products where shop_id=s and id in(select (x->>'product_id')::uuid from jsonb_array_elements(p->'lines') x) order by id for update;
  for l in select * from jsonb_array_elements(p->'lines') loop
   q:=(l->>'quantity')::integer;price_value:=(l->>'price')::bigint;
   if q is null or q not between 1 and 999 or price_value is null or price_value not between 0 and 1000000000 then raise exception 'Số lượng hoặc giá không hợp lệ.'; end if;
   select * into prod from public.products where id=(l->>'product_id')::uuid and shop_id=s;
   if not found or not prod.active then raise exception 'Sản phẩm không còn được bán.'; end if;
   if not coalesce((p->>'offline')::boolean,false) and (prod.price<>price_value or prod.stock<q) then raise exception 'Giá hoặc tồn kho đã thay đổi. Kiểm tra lại giỏ hàng.'; end if;
   total_value:=total_value+q*price_value;
  end loop;
  cash_value:=(p->>'cash')::bigint;transfer_value:=(p->>'transfer')::bigint;
  if cash_value is null or transfer_value is null or cash_value<0 or transfer_value<0 or cash_value+transfer_value<>total_value then raise exception 'Thanh toán không khớp tổng đơn.'; end if;
  if (p->>'occurred_at')::timestamptz>now()+interval '5 minutes' or (p->>'occurred_at')::timestamptz<sh.started_at-interval '5 minutes' then raise exception 'Thời gian đơn không hợp lệ.'; end if;
  insert into public.orders(id,shop_id,user_id,shift_id,created_at,total,cash,transfer,payload_hash) values(v_id,s,u,sh.id,(p->>'occurred_at')::timestamptz,total_value,cash_value,transfer_value,hash_value);
  for l in select * from jsonb_array_elements(p->'lines') loop
   select * into prod from public.products where id=(l->>'product_id')::uuid and shop_id=s;
   q:=(l->>'quantity')::integer;price_value:=(l->>'price')::bigint;
   insert into public.order_items(shop_id,order_id,product_id,name,variant,price,quantity) values(s,v_id,prod.id,prod.name,prod.variant,price_value,q) returning id into item_id;
   select cost into cost_value from public.product_costs where product_id=prod.id;
   insert into public.order_costs values(item_id,s,coalesce(cost_value,0));
   update public.products set stock=stock-q where id=prod.id;
   insert into public.inventory_movements(shop_id,product_id,order_id,quantity,reason,actor_id) values(s,prod.id,v_id,-q,'Bán hàng',u);
   if prod.stock-q<0 then insert into public.audit_logs(shop_id,actor_id,action,detail) values(s,u,'negative_stock',prod.sku); end if;
  end loop;
  if cash_value>0 then insert into public.transactions(shop_id,order_id,shift_id,method,amount,kind) values(s,v_id,sh.id,'cash',cash_value,'sale'); end if;
  if transfer_value>0 then insert into public.transactions(shop_id,order_id,shift_id,method,amount,kind) values(s,v_id,sh.id,'bank_transfer',transfer_value,'sale'); end if;
 elsif p_type='cancel' then
  select * into ord from public.orders where id=(p->>'id')::uuid and shop_id=s for update;
  if not found then raise exception 'Không tìm thấy đơn.'; end if;
  if not a and (ord.user_id<>u or not public.own_open_shift(ord.shift_id) or not (select allow_staff_cancel from public.shop_settings where shop_id=s)) then raise exception 'Cần quản lý hủy đơn này.'; end if;
  if ord.status='cancelled' then return '{"ok":true,"duplicate":true}'::jsonb; end if;
  reason_value:=trim(p->>'reason');if coalesce(length(reason_value),0)=0 then raise exception 'Nhập lý do hủy.'; end if;
  -- Cash reversals on closed shifts require a separate adjustment workflow.
  select * into sh from public.shifts where id=ord.shift_id for update;
  if sh.status<>'open' then raise exception 'Ca đã đóng. Cần quy trình điều chỉnh tài chính trước khi hủy.'; end if;
  update public.orders set status='cancelled',reason=reason_value,cancelled_by=u,cancelled_at=now() where id=ord.id;
  for l in select to_jsonb(i) from public.order_items i where order_id=ord.id order by product_id loop
   update public.products set stock=stock+(l->>'quantity')::integer where id=(l->>'product_id')::uuid and shop_id=s;
   insert into public.inventory_movements(shop_id,product_id,order_id,quantity,reason,actor_id) values(s,(l->>'product_id')::uuid,ord.id,(l->>'quantity')::integer,reason_value,u);
  end loop;
  insert into public.transactions(shop_id,order_id,shift_id,method,amount,kind) select shop_id,order_id,shift_id,method,-amount,'reversal' from public.transactions where order_id=ord.id and kind='sale';
 elsif p_type='open_shift' then
  cash_value:=(p->>'opening_cash')::bigint;
  if cash_value is null or cash_value<0 then raise exception 'Tiền đầu ca không hợp lệ.'; end if;
  insert into public.shifts(shop_id,user_id,opening_cash) values(s,u,cash_value) returning id into v_id;
 elsif p_type='close_shift' then
  select * into sh from public.shifts where id=(p->>'id')::uuid and shop_id=s and user_id=u and status='open' for update;
  if not found then raise exception 'Không có ca đang mở.'; end if;
  select sh.opening_cash+coalesce(sum(amount),0) into expected from public.transactions where shift_id=sh.id and method='cash';
  actual:=(p->>'actual_cash')::bigint;reason_value:=coalesce(trim(p->>'note'),'');
  if actual is null or actual<0 then raise exception 'Tiền thực tế không hợp lệ.'; end if;
  if actual<>expected and reason_value='' then raise exception 'Nhập lý do chênh lệch.'; end if;
  update public.shifts set expected_cash=expected,actual_cash=actual,note=reason_value,ended_at=now(),status='submitted' where id=sh.id;
 elsif p_type='approve_shift' then
  update public.shifts set status='approved' where id=(p->>'id')::uuid and shop_id=s and status='submitted';
  if not found then raise exception 'Ca chưa được gửi duyệt.'; end if;
 elsif p_type='product' then
  v_id:=coalesce((p->>'id')::uuid,gen_random_uuid());
  if exists(select 1 from public.products where id=v_id and shop_id<>s) then raise exception 'FORBIDDEN'; end if;
  insert into public.products(id,shop_id,name,sku,category,variant,price,stock,active,color,kind)
  values(v_id,s,p->>'name',p->>'sku',p->>'category',p->>'variant',(p->>'price')::bigint,(p->>'stock')::integer,coalesce((p->>'active')::boolean,true),p->>'color',p->>'kind')
  on conflict(id) do update set name=excluded.name,sku=excluded.sku,category=excluded.category,variant=excluded.variant,price=excluded.price,active=excluded.active,color=excluded.color,kind=excluded.kind;
  insert into public.product_costs(product_id,shop_id,cost) values(v_id,s,(p->>'cost')::bigint) on conflict(product_id) do update set cost=excluded.cost;
 elsif p_type='stock' then
  q:=(p->>'quantity')::integer;reason_value:=trim(p->>'reason');
  if q is null or q=0 or coalesce(length(reason_value),0)=0 then raise exception 'Nhập số lượng và lý do.'; end if;
  update public.products set stock=stock+q where id=(p->>'id')::uuid and shop_id=s;
  if not found then raise exception 'Không tìm thấy sản phẩm.'; end if;
  insert into public.inventory_movements(shop_id,product_id,quantity,reason,actor_id) values(s,(p->>'id')::uuid,q,reason_value,u);
 elsif p_type='expense' then
  if coalesce(length(trim(p->>'note')),0)=0 then raise exception 'Nhập nội dung chi phí.'; end if;
  insert into public.expenses(shop_id,amount,category,note,actor_id) values(s,(p->>'amount')::bigint,p->>'category',p->>'note',u);
  insert into public.transactions(shop_id,method,amount,kind) values(s,'expense',-(p->>'amount')::bigint,'expense');
 elsif p_type='member' then
  if (p->>'id')::uuid=u and ((p->>'role')<>'admin' or (p->>'active')::boolean=false) then raise exception 'Không thể tự khóa hoặc hạ quyền.'; end if;
  update public.members set name=p->>'name',role=p->>'role',hourly_rate=(p->>'hourly_rate')::bigint,active=coalesce((p->>'active')::boolean,true) where id=(p->>'id')::uuid and shop_id=s;
  if not found then raise exception 'Không tìm thấy nhân viên.'; end if;
 elsif p_type='settings' then
  update public.shop_settings set name=p->>'name',address=p->>'address',phone=p->>'phone',receipt_footer=p->>'receipt_footer',idle_minutes=(p->>'idle_minutes')::integer,allow_staff_cancel=(p->>'allow_staff_cancel')::boolean,theme=p->>'theme',bonus_percent=(p->>'bonus_percent')::numeric where shop_id=s;
 else raise exception 'Thao tác không được hỗ trợ.';
 end if;
 insert into public.audit_logs(shop_id,actor_id,action,detail) values(s,u,p_type,coalesce(v_id::text,p->>'id',p->>'note',p->>'name',''));
 return jsonb_build_object('ok',true,'id',v_id);
end $$;

-- Only the trusted server may call PIN verification; counters persist on failure.
create function public.verify_profile_pin(p_shop uuid,p_user uuid,p_pin text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.staff_pins%rowtype;
begin
 select * into r from public.staff_pins where user_id=p_user and shop_id=p_shop for update;
 if not found or not exists(select 1 from public.members where id=p_user and shop_id=p_shop and active) then return '{"ok":false,"message":"PIN chưa đúng hoặc hồ sơ không hoạt động."}'::jsonb; end if;
 if r.requires_unlock then return '{"ok":false,"message":"Hồ sơ đã khóa. Quản lý cần mở khóa bằng mật khẩu."}'::jsonb; end if;
 if r.window_start<now()-interval '10 minutes' then r.attempt_count:=0;r.window_start:=now();end if;
 -- pgcrypto accepts the 2a bcrypt identifier; numeric PINs have identical 2a/2b semantics.
 if p_pin !~ '^[0-9]{4,6}$' or extensions.crypt(p_pin,replace(r.hash,'$2b$','$2a$'))<>replace(r.hash,'$2b$','$2a$') then
  r.attempt_count:=r.attempt_count+1;
  update public.staff_pins set attempt_count=r.attempt_count,window_start=r.window_start,locked_until=case when r.attempt_count>=5 then now()+interval '15 minutes' end,requires_unlock=r.attempt_count>=5 where user_id=p_user;
  return '{"ok":false,"message":"PIN chưa đúng hoặc hồ sơ đã bị khóa."}'::jsonb;
 end if;
 update public.staff_pins set attempt_count=0,window_start=now() where user_id=p_user;
 insert into public.audit_logs(shop_id,actor_id,action,detail) values(p_shop,p_user,'pin_login','Đăng nhập hồ sơ');
 return '{"ok":true}'::jsonb;
end $$;
revoke all on function public.verify_profile_pin(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.verify_profile_pin(uuid,uuid,text) to service_role;
revoke all on function public.manager_state(),public.manager_command(text,jsonb),public.my_shop(),public.is_admin(),public.own_open_shift(uuid) from public,anon;
grant execute on function public.manager_state(),public.manager_command(text,jsonb),public.my_shop(),public.is_admin(),public.own_open_shift(uuid) to authenticated;
