import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptOfferTransaction } from '../services/acceptOfferTransaction.js';

function createClient({ farmerAvailableKg = 60, sellerFilledKg = 0, sellerCapacityKg = 130 } = {}) {
  const calls = [];
  const client = {
    calls,
    async query(sql, params = []) {
      const normalized = sql.replace(/\s+/g, ' ').trim();
      calls.push({ sql: normalized, params });
      if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') return { rows: [], rowCount: 0 };
      if (normalized.includes('FROM farmers WHERE')) return { rows: [{ id: 'farmer-1', name: 'Muthuvel', crop: 'Tomato', availableKg: farmerAvailableKg, ownerUserId: 'user-farmer', latitude: 10.86, longitude: 79.1 }] };
      if (normalized.includes('FROM sellers s JOIN markets')) return { rows: [{ id: 'seller-1', name: 'Malar Stores', crop: 'Tomato', capacityKg: sellerCapacityKg, filledKg: sellerFilledKg, bidPerKg: 31, latitude: 10.66, longitude: 79.2 }] };
      return { rows: [], rowCount: 1 };
    },
  };
  return client;
}

const actor = { id: 'user-farmer', profileId: 'farmer-1' };

test('accepted offer updates inventory, seller capacity, commitment, deal, and commit together', async () => {
  const client = createClient();
  const deal = await acceptOfferTransaction(client, { farmerId: 'farmer-1', sellerId: 'seller-1', quantityKg: 60, actor });
  const statements = client.calls.map((call) => call.sql);

  assert.equal(deal.totalPrice, 1860);
  assert.equal(deal.status, 'Accepted');
  assert.ok(statements.some((sql) => sql.startsWith('UPDATE farmers')));
  assert.ok(statements.some((sql) => sql.startsWith('UPDATE sellers')));
  assert.ok(statements.some((sql) => sql.startsWith('INSERT INTO deals')));
  assert.equal(statements.at(-1), 'COMMIT');
});

test('oversized offer rolls back before any inventory update', async () => {
  const client = createClient({ sellerFilledKg: 100, sellerCapacityKg: 130 });
  await assert.rejects(
    acceptOfferTransaction(client, { farmerId: 'farmer-1', sellerId: 'seller-1', quantityKg: 31, actor }),
    { statusCode: 400 },
  );
  const statements = client.calls.map((call) => call.sql);
  assert.equal(statements.at(-1), 'ROLLBACK');
  assert.equal(statements.some((sql) => sql.startsWith('UPDATE farmers') || sql.startsWith('UPDATE sellers')), false);
});

test('zero, fractional, and missing weights are rejected', async () => {
  for (const quantityKg of [0, 0.5, undefined]) {
    const client = createClient();
    await assert.rejects(
      acceptOfferTransaction(client, { farmerId: 'farmer-1', sellerId: 'seller-1', quantityKg, actor }),
      { statusCode: 400 },
    );
    assert.equal(client.calls.length, 0);
  }
});