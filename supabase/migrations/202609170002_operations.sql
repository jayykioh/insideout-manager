-- Operations, historical reporting and immutable payroll snapshots.
alter table public.products add column image_url text;
alter table public.members add column avatar_url text;
create table public.pay_rules (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),user_id uuid not null,
 effective_at timestamptz not null,hourly_rate bigint not null check(hourly_rate>=0),
 bonus_percent numeric not null check(bonus_percent between 0 and 100),
 foreign key(shop_id,user_id) references public.members(shop_id,id),unique(user_id,effective_at)
);
create table public.payroll_periods (
 id uuid primary key default gen_random_uuid(),shop_id uuid not null references public.shops(id),start_date date not null,end_date date not null,
 status text not null default 'approved' check(status in('approved','paid')),approved_at timestamptz not null default now(),
 approved_by uuid not null references auth.users(id),paid_at timestamptz,lines jsonb not null,
 check(end_date>=start_date and end_date-start_date<=365)
);
create table public.order_resolutions (
 order_id uuid primary key,shop_id uuid not null references public.shops(id),actor_id uuid not null references auth.users(id),
 action text not null,reason text not null,created_at timestamptz not null default now()
);
alter table public.pay_rules enable row level security;
alter table public.payroll_periods enable row level security;
alter table public.order_resolutions enable row level security;
revoke all on public.pay_rules,public.payroll_periods,public.order_resolutions from anon,authenticated;
grant select on public.pay_rules,public.payroll_periods,public.order_resolutions to authenticated;
create policy pay_rules_admin on public.pay_rules for select to authenticated using(shop_id=public.my_shop() and public.is_admin());
create policy payroll_admin on public.payroll_periods for select to authenticated using(shop_id=public.my_shop() and public.is_admin());
create policy resolution_admin on public.order_resolutions for select to authenticated using(shop_id=public.my_shop() and public.is_admin());
insert into public.pay_rules(shop_id,user_id,effective_at,hourly_rate,bonus_percent)
select m.shop_id,m.id,'2000-01-01',m.hourly_rate,coalesce(s.bonus_percent,1) from public.members m left join public.shop_settings s on s.shop_id=m.shop_id;
create function public.record_pay_rule() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' or new.hourly_rate is distinct from old.hourly_rate then
 insert into public.pay_rules(shop_id,user_id,effective_at,hourly_rate,bonus_percent)
 values(new.shop_id,new.id,case when TG_OP='INSERT' then '2000-01-01'::timestamptz else clock_timestamp() end,new.hourly_rate,coalesce((select bonus_percent from public.shop_settings where shop_id=new.shop_id),1));
 end if;return new;
end $$;
create trigger record_pay_rule after insert or update of hourly_rate on public.members for each row execute function public.record_pay_rule();

alter function public.manager_command(text,jsonb) rename to manager_command_v1;
revoke all on function public.manager_command_v1(text,jsonb) from public,anon,authenticated;
alter function public.manager_state() rename to manager_state_v1;
create function public.manager_state() returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb; enriched jsonb;
begin
 result:=public.manager_state_v1();
 if public.is_admin() then
  select coalesce(jsonb_agg(o||jsonb_build_object('cost_total',coalesce((select sum(c.cost*i.quantity) from public.order_items i join public.order_costs c on c.item_id=i.id where i.order_id=(o->>'id')::uuid),0))),'[]'::jsonb) into enriched from jsonb_array_elements(result->'orders') o;
  result:=jsonb_set(result,'{orders}',enriched)||jsonb_build_object(
   'pay_rules',coalesce((select jsonb_agg(to_jsonb(r) order by effective_at) from public.pay_rules r),'[]'::jsonb),
   'payroll_periods',coalesce((select jsonb_agg(to_jsonb(r) order by start_date desc) from public.payroll_periods r),'[]'::jsonb));
 end if;
 return result;
end $$;
create function public.payroll_preview(p_start date,p_end date) returns jsonb language plpgsql security definer set search_path='' as $$
declare s uuid:=public.my_shop();m record;r record;from_time timestamptz;to_time timestamptz;lo timestamptz;hi timestamptz;
 seconds numeric;base_value numeric;sales_value bigint;bonus_value numeric;segment_seconds numeric;segment_sales bigint;lines jsonb:='[]'::jsonb;
