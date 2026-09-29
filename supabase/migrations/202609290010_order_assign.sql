alter function public.manager_command(text,jsonb) rename to manager_command_v2;
revoke all on function public.manager_command_v2(text,jsonb) from public,anon,authenticated;

create function public.manager_command(p_type text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s uuid:=public.my_shop();u uuid:=auth.uid();a boolean:=public.is_admin();v_id uuid;
begin
 if s is null or u is null then raise exception 'AUTH_REQUIRED';end if;
 if p_type='order_assign' then
  if not a then raise exception 'FORBIDDEN';end if;
  v_id:=(p->>'id')::uuid;
  update public.orders set user_id=(p->>'user_id')::uuid where id=v_id and shop_id=s;
  if not found then raise exception 'Không tìm thấy đơn hàng.';end if;
  insert into public.audit_logs(shop_id,actor_id,action,detail) values(s,u,p_type,v_id::text||' -> '||(p->>'user_id'));
  return jsonb_build_object('ok',true,'id',v_id);
 else
  return public.manager_command_v2(p_type,p);
 end if;
end $$;

grant execute on function public.manager_command(text,jsonb) to authenticated;
