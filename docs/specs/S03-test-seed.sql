-- Local development seed data.
-- Test accounts:
--   - phone: 13800138000, password: Passw0rd!
--   - phone: 13900139000, password: Passw0rd!
--
-- Notes:
--   - Growth events / summaries / snapshots are generated for the most recent 15 days
--     (relative to execution time, timezone: Asia/Shanghai).

BEGIN;

-- Cleanup old seed rows (idempotent rerun).
DELETE FROM ai_messages
WHERE id BETWEEN 900090100 AND 900090199
  OR conversation_id IN (
    SELECT id FROM ai_conversations WHERE family_id = 900030001 AND baby_id = 900050001
  );
DELETE FROM ai_conversations
WHERE id BETWEEN 900090001 AND 900090099
  OR (family_id = 900030001 AND baby_id = 900050001);
DELETE FROM alert_events
WHERE id BETWEEN 900080100 AND 900080199
  OR (family_id = 900030001 AND baby_id = 900050001);
DELETE FROM alert_rules
WHERE id BETWEEN 900080001 AND 900080099
  OR family_id = 900030001;
DELETE FROM metric_snapshots
WHERE id BETWEEN 900070200 AND 900070299
  OR (family_id = 900030001 AND baby_id = 900050001);
DELETE FROM weekly_summaries
WHERE id BETWEEN 900070100 AND 900070199
  OR (family_id = 900030001 AND baby_id = 900050001);
DELETE FROM daily_summaries
WHERE id BETWEEN 900070001 AND 900070099
  OR (family_id = 900030001 AND baby_id = 900050001);
DELETE FROM feeding_events
WHERE event_id IN (
  SELECT id FROM growth_events WHERE family_id = 900030001 AND baby_id = 900050001
);
DELETE FROM excretion_events
WHERE event_id IN (
  SELECT id FROM growth_events WHERE family_id = 900030001 AND baby_id = 900050001
);
DELETE FROM medication_events
WHERE event_id IN (
  SELECT id FROM growth_events WHERE family_id = 900030001 AND baby_id = 900050001
);
DELETE FROM vaccine_events
WHERE event_id IN (
  SELECT id FROM growth_events WHERE family_id = 900030001 AND baby_id = 900050001
);
DELETE FROM milestone_events
WHERE event_id IN (
  SELECT id FROM growth_events WHERE family_id = 900030001 AND baby_id = 900050001
);
DELETE FROM sleep_events
WHERE event_id IN (
  SELECT id FROM growth_events WHERE family_id = 900030001 AND baby_id = 900050001
);
DELETE FROM measurement_events
WHERE event_id IN (
  SELECT id FROM growth_events WHERE family_id = 900030001 AND baby_id = 900050001
);
DELETE FROM growth_events
WHERE id BETWEEN 900060000 AND 900060199
  OR (family_id = 900030001 AND baby_id = 900050001);
DELETE FROM export_tasks
WHERE id BETWEEN 900100001 AND 900100099
  OR (family_id = 900030001 AND baby_id = 900050001);
DELETE FROM task_jobs WHERE id BETWEEN 900110001 AND 900110099;
DELETE FROM operation_logs
WHERE id BETWEEN 900120001 AND 900120099
  OR family_id = 900030001;
DELETE FROM family_members WHERE id IN (900040001, 900040002) OR family_id = 900030001;
DELETE FROM babies WHERE id IN (900050001);
DELETE FROM user_identities WHERE id IN (900020001, 900020002);
DELETE FROM families WHERE id IN (900030001);
DELETE FROM users WHERE id IN (900010001, 900010002);

INSERT INTO users (
  id,
  display_name,
  phone_ciphertext,
  password_hash,
  status,
  last_login_at,
  created_at,
  updated_at
)
VALUES
  (
    900010001,
    '测试家长A',
    '13800138000',
    'pbkdf2_sha256$120000$MDEyMzQ1Njc4OWFiY2RlZg==$Zx-Rob8b1LAup_cfdS0LptQUGNaCPTn1xXGqwHY_zOY=',
    'active',
    1760000000000,
    1760000000000,
    1760000000000
  ),
  (
    900010002,
    '测试家长B',
    '13900139000',
    'pbkdf2_sha256$120000$MDEyMzQ1Njc4OWFiY2RlZg==$Zx-Rob8b1LAup_cfdS0LptQUGNaCPTn1xXGqwHY_zOY=',
    'active',
    1760000000000,
    1760000000000,
    1760000000000
  );