begin
 if not public.is_admin() or s is null then raise exception 'FORBIDDEN';end if;
 if p_start is null or p_end is null or p_end<p_start or p_end-p_start>365 then raise exception 'Kỳ lương không hợp lệ.';end if;
 from_time:=p_start::timestamp at time zone 'Asia/Ho_Chi_Minh';to_time:=(p_end+1)::timestamp at time zone 'Asia/Ho_Chi_Minh';
 for m in select * from public.members where shop_id=s order by name loop
  seconds:=0;base_value:=0;sales_value:=0;bonus_value:=0;
  for r in select *,lead(effective_at,1,'infinity'::timestamptz) over(order by effective_at) next_at from public.pay_rules where user_id=m.id order by effective_at loop
   lo:=greatest(from_time,r.effective_at);hi:=least(to_time,r.next_at);
   if hi<=lo then continue;end if;
   select coalesce(sum(greatest(0,extract(epoch from least(ended_at,hi)-greatest(started_at,lo)))),0) into segment_seconds from public.shifts where user_id=m.id and shop_id=s and ended_at is not null and started_at<hi and ended_at>lo;
   select coalesce(sum(total),0) into segment_sales from public.orders where user_id=m.id and shop_id=s and status='completed' and created_at>=lo and created_at<hi;
   seconds:=seconds+segment_seconds;base_value:=base_value+segment_seconds/3600*r.hourly_rate;sales_value:=sales_value+segment_sales;bonus_value:=bonus_value+segment_sales*r.bonus_percent/100;
  end loop;
  lines:=lines||jsonb_build_array(jsonb_build_object('user_id',m.id,'name',m.name,'minutes',seconds/60,'base',round(base_value),'sales',sales_value,'bonus',round(bonus_value),'adjustment',0,'note','','total',round(base_value)+round(bonus_value)));
 end loop;
 return lines;
end $$;

