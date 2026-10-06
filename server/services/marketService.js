import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';

function createError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function withSummary(market) {
  return {
    ...market,
    summary: {
      farmerCount: market.farmers.length,
      sellerCount: market.sellers.length,
      availableKg: market.farmers.reduce((sum, farmer) => sum + farmer.availableKg, 0),
      committedKg: market.sellers.reduce((sum, seller) => sum + seller.filledKg, 0),
      marketCount: market.markets.length,
    },
  };
}

async function recordActivity(client, message, type) {
  await client.query(
    'INSERT INTO activity (id, message, type, time_label) VALUES ($1, $2, $3, $4)',
    [`activity-${randomUUID()}`, message, type, 'Just now'],
  );
  await client.query(`
    DELETE FROM activity
    WHERE id IN (
      SELECT id FROM activity ORDER BY sort_order DESC OFFSET 8
    )
  `);
}

export async function getMarket() {
  const [markets, farmers, sellers, commitments, activity] = await Promise.all([
    pool.query('SELECT name FROM markets ORDER BY sort_order'),
    pool.query(`
      SELECT id, name, village, crop, available_kg AS "availableKg", grade, harvest
      FROM farmers ORDER BY sort_order DESC
    `),
    pool.query(`
      SELECT id, name, market_name AS market, crop, capacity_kg AS "capacityKg",
        filled_kg AS "filledKg", bid_per_kg::float8 AS "bidPerKg", distance_km::float8 AS "distanceKm"
      FROM sellers ORDER BY sort_order DESC
    `),
    pool.query(`
      SELECT id, farmer_id AS "farmerId", farmer_name AS "farmerName",
        seller_id AS "sellerId", seller_name AS "sellerName", crop,
        quantity_kg AS "quantityKg", price_per_kg::float8 AS "pricePerKg", created_at AS "createdAt"
      FROM commitments ORDER BY created_at DESC
    `),
    pool.query('SELECT id, message, time_label AS time, type FROM activity ORDER BY sort_order DESC LIMIT 8'),
  ]);

  return withSummary({
    markets: markets.rows.map((row) => row.name),
    farmers: farmers.rows,
    sellers: sellers.rows,
    commitments: commitments.rows,
    activity: activity.rows,
  });
}

export async function commitFarmerLot({ farmerId, sellerId, quantityKg } = {}) {
  if (!Number.isInteger(quantityKg) || quantityKg < 1) {
    throw createError(400, 'Enter a whole-number quantity greater than zero.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const farmerResult = await client.query(`
      SELECT id, name, crop, available_kg AS "availableKg"
      FROM farmers WHERE id = $1 FOR UPDATE
    `, [farmerId]);
    const sellerResult = await client.query(`
      SELECT id, name, crop, capacity_kg AS "capacityKg", filled_kg AS "filledKg",
        bid_per_kg::float8 AS "bidPerKg"
      FROM sellers WHERE id = $1 FOR UPDATE
    `, [sellerId]);
    const farmer = farmerResult.rows[0];
    const seller = sellerResult.rows[0];

    if (!farmer || !seller) throw createError(404, 'Farmer or seller was not found.');
    if (farmer.crop !== seller.crop) throw createError(400, 'This buyer is not purchasing that crop.');
    if (quantityKg > farmer.availableKg) throw createError(400, 'That is more than the farmer has available.');
    if (quantityKg > seller.capacityKg - seller.filledKg) throw createError(400, 'That is more than the buyer has room for.');

    const commitmentId = `commitment-${randomUUID()}`;
    await client.query('UPDATE farmers SET available_kg = available_kg - $1 WHERE id = $2', [quantityKg, farmerId]);
    await client.query('UPDATE sellers SET filled_kg = filled_kg + $1 WHERE id = $2', [quantityKg, sellerId]);
    await client.query(`
      INSERT INTO commitments (id, farmer_id, farmer_name, seller_id, seller_name, crop, quantity_kg, price_per_kg)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [commitmentId, farmerId, farmer.name, sellerId, seller.name, farmer.crop, quantityKg, seller.bidPerKg]);
    await recordActivity(client, `${farmer.name} committed ${quantityKg} kg of ${farmer.crop.toLowerCase()} to ${seller.name}`, 'commitment');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return getMarket();
}

export async function updateSellerBid(sellerId, rawBid) {
  const bidPerKg = Number(rawBid);
  if (!Number.isFinite(bidPerKg) || bidPerKg < 1 || bidPerKg > 10000) {
    throw createError(400, 'Enter a valid bid between Rs 1 and Rs 10,000 per kg.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      UPDATE sellers SET bid_per_kg = $1 WHERE id = $2
      RETURNING name, crop
    `, [bidPerKg, sellerId]);
    const seller = result.rows[0];
    if (!seller) throw createError(404, 'Seller was not found.');
    await recordActivity(client, `${seller.name} set a ${seller.crop.toLowerCase()} bid of Rs ${bidPerKg}/kg`, 'bid');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return getMarket();
}

export async function createFarmerListing(listing = {}) {
  const { name, village, crop, availableKg, grade } = listing;
  const quantity = Number(availableKg);
  if (!name?.trim() || !village?.trim() || !crop?.trim() || !Number.isInteger(quantity) || quantity < 1) {
    throw createError(400, 'Add a name, village, crop, and whole-number quantity.');
  }

  const farmer = {
    id: `farmer-${randomUUID()}`,
    name: name.trim(),
    village: village.trim(),
    crop: crop.trim(),
    availableKg: quantity,
    grade: grade === 'B' ? 'B' : 'A',
    harvest: 'Today',
  };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO farmers (id, name, village, crop, available_kg, grade, harvest)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [farmer.id, farmer.name, farmer.village, farmer.crop, farmer.availableKg, farmer.grade, farmer.harvest]);
    await recordActivity(client, `${farmer.name} listed ${quantity} kg of ${farmer.crop.toLowerCase()}`, 'listing');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return getMarket();
}