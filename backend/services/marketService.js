import { randomUUID } from 'node:crypto';
import { pool } from '../db/pool.js';
import { defaultRadiusKm, marketCoordinates, radiusOptionsKm, transportCostPerKmKg, villageCoordinates } from '../config/nearby.js';
import { approximateCoordinates, rankNearby } from './nearby.js';
import { acceptOfferTransaction } from './acceptOfferTransaction.js';

function createError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function withSummary(market) {
  const distances = market.farmers.map((farmer) => farmer.nearestBuyerDistanceKm).filter(Number.isFinite);
  const prices = market.farmers.map((farmer) => farmer.bestBidPerKg).filter(Number.isFinite);
  return {
    ...market,
    summary: {
      farmerCount: market.farmers.length,
      sellerCount: market.sellers.length,
      availableKg: market.farmers.reduce((sum, farmer) => sum + farmer.availableKg, 0),
      committedKg: market.sellers.reduce((sum, seller) => sum + seller.filledKg, 0),
      marketCount: market.markets.length,
      averageDistanceKm: distances.length ? Number((distances.reduce((sum, value) => sum + value, 0) / distances.length).toFixed(1)) : 0,
      averageBestPricePerKg: prices.length ? Number((prices.reduce((sum, value) => sum + value, 0) / prices.length).toFixed(2)) : 0,
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

export async function getMarket(actor, radiusInput = defaultRadiusKm) {
  const radiusKm = radiusFor(radiusInput);
  const [markets, farmers, sellers, commitments, activity, userResult] = await Promise.all([
    pool.query('SELECT name, latitude, longitude FROM markets ORDER BY sort_order'),
    pool.query(`
      SELECT id, name, village, crop, available_kg AS "availableKg", grade, harvest,
        owner_user_id AS "ownerUserId", latitude, longitude
      FROM farmers ORDER BY sort_order DESC
    `),
    pool.query(`
      SELECT s.id, s.name, s.market_name AS market, s.crop, s.capacity_kg AS "capacityKg",
        s.filled_kg AS "filledKg", s.bid_per_kg::float8 AS "bidPerKg", s.distance_km::float8 AS "distanceKm",
        m.latitude, m.longitude
      FROM sellers s JOIN markets m ON m.name = s.market_name ORDER BY s.sort_order DESC
    `),
    pool.query(`
      SELECT id, farmer_id AS "farmerId", farmer_name AS "farmerName",
        seller_id AS "sellerId", seller_name AS "sellerName", crop,
        quantity_kg AS "quantityKg", price_per_kg::float8 AS "pricePerKg", created_at AS "createdAt"
      FROM commitments ORDER BY created_at DESC
    `),
    pool.query('SELECT id, message, time_label AS time, type FROM activity ORDER BY sort_order DESC LIMIT 8'),
    actor?.id ? pool.query('SELECT latitude, longitude FROM users WHERE id = $1', [actor.id]) : Promise.resolve({ rows: [] }),
  ]);

  const market = {
    markets: markets.rows.map((row) => ({
      name: row.name,
      latitude: row.latitude ?? marketCoordinates[row.name]?.latitude ?? null,
      longitude: row.longitude ?? marketCoordinates[row.name]?.longitude ?? null,
    })),
    farmers: farmers.rows,
    sellers: sellers.rows,
    commitments: commitments.rows,
    activity: activity.rows,
  };
  const savedUser = userResult.rows[0] ?? {};

  if (actor?.role === 'farmer') {
    market.farmers = market.farmers.filter((farmer) => farmer.ownerUserId === actor.id || farmer.id === actor.profileId);
    const farmerIds = new Set(market.farmers.map((farmer) => farmer.id));
    market.commitments = market.commitments.filter((commitment) => farmerIds.has(commitment.farmerId));
    market.activity = [];
    const ownProfile = market.farmers.find((farmer) => farmer.id === actor.profileId);
    const origin = profileCoordinates(savedUser) ?? farmerCoordinates(ownProfile ?? {});
    market.markets = rankNearby(market.markets, { origin, radiusKm, priceFor: () => 0 });
    market.farmers = market.farmers.map((farmer) => {
      const coordinates = farmerCoordinates(farmer);
      const offers = rankNearby(market.sellers.filter((seller) => seller.crop === farmer.crop && seller.filledKg < seller.capacityKg), {
        origin: profileCoordinates(savedUser) ?? coordinates,
        radiusKm,
        priceFor: (seller) => seller.bidPerKg,
        costPerKmKg: transportCostPerKmKg(),
      });
      return {
        ...farmer,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        offers,
        nearestBuyerDistanceKm: offers[0]?.distanceKm,
        bestBidPerKg: offers[0]?.bidPerKg,
      };
    });
    market.sellers = rankNearby(market.sellers, {
      origin,
      radiusKm,
      priceFor: (seller) => seller.bidPerKg,
      costPerKmKg: transportCostPerKmKg(),
    });
  } else if (actor?.role === 'seller') {
    const seller = market.sellers.find((item) => item.id === actor.profileId);
    const origin = profileCoordinates(savedUser) ?? profileCoordinates(seller);
    market.markets = rankNearby(market.markets, { origin, radiusKm, priceFor: () => 0 });
    market.sellers = seller ? [{ ...seller, ...(origin ?? {}) }] : [];
    const supply = seller ? rankNearby(market.farmers
      .filter((farmer) => farmer.crop === seller.crop && farmer.availableKg > 0)
      .map((farmer) => ({ ...farmer, ...(farmerCoordinates(farmer) ?? {}) })), {
        origin,
        radiusKm,
        priceFor: () => seller.bidPerKg,
      }) : [];
    market.farmers = supply.map((farmer) => {
      const approximate = approximateCoordinates(farmer.latitude, farmer.longitude);
      const { latitude, longitude, ...villageOnly } = farmer;
      return { ...villageOnly, approximateLatitude: approximate.latitude, approximateLongitude: approximate.longitude };
    });
    market.commitments = market.commitments.filter((commitment) => commitment.sellerId === actor.profileId);
    market.activity = [];
  } else if (actor?.role === 'admin') {
    market.farmers = market.farmers.map((farmer) => {
      const coordinates = farmerCoordinates(farmer);
      const offers = rankNearby(market.sellers.filter((seller) => seller.crop === farmer.crop), {
        origin: coordinates,
        radiusKm: 50,
        priceFor: (seller) => seller.bidPerKg,
        costPerKmKg: transportCostPerKmKg(),
      });
      return { ...farmer, latitude: coordinates?.latitude ?? null, longitude: coordinates?.longitude ?? null, nearestBuyerDistanceKm: offers[0]?.distanceKm, bestBidPerKg: offers[0]?.bidPerKg };
    });
  }

  return withSummary(market);
}

export async function commitFarmerLot({ farmerId, sellerId, quantityKg } = {}, actor, radiusKm = defaultRadiusKm) {
  const client = await pool.connect();
  try {
    await acceptOfferTransaction(client, { farmerId, sellerId, quantityKg, actor });
  } finally {
    client.release();
  }

  return getMarket(actor, radiusKm);
}

export async function updateSellerBid(sellerId, rawBid, actor, radiusKm = defaultRadiusKm) {
  const bidPerKg = Number(rawBid);
  if (!Number.isFinite(bidPerKg) || bidPerKg < 1 || bidPerKg > 10000) {
    throw createError(400, 'Enter a valid bid between Rs 1 and Rs 10,000 per kg.');
  }
  if (actor && sellerId !== actor.profileId) {
    throw createError(403, 'You can only update your own seller bid.');
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

  return getMarket(actor, radiusKm);
}

export async function createFarmerListing(listing = {}, actor, radiusKm = defaultRadiusKm) {
  const { name, village, crop, availableKg, grade, latitude, longitude } = listing;
  const farmerName = actor?.displayName?.trim() || name?.trim();
  const quantity = Number(availableKg);
  if (!farmerName || !village?.trim() || !crop?.trim() || !Number.isInteger(quantity) || quantity < 1) {
    throw createError(400, 'Add a name, village, crop, and whole-number quantity.');
  }

  const farmer = {
    id: `farmer-${randomUUID()}`,
    name: farmerName,
    village: village.trim(),
    crop: crop.trim(),
    availableKg: quantity,
    grade: grade === 'B' ? 'B' : 'A',
    harvest: 'Today',
    latitude: Number.isFinite(latitude) && Number.isFinite(longitude)
      ? latitude
      : villageCoordinates[village.trim()]?.latitude ?? null,
    longitude: Number.isFinite(latitude) && Number.isFinite(longitude)
      ? longitude
      : villageCoordinates[village.trim()]?.longitude ?? null,
  };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      INSERT INTO farmers (id, name, village, crop, available_kg, grade, harvest, owner_user_id, latitude, longitude)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [farmer.id, farmer.name, farmer.village, farmer.crop, farmer.availableKg, farmer.grade, farmer.harvest, actor?.id ?? null, farmer.latitude, farmer.longitude]);
    if (farmer.latitude !== null && farmer.longitude !== null && actor?.id) {
      await client.query('UPDATE users SET latitude = $1, longitude = $2 WHERE id = $3', [farmer.latitude, farmer.longitude, actor.id]);
    }
    await recordActivity(client, `${farmer.name} listed ${quantity} kg of ${farmer.crop.toLowerCase()}`, 'listing');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return getMarket(actor, radiusKm);
}

export async function updateFarmerListing(farmerId, listing = {}, actor, radiusKm = defaultRadiusKm) {
  const { village, crop, availableKg, grade, latitude, longitude } = listing;
  const quantity = Number(availableKg);
  if (!village?.trim() || !crop?.trim() || !Number.isInteger(quantity) || quantity < 1) {
    throw createError(400, 'Add a village, crop, and whole-number weight of at least 1 kg.');
  }
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const coordinates = hasCoordinates
    ? { latitude, longitude }
    : villageCoordinates[village.trim()] ?? { latitude: null, longitude: null };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      UPDATE farmers f SET village = $1, crop = $2, available_kg = $3, grade = $4,
        latitude = $5, longitude = $6
      WHERE f.id = $7 AND (f.owner_user_id = $8 OR f.id = $9)
        AND NOT EXISTS (SELECT 1 FROM commitments c WHERE c.farmer_id = f.id)
      RETURNING f.name
    `, [village.trim(), crop.trim(), quantity, grade === 'B' ? 'B' : 'A', coordinates.latitude, coordinates.longitude, farmerId, actor.id, actor.profileId]);
    if (!result.rowCount) throw createError(409, 'This listing has a commitment or is not yours, so it cannot be edited.');
    if (coordinates.latitude !== null && coordinates.longitude !== null) {
      await client.query('UPDATE users SET latitude = $1, longitude = $2 WHERE id = $3', [coordinates.latitude, coordinates.longitude, actor.id]);
    }
    await recordActivity(client, `${result.rows[0].name} updated a ${crop.toLowerCase()} listing`, 'listing');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return getMarket(actor, radiusKm);
}

export async function withdrawFarmerListing(farmerId, actor, radiusKm = defaultRadiusKm) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      DELETE FROM farmers f
      WHERE f.id = $1 AND (f.owner_user_id = $2 OR f.id = $3)
        AND NOT EXISTS (SELECT 1 FROM commitments c WHERE c.farmer_id = f.id)
      RETURNING f.name, f.crop
    `, [farmerId, actor.id, actor.profileId]);
    if (!result.rowCount) throw createError(409, 'This listing has a commitment or is not yours, so it cannot be withdrawn.');
    await recordActivity(client, `${result.rows[0].name} withdrew a ${result.rows[0].crop.toLowerCase()} listing`, 'listing');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return getMarket(actor, radiusKm);
}

export async function getDeals(actor) {
  const result = await pool.query(`
    SELECT d.id, d.farmer_id AS "farmerId", d.seller_id AS "sellerId",
      f.name AS "farmerName", f.village, f.latitude AS "farmerLatitude", f.longitude AS "farmerLongitude",
      s.name AS "sellerName", s.market_name AS market, m.latitude AS "sellerLatitude", m.longitude AS "sellerLongitude",
      d.crop, d.quantity_kg AS "quantityKg", d.price_per_kg::float8 AS "pricePerKg",
      d.total_price::float8 AS "totalPrice", d.status, d.created_at AS "createdAt"
    FROM deals d JOIN farmers f ON f.id = d.farmer_id
      JOIN sellers s ON s.id = d.seller_id JOIN markets m ON m.name = s.market_name
    WHERE ($1 = 'admin')
      OR ($1 = 'farmer' AND (d.farmer_id = $2 OR d.farmer_id IN (SELECT id FROM farmers WHERE owner_user_id = $4)))
      OR ($1 = 'seller' AND d.seller_id = $3)
    ORDER BY d.created_at DESC
  `, [actor.role, actor.profileId, actor.profileId, actor.id]);

  return result.rows.map((deal) => actor.role === 'seller' && deal.status !== 'Accepted'
    ? { ...deal, farmerLatitude: null, farmerLongitude: null }
    : deal);
}

function radiusFor(value) {
  const radius = Number(value);
  return radiusOptionsKm.includes(radius) ? radius : defaultRadiusKm;
}

function profileCoordinates(profile) {
  return Number.isFinite(profile?.latitude) && Number.isFinite(profile?.longitude)
    ? { latitude: profile.latitude, longitude: profile.longitude }
    : null;
}

function farmerCoordinates(farmer) {
  return profileCoordinates(farmer) ?? villageCoordinates[farmer.village] ?? null;
}