create function public.manager_command(p_type text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s uuid:=public.my_shop();u uuid:=auth.uid();a boolean:=public.is_admin();r record;sh public.shifts%rowtype;result jsonb;
 start_day date;end_day date;from_time timestamptz;to_time timestamptz;lines jsonb;line jsonb;adjusted jsonb:='[]'::jsonb;
 adj bigint;note text;new_start timestamptz;new_end timestamptz;v_id uuid;reason_value text;existed boolean;price bigint;effective timestamptz;
begin
 if s is null or u is null then raise exception 'AUTH_REQUIRED';end if;
 if p_type='preference' then
  if p->>'theme' not in('dark','light') then raise exception 'Giao diện không hợp lệ.';end if;
  insert into public.user_preferences(user_id,theme) values(u,p->>'theme') on conflict(user_id) do update set theme=excluded.theme;return '{"ok":true}'::jsonb;
 end if;
 if p_type='checkout' then
  -- Never trust an arbitrary client price just because the device says it was offline.
  -- Existing idempotency receipts must be returned even after catalog prices change.
  if not exists(select 1 from public.orders where id=(p->>'id')::uuid and shop_id=s and user_id=u) then
   for line in select * from jsonb_array_elements(p->'lines') loop
    select pr.price into price from public.products pr where id=(line->>'product_id')::uuid and shop_id=s;
    if price is null or price<>(line->>'price')::bigint then raise exception 'Giá đã thay đổi. Quản lý cần đối soát đơn chờ.';end if;
   end loop;
  end if;
  return public.manager_command_v1(p_type,p);
 end if;
 if p_type in('pay_rule','payroll_approve','payroll_paid','attendance_correct','member','member_status','settings','resolve_order','cancel','open_shift','close_shift') then
  perform pg_advisory_xact_lock(hashtextextended(s::text,2));
 end if;
 if p_type not in('open_shift','close_shift','cancel') and not a then raise exception 'FORBIDDEN';end if;
 reason_value:=trim(coalesce(p->>'reason',''));
 if p_type='resolve_order' then
  return public.resolve_offline_order(p);
 elsif p_type='pay_rule' then
  effective:=(p->>'effective_at')::timestamptz;
  if effective is null or exists(select 1 from public.payroll_periods where shop_id=s and effective<((end_date+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')) then raise exception 'Không sửa quy tắc trước khi kỳ đã duyệt kết thúc.';end if;
  insert into public.pay_rules(shop_id,user_id,effective_at,hourly_rate,bonus_percent) values(s,(p->>'user_id')::uuid,effective,(p->>'hourly_rate')::bigint,(p->>'bonus_percent')::numeric);
 elsif p_type='payroll_approve' then
  start_day:=(p->>'start_date')::date;end_day:=(p->>'end_date')::date;
  from_time:=start_day::timestamp at time zone 'Asia/Ho_Chi_Minh';to_time:=(end_day+1)::timestamp at time zone 'Asia/Ho_Chi_Minh';
  if exists(select 1 from public.payroll_periods where shop_id=s and start_date<=end_day and end_date>=start_day) then raise exception 'Kỳ lương trùng với kỳ đã phê duyệt.';end if;
  if exists(select 1 from public.shifts where shop_id=s and ended_at is null and started_at<to_time) then raise exception 'Đóng tất cả ca trong kỳ trước khi duyệt lương.';end if;
  lines:=public.payroll_preview(start_day,end_day);
  for line in select * from jsonb_array_elements(lines) loop
   adj:=coalesce((p->'adjustments'->(line->>'user_id')->>'amount')::bigint,0);note:=coalesce(p->'adjustments'->(line->>'user_id')->>'note','');
   if abs(adj)>1000000000 or (adj<>0 and trim(note)='') or (line->>'total')::bigint+adj<0 then raise exception 'Khoản điều chỉnh không hợp lệ hoặc thiếu lý do.';end if;
   adjusted:=adjusted||jsonb_build_array(line||jsonb_build_object('adjustment',adj,'note',note,'total',(line->>'total')::bigint+adj));
  end loop;
  insert into public.payroll_periods(shop_id,start_date,end_date,approved_by,lines) values(s,start_day,end_day,u,adjusted) returning id into v_id;
 elsif p_type='payroll_paid' then
  update public.payroll_periods set status='paid',paid_at=coalesce(paid_at,now()) where id=(p->>'id')::uuid and shop_id=s returning id into v_id;
  if not found then raise exception 'Không tìm thấy kỳ lương.';end if;
 elsif p_type='attendance_correct' then
  select * into sh from public.shifts where id=(p->>'id')::uuid and shop_id=s for update;
  new_start:=(p->>'started_at')::timestamptz;new_end:=(p->>'ended_at')::timestamptz;
  if sh.id is null or sh.ended_at is null or reason_value='' or new_start is null or new_end is null or new_end<=new_start or new_end>now()+interval '5 minutes' then raise exception 'Giờ chấm công hoặc lý do không hợp lệ.';end if;
  if exists(select 1 from public.payroll_periods where shop_id=s and greatest(sh.ended_at,new_end)>(start_date::timestamp at time zone 'Asia/Ho_Chi_Minh') and least(sh.started_at,new_start)<((end_date+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')) then raise exception 'Ca liên quan tới kỳ lương đã duyệt.';end if;
  if exists(select 1 from public.shifts where user_id=sh.user_id and id<>sh.id and started_at<new_end and coalesce(ended_at,'infinity')>new_start) then raise exception 'Giờ làm bị trùng ca khác.';end if;
  update public.shifts set started_at=new_start,ended_at=new_end where id=sh.id;
  reason_value:=jsonb_build_object('reason',reason_value,'before',to_jsonb(sh),'after_start',new_start,'after_end',new_end)::text;
 elsif p_type='member_status' then
  if (p->>'id')::uuid=u then raise exception 'Không thể tự vô hiệu hóa tài khoản.';end if;
  update public.members set active=(p->>'active')::boolean where id=(p->>'id')::uuid and shop_id=s;
  if not found then raise exception 'Không tìm thấy nhân viên.';end if;
 elsif p_type='device_revoke' then
  update public.device_sessions set revoked_at=now() where id=(p->>'id')::uuid and shop_id=s;
  if not found then raise exception 'Không tìm thấy thiết bị.';end if;
 elsif p_type='asset' then
  if p->>'url' !~ '^https://' then raise exception 'URL ảnh không hợp lệ.';end if;
  if p->>'kind'='product' then update public.products set image_url=p->>'url' where id=(p->>'id')::uuid and shop_id=s;
  elsif p->>'kind'='avatar' then update public.members set avatar_url=p->>'url' where id=(p->>'id')::uuid and shop_id=s;
  else raise exception 'Loại ảnh không hợp lệ.';end if;
  if not found then raise exception 'Không tìm thấy đối tượng.';end if;
 elsif p_type='product' then
  existed:=exists(select 1 from public.products where id=(p->>'id')::uuid);
  result:=public.manager_command_v1(p_type,p);
  if not existed and (p->>'stock')::integer<>0 then insert into public.inventory_movements(shop_id,product_id,quantity,reason,actor_id) values(s,(result->>'id')::uuid,(p->>'stock')::integer,'Tồn kho ban đầu',u);end if;
  return result;
 elsif p_type='settings' then
  select bonus_percent<>(p->>'bonus_percent')::numeric into existed from public.shop_settings where shop_id=s;
  result:=public.manager_command_v1(p_type,p);
  if existed then
   insert into public.pay_rules(shop_id,user_id,effective_at,hourly_rate,bonus_percent)
   select s,m.id,clock_timestamp(),coalesce((select hourly_rate from public.pay_rules where user_id=m.id and effective_at<=now() order by effective_at desc limit 1),m.hourly_rate),(p->>'bonus_percent')::numeric from public.members m where m.shop_id=s;
  end if;return result;
 elsif p_type='cancel' then
  select * into r from public.orders where id=(p->>'id')::uuid and shop_id=s;
  if exists(select 1 from public.payroll_periods where shop_id=s and r.created_at>=(start_date::timestamp at time zone 'Asia/Ho_Chi_Minh') and r.created_at<((end_date+1)::timestamp at time zone 'Asia/Ho_Chi_Minh')) then raise exception 'Đơn thuộc kỳ lương đã duyệt. Ghi nhận hoàn tiền ở kỳ hiện tại.';end if;
  return public.manager_command_v1(p_type,p);
 else return public.manager_command_v1(p_type,p);
 end if;
 insert into public.audit_logs(shop_id,actor_id,action,detail) values(s,u,p_type,coalesce(v_id::text,p->>'id',p->>'user_id','')||' '||reason_value);
 return jsonb_build_object('ok',true,'id',v_id);
end $$;
revoke all on function public.manager_command(text,jsonb),public.manager_state(),public.payroll_preview(date,date),public.record_pay_rule() from public,anon;
grant execute on function public.manager_command(text,jsonb),public.manager_state(),public.payroll_preview(date,date) to authenticated;
