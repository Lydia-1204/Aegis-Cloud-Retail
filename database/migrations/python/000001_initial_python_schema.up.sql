-- Python 微服务初始表结构（aegis_python 库）
-- traffic-sense: ai_customer
-- ai-assistant: ai_chat_logs, ai_analysis, ai_expert_knowledge

-- ---------------------------------------------------------------------------
-- traffic-sense: 客流记录表
-- ---------------------------------------------------------------------------

CREATE TABLE ai_customer (
    ai_customer_id       BIGSERIAL PRIMARY KEY,
    store_id             INTEGER NOT NULL,
    customer_start_time  TIMESTAMPTZ NOT NULL,
    customer_end_time    TIMESTAMPTZ NOT NULL,
    customer_enter_total INTEGER NOT NULL DEFAULT 0,
    customer_leave_total INTEGER NOT NULL DEFAULT 0,
    ai_customer_stats_time TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ai_customer IS '客流记录表（traffic-sense 服务）';
COMMENT ON COLUMN ai_customer.ai_customer_id IS '主键，自增';
COMMENT ON COLUMN ai_customer.store_id IS '门店ID（逻辑外键）';
COMMENT ON COLUMN ai_customer.customer_start_time IS '时段开始时间';
COMMENT ON COLUMN ai_customer.customer_end_time IS '时段结束时间';
COMMENT ON COLUMN ai_customer.customer_enter_total IS '该时段进店总人数';
COMMENT ON COLUMN ai_customer.customer_leave_total IS '该时段出店总人数';
COMMENT ON COLUMN ai_customer.ai_customer_stats_time IS '入库时间';

CREATE INDEX ix_ai_customer_store_id ON ai_customer (store_id);
CREATE INDEX ix_ai_customer_stats_time ON ai_customer (ai_customer_stats_time);

-- ---------------------------------------------------------------------------
-- ai-assistant: 对话日志表
-- ---------------------------------------------------------------------------

CREATE TABLE ai_chat_logs (
    chat_id              SERIAL PRIMARY KEY,
    store_id             INTEGER NOT NULL,
    chat_session_id      VARCHAR(128) NOT NULL,
    chat_query           TEXT NOT NULL,
    context_snapshot     JSONB NOT NULL DEFAULT '{}'::jsonb,
    chat_final_prompt    TEXT,
    ai_response          TEXT,
    chat_tokens_used     INTEGER NOT NULL DEFAULT 0,
    chat_time            TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ai_chat_logs IS '对话日志表（ai-assistant 服务）';
COMMENT ON COLUMN ai_chat_logs.chat_id IS '主键，自增';
COMMENT ON COLUMN ai_chat_logs.store_id IS '提问门店ID';
COMMENT ON COLUMN ai_chat_logs.chat_session_id IS '对话会话ID（追溯多轮上下文）';
COMMENT ON COLUMN ai_chat_logs.chat_query IS '用户原始提问';
COMMENT ON COLUMN ai_chat_logs.context_snapshot IS '注入的经营数据/诊断结果快照';
COMMENT ON COLUMN ai_chat_logs.chat_final_prompt IS '最终提示词';
COMMENT ON COLUMN ai_chat_logs.ai_response IS 'AI生成的最终业务建议';
COMMENT ON COLUMN ai_chat_logs.chat_tokens_used IS '本次交互消耗的Token数';
COMMENT ON COLUMN ai_chat_logs.chat_time IS '对话发生时间';

CREATE INDEX ix_ai_chat_logs_store_id ON ai_chat_logs (store_id);
CREATE INDEX ix_ai_chat_logs_session_id ON ai_chat_logs (chat_session_id);
CREATE INDEX ix_ai_chat_logs_time ON ai_chat_logs (chat_time);

-- ---------------------------------------------------------------------------
-- ai-assistant: AI分析结果表
-- ---------------------------------------------------------------------------

CREATE TABLE ai_analysis (
    ai_analysis_id   BIGSERIAL PRIMARY KEY,
    store_id         INTEGER NOT NULL,
    sku_id           INTEGER NOT NULL DEFAULT 0,
    analysis_label   VARCHAR(64) NOT NULL,
    strategy_key     VARCHAR(64) NOT NULL,
    analysis_data    JSONB NOT NULL DEFAULT '{}'::jsonb,
    analysis_time    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE ai_analysis IS 'AI分析结果表（ai-assistant 服务）';
COMMENT ON COLUMN ai_analysis.ai_analysis_id IS '主键，自增';
COMMENT ON COLUMN ai_analysis.store_id IS '门店ID（逻辑外键），0代表全域';
COMMENT ON COLUMN ai_analysis.sku_id IS '分析对象SKU';
COMMENT ON COLUMN ai_analysis.analysis_label IS '分析标签（枚举）';
COMMENT ON COLUMN ai_analysis.strategy_key IS '核心逻辑纽带：匹配专家库的暗号';
COMMENT ON COLUMN ai_analysis.analysis_data IS '运算结果（存放Prophet/iForest细节）';
COMMENT ON COLUMN ai_analysis.analysis_time IS '诊断计算时间';

CREATE INDEX ix_ai_analysis_store_id ON ai_analysis (store_id);
CREATE INDEX ix_ai_analysis_sku_id ON ai_analysis (sku_id);
CREATE INDEX ix_ai_analysis_strategy_key ON ai_analysis (strategy_key);
CREATE INDEX ix_ai_analysis_time ON ai_analysis (analysis_time);

-- ---------------------------------------------------------------------------
-- ai-assistant: 专家知识库表
-- ---------------------------------------------------------------------------

CREATE TABLE ai_expert_knowledge (
    knowledge_id             SERIAL PRIMARY KEY,
    strategy_key              VARCHAR(64) NOT NULL UNIQUE,
    scenario_name             TEXT NOT NULL,
    expert_prompt             TEXT NOT NULL,
    is_active                 SMALLINT NOT NULL DEFAULT 1,
    knowledge_time            TIMESTAMPTZ NOT NULL DEFAULT now(),
    knowledge_updated_time    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_ai_expert_knowledge_is_active CHECK (is_active IN (0, 1))
);

COMMENT ON TABLE ai_expert_knowledge IS '专家知识库表（ai-assistant 服务）';
COMMENT ON COLUMN ai_expert_knowledge.knowledge_id IS '策略ID，主键，自增';
COMMENT ON COLUMN ai_expert_knowledge.strategy_key IS '策略触发标识（唯一暗号）';
COMMENT ON COLUMN ai_expert_knowledge.scenario_name IS '业务场景描述';
COMMENT ON COLUMN ai_expert_knowledge.expert_prompt IS '注入给DeepSeek的专家经验文本';
COMMENT ON COLUMN ai_expert_knowledge.is_active IS '是否启用（1-启用，0-停用）';
COMMENT ON COLUMN ai_expert_knowledge.knowledge_time IS '创建时间';
COMMENT ON COLUMN ai_expert_knowledge.knowledge_updated_time IS '最后修改时间';

CREATE INDEX ix_ai_expert_knowledge_active ON ai_expert_knowledge (is_active);