INSERT INTO user_identities (
  id,
  user_id,
  provider,
  openid_ciphertext,
  unionid_ciphertext,
  created_at,
  updated_at
)
VALUES
  (
    900020001,
    900010001,
    'wechat_mp',
    'wechat_mp:test-code-13800138000',
    NULL,
    1760000000000,
    1760000000000
  ),
  (
    900020002,
    900010002,
    'wechat_mp',
    'wechat_mp:test-code-13900139000',
    NULL,
    1760000000000,
    1760000000000
  );

INSERT INTO families (
  id,
  name,
  timezone,
  status,
  created_by,
  created_at,
  updated_at
)
VALUES
  (
    900030001,
    '测试家庭A',
    'Asia/Shanghai',
    'active',
    900010001,
    1760000000000,
    1760000000000
  );

INSERT INTO family_members (
  id,
  family_id,
  user_id,
  role,
  status,
  invited_by,
  joined_at,
  created_at,
  updated_at
)
VALUES
  (
    900040001,
    900030001,
    900010001,
    'owner',
    'active',
    900010001,
    1760000000000,
    1760000000000,
    1760000000000
  ),
  (
    900040002,
    900030001,
    900010002,
    'caregiver',
    'active',
    900010001,
    1760000000000,
    1760000000000,
    1760000000000
  );

INSERT INTO babies (
  id,
  family_id,
  name,
  nickname,
  gender,
  birth_date,
  due_date,
  birth_weight_g,
  birth_height_cm,
  birth_head_circumference_cm,
  status,
  created_at,
  updated_at
)
VALUES
  (
    900050001,
    900030001,
    '小满',
    '满满',
    'male',
    1754006400000,
    1753920000000,
    3250,
    50.50,
    34.20,
    'active',
    1760000000000,
    1760000000000
  );

