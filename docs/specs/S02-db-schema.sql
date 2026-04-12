CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name VARCHAR(100) NOT NULL,
    phone_ciphertext TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    provider VARCHAR(30) NOT NULL CHECK (provider IN ('wechat_mp')),
    openid_ciphertext TEXT NOT NULL,
    unionid_ciphertext TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

CREATE TABLE families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE family_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id),
    user_id UUID NOT NULL REFERENCES users(id),
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'caregiver', 'viewer')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'removed')),
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (family_id, user_id)
);

CREATE TABLE babies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id),
    name VARCHAR(100) NOT NULL,
    nickname VARCHAR(100),
    gender VARCHAR(20) NOT NULL DEFAULT 'unknown' CHECK (gender IN ('male', 'female', 'unknown')),
    birth_date DATE NOT NULL,
    due_date DATE,
    birth_weight_g INTEGER,
    birth_height_cm NUMERIC(6,2),
    birth_head_circumference_cm NUMERIC(6,2),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE growth_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id),
    baby_id UUID NOT NULL REFERENCES babies(id),
    event_type VARCHAR(30) NOT NULL CHECK (
        event_type IN ('feeding', 'excretion', 'measurement', 'sleep', 'medication', 'vaccine', 'milestone')
    ),
    occurred_at TIMESTAMPTZ NOT NULL,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Shanghai',
    source VARCHAR(20) NOT NULL DEFAULT 'miniapp' CHECK (source IN ('miniapp', 'h5', 'admin', 'system')),
    notes TEXT,
    payload_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE feeding_events (
    event_id UUID PRIMARY KEY REFERENCES growth_events(id),
    mode VARCHAR(30) NOT NULL CHECK (mode IN ('breast_milk', 'bottle_breast_milk', 'formula', 'solid_food', 'water')),
    volume NUMERIC(10,2) NOT NULL CHECK (volume > 0),
    unit VARCHAR(10) NOT NULL DEFAULT 'ml',
    is_night BOOLEAN NOT NULL DEFAULT FALSE,
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE excretion_events (
    event_id UUID PRIMARY KEY REFERENCES growth_events(id),
    excretion_type VARCHAR(20) NOT NULL CHECK (excretion_type IN ('urine', 'stool', 'mixed')),
    color VARCHAR(30),
    texture VARCHAR(30),
    is_abnormal BOOLEAN NOT NULL DEFAULT FALSE,
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE measurement_events (
    event_id UUID PRIMARY KEY REFERENCES growth_events(id),
    weight_g INTEGER CHECK (weight_g > 0),
    height_cm NUMERIC(6,2),
    head_circumference_cm NUMERIC(6,2),
    hand_length_cm NUMERIC(6,2),
    leg_length_cm NUMERIC(6,2),
    temperature_c NUMERIC(4,2),
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE sleep_events (
    event_id UUID PRIMARY KEY REFERENCES growth_events(id),
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes >= 0),
    night_wake_count INTEGER NOT NULL DEFAULT 0 CHECK (night_wake_count >= 0),
    quality_tag VARCHAR(20),
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE medication_events (
    event_id UUID PRIMARY KEY REFERENCES growth_events(id),
    medicine_name VARCHAR(120) NOT NULL,
    dosage NUMERIC(10,2),
    dosage_unit VARCHAR(20),
    planned_at TIMESTAMPTZ,
    taken_at TIMESTAMPTZ,
    execution_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (execution_status IN ('pending', 'taken', 'skipped')),
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE vaccine_events (
    event_id UUID PRIMARY KEY REFERENCES growth_events(id),
    vaccine_name VARCHAR(120) NOT NULL,
    planned_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    institution_name VARCHAR(120),
    batch_no VARCHAR(80),
    status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'missed')),
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE milestone_events (
    event_id UUID PRIMARY KEY REFERENCES growth_events(id),
    milestone_type VARCHAR(50) NOT NULL,
    description TEXT,
    extra JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE daily_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id),
    baby_id UUID NOT NULL REFERENCES babies(id),
    summary_date DATE NOT NULL,
    feeding_total_ml INTEGER NOT NULL DEFAULT 0,
    feeding_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    excretion_count_total INTEGER NOT NULL DEFAULT 0,
    excretion_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    sleep_total_minutes INTEGER NOT NULL DEFAULT 0,
    last_measurement_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    alert_count INTEGER NOT NULL DEFAULT 0,
    ai_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (family_id, baby_id, summary_date)
);

CREATE TABLE weekly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id),
    baby_id UUID NOT NULL REFERENCES babies(id),
    week_start DATE NOT NULL,
    summary_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (family_id, baby_id, week_start)
);

CREATE TABLE metric_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id),
    baby_id UUID NOT NULL REFERENCES babies(id),
    metric_code VARCHAR(50) NOT NULL,
    bucket_type VARCHAR(20) NOT NULL CHECK (bucket_type IN ('day', 'week', 'month')),
    bucket_date DATE NOT NULL,
    metric_value NUMERIC(12,2) NOT NULL,
    metric_unit VARCHAR(20),
    tags JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (baby_id, metric_code, bucket_type, bucket_date)
);

CREATE TABLE alert_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id),
    rule_type VARCHAR(50) NOT NULL,
    threshold_value NUMERIC(12,2),
    window_hours INTEGER,
    window_days INTEGER,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'high')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE alert_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id),
    baby_id UUID NOT NULL REFERENCES babies(id),
    rule_id UUID REFERENCES alert_rules(id),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'high')),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    triggered_at TIMESTAMPTZ NOT NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id),
    baby_id UUID NOT NULL REFERENCES babies(id),
    asked_by UUID REFERENCES users(id),
    question TEXT NOT NULL,
    answer TEXT,
    model_name VARCHAR(100),
    context_window VARCHAR(50),
    status VARCHAR(20) NOT NULL CHECK (status IN ('succeeded', 'failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id),
    role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
    content TEXT NOT NULL,
    token_count INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE export_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id),
    baby_id UUID NOT NULL REFERENCES babies(id),
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'custom')),
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
    object_key VARCHAR(255),
    download_url TEXT,
    expires_at TIMESTAMPTZ,
    error_message TEXT,
    requested_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE task_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'succeeded', 'failed')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID REFERENCES families(id),
    operator_user_id UUID REFERENCES users(id),
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    action VARCHAR(30) NOT NULL,
    source VARCHAR(20) NOT NULL CHECK (source IN ('miniapp', 'h5', 'admin', 'system')),
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_growth_events_baby_occurred_at ON growth_events (baby_id, occurred_at DESC);
CREATE INDEX idx_growth_events_family_type_occurred_at ON growth_events (family_id, event_type, occurred_at DESC);
CREATE INDEX idx_daily_summaries_baby_date ON daily_summaries (baby_id, summary_date DESC);
CREATE INDEX idx_metric_snapshots_baby_metric_bucket ON metric_snapshots (baby_id, metric_code, bucket_date);
CREATE INDEX idx_alert_events_baby_status_triggered ON alert_events (baby_id, status, triggered_at DESC);
CREATE INDEX idx_task_jobs_status_run_after ON task_jobs (status, run_after);
