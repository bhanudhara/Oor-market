ALTER TABLE farmers ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

UPDATE farmers SET latitude = COALESCE(latitude, CASE village
  WHEN 'Kandiyur' THEN 10.8602519
  WHEN 'Thiruvaiyaru' THEN 10.8797198
  WHEN 'Thogur' THEN 10.8303344
  WHEN 'Papanasam' THEN 10.8604181
  WHEN 'Ayyampettai' THEN 10.8962881
  WHEN 'Thirumanur' THEN 10.9351706
END), longitude = COALESCE(longitude, CASE village
  WHEN 'Kandiyur' THEN 79.1077238
  WHEN 'Thiruvaiyaru' THEN 79.1039298
  WHEN 'Thogur' THEN 78.8110685
  WHEN 'Papanasam' THEN 79.235816
  WHEN 'Ayyampettai' THEN 79.1886395
  WHEN 'Thirumanur' THEN 79.1034943
END);

UPDATE markets SET latitude = CASE name
  WHEN 'Thanjavur Central Market' THEN COALESCE(latitude, 10.659037)
  WHEN 'Kumbakonam Market' THEN COALESCE(latitude, 10.9604108)
  WHEN 'Papanasam Uzhavar Sandhai' THEN COALESCE(latitude, 10.8604181)
  WHEN 'Ayyampettai Market' THEN COALESCE(latitude, 10.8962881)
  ELSE latitude
END, longitude = CASE name
  WHEN 'Thanjavur Central Market' THEN COALESCE(longitude, 79.2014278)
  WHEN 'Kumbakonam Market' THEN COALESCE(longitude, 79.3820861)
  WHEN 'Papanasam Uzhavar Sandhai' THEN COALESCE(longitude, 79.235816)
  WHEN 'Ayyampettai Market' THEN COALESCE(longitude, 79.1886395)
  ELSE longitude
END;

UPDATE users u SET latitude = COALESCE(u.latitude, f.latitude), longitude = COALESCE(u.longitude, f.longitude)
FROM farmers f WHERE u.role = 'farmer' AND u.profile_id = f.id;

UPDATE users u SET latitude = COALESCE(u.latitude, m.latitude), longitude = COALESCE(u.longitude, m.longitude)
FROM sellers s JOIN markets m ON m.name = s.market_name
WHERE u.role = 'seller' AND u.profile_id = s.id;

CREATE TABLE IF NOT EXISTS deals (
  id TEXT PRIMARY KEY,
  commitment_id TEXT UNIQUE REFERENCES commitments(id) ON DELETE SET NULL,
  farmer_id TEXT NOT NULL REFERENCES farmers(id),
  seller_id TEXT NOT NULL REFERENCES sellers(id),
  crop TEXT NOT NULL,
  quantity_kg INTEGER NOT NULL CHECK (quantity_kg >= 1),
  price_per_kg NUMERIC(10, 2) NOT NULL CHECK (price_per_kg BETWEEN 1 AND 10000),
  total_price NUMERIC(12, 2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Accepted' CHECK (status IN ('Accepted', 'Completed', 'Cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS deals_farmer_idx ON deals (farmer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deals_seller_idx ON deals (seller_id, created_at DESC);

INSERT INTO deals (id, commitment_id, farmer_id, seller_id, crop, quantity_kg, price_per_kg, total_price, status, created_at)
SELECT 'deal-' || c.id, c.id, c.farmer_id, c.seller_id, c.crop, c.quantity_kg,
  c.price_per_kg, c.quantity_kg * c.price_per_kg, 'Accepted', c.created_at
FROM commitments c
ON CONFLICT (commitment_id) DO NOTHING;