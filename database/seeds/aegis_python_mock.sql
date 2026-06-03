-- aegis_python 种子数据（Python 微服务测试数据）
-- 用法：
--   psql "postgres://aegis:aegis_dev@localhost:5432/aegis_python?sslmode=disable" -f database/seeds/aegis_python_mock.sql
-- 或在 pgAdmin 中打开本文件执行。

-- Reset the previous Python-side demo dataset before importing this seed version.
-- ai_analysis is intentionally left empty so sales forecast has no seeded data.
TRUNCATE ai_chat_logs, ai_analysis, ai_customer, ai_expert_knowledge
  RESTART IDENTITY CASCADE;

-- ---------------------------------------------------------------------------
-- 专家知识库（ai_expert_knowledge）
-- 策略标识(strategy_key) 用于 AI 分析时精准匹配专家经验
-- ---------------------------------------------------------------------------

INSERT INTO ai_expert_knowledge (strategy_key, scenario_name, expert_prompt, is_active)
VALUES
  (
    'inventory_shortage_low_stock',
    '库存不足预警 - 低于安全库存',
    '当门店某 SKU 实际库存低于安全库存（通常为日均销量的 3-5 倍）时，AI 应生成库存不足预警。建议调拨或补货策略：1) 检查总部仓库库存；2) 评估跨店调拨可行性；3) 考虑临时促销活动加速去库存。',
    1
  ),
  (
    'inventory_shortage_out_of_stock',
    '缺货预警 - SKU 已售罄',
    '当门店某 SKU 实际库存为零时，AI 应生成缺货预警并标记为紧急。缺货影响：1) 直接损失销售机会；2) 顾客满意度下降。建议：1) 立即查询总部/其他门店库存；2) 触发紧急调拨流程；3) 如无法调拨，考虑限时预售。',
    1
  ),
  (
    'inventory_oversupply',
    '积压预警 - 库存过高',
    '当门店某 SKU 实际库存远超日均销量（超过 30 天销量）时，AI 应生成积压预警。积压风险：1) 资金占用；2) 临期/过期损耗。建议策略：1) 评估促销力度；2) 检查是否需要调拨至其他门店；3) 建议组合销售方案。',
    1
  ),
  (
    'traffic_high_conversion_low',
    '高客流低转化分析',
    '当门店客流数据呈现"高进店、低成交"特征时（入店人数高但成交率低），AI 应分析原因：1) 商品陈列问题；2) 价格敏感；3) 员工服务不足；4) 品类结构不匹配。建议：1) 优化商品布局；2) 检查价格竞争力；3) 提升员工推荐话术。',
    1
  ),
  (
    'sales_decline_trend',
    '销量持续下滑分析',
    '当门店日销量连续 3 天以上环比下滑超过 15% 时，AI 应分析原因并给出对策：1) 外部因素（天气、竞品活动）；2) 内部因素（陈列、员工）；3) 商品因素（缺货、过期）。建议：1) 加强门店氛围；2) 开展小型促销活动；3) 员工激励方案。',
    1
  ),
  (
    'peak_hours_optimization',
    '高峰时段优化建议',
    '基于客流数据识别门店高峰时段（通常 11:00-13:00, 17:00-19:00），AI 应给出人员/库存配置建议：1) 高峰前 15 分钟补货到位；2) 增加收银通道；3) 临时增设促销点。建议配置高峰时段员工数量为基础时段的 2-3 倍。',
    1
  ),
  (
    'transfer_order_optimization',
    '调拨单优化建议',
    '当系统检测到调拨单状态异常（如长时间处于某个状态）或调拨效率低下时，AI 应分析：1) 调拨距离与时效；2) 门店库存匹配度；3) 物流成本优化。建议：1) 优先处理紧急调拨；2) 合并小批量调拨；3) 优化调拨路线。',
    1
  )
ON CONFLICT (strategy_key) DO UPDATE SET
  scenario_name = EXCLUDED.scenario_name,
  expert_prompt = EXCLUDED.expert_prompt,
  is_active = EXCLUDED.is_active,
  knowledge_updated_time = now();

SELECT setval(pg_get_serial_sequence('ai_expert_knowledge', 'knowledge_id'),
              (SELECT MAX(knowledge_id) FROM ai_expert_knowledge), true);

-- ---------------------------------------------------------------------------
-- 客流记录测试数据（ai_customer）
-- 每5分钟记录一次
-- ---------------------------------------------------------------------------

