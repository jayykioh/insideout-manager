-- 202609170004_indexes.sql
-- Thêm các Index còn thiếu cho Foreign Keys và tối ưu Query Performance theo Supabase Best Practices.

-- 1. Index cho Foreign Keys (Tránh khóa bảng và chậm khi xóa/cập nhật)
create index if not exists items_product on public.order_items(product_id);
create index if not exists transactions_order on public.transactions(order_id);
create index if not exists movement_order on public.inventory_movements(order_id);
create index if not exists movement_actor on public.inventory_movements(actor_id);
create index if not exists expenses_actor on public.expenses(actor_id);
create index if not exists audit_actor on public.audit_logs(actor_id);
create index if not exists device_sessions_enrolled on public.device_sessions(enrolled_by);
create index if not exists device_sessions_shop on public.device_sessions(shop_id);
create index if not exists payroll_approved_by on public.payroll_periods(approved_by);
create index if not exists resolution_actor on public.order_resolutions(actor_id);

-- 2. Tối ưu Composite Indexes cho các query trong manager_state (Dành cho việc Load App)
-- Query audit_logs theo shop_id và created_at desc
create index if not exists audit_shop_date on public.audit_logs(shop_id, created_at desc);

-- Query inventory_movements theo shop_id và created_at desc 
-- (Đã có index (shop_id, product_id, created_at) nhưng không tối ưu nhất khi chỉ query theo shop_id)
create index if not exists movement_shop_date on public.inventory_movements(shop_id, created_at desc);

-- Query payroll_periods theo shop_id và start_date desc
create index if not exists payroll_shop_date on public.payroll_periods(shop_id, start_date desc);

-- Query pay_rules theo shop_id và effective_at
create index if not exists pay_rules_shop_date on public.pay_rules(shop_id, effective_at);
