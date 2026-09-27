ALTER TABLE public.orders ADD COLUMN card bigint NOT NULL DEFAULT 0 CHECK (card >= 0);
ALTER TABLE public.orders ADD COLUMN discount bigint NOT NULL DEFAULT 0 CHECK (discount >= 0);
ALTER TABLE public.orders ADD COLUMN note text NOT NULL DEFAULT '';
ALTER TABLE public.orders DROP CONSTRAINT orders_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_check CHECK(total = cash + transfer + card);
ALTER TABLE public.transactions DROP CONSTRAINT transactions_method_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_method_check CHECK (method in ('cash','bank_transfer','card','expense'));

CREATE OR REPLACE FUNCTION public.manager_command_v1(p_type text, p jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
 declare
  u uuid:=auth.uid(); s uuid:=public.my_shop(); a boolean:=public.is_admin();
  v_id uuid; sh public.shifts%rowtype; ord public.orders%rowtype; prod public.products%rowtype; l jsonb; q integer;
  price_value bigint; total_value bigint:=0;
  cash_value bigint; transfer_value bigint; card_value bigint; discount_value bigint; note_value text;
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
   if not a then
     select * into sh from public.shifts where id=(p->>'shift_id')::uuid and shop_id=s and user_id=u for update;
     if not found or sh.status<>'open' then raise exception 'Ca làm không còn mở. Liên hệ quản lý để xử lý đơn chờ.'; end if;
   else
     select * into sh from public.shifts where id=(p->>'shift_id')::uuid and shop_id=s and user_id=u for update;
   end if;
   if jsonb_typeof(p->'lines')<>'array' or jsonb_array_length(p->'lines') not between 1 and 100 then raise exception 'Giỏ hàng không hợp lệ.'; end if;
   if (select count(*) from jsonb_array_elements(p->'lines'))<>(select count(distinct x->>'product_id') from jsonb_array_elements(p->'lines') x) then raise exception 'Sản phẩm bị trùng.'; end if;
   perform 1 from public.products where shop_id=s and id in(select (x->>'product_id')::uuid from jsonb_array_elements(p->'lines') x) order by id for update;
   for l in select * from jsonb_array_elements(p->'lines') loop
    q:=(l->>'quantity')::integer;price_value:=(l->>'price')::bigint;
    if q is null or q not between 1 and 999 or price_value is null or price_value not between 0 and 1000000000 then raise exception 'Số lượng hoặc giá không hợp lệ.'; end if;
    select * into prod from public.products where id=(l->>'product_id')::uuid and shop_id=s;
    if not found or not prod.active then raise exception 'Sản phẩm không còn được bán.'; end if;
    if not coalesce((p->>'offline')::boolean,false) and (prod.price<>price_value or prod.stock<q) then raise exception 'Giá hoặc tồn kho đã thay đổi. Kiểm tra lại giỏ hàng.'; end if;
    total_value:=total_value+q*price_value;
   end loop;
   cash_value:=(p->>'cash')::bigint;
   transfer_value:=(p->>'transfer')::bigint;
   card_value:=coalesce((p->>'card')::bigint, 0);
   discount_value:=coalesce((p->>'discount')::bigint, 0);
   note_value:=coalesce(p->>'note', '');
   
   total_value := GREATEST(0::bigint, total_value - discount_value);
   if cash_value is null or transfer_value is null or cash_value<0 or transfer_value<0 or card_value<0 or discount_value<0 or cash_value+transfer_value+card_value<>total_value then
    raise exception 'Thanh toán không khớp tổng đơn.';
   end if;
   if (p->>'occurred_at')::timestamptz>now()+interval '5 minutes' or (sh.id is not null and (p->>'occurred_at')::timestamptz<sh.started_at-interval '5 minutes') then raise exception 'Thời gian đơn không hợp lệ.'; end if;
   
   insert into public.orders(id,shop_id,user_id,shift_id,created_at,total,cash,transfer,card,discount,note,payload_hash)
   values(v_id,s,u,sh.id,(p->>'occurred_at')::timestamptz,total_value,cash_value,transfer_value,card_value,discount_value,note_value,hash_value);
   
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
   if card_value>0 then insert into public.transactions(shop_id,order_id,shift_id,method,amount,kind) values(s,v_id,sh.id,'card',card_value,'sale'); end if;
   
  elsif p_type='cancel' then
   select * into ord from public.orders where id=(p->>'id')::uuid and shop_id=s for update;
   if not found then raise exception 'Không tìm thấy đơn.'; end if;
   if not a and (ord.user_id<>u or not public.own_open_shift(ord.shift_id) or not (select allow_staff_cancel from public.shop_settings where shop_id=s)) then raise exception 'Cần quản lý hủy đơn này.'; end if;
   if ord.status='cancelled' then return '{"ok":true,"duplicate":true}'::jsonb; end if;
   reason_value:=trim(p->>'reason');if coalesce(length(reason_value),0)=0 then raise exception 'Nhập lý do hủy.'; end if;
   if ord.shift_id is not null then
     select * into sh from public.shifts where id=ord.shift_id for update;
     if sh.status<>'open' then raise exception 'Ca đã đóng. Cần quy trình điều chỉnh tài chính trước khi hủy.'; end if;
   end if;
   update public.orders set status='cancelled',reason=reason_value,cancelled_by=u,cancelled_at=now() where id=ord.id;
   for l in select to_jsonb(i) from public.order_items i where order_id=ord.id order by product_id loop
    update public.products set stock=stock+(l->>'quantity')::integer where id=(l->>'product_id')::uuid and shop_id=s;
    insert into public.inventory_movements(shop_id,product_id,order_id,quantity,reason,actor_id) values(s,(l->>'product_id')::uuid,ord.id,(l->>'quantity')::integer,reason_value,u);
   end loop;
   insert into public.transactions(shop_id,order_id,shift_id,method,amount,kind)
   select shop_id,order_id,shift_id,method,-amount,'reversal' from public.transactions where order_id=ord.id and kind='sale';
  
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
   update public.members set name=p->>'name',role=p->>'role',hourly_rate=(p->>'hourly_rate')::bigint,active=coalesce((p->>'active')::boolean,true)
   where id=(p->>'id')::uuid and shop_id=s;
   if not found then raise exception 'Không tìm thấy nhân viên.'; end if;
  
  elsif p_type='settings' then
   update public.shop_settings set name=p->>'name',address=p->>'address',phone=p->>'phone',receipt_footer=p->>'receipt_footer',idle_minutes=(p->>'idle_minutes')::integer,allow_staff_cancel=(p->>'allow_staff_cancel')::boolean,theme=p->>'theme',bonus_percent=(p->>'bonus_percent')::numeric
   where shop_id=s;
  
  else
   raise exception 'Thao tác không được hỗ trợ.';
  end if;
  
  insert into public.audit_logs(shop_id,actor_id,action,detail) values(s,u,p_type,coalesce(v_id::text,p->>'id',p->>'note',p->>'name',''));
  return jsonb_build_object('ok',true,'id',v_id);
 end $function$;
