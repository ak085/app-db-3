-- Storage App TimescaleDB Initialization
-- Creates sensor_readings hypertable for time-series data

-- Create extension if not exists
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create sensor_readings table
CREATE TABLE IF NOT EXISTS sensor_readings (
  time TIMESTAMPTZ NOT NULL,

  -- Site and equipment identifiers
  site_id TEXT,
  equipment_type TEXT,
  equipment_id TEXT,

  -- BACnet identifiers
  device_id INTEGER NOT NULL,
  device_name TEXT,
  device_ip TEXT,
  object_type TEXT NOT NULL,
  object_instance INTEGER NOT NULL,

  -- Point information (nullable - MQTT uses BACnet identifiers)
  point_id INTEGER,
  point_name TEXT,
  haystack_name TEXT,
  dis TEXT,

  -- Measurement data
  value DOUBLE PRECISION,
  units TEXT,
  quality TEXT CHECK (quality IN ('good', 'uncertain', 'bad')),

  -- Metadata
  poll_duration REAL,
  poll_cycle BIGINT
);

-- Convert to hypertable (partitioned by time)
SELECT create_hypertable(
  'sensor_readings',
  'time',
  if_not_exists => TRUE,
  chunk_time_interval => INTERVAL '1 day'
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sensor_point_time
  ON sensor_readings (point_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_device_time
  ON sensor_readings (device_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_equipment_time
  ON sensor_readings (site_id, equipment_type, equipment_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_haystack
  ON sensor_readings (haystack_name, time DESC);

-- Enable compression (compress data older than 6 hours)
ALTER TABLE sensor_readings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'device_id, object_type, object_instance',
  timescaledb.compress_orderby = 'time DESC'
);

-- Add compression policy (compress chunks older than 6 hours)
SELECT add_compression_policy(
  'sensor_readings',
  INTERVAL '6 hours',
  if_not_exists => TRUE
);

-- Add retention policy (drop data older than 30 days)
SELECT add_retention_policy(
  'sensor_readings',
  INTERVAL '30 days',
  if_not_exists => TRUE
);

-- Create continuous aggregate for 5-minute averages (useful for Grafana)
CREATE MATERIALIZED VIEW IF NOT EXISTS sensor_readings_5min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', time) AS bucket,
  device_id,
  object_type,
  object_instance,
  haystack_name,
  site_id,
  equipment_type,
  equipment_id,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  COUNT(*) AS sample_count
FROM sensor_readings
WHERE quality = 'good'
GROUP BY bucket, device_id, object_type, object_instance, haystack_name, site_id, equipment_type, equipment_id;

-- Refresh policy for continuous aggregate (refresh every 5 minutes)
SELECT add_continuous_aggregate_policy(
  'sensor_readings_5min',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE
);

-- Grant permissions
GRANT ALL ON sensor_readings TO timescale;
GRANT ALL ON sensor_readings_5min TO timescale;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ TimescaleDB initialization complete!';
  RAISE NOTICE '   - sensor_readings hypertable created';
  RAISE NOTICE '   - Compression enabled (6 hours)';
  RAISE NOTICE '   - Retention policy: 30 days';
  RAISE NOTICE '   - Continuous aggregate: 5-minute averages';
END $$;