INSERT INTO growth_events (
  id,
  family_id,
  baby_id,
  event_type,
  occurred_at,
  start_at,
  end_at,
  timezone,
  source,
  notes,
  payload_snapshot,
  status,
  created_by,
  updated_by,
  created_at,
  updated_at
)
WITH seed_ctx AS (
  SELECT date_trunc('day', NOW() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' AS today_start
),
day_series AS (
  SELECT
    gs AS day_index,
    (seed_ctx.today_start - ((14 - gs) * INTERVAL '1 day')) AS day_start
  FROM seed_ctx
  CROSS JOIN generate_series(0, 14) AS gs
),
event_rows AS (
  SELECT
    day_index,
    'feeding'::TEXT AS event_type,
    (EXTRACT(EPOCH FROM (day_start + INTERVAL '9 hour 30 minute')) * 1000)::BIGINT AS occurred_at,
    (EXTRACT(EPOCH FROM (day_start + INTERVAL '9 hour 25 minute')) * 1000)::BIGINT AS start_at,
    (EXTRACT(EPOCH FROM (day_start + INTERVAL '9 hour 30 minute')) * 1000)::BIGINT AS end_at,
    '配方奶喂养'::TEXT AS notes,
    jsonb_build_object(
      'mode',
      'formula',
      'volume',
      (120 + day_index * 2 + (day_index % 2) * 6),
      'unit',
      'ml'
    ) AS payload_snapshot,
    900010001 AS actor_user_id,
    900060000 + day_index * 10 + 1 AS event_id
  FROM day_series

  UNION ALL

  SELECT
    day_index,
    'sleep'::TEXT AS event_type,
    (EXTRACT(EPOCH FROM (day_start + INTERVAL '14 hour 20 minute')) * 1000)::BIGINT AS occurred_at,
    (EXTRACT(EPOCH FROM (day_start + INTERVAL '13 hour 0 minute')) * 1000)::BIGINT AS start_at,
    (EXTRACT(EPOCH FROM (day_start + INTERVAL '14 hour 20 minute')) * 1000)::BIGINT AS end_at,
    '午睡记录'::TEXT AS notes,
    jsonb_build_object(
      'duration_minutes',
      (80 + (day_index % 5) * 10),
      'night_wake_count',
      (day_index % 3),
      'quality_tag',
      CASE WHEN day_index % 4 = 0 THEN 'excellent' ELSE 'good' END
    ) AS payload_snapshot,
    900010002 AS actor_user_id,
    900060000 + day_index * 10 + 2 AS event_id
  FROM day_series

  UNION ALL

  SELECT
    day_index,
    'measurement'::TEXT AS event_type,
    (EXTRACT(EPOCH FROM (day_start + INTERVAL '20 hour 40 minute')) * 1000)::BIGINT AS occurred_at,
    NULL::BIGINT AS start_at,
    NULL::BIGINT AS end_at,
    '晚间测量'::TEXT AS notes,
    jsonb_build_object(
      'weight_g',
      (6100 + day_index * 22),
      'height_cm',
      ROUND((61.80 + day_index * 0.09)::NUMERIC, 2),
      'head_circumference_cm',
      ROUND((40.50 + day_index * 0.04)::NUMERIC, 2)
    ) AS payload_snapshot,
    900010001 AS actor_user_id,
    900060000 + day_index * 10 + 3 AS event_id
  FROM day_series
)
SELECT
  event_id,
  900030001,
  900050001,
  event_type,
  occurred_at,
  start_at,
  end_at,
  'Asia/Shanghai',
  'miniapp',
  notes,
  payload_snapshot,
  'active',
  actor_user_id,
  actor_user_id,
  occurred_at,
  occurred_at
FROM event_rows
ORDER BY event_id;

INSERT INTO feeding_events (event_id, mode, volume, unit, is_night, extra)
SELECT
  900060000 + gs * 10 + 1,
  'formula',
  (120 + gs * 2 + (gs % 2) * 6),
  'ml',
  (gs % 4 = 0),
  '{}'::jsonb
FROM generate_series(0, 14) AS gs
ORDER BY 1;

INSERT INTO sleep_events (event_id, duration_minutes, night_wake_count, quality_tag, extra)
SELECT
  900060000 + gs * 10 + 2,
  (80 + (gs % 5) * 10),
  (gs % 3),
  CASE WHEN gs % 4 = 0 THEN 'excellent' ELSE 'good' END,
  '{}'::jsonb
FROM generate_series(0, 14) AS gs
ORDER BY 1;

INSERT INTO measurement_events (
  event_id,
  weight_g,
  height_cm,
  head_circumference_cm,
  hand_length_cm,
  leg_length_cm,
  temperature_c,
  extra
)
SELECT
  900060000 + gs * 10 + 3,
  (6100 + gs * 22),
  ROUND((61.80 + gs * 0.09)::NUMERIC, 2),
  ROUND((40.50 + gs * 0.04)::NUMERIC, 2),
  NULL,
  NULL,
  ROUND((36.60 + (gs % 3) * 0.05)::NUMERIC, 2),
  '{}'::jsonb
FROM generate_series(0, 14) AS gs
ORDER BY 1;

INSERT INTO daily_summaries (
  id,
  family_id,
  baby_id,
  summary_date,
  feeding_total_ml,
  feeding_breakdown,
  excretion_count_total,
  excretion_breakdown,
  sleep_total_minutes,
  last_measurement_snapshot,
  alert_count,
  ai_summary,
  created_at,
  updated_at
)
WITH seed_ctx AS (
  SELECT date_trunc('day', NOW() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' AS today_start
),
day_series AS (
  SELECT
    gs AS day_index,
    (seed_ctx.today_start - ((14 - gs) * INTERVAL '1 day')) AS day_start
  FROM seed_ctx
  CROSS JOIN generate_series(0, 14) AS gs
)
SELECT
  900070001 + day_index,
  900030001,
  900050001,
  (EXTRACT(EPOCH FROM day_start) * 1000)::BIGINT,
  (120 + day_index * 2 + (day_index % 2) * 6),
  jsonb_build_object('formula_ml', (120 + day_index * 2 + (day_index % 2) * 6)),
  (3 + (day_index % 2)),
  jsonb_build_object('urine', (2 + (day_index % 2)), 'stool', 1),
  (80 + (day_index % 5) * 10),
  jsonb_build_object(
    'weight_g',
    (6100 + day_index * 22),
    'height_cm',
    ROUND((61.80 + day_index * 0.09)::NUMERIC, 2),
    'head_circumference_cm',
    ROUND((40.50 + day_index * 0.04)::NUMERIC, 2)
  ),
  CASE WHEN day_index IN (5, 12) THEN 1 ELSE 0 END,
  CASE
    WHEN day_index IN (5, 12) THEN '喂养间隔略有波动，建议观察下一日变化。'
    ELSE '喂养与睡眠整体平稳，体重趋势符合预期。'
  END,
  (EXTRACT(EPOCH FROM (day_start + INTERVAL '23 hour')) * 1000)::BIGINT,
  (EXTRACT(EPOCH FROM (day_start + INTERVAL '23 hour')) * 1000)::BIGINT
FROM day_series
ORDER BY day_index;

INSERT INTO weekly_summaries (
  id,
  family_id,
  baby_id,
  week_start,
  summary_payload,
  ai_summary,
  created_at,
  updated_at
)
WITH daily_src AS (
  SELECT
    summary_date,
    feeding_total_ml,
    sleep_total_minutes,
    updated_at,
    date_trunc(
      'week',
      to_timestamp(summary_date / 1000.0) AT TIME ZONE 'Asia/Shanghai'
    ) AT TIME ZONE 'Asia/Shanghai' AS week_start_ts
  FROM daily_summaries
  WHERE id BETWEEN 900070001 AND 900070099
),
weekly_grouped AS (
  SELECT
    (EXTRACT(EPOCH FROM week_start_ts) * 1000)::BIGINT AS week_start_ms,
    SUM(feeding_total_ml) AS feeding_total_ml,
    SUM(sleep_total_minutes) AS sleep_total_minutes,
    COUNT(*) AS day_count,
    MAX(updated_at) AS updated_at
  FROM daily_src
  GROUP BY week_start_ts
)
SELECT
  900070100 + ROW_NUMBER() OVER (ORDER BY week_start_ms),
  900030001,
  900050001,
  week_start_ms,
  jsonb_build_object(
    'feeding_total_ml',
    feeding_total_ml,
    'sleep_total_minutes',
    sleep_total_minutes,
    'days',
    day_count
  ),
  '周度趋势平稳，建议继续按天记录。',
  updated_at,
  updated_at
FROM weekly_grouped
ORDER BY week_start_ms;

INSERT INTO metric_snapshots (
  id,
  family_id,
  baby_id,
  metric_code,
  bucket_type,
  bucket_date,
  metric_value,
  metric_unit,
  tags,
  created_at,
  updated_at
)
WITH seed_ctx AS (
  SELECT date_trunc('day', NOW() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' AS today_start
),
day_series AS (
  SELECT
    gs AS day_index,
    (seed_ctx.today_start - ((14 - gs) * INTERVAL '1 day')) AS day_start
  FROM seed_ctx
  CROSS JOIN generate_series(0, 14) AS gs
),
metric_rows AS (
  SELECT
    (900070200 + day_index * 2 + 1) AS id,
    'weight_g'::TEXT AS metric_code,
    (EXTRACT(EPOCH FROM day_start) * 1000)::BIGINT AS bucket_date,
    (6100 + day_index * 22)::NUMERIC AS metric_value,
    'g'::TEXT AS metric_unit,
    (EXTRACT(EPOCH FROM (day_start + INTERVAL '23 hour')) * 1000)::BIGINT AS updated_at
  FROM day_series

  UNION ALL

  SELECT
    (900070200 + day_index * 2 + 2) AS id,
    'sleep_total_minutes'::TEXT AS metric_code,
    (EXTRACT(EPOCH FROM day_start) * 1000)::BIGINT AS bucket_date,
    (80 + (day_index % 5) * 10)::NUMERIC AS metric_value,
    'minute'::TEXT AS metric_unit,
    (EXTRACT(EPOCH FROM (day_start + INTERVAL '23 hour')) * 1000)::BIGINT AS updated_at
  FROM day_series
)
SELECT
  id,
  900030001,
  900050001,
  metric_code,
  'day',
  bucket_date,
  metric_value,
  metric_unit,
  '{}'::jsonb,
  updated_at,
  updated_at
FROM metric_rows
ORDER BY id;

INSERT INTO alert_rules (
  id,
  family_id,
  rule_type,
  threshold_value,
  window_hours,
  window_days,
  severity,
  enabled,
  config,
  created_by,
  created_at,
  updated_at
)
VALUES
  (
    900080001,
    900030001,
    'feeding_interval',
    4,
    12,
    NULL,
    'warning',
    TRUE,
    '{"unit":"hour","description":"12小时内最长喂养间隔不超过4小时"}'::jsonb,
    900010001,
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
  );

INSERT INTO alert_events (
  id,
  family_id,
  baby_id,
  rule_id,
  severity,
  title,
  content,
  status,
  triggered_at,
  acknowledged_at,
  resolved_at,
  created_at,
  updated_at
)
WITH seed_ctx AS (
  SELECT date_trunc('day', NOW() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' AS today_start
)
SELECT
  id,
  900030001,
  900050001,
  900080001,
  severity,
  title,
  content,
  status,
  triggered_at,
  acknowledged_at,
  resolved_at,
  created_at,
  updated_at
FROM (
  SELECT
    900080101 AS id,
    'warning'::TEXT AS severity,
    '喂养间隔偏长'::TEXT AS title,
    '过去 12 小时出现一次喂养间隔超过 4 小时，请关注。'::TEXT AS content,
    'open'::TEXT AS status,
    (EXTRACT(EPOCH FROM (seed_ctx.today_start - INTERVAL '1 day' + INTERVAL '15 hour')) * 1000)::BIGINT AS triggered_at,
    NULL::BIGINT AS acknowledged_at,
    NULL::BIGINT AS resolved_at,
    (EXTRACT(EPOCH FROM (seed_ctx.today_start - INTERVAL '1 day' + INTERVAL '15 hour')) * 1000)::BIGINT AS created_at,
    (EXTRACT(EPOCH FROM (seed_ctx.today_start - INTERVAL '1 day' + INTERVAL '15 hour')) * 1000)::BIGINT AS updated_at
  FROM seed_ctx

  UNION ALL

  SELECT
    900080102 AS id,
    'info'::TEXT AS severity,
    '夜间醒来次数增加'::TEXT AS title,
    '最近 3 天夜醒次数略高，建议结合喂养节奏观察。'::TEXT AS content,
    'resolved'::TEXT AS status,
    (EXTRACT(EPOCH FROM (seed_ctx.today_start - INTERVAL '6 day' + INTERVAL '3 hour')) * 1000)::BIGINT AS triggered_at,
    (EXTRACT(EPOCH FROM (seed_ctx.today_start - INTERVAL '5 day' + INTERVAL '9 hour')) * 1000)::BIGINT AS acknowledged_at,
    (EXTRACT(EPOCH FROM (seed_ctx.today_start - INTERVAL '4 day' + INTERVAL '10 hour')) * 1000)::BIGINT AS resolved_at,
    (EXTRACT(EPOCH FROM (seed_ctx.today_start - INTERVAL '6 day' + INTERVAL '3 hour')) * 1000)::BIGINT AS created_at,
    (EXTRACT(EPOCH FROM (seed_ctx.today_start - INTERVAL '4 day' + INTERVAL '10 hour')) * 1000)::BIGINT AS updated_at
  FROM seed_ctx
) AS t
ORDER BY id;

INSERT INTO ai_conversations (
  id,
  family_id,
  baby_id,
  asked_by,
  question,
  answer,
  model_name,
  context_window,
  status,
  error_message,
  created_at
)
VALUES
  (
    900090001,
    900030001,
    900050001,
    900010001,
    '最近15天平均每天喂养多少毫升？',
    '最近 15 天平均每天喂养约 138ml，整体呈缓慢上升趋势。',
    'gpt-4.1-mini',
    '15d',
    'succeeded',
    NULL,
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT - 1800000
  );

INSERT INTO ai_messages (id, conversation_id, role, content, token_count, created_at)
VALUES
  (
    900090101,
    900090001,
    'user',
    '最近15天平均每天喂养多少毫升？',
    15,
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT - 1800000
  ),
  (
    900090102,
    900090001,
    'assistant',
    '最近 15 天平均每天喂养约 138ml，整体呈缓慢上升趋势。',
    30,
    (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT - 1790000
  );

INSERT INTO export_tasks (
  id,
  family_id,
  baby_id,
  report_type,
  date_from,
  date_to,
  status,
  object_key,
  download_url,
  expires_at,
  error_message,
  requested_by,
  created_at,
  updated_at
)
WITH seed_ctx AS (
  SELECT
    date_trunc('day', NOW() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' AS today_start,
    to_char((NOW() AT TIME ZONE 'Asia/Shanghai')::DATE, 'YYYY-MM-DD') AS today_text
)
SELECT
  900100001,
  900030001,
  900050001,
  'daily',
  (EXTRACT(EPOCH FROM (seed_ctx.today_start - INTERVAL '14 day')) * 1000)::BIGINT,
  (EXTRACT(EPOCH FROM (seed_ctx.today_start + INTERVAL '1 day' - INTERVAL '1 millisecond')) * 1000)::BIGINT,
  'succeeded',
  'reports/900030001/900050001/' || seed_ctx.today_text || '-recent-15d.pdf',
  'https://example.local/reports/' || seed_ctx.today_text || '-recent-15d.pdf',
  (EXTRACT(EPOCH FROM (seed_ctx.today_start + INTERVAL '3 day')) * 1000)::BIGINT,
  NULL,
  900010001,
  (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
FROM seed_ctx;

INSERT INTO task_jobs (
  id,
  job_type,
  payload,
  status,
  retry_count,
  max_retries,
  run_after,
  locked_at,
  locked_by,
  error_message,
  created_at,
  updated_at
)
WITH seed_ctx AS (
  SELECT date_trunc('day', NOW() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' AS today_start
)
SELECT
  900110001,
  'aggregate_daily',
  jsonb_build_object(
    'family_id',
    900030001,
    'baby_id',
    900050001,
    'summary_date',
    (EXTRACT(EPOCH FROM seed_ctx.today_start) * 1000)::BIGINT
  ),
  'succeeded',
  0,
  3,
  (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  NULL,
  NULL,
  NULL,
  (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
  (EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT
FROM seed_ctx;

INSERT INTO operation_logs (
  id,
  family_id,
  operator_user_id,
  resource_type,
  resource_id,
  action,
  source,
  old_value,
  new_value,
  created_at
)
WITH seed_ctx AS (
  SELECT date_trunc('day', NOW() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' AS today_start
)
SELECT
  id,
  900030001,
  900010001,
  resource_type,
  resource_id,
  action,
  'miniapp',
  old_value,
  new_value,
  created_at
FROM (
  SELECT
    900120001 AS id,
    'growth_event'::TEXT AS resource_type,
    900060141::BIGINT AS resource_id,
    'create'::TEXT AS action,
    NULL::jsonb AS old_value,
    '{"event_type":"feeding","volume":148,"window":"recent-15d"}'::jsonb AS new_value,
    (EXTRACT(EPOCH FROM (seed_ctx.today_start - INTERVAL '1 day' + INTERVAL '9 hour 30 minute')) * 1000)::BIGINT AS created_at
  FROM seed_ctx

  UNION ALL

  SELECT
    900120002 AS id,
    'baby'::TEXT AS resource_type,
    900050001::BIGINT AS resource_id,
    'update'::TEXT AS action,
    '{"nickname":"小满"}'::jsonb AS old_value,
    '{"nickname":"满满"}'::jsonb AS new_value,
    (EXTRACT(EPOCH FROM (seed_ctx.today_start - INTERVAL '2 day' + INTERVAL '20 hour 45 minute')) * 1000)::BIGINT AS created_at
  FROM seed_ctx
) AS logs
ORDER BY id;

COMMIT;
