-- Local development seed data.
-- Test accounts:
--   - phone: 13800138000, password: Passw0rd!
--   - phone: 13900139000, password: Passw0rd!

BEGIN;

-- Cleanup old seed rows (idempotent rerun).
DELETE FROM ai_messages WHERE id IN (900090101, 900090102);
DELETE FROM ai_conversations WHERE id IN (900090001);
DELETE FROM alert_events WHERE id IN (900080101);
DELETE FROM alert_rules WHERE id IN (900080001);
DELETE FROM metric_snapshots WHERE id IN (900070201, 900070202);
DELETE FROM weekly_summaries WHERE id IN (900070101);
DELETE FROM daily_summaries WHERE id IN (900070001);
DELETE FROM feeding_events WHERE event_id IN (900060001);
DELETE FROM sleep_events WHERE event_id IN (900060002);
DELETE FROM measurement_events WHERE event_id IN (900060003);
DELETE FROM growth_events WHERE id IN (900060001, 900060002, 900060003);
DELETE FROM export_tasks WHERE id IN (900100001);
DELETE FROM task_jobs WHERE id IN (900110001);
DELETE FROM operation_logs WHERE id IN (900120001, 900120002);
DELETE FROM family_members WHERE id IN (900040001, 900040002);
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
VALUES
  (
    900060001,
    900030001,
    900050001,
    'feeding',
    1760058000000,
    1760057700000,
    1760058000000,
    'Asia/Shanghai',
    'miniapp',
    '配方奶喂养',
    '{"mode":"formula","volume":120,"unit":"ml"}'::jsonb,
    'active',
    900010001,
    900010001,
    1760058000000,
    1760058000000
  ),
  (
    900060002,
    900030001,
    900050001,
    'sleep',
    1760066400000,
    1760060700000,
    1760066400000,
    'Asia/Shanghai',
    'miniapp',
    '上午小睡',
    '{"duration_minutes":95,"night_wake_count":0,"quality_tag":"good"}'::jsonb,
    'active',
    900010002,
    900010002,
    1760066400000,
    1760066400000
  ),
  (
    900060003,
    900030001,
    900050001,
    'measurement',
    1760070000000,
    NULL,
    NULL,
    'Asia/Shanghai',
    'miniapp',
    '晚间测量',
    '{"weight_g":6200,"height_cm":62.3,"head_circumference_cm":41.2}'::jsonb,
    'active',
    900010001,
    900010001,
    1760070000000,
    1760070000000
  );

INSERT INTO feeding_events (event_id, mode, volume, unit, is_night, extra)
VALUES (900060001, 'formula', 120, 'ml', FALSE, '{}'::jsonb);

INSERT INTO sleep_events (event_id, duration_minutes, night_wake_count, quality_tag, extra)
VALUES (900060002, 95, 0, 'good', '{}'::jsonb);

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
VALUES (900060003, 6200, 62.30, 41.20, NULL, NULL, 36.70, '{}'::jsonb);

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
VALUES
  (
    900070001,
    900030001,
    900050001,
    1760054400000,
    120,
    '{"formula_ml":120}'::jsonb,
    0,
    '{}'::jsonb,
    95,
    '{"weight_g":6200,"height_cm":62.3}'::jsonb,
    1,
    '今日喂养与睡眠正常，建议持续观察体重增长趋势。',
    1760080000000,
    1760080000000
  );

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
VALUES
  (
    900070101,
    900030001,
    900050001,
    1759708800000,
    '{"feeding_total_ml":810,"sleep_total_minutes":850}'::jsonb,
    '本周整体状态平稳，作息规律较好。',
    1760080000000,
    1760080000000
  );

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
VALUES
  (
    900070201,
    900030001,
    900050001,
    'weight_g',
    'day',
    1760054400000,
    6200,
    'g',
    '{}'::jsonb,
    1760080000000,
    1760080000000
  ),
  (
    900070202,
    900030001,
    900050001,
    'sleep_total_minutes',
    'day',
    1760054400000,
    95,
    'minute',
    '{}'::jsonb,
    1760080000000,
    1760080000000
  );

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
    1760000000000,
    1760000000000
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
VALUES
  (
    900080101,
    900030001,
    900050001,
    900080001,
    'warning',
    '喂养间隔偏长',
    '上午 10:00 至 14:30 间喂养间隔超过阈值，请关注。',
    'open',
    1760068200000,
    NULL,
    NULL,
    1760068200000,
    1760068200000
  );

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
    '今天喂养和睡眠情况如何？',
    '喂养和睡眠总体正常，建议继续记录并观察连续三天趋势。',
    'gpt-4.1-mini',
    '7d',
    'succeeded',
    NULL,
    1760081000000
  );

INSERT INTO ai_messages (id, conversation_id, role, content, token_count, created_at)
VALUES
  (
    900090101,
    900090001,
    'user',
    '今天喂养和睡眠情况如何？',
    14,
    1760081000000
  ),
  (
    900090102,
    900090001,
    'assistant',
    '喂养和睡眠总体正常，建议继续记录并观察连续三天趋势。',
    28,
    1760081010000
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
VALUES
  (
    900100001,
    900030001,
    900050001,
    'daily',
    1760054400000,
    1760140799999,
    'succeeded',
    'reports/900030001/900050001/2026-10-10-daily.pdf',
    'https://example.local/reports/2026-10-10-daily.pdf',
    1760227200000,
    NULL,
    900010001,
    1760082000000,
    1760082000000
  );

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
VALUES
  (
    900110001,
    'aggregate_daily',
    '{"family_id":900030001,"baby_id":900050001,"summary_date":1760054400000}'::jsonb,
    'succeeded',
    0,
    3,
    1760080000000,
    NULL,
    NULL,
    NULL,
    1760080000000,
    1760080000000
  );

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
VALUES
  (
    900120001,
    900030001,
    900010001,
    'growth_event',
    900060001,
    'create',
    'miniapp',
    NULL,
    '{"event_type":"feeding","volume":120}'::jsonb,
    1760058000000
  ),
  (
    900120002,
    900030001,
    900010001,
    'baby',
    900050001,
    'update',
    'miniapp',
    '{"nickname":"小满"}'::jsonb,
    '{"nickname":"满满"}'::jsonb,
    1760071000000
  );

COMMIT;
