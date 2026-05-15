-- 与《Aegis接口设计文档》§7.1「全局基础 Mock」对齐的种子数据（库：aegis_go）
-- 用法（在已执行 migrate up 之后）：
--   psql "postgres://aegis:aegis_dev@localhost:5432/aegis_go?sslmode=disable" -f database/seeds/aegis_go_mock_7_1.sql
-- 或在 pgAdmin 中打开本文件执行。
--
-- 说明：
-- - 迁移已插入 store_id=0（总部 HQ），本脚本插入门店 1–3、角色、用户、分类、SKU 及门店经营相关行。
-- - 口令与文档登录示例一致：account_name 为 head001 / store001_mgr 时，密码均为 123456（由 pgcrypto 生成 bcrypt）。
-- - 可重复执行前先 TRUNCATE / DELETE（见文件末尾可选段），避免主键冲突。

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 角色（文档：Head / Store）
-- ---------------------------------------------------------------------------
INSERT INTO roles (role_id, role_name, permissions)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 'Head', '{"scopes":["*"]}'::jsonb),
  (2, 'Store', '{"scopes":["store_self"]}'::jsonb)
ON CONFLICT (role_id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('roles', 'role_id'), (SELECT MAX(role_id) FROM roles), true);

-- ---------------------------------------------------------------------------
-- 门店（文档 mockStores；与 store_id=0 总部并存）
-- ---------------------------------------------------------------------------
INSERT INTO stores (store_id, store_code, store_name, store_location, store_area, store_status)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 'S001', '葵涌旗舰店', '香港新界葵涌葵涌道123号', 150.0, 'active'),
  (2, 'S002', '旺角分店', '香港九龙旺角西洋菜南街88号', 98.5, 'active'),
  (3, 'S003', '铜锣湾分店', '香港铜锣湾轩尼诗道500号', 120.0, 'inactive')
ON CONFLICT (store_id) DO UPDATE SET
  store_code     = EXCLUDED.store_code,
  store_name     = EXCLUDED.store_name,
  store_location = EXCLUDED.store_location,
  store_area     = EXCLUDED.store_area,
  store_status   = EXCLUDED.store_status,
  updated_at     = now();

WITH m AS (SELECT COALESCE(MAX(store_id), 0) AS mx FROM stores)
SELECT setval(
  pg_get_serial_sequence('stores', 'store_id'),
  GREATEST((SELECT mx FROM m), 1),
  (SELECT mx FROM m) >= 1
);

-- ---------------------------------------------------------------------------
-- 用户（文档 mock：head001 总部张三 user_id=1；store001_mgr 李四 user_id=5 store_id=1）
-- password：123456
-- ---------------------------------------------------------------------------
INSERT INTO app_users (user_id, store_id, role_id, user_name, account_name, password_hash)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 0, 1, '张三', 'head001', crypt('123456', gen_salt('bf'))),
  (5, 1, 2, '李四', 'store001_mgr', crypt('123456', gen_salt('bf')))
ON CONFLICT (user_id) DO UPDATE SET
  store_id       = EXCLUDED.store_id,
  role_id        = EXCLUDED.role_id,
  user_name      = EXCLUDED.user_name,
  account_name   = EXCLUDED.account_name,
  password_hash  = EXCLUDED.password_hash,
  updated_at     = now();

SELECT setval(pg_get_serial_sequence('app_users', 'user_id'), (SELECT MAX(user_id) FROM app_users), true);

-- ---------------------------------------------------------------------------
-- SKU 分类 + SKU（文档：category 1 饮料 / 2 零食；sku 101–103）
-- ---------------------------------------------------------------------------
INSERT INTO sku_categories (category_id, category_name)
OVERRIDING SYSTEM VALUE
VALUES
  (1, '饮料'),
  (2, '零食')
ON CONFLICT (category_id) DO UPDATE SET
  category_name = EXCLUDED.category_name,
  updated_at    = now();

SELECT setval(pg_get_serial_sequence('sku_categories', 'category_id'), (SELECT MAX(category_id) FROM sku_categories), true);

INSERT INTO skus (sku_id, sku_code, sku_name, category_id, std_cost, sug_price, sku_status)
OVERRIDING SYSTEM VALUE
VALUES
  (101, 'SKU001', '可口可乐 330ml', 1, 2.50, 5.00, 'sale'),
  (102, 'SKU002', '薯片原味 75g',   2, 4.00, 8.50, 'sale'),
  (103, 'SKU003', '矿泉水 500ml',   1, 0.80, 2.00, 'sale')
