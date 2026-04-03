-- 按外键依赖逆序删除

BEGIN;

DROP TABLE IF EXISTS ai_inventory_diagnoses;
DROP TABLE IF EXISTS transfer_details;
DROP TABLE IF EXISTS transfer_orders;
DROP TABLE IF EXISTS customer_logs;
DROP TABLE IF EXISTS sales_details;
DROP TABLE IF EXISTS sales_daily;
DROP TABLE IF EXISTS inventories;
DROP TABLE IF EXISTS skus;
DROP TABLE IF EXISTS sku_categories;
DROP TABLE IF EXISTS app_users;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS stores;

COMMIT;
