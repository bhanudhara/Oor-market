CREATE TABLE IF NOT EXISTS markets (
  name TEXT PRIMARY KEY,
  sort_order BIGSERIAL NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS farmers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  village TEXT NOT NULL,
  crop TEXT NOT NULL,
  available_kg INTEGER NOT NULL CHECK (available_kg >= 0),
  grade TEXT NOT NULL CHECK (grade IN ('A', 'B')),
  harvest TEXT NOT NULL,
  sort_order BIGSERIAL NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS farmers_crop_idx ON farmers (crop);

CREATE TABLE IF NOT EXISTS sellers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  market_name TEXT NOT NULL REFERENCES markets(name),
  crop TEXT NOT NULL,
  capacity_kg INTEGER NOT NULL CHECK (capacity_kg > 0),
  filled_kg INTEGER NOT NULL DEFAULT 0 CHECK (filled_kg >= 0 AND filled_kg <= capacity_kg),
  bid_per_kg NUMERIC(10, 2) NOT NULL CHECK (bid_per_kg > 0),
  distance_km NUMERIC(7, 2) NOT NULL DEFAULT 0 CHECK (distance_km >= 0),
  sort_order BIGSERIAL NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS sellers_crop_idx ON sellers (crop);

CREATE TABLE IF NOT EXISTS commitments (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  farmer_name TEXT NOT NULL,
  seller_id TEXT NOT NULL REFERENCES sellers(id),
  seller_name TEXT NOT NULL,
  crop TEXT NOT NULL,
  quantity_kg INTEGER NOT NULL CHECK (quantity_kg > 0),
  price_per_kg NUMERIC(10, 2) NOT NULL CHECK (price_per_kg > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  time_label TEXT NOT NULL,
  sort_order BIGSERIAL NOT NULL UNIQUE
);