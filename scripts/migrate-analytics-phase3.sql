-- Phase 3 first-party analytics pipeline: raw events + daily rollups.
-- Lives in a dedicated `analytics` schema, never `public` -- Payload's drizzle
-- push treats unknown public tables as drift and can hang deploys with
-- interactive prompts. Every reference elsewhere in the app must be
-- schema-qualified (analytics.events, analytics.daily).
-- Idempotent. Registered in scripts/run-migrations.ts.

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.events (
  id bigserial PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  event_type text NOT NULL,
  path text,
  entity_type text,
  entity_id integer,
  session_id text,
  visitor_id text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  ip_hash text,
  geo_city text,
  geo_state text,
  device text,
  browser text,
  meta jsonb
);

CREATE INDEX IF NOT EXISTS events_ts_idx ON analytics.events (ts);
CREATE INDEX IF NOT EXISTS events_type_ts_idx ON analytics.events (event_type, ts);
CREATE INDEX IF NOT EXISTS events_entity_idx ON analytics.events (entity_type, entity_id, ts);
CREATE INDEX IF NOT EXISTS events_session_idx ON analytics.events (session_id);

CREATE TABLE IF NOT EXISTS analytics.daily (
  day date NOT NULL,
  metric text NOT NULL,
  dimension text NOT NULL DEFAULT '',
  value bigint NOT NULL,
  PRIMARY KEY (day, metric, dimension)
);
