-- Reconciliation for real customer sales preserved in the offline outbox.
create function public.resolve_offline_order(p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s uuid:=public.my_shop();u uuid:=auth.uid();c jsonb:=p->'checkout';seller uuid:=(p->>'actor_id')::uuid;
 sh public.shifts%rowtype;ord public.orders%rowtype;prod public.products%rowtype;l jsonb;quantity_value integer;price_value bigint;
 total_value bigint:=0;cash_value bigint;transfer_value bigint;item_id uuid;v_id uuid;hash_value text;reason_value text;
begin
 if not public.is_admin() or s is null then raise exception 'FORBIDDEN';end if;
 reason_value:=trim(coalesce(p->>'reason',''));if length(reason_value)<3 then raise exception 'Nhập lý do đối soát.';end if;
 v_id:=(c->>'id')::uuid;if v_id is null or seller is null then raise exception 'Đơn chờ không hợp lệ.';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_id::text,0));perform pg_advisory_xact_lock(hashtextextended(s::text,2));
 hash_value:=encode(extensions.digest(c::text,'sha256'),'hex');
 select * into ord from public.orders where id=v_id;
 if found then if ord.shop_id<>s or ord.user_id<>seller or ord.payload_hash<>hash_value then raise exception 'Mã đơn trùng dữ liệu khác.';end if;return jsonb_build_object('id',ord.id,'duplicate',true);end if;
 if not exists(select 1 from public.members where id=seller and shop_id=s) then raise exception 'Nhân viên không thuộc cửa hàng.';end if;
 select * into sh from public.shifts where id=(c->>'shift_id')::uuid and shop_id=s and user_id=seller for update;
 if not found then raise exception 'Ca gốc không thuộc nhân viên này.';end if;
 if jsonb_typeof(c->'lines')<>'array' or jsonb_array_length(c->'lines') not between 1 and 100 then raise exception 'Giỏ hàng không hợp lệ.';end if;
 if (select count(*) from jsonb_array_elements(c->'lines'))<>(select count(distinct x->>'product_id') from jsonb_array_elements(c->'lines') x) then raise exception 'Sản phẩm bị trùng.';end if;
 perform 1 from public.products where shop_id=s and id in(select (x->>'product_id')::uuid from jsonb_array_elements(c->'lines') x) order by id for update;
 for l in select * from jsonb_array_elements(c->'lines') loop
  quantity_value:=(l->>'quantity')::integer;price_value:=(l->>'price')::bigint;
  if quantity_value is null or quantity_value not between 1 and 999 or price_value is null or price_value not between 0 and 1000000000 then raise exception 'Số lượng hoặc giá không hợp lệ.';end if;
  if not exists(select 1 from public.products where id=(l->>'product_id')::uuid and shop_id=s) then raise exception 'Sản phẩm không thuộc cửa hàng.';end if;
  total_value:=total_value+quantity_value*price_value;
 end loop;
 cash_value:=(c->>'cash')::bigint;transfer_value:=(c->>'transfer')::bigint;
 if cash_value is null or transfer_value is null or cash_value<0 or transfer_value<0 or cash_value+transfer_value<>total_value then raise exception 'Tiền thanh toán không khớp.';end if;
 if (c->>'occurred_at')::timestamptz is null or (c->>'occurred_at')::timestamptz>now()+interval '5 minutes' then raise exception 'Thời gian không hợp lệ.';end if;
 insert into public.orders(id,shop_id,user_id,shift_id,created_at,total,cash,transfer,payload_hash) values(v_id,s,seller,sh.id,(c->>'occurred_at')::timestamptz,total_value,cash_value,transfer_value,hash_value);
 for l in select * from jsonb_array_elements(c->'lines') loop
  select * into prod from public.products where id=(l->>'product_id')::uuid and shop_id=s;
  quantity_value:=(l->>'quantity')::integer;price_value:=(l->>'price')::bigint;
  insert into public.order_items(shop_id,order_id,product_id,name,variant,price,quantity) values(s,v_id,prod.id,prod.name,prod.variant,price_value,quantity_value) returning id into item_id;
  insert into public.order_costs values(item_id,s,coalesce((select cost from public.product_costs where product_id=prod.id),0));
  update public.products set stock=stock-quantity_value where id=prod.id;
  insert into public.inventory_movements(shop_id,product_id,order_id,quantity,reason,actor_id) values(s,prod.id,v_id,-quantity_value,'Đối soát đơn ngoại tuyến: '||reason_value,u);
 end loop;
 if cash_value>0 then insert into public.transactions(shop_id,order_id,shift_id,method,amount,kind) values(s,v_id,sh.id,'cash',cash_value,'sale');end if;
 if transfer_value>0 then insert into public.transactions(shop_id,order_id,shift_id,method,amount,kind) values(s,v_id,sh.id,'bank_transfer',transfer_value,'sale');end if;
 if sh.status<>'open' then update public.shifts set expected_cash=coalesce(expected_cash,opening_cash)+cash_value,status='submitted',note=note||E'\nĐơn ngoại tuyến bổ sung: '||v_id where id=sh.id;end if;
 insert into public.order_resolutions(order_id,shop_id,actor_id,action,reason) values(v_id,s,u,'accept',reason_value);
 insert into public.audit_logs(shop_id,actor_id,action,detail) values(s,u,'resolve_order',v_id||' '||reason_value);
 return jsonb_build_object('ok',true,'id',v_id);
end $$;
revoke all on function public.resolve_offline_order(jsonb) from public,anon,authenticated;
-- Provision member + PIN atomically; Auth identity creation is compensated by the server on error.
create function public.provision_member(p_shop uuid,p_actor uuid,p_user uuid,p_name text,p_role text,p_rate bigint,p_hash text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.members where id=p_actor and shop_id=p_shop and role='admin' and active) then raise exception 'FORBIDDEN';end if;
 insert into public.members(id,shop_id,name,role,hourly_rate) values(p_user,p_shop,p_name,p_role,p_rate);
 insert into public.staff_pins(user_id,shop_id,hash) values(p_user,p_shop,p_hash);
 insert into public.audit_logs(shop_id,actor_id,action,detail) values(p_shop,p_actor,'member_create',p_user::text);
end $$;
revoke all on function public.provision_member(uuid,uuid,uuid,text,text,bigint,text) from public,anon,authenticated;
grant execute on function public.provision_member(uuid,uuid,uuid,text,text,bigint,text) to service_role;

-- Storage is present on Supabase; omitted in standalone PostgreSQL test environments.
do $$ begin
 if to_regclass('storage.buckets') is not null then
  insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('shop-images','shop-images',true,5242880,array['image/webp','image/png','image/jpeg']) on conflict(id) do nothing;
 end if;
end $$;

