-- Run as project owner after replacing the UUID with the initial Supabase Auth admin.
-- This intentionally contains no default passwords or PINs.
begin;
do $$
declare
 admin_id uuid := 'bfbe8b62-3c30-4292-9341-d9d7948ccaa9';
 shop uuid;
begin
 if not exists(select 1 from auth.users where id=admin_id) then raise exception 'Create the admin in Supabase Auth first'; end if;
 if exists(select 1 from public.members where id=admin_id) then raise exception 'Admin already belongs to a shop'; end if;
 insert into public.shops(name) values('Inside Out') returning id into shop;
 insert into public.members(id,shop_id,name,role) values(admin_id,shop,'Quản lý','admin');
 insert into public.shop_settings(shop_id) values(shop);
end $$;
commit;