ON CONFLICT (sku_id) DO UPDATE SET
  sku_code    = EXCLUDED.sku_code,
  sku_name    = EXCLUDED.sku_name,
  category_id = EXCLUDED.category_id,
  std_cost    = EXCLUDED.std_cost,
  sug_price   = EXCLUDED.sug_price,
  sku_status  = EXCLUDED.sku_status,
  updated_at  = now();

SELECT setval(pg_get_serial_sequence('skus', 'sku_id'), (SELECT MAX(sku_id) FROM skus), true);

-- ---------------------------------------------------------------------------
-- 库存 mockInventory（门店 1）
-- ---------------------------------------------------------------------------
INSERT INTO inventories (inventory_id, store_id, sku_id, actual_quantity)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 1, 101, 23),
  (2, 1, 102, 156),
  (3, 1, 103, 8)
ON CONFLICT (inventory_id) DO UPDATE SET
  store_id         = EXCLUDED.store_id,
  sku_id           = EXCLUDED.sku_id,
  actual_quantity  = EXCLUDED.actual_quantity,
  updated_at       = now();

SELECT setval(pg_get_serial_sequence('inventories', 'inventory_id'), (SELECT MAX(inventory_id) FROM inventories), true);

-- ---------------------------------------------------------------------------
-- Sales daily + details mock data.
-- Dates are relative to CURRENT_DATE so the AI/business default 30-day
-- snapshot window contains real Go-side sales data.
-- ---------------------------------------------------------------------------
WITH seed_sales AS (
  SELECT *
  FROM (VALUES
    (1::bigint, CURRENT_DATE - 13, 18, 24, 58),
    (1::bigint, CURRENT_DATE - 12, 20, 25, 63),
    (1::bigint, CURRENT_DATE - 11, 19, 22, 60),
    (1::bigint, CURRENT_DATE - 10, 22, 27, 65),
    (1::bigint, CURRENT_DATE -  9, 24, 28, 70),
    (1::bigint, CURRENT_DATE -  8, 31, 31, 86),
    (1::bigint, CURRENT_DATE -  7, 35, 33, 92),
    (1::bigint, CURRENT_DATE -  6, 21, 23, 61),
    (1::bigint, CURRENT_DATE -  5, 23, 24, 66),
    (1::bigint, CURRENT_DATE -  4, 25, 29, 72),
    (1::bigint, CURRENT_DATE -  3, 27, 30, 74),
    (1::bigint, CURRENT_DATE -  2, 34, 32, 88),
    (1::bigint, CURRENT_DATE -  1, 38, 36, 95),
    (1::bigint, CURRENT_DATE,      28, 26, 69),
    (2::bigint, CURRENT_DATE -  6, 12, 18, 40),
    (2::bigint, CURRENT_DATE -  5, 14, 19, 42),
    (2::bigint, CURRENT_DATE -  4, 13, 17, 39),
    (2::bigint, CURRENT_DATE -  3, 16, 22, 45),
    (2::bigint, CURRENT_DATE -  2, 18, 24, 51),
    (2::bigint, CURRENT_DATE -  1, 21, 27, 55),
    (2::bigint, CURRENT_DATE,      15, 20, 44)
  ) AS v(store_id, sales_date, qty_101, qty_102, qty_103)
), upserted_daily AS (
  INSERT INTO sales_daily (store_id, sales_date, total_orders, total_income, total_profit)
  SELECT
    store_id,
    sales_date,
    GREATEST(1, round(((qty_101 + qty_102 + qty_103)::numeric / 3.2))::integer) AS total_orders,
    (qty_101 * 5.00 + qty_102 * 8.50 + qty_103 * 2.00) AS total_income,
    (qty_101 * 2.50 + qty_102 * 4.50 + qty_103 * 1.20) AS total_profit
  FROM seed_sales
  ON CONFLICT (store_id, sales_date) DO UPDATE SET
    total_orders = EXCLUDED.total_orders,
    total_income = EXCLUDED.total_income,
    total_profit = EXCLUDED.total_profit,
    updated_at = now()
  RETURNING sales_id, store_id, sales_date
), deleted_details AS (
  DELETE FROM sales_details sd
  USING upserted_daily ud
  WHERE sd.sales_id = ud.sales_id
  RETURNING sd.detail_id
), delete_done AS (
  SELECT count(*) AS deleted_count FROM deleted_details
), detail_rows AS (
  SELECT store_id, sales_date, 101::bigint AS sku_id, qty_101 AS sku_amount, qty_101 * 5.00 AS sku_income, qty_101 * 2.50 AS sku_profit FROM seed_sales
  UNION ALL
  SELECT store_id, sales_date, 102::bigint AS sku_id, qty_102 AS sku_amount, qty_102 * 8.50 AS sku_income, qty_102 * 4.50 AS sku_profit FROM seed_sales
  UNION ALL
  SELECT store_id, sales_date, 103::bigint AS sku_id, qty_103 AS sku_amount, qty_103 * 2.00 AS sku_income, qty_103 * 1.20 AS sku_profit FROM seed_sales
)
INSERT INTO sales_details (sales_id, sku_id, sku_amount, sku_income, sku_profit)
SELECT ud.sales_id, dr.sku_id, dr.sku_amount, dr.sku_income, dr.sku_profit
FROM detail_rows dr
JOIN upserted_daily ud ON ud.store_id = dr.store_id AND ud.sales_date = dr.sales_date
CROSS JOIN delete_done
WHERE dr.sku_amount > 0
ORDER BY ud.sales_id, dr.sku_id;

