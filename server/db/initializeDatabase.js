import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const databaseDirectory = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(databaseDirectory, 'schema.sql');
const seedPath = path.join(databaseDirectory, '..', 'data', 'market.json');

export async function initializeDatabase() {
  const schema = await fs.readFile(schemaPath, 'utf8');
  await pool.query(schema);

  const result = await pool.query(`
    SELECT NOT EXISTS (SELECT 1 FROM farmers) AND NOT EXISTS (SELECT 1 FROM sellers) AS is_empty
  `);
  if (!result.rows[0].is_empty) return;

  const seed = JSON.parse(await fs.readFile(seedPath, 'utf8'));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const name of seed.markets) {
      await client.query('INSERT INTO markets (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [name]);
    }
    for (const farmer of [...seed.farmers].reverse()) {
      await client.query(`
        INSERT INTO farmers (id, name, village, crop, available_kg, grade, harvest)
        VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING
      `, [farmer.id, farmer.name, farmer.village, farmer.crop, farmer.availableKg, farmer.grade, farmer.harvest]);
    }
    for (const seller of [...seed.sellers].reverse()) {
      await client.query(`
        INSERT INTO sellers (id, name, market_name, crop, capacity_kg, filled_kg, bid_per_kg, distance_km)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (id) DO NOTHING
      `, [seller.id, seller.name, seller.market, seller.crop, seller.capacityKg, seller.filledKg, seller.bidPerKg, seller.distanceKm]);
    }
    for (const commitment of [...seed.commitments].reverse()) {
      await client.query(`
        INSERT INTO commitments (id, farmer_id, farmer_name, seller_id, seller_name, crop, quantity_kg, price_per_kg, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW())) ON CONFLICT (id) DO NOTHING
      `, [commitment.id, commitment.farmerId, commitment.farmerName, commitment.sellerId, commitment.sellerName, commitment.crop, commitment.quantityKg, commitment.pricePerKg, commitment.createdAt ?? null]);
    }
    for (const item of [...seed.activity].reverse()) {
      await client.query(`
        INSERT INTO activity (id, message, type, time_label)
        VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING
      `, [item.id, item.message, item.type, item.time]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}