WITH ai_customer_seed AS (
  SELECT *
  FROM (VALUES
    -- 门店1 09:00-10:00 (每5分钟一条)
    (1, TIME '09:00', TIME '09:05', 5, 3),
    (1, TIME '09:05', TIME '09:10', 8, 5),
    (1, TIME '09:10', TIME '09:15', 6, 7),
    (1, TIME '09:15', TIME '09:20', 7, 4),
    (1, TIME '09:20', TIME '09:25', 9, 6),
    (1, TIME '09:25', TIME '09:30', 10, 8),
    (1, TIME '09:30', TIME '09:35', 8, 9),
    (1, TIME '09:35', TIME '09:40', 11, 7),
    (1, TIME '09:40', TIME '09:45', 12, 10),
    (1, TIME '09:45', TIME '09:50', 9, 8),
    (1, TIME '09:50', TIME '09:55', 10, 11),
    (1, TIME '09:55', TIME '10:00', 13, 9),
    -- 门店1 10:00-11:00
    (1, TIME '10:00', TIME '10:05', 15, 12),
    (1, TIME '10:05', TIME '10:10', 18, 14),
    (1, TIME '10:10', TIME '10:15', 16, 15),
    (1, TIME '10:15', TIME '10:20', 20, 16),
    (1, TIME '10:20', TIME '10:25', 22, 18),
    (1, TIME '10:25', TIME '10:30', 25, 20),
    (1, TIME '10:30', TIME '10:35', 23, 22),
    (1, TIME '10:35', TIME '10:40', 28, 24),
    (1, TIME '10:40', TIME '10:45', 30, 26),
    (1, TIME '10:45', TIME '10:50', 26, 28),
    (1, TIME '10:50', TIME '10:55', 29, 25),
    (1, TIME '10:55', TIME '11:00', 32, 30),
    -- 门店1 11:00-12:00 (午高峰)
    (1, TIME '11:00', TIME '11:05', 35, 28),
    (1, TIME '11:05', TIME '11:10', 42, 35),
    (1, TIME '11:10', TIME '11:15', 48, 40),
    (1, TIME '11:15', TIME '11:20', 50, 42),
    (1, TIME '11:20', TIME '11:25', 45, 48),
    (1, TIME '11:25', TIME '11:30', 52, 45),
    (1, TIME '11:30', TIME '11:35', 55, 50),
    (1, TIME '11:35', TIME '11:40', 58, 52),
    (1, TIME '11:40', TIME '11:45', 53, 55),
    (1, TIME '11:45', TIME '11:50', 60, 48),
    (1, TIME '11:50', TIME '11:55', 56, 58),
    (1, TIME '11:55', TIME '12:00', 62, 55),
    -- 门店1 12:00-13:00
    (1, TIME '12:00', TIME '12:05', 65, 58),
    (1, TIME '12:05', TIME '12:10', 70, 62),
    (1, TIME '12:10', TIME '12:15', 68, 65),
    (1, TIME '12:15', TIME '12:20', 72, 68),
    (1, TIME '12:20', TIME '12:25', 75, 70),
    (1, TIME '12:25', TIME '12:30', 78, 72),
    (1, TIME '12:30', TIME '12:35', 80, 75),
    (1, TIME '12:35', TIME '12:40', 76, 78),
    (1, TIME '12:40', TIME '12:45', 82, 80),
    (1, TIME '12:45', TIME '12:50', 78, 82),
    (1, TIME '12:50', TIME '12:55', 85, 78),
    (1, TIME '12:55', TIME '13:00', 88, 85),
    -- 门店2 09:00-10:00
    (2, TIME '09:00', TIME '09:05', 3, 2),
    (2, TIME '09:05', TIME '09:10', 5, 4),
    (2, TIME '09:10', TIME '09:15', 4, 5),
    (2, TIME '09:15', TIME '09:20', 6, 3),
    (2, TIME '09:20', TIME '09:25', 7, 5),
    (2, TIME '09:25', TIME '09:30', 8, 6),
    (2, TIME '09:30', TIME '09:35', 6, 7),
    (2, TIME '09:35', TIME '09:40', 9, 5),
    (2, TIME '09:40', TIME '09:45', 10, 8),
    (2, TIME '09:45', TIME '09:50', 8, 9),
    (2, TIME '09:50', TIME '09:55', 11, 7),
    (2, TIME '09:55', TIME '10:00', 12, 10)
  ) AS v(store_id, start_time, end_time, enter_total, leave_total)
)
INSERT INTO ai_customer (store_id, customer_start_time, customer_end_time, customer_enter_total, customer_leave_total, ai_customer_stats_time)
SELECT
  store_id,
  CURRENT_DATE + start_time,
  CURRENT_DATE + end_time,
  enter_total,
  leave_total,
  CURRENT_DATE + end_time
FROM ai_customer_seed
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('ai_customer', 'ai_customer_id'),
              (SELECT MAX(ai_customer_id) FROM ai_customer), true);

-- ---------------------------------------------------------------------------
-- AI analysis / sales forecast seed data intentionally stays empty.
-- ---------------------------------------------------------------------------
SELECT setval(pg_get_serial_sequence('ai_analysis', 'ai_analysis_id'), 1, false);

-- ---------------------------------------------------------------------------
-- 对话日志测试数据（ai_chat_logs）
-- ---------------------------------------------------------------------------

INSERT INTO ai_chat_logs (store_id, chat_session_id, chat_query, context_snapshot, chat_final_prompt, ai_response, chat_tokens_used, chat_time)
VALUES
  (1, 'session_001',
   '门店1今天库存和销售整体怎么样？',
   '{"store_id": 1, "sku_id": 101, "sku_name": "可口可乐 330ml", "actual_quantity": 72, "recent_sales_days": 8}'::jsonb,
   'Summarize current store inventory and recent sales. Forecast records are generated only on demand.',
   '门店1当前库存结构整体正常。可口可乐库存为72瓶，薯片库存为48包，矿泉水库存为135瓶；最近销售记录可用于经营看板展示，预测结果会在点击预测时按需生成。',
   1250,
   CURRENT_DATE + TIME '10:30'),
  (1, 'session_002',
   '帮我看看今天客流有什么问题吗？',
   '{"store_id": 1, "date_range": "today", "total_enter": 286, "total_leave": 242}'::jsonb,
   'Analyze store foot traffic data for the day...',
   '门店1今日客流整体正常。午间客流峰值明显，晚间仍有稳定到店人数；建议保持高峰时段补货巡检和收银排班。',
   2100,
   CURRENT_DATE + TIME '15:00')
ON CONFLICT DO NOTHING;

SELECT setval(pg_get_serial_sequence('ai_chat_logs', 'chat_id'),
              (SELECT MAX(chat_id) FROM ai_chat_logs), true);

-- ---------------------------------------------------------------------------
-- 可选：如需重置本脚本数据，可先执行：
-- TRUNCATE ai_chat_logs, ai_analysis, ai_customer, ai_expert_knowledge RESTART IDENTITY CASCADE;
-- ---------------------------------------------------------------------------
