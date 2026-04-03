-- aegis_go 初始表结构（foundation-data + store-ops 共用库）
-- 约定：AI/Python 不直连本库；枚举类字段先用 VARCHAR + CHECK，便于演进。
-- 执行（需安装 migrate CLI）：migrate -path database/migrations/go -database "postgres://..." up

BEGIN;

-- ---------------------------------------------------------------------------
-- foundation-data：门店 / 角色 / 用户 / 商品
-- ---------------------------------------------------------------------------

CREATE TABLE stores (
    store_id     BIGSERIAL PRIMARY KEY,
    store_code   VARCHAR(64)  NOT NULL,
    store_name   VARCHAR(256) NOT NULL,
    store_location TEXT       NOT NULL DEFAULT '',
    store_area   NUMERIC(14, 4) NOT NULL DEFAULT 0,
    store_status VARCHAR(32)  NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_stores_store_code UNIQUE (store_code)
);

COMMENT ON TABLE stores IS '门店主数据（foundation-data 维护）';
COMMENT ON COLUMN stores.store_id IS '0 表示总部虚拟门店，供 app_users.store_id 外键使用';

-- 总部占位行：满足 user.store_id=0 且 NOT NULL 的外键
INSERT INTO stores (store_id, store_code, store_name, store_location, store_area, store_status)
VALUES (0, 'HQ', '总部', '', 0, 'active');

SELECT setval(pg_get_serial_sequence('stores', 'store_id'), (SELECT MAX(store_id) FROM stores));

CREATE TABLE roles (
    role_id     BIGSERIAL PRIMARY KEY,
    role_name   VARCHAR(16) NOT NULL,
    permissions JSONB       NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_roles_role_name CHECK (role_name IN ('Head', 'Store'))
);

COMMENT ON TABLE roles IS '角色与权限（foundation-data 维护）';

CREATE TABLE app_users (
    user_id       BIGSERIAL PRIMARY KEY,
    store_id      BIGINT       NOT NULL REFERENCES stores (store_id),
    role_id       BIGINT       NOT NULL REFERENCES roles (role_id),
    user_name     VARCHAR(128) NOT NULL,
    account_name  VARCHAR(128) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_app_users_account_name UNIQUE (account_name)
);

COMMENT ON TABLE app_users IS '系统用户；PostgreSQL 保留字 USER，故表名 app_users（foundation-data 维护）';
COMMENT ON COLUMN app_users.store_id IS '归属门店；0 表示总部';
COMMENT ON COLUMN app_users.password_hash IS '密码哈希（bcrypt/argon2 等），禁止明文';

CREATE INDEX ix_app_users_store_id ON app_users (store_id);
CREATE INDEX ix_app_users_role_id ON app_users (role_id);

