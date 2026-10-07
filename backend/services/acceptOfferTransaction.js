import { randomUUID } from 'node:crypto';

function serviceError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

export async function acceptOfferTransaction(client, { farmerId, sellerId, quantityKg, actor }) {
  if (!Number.isInteger(quantityKg) || quantityKg < 1) {
    throw serviceError(400, 'Weight must be a whole number of at least 1 kg.');
  }

  await client.query('BEGIN');
  try {
    const farmerResult = await client.query(`
      SELECT id, name, crop, available_kg AS "availableKg", owner_user_id AS "ownerUserId",
        latitude, longitude
      FROM farmers WHERE id = $1 FOR UPDATE
    `, [farmerId]);
    const sellerResult = await client.query(`
      SELECT s.id, s.name, s.crop, s.capacity_kg AS "capacityKg", s.filled_kg AS "filledKg",
        s.bid_per_kg::float8 AS "bidPerKg", m.latitude, m.longitude
      FROM sellers s JOIN markets m ON m.name = s.market_name
      WHERE s.id = $1 FOR UPDATE OF s
    `, [sellerId]);
    const farmer = farmerResult.rows[0];
    const seller = sellerResult.rows[0];

    if (!farmer || !seller) throw serviceError(404, 'Farmer or seller was not found.');
    if (farmer.ownerUserId !== actor.id && farmer.id !== actor.profileId) {
      throw serviceError(403, 'You can only commit produce from your own listings.');
    }
    if (farmer.crop !== seller.crop) throw serviceError(400, 'This buyer is not purchasing that crop.');
    if (quantityKg > farmer.availableKg) throw serviceError(400, 'That is more than the farmer has available.');
    if (quantityKg > seller.capacityKg - seller.filledKg) throw serviceError(400, 'That is more than the buyer has room for.');
    if (!Number.isFinite(seller.bidPerKg) || seller.bidPerKg < 1 || seller.bidPerKg > 10000) {
      throw serviceError(400, 'Seller bid must be between Rs 1 and Rs 10,000 per kg.');
    }

    const dealId = `deal-${randomUUID()}`;
    const commitmentId = `commitment-${randomUUID()}`;
    const totalPrice = Number((quantityKg * seller.bidPerKg).toFixed(2));
    await client.query('UPDATE farmers SET available_kg = available_kg - $1 WHERE id = $2', [quantityKg, farmerId]);
    await client.query('UPDATE sellers SET filled_kg = filled_kg + $1 WHERE id = $2', [quantityKg, sellerId]);
    await client.query(`
      INSERT INTO commitments (id, farmer_id, farmer_name, seller_id, seller_name, crop, quantity_kg, price_per_kg)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [commitmentId, farmerId, farmer.name, sellerId, seller.name, farmer.crop, quantityKg, seller.bidPerKg]);
    await client.query(`
      INSERT INTO deals (id, commitment_id, farmer_id, seller_id, crop, quantity_kg, price_per_kg, total_price, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Accepted')
    `, [dealId, commitmentId, farmerId, sellerId, farmer.crop, quantityKg, seller.bidPerKg, totalPrice]);
    await client.query(`
      INSERT INTO activity (id, message, type, time_label)
      VALUES ($1, $2, 'commitment', 'Just now')
    `, [`activity-${randomUUID()}`, `${farmer.name} committed ${quantityKg} kg of ${farmer.crop.toLowerCase()} to ${seller.name}`]);
    await client.query('COMMIT');

    return {
      id: dealId,
      commitmentId,
      farmerId,
      sellerId,
      crop: farmer.crop,
      quantityKg,
      pricePerKg: seller.bidPerKg,
      totalPrice,
      status: 'Accepted',
      farmerCoordinates: { latitude: farmer.latitude, longitude: farmer.longitude },
      sellerCoordinates: { latitude: seller.latitude, longitude: seller.longitude },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}