SELECT setval(pg_get_serial_sequence('sales_daily', 'sales_id'), (SELECT COALESCE(MAX(sales_id), 1) FROM sales_daily), true);
SELECT setval(pg_get_serial_sequence('sales_details', 'detail_id'), (SELECT COALESCE(MAX(detail_id), 1) FROM sales_details), true);

-- ---------------------------------------------------------------------------
-- 客流 mockTrafficLogs（文档时间 2026-03-14 UTC）
-- ---------------------------------------------------------------------------
INSERT INTO customer_logs (customer_log_id, store_id, record_timestamp, in_count)
OVERRIDING SYSTEM VALUE
VALUES
  (301, 1, '2026-03-14T14:00:00Z', 45),
  (302, 1, '2026-03-14T15:00:00Z', 67),
  (303, 1, '2026-03-14T16:00:00Z', 32)
ON CONFLICT (customer_log_id) DO UPDATE SET
  store_id         = EXCLUDED.store_id,
  record_timestamp = EXCLUDED.record_timestamp,
  in_count         = EXCLUDED.in_count;

SELECT setval(pg_get_serial_sequence('customer_logs', 'customer_log_id'), (SELECT MAX(customer_log_id) FROM customer_logs), true);

-- ---------------------------------------------------------------------------
-- 调拨单 + 明细（文档 mockTransferOrders；仅库表字段，不含 JSON 里的 store_name）
-- ---------------------------------------------------------------------------
INSERT INTO transfer_orders (order_id, store_id, status, feedback)
OVERRIDING SYSTEM VALUE
VALUES
  (1001, 1, 'issued_pending_confirmation', NULL),
  (1002, 2, 'in_negotiation', '库容不足，建议可乐调减至30件'),
  (1003, 3, 'confirmed_executed', NULL)
ON CONFLICT (order_id) DO UPDATE SET
  store_id  = EXCLUDED.store_id,
  status    = EXCLUDED.status,
  feedback  = EXCLUDED.feedback,
  updated_at = now();

SELECT setval(pg_get_serial_sequence('transfer_orders', 'order_id'), (SELECT MAX(order_id) FROM transfer_orders), true);

INSERT INTO transfer_details (detail_id, order_id, sku_id, suggested_qty, actual_qty, transfer_direction)
OVERRIDING SYSTEM VALUE
VALUES
  (501, 1001, 101, 50, 50, 'H2S'),
  (502, 1002, 101, 60, 0, 'H2S'),
  (503, 1003, 103, 100, 100, 'H2S')
ON CONFLICT (detail_id) DO UPDATE SET
  order_id           = EXCLUDED.order_id,
  sku_id             = EXCLUDED.sku_id,
  suggested_qty      = EXCLUDED.suggested_qty,
  actual_qty         = EXCLUDED.actual_qty,
  transfer_direction = EXCLUDED.transfer_direction;

SELECT setval(pg_get_serial_sequence('transfer_details', 'detail_id'), (SELECT MAX(detail_id) FROM transfer_details), true);

-- 可选：如需「从零重灌」本脚本数据，可先执行（会清空业务表，保留 schema_migrations）：
-- TRUNCATE ai_inventory_diagnoses, transfer_details, transfer_orders, customer_logs, sales_details, sales_daily,
--   inventories, skus, sku_categories, app_users, roles, stores RESTART IDENTITY CASCADE;
-- 注意：TRUNCATE stores 会删掉 store_id=0 总部行，需重新跑迁移或手工再插 HQ。