CREATE TABLE sku_categories (
    category_id   BIGSERIAL PRIMARY KEY,
    category_name VARCHAR(256) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sku_categories IS 'SKU 分类（foundation-data 维护）';

CREATE TABLE skus (
    sku_id       BIGSERIAL PRIMARY KEY,
    sku_code     VARCHAR(64)  NOT NULL,
    sku_name     VARCHAR(512) NOT NULL,
    category_id  BIGINT       NOT NULL REFERENCES sku_categories (category_id),
    std_cost     NUMERIC(14, 4) NOT NULL DEFAULT 0,
    sug_price    NUMERIC(14, 4) NOT NULL DEFAULT 0,
    sku_status   VARCHAR(16)  NOT NULL DEFAULT 'sale',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT uq_skus_sku_code UNIQUE (sku_code),
    CONSTRAINT ck_skus_sku_status CHECK (sku_status IN ('sale', 'unsale'))
);

COMMENT ON TABLE skus IS 'SKU 主数据（foundation-data 维护）';

CREATE INDEX ix_skus_category_id ON skus (category_id);

-- ---------------------------------------------------------------------------
-- store-ops：库存、销售、客流、调拨、AI 诊断结果（由 Go 服务写入；AI 经 API）
-- ---------------------------------------------------------------------------

CREATE TABLE inventories (
    inventory_id     BIGSERIAL PRIMARY KEY,
    store_id         BIGINT NOT NULL REFERENCES stores (store_id),
    sku_id           BIGINT NOT NULL REFERENCES skus (sku_id),
    actual_quantity  INTEGER NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_inventories_store_sku UNIQUE (store_id, sku_id)
);

COMMENT ON TABLE inventories IS '门店库存（store-ops 维护）';

CREATE INDEX ix_inventories_store_id ON inventories (store_id);
CREATE INDEX ix_inventories_sku_id ON inventories (sku_id);

CREATE TABLE sales_daily (
    sales_id      BIGSERIAL PRIMARY KEY,
    store_id      BIGINT NOT NULL REFERENCES stores (store_id),
    sales_date    DATE NOT NULL,
    total_orders  INTEGER NOT NULL DEFAULT 0,
    total_income  NUMERIC(14, 4) NOT NULL DEFAULT 0,
    total_profit  NUMERIC(14, 4) NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_sales_daily_store_date UNIQUE (store_id, sales_date)
);

COMMENT ON TABLE sales_daily IS '门店日结汇总（store-ops 维护）';

CREATE INDEX ix_sales_daily_store_id ON sales_daily (store_id);

CREATE TABLE sales_details (
    detail_id   BIGSERIAL PRIMARY KEY,
    sales_id    BIGINT NOT NULL REFERENCES sales_daily (sales_id) ON DELETE CASCADE,
    sku_id      BIGINT NOT NULL REFERENCES skus (sku_id),
    sku_amount  INTEGER NOT NULL DEFAULT 0,
    sku_income  NUMERIC(14, 4) NOT NULL DEFAULT 0,
    sku_profit  NUMERIC(14, 4) NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE sales_details IS '日结明细（store-ops 维护）';

CREATE INDEX ix_sales_details_sales_id ON sales_details (sales_id);
CREATE INDEX ix_sales_details_sku_id ON sales_details (sku_id);

CREATE TABLE customer_logs (
    customer_log_id       BIGSERIAL PRIMARY KEY,
    store_id              BIGINT NOT NULL REFERENCES stores (store_id),
    record_timestamp      TIMESTAMPTZ NOT NULL DEFAULT now(),
    in_count              INTEGER NOT NULL DEFAULT 0,
    customer_start_time   TIMESTAMPTZ,
    customer_end_time     TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE customer_logs IS '门店客流记录（store-ops 维护；数据由 API/任务写入）';
COMMENT ON COLUMN customer_logs.in_count IS '入店人数等；业务上可约束为仅追加';

CREATE INDEX ix_customer_logs_store_time ON customer_logs (store_id, record_timestamp);

CREATE TABLE transfer_orders (
    order_id   BIGSERIAL PRIMARY KEY,
    store_id   BIGINT NOT NULL REFERENCES stores (store_id),
    status     VARCHAR(32) NOT NULL DEFAULT 'draft',
    feedback   TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE transfer_orders IS '调拨单（store-ops）；与 ER 一致仅保留 store_id，收发方语义由业务层结合 transfer_details.transfer_direction 解释';
COMMENT ON COLUMN transfer_orders.status IS '状态机，具体取值由应用层枚举维护';

CREATE INDEX ix_transfer_orders_store_id ON transfer_orders (store_id);

CREATE TABLE transfer_details (
    detail_id          BIGSERIAL PRIMARY KEY,
    order_id           BIGINT NOT NULL REFERENCES transfer_orders (order_id) ON DELETE CASCADE,
    sku_id             BIGINT NOT NULL REFERENCES skus (sku_id),
    suggested_qty      INTEGER NOT NULL DEFAULT 0,
    actual_qty         INTEGER NOT NULL DEFAULT 0,
    transfer_direction VARCHAR(8) NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_transfer_details_direction CHECK (transfer_direction IN ('H2S', 'S2H'))
);

COMMENT ON TABLE transfer_details IS '调拨明细（store-ops）';
COMMENT ON COLUMN transfer_details.suggested_qty IS 'AI 建议量等业务含义由应用解释';
COMMENT ON COLUMN transfer_details.actual_qty IS '人工确认量';

CREATE INDEX ix_transfer_details_order_id ON transfer_details (order_id);

CREATE TABLE ai_inventory_diagnoses (
    inventory_diagnosis_id           BIGSERIAL PRIMARY KEY,
    store_id                         BIGINT NOT NULL REFERENCES stores (store_id),
    sku_id                           BIGINT NOT NULL REFERENCES skus (sku_id),
    inventory_diagnosis_result_type  VARCHAR(16) NOT NULL,
    inventory_root_cause             JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_ai_inv_diag_result CHECK (
        inventory_diagnosis_result_type IN ('Normal', 'Shortage', 'Unsale')
    )
);

COMMENT ON TABLE ai_inventory_diagnoses IS '库存诊断结果（store-ops 表；内容由 API 写入）';

CREATE INDEX ix_ai_inv_diag_store_sku ON ai_inventory_diagnoses (store_id, sku_id);

COMMIT;
