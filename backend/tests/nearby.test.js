import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, rankNearby } from '../services/nearby.js';

test('Haversine distance matches the Thanjavur to Kumbakonam town distance', () => {
  const distance = haversineKm(
    { latitude: 10.659037, longitude: 79.2014278 },
    { latitude: 10.9604108, longitude: 79.3820861 },
  );
  assert.ok(distance > 35 && distance < 40, `distance was ${distance} km`);
});

test('radius filtering sorts equal bids by distance and computes net price', () => {
  const origin = { latitude: 10.86, longitude: 79.10 };
  const results = rankNearby([
    { id: 'farther', latitude: 10.88, longitude: 79.10, bidPerKg: 40 },
    { id: 'nearer', latitude: 10.861, longitude: 79.10, bidPerKg: 40 },
    { id: 'outside', latitude: 11.2, longitude: 79.10, bidPerKg: 90 },
  ], { origin, radiusKm: 5, priceFor: (item) => item.bidPerKg, costPerKmKg: 0.5 });

  assert.deepEqual(results.map((item) => item.id), ['nearer', 'farther']);
  assert.ok(results.every((item) => item.distanceKm <= 5));
  assert.equal(results[0].distance_km, results[0].distanceKm);
  assert.equal(results[0].net_price_per_kg, results[0].netPricePerKg);
  assert.ok(results[0].netPricePerKg < 40);
});

test('higher bid sorts ahead of a closer lower bid', () => {
  const results = rankNearby([
    { id: 'near-low', latitude: 10.861, longitude: 79.10, bidPerKg: 29 },
    { id: 'far-high', latitude: 10.88, longitude: 79.10, bidPerKg: 31 },
  ], { origin: { latitude: 10.86, longitude: 79.10 }, radiusKm: 5, priceFor: (item) => item.bidPerKg });

  assert.deepEqual(results.map((item) => item.id), ['far-high', 'near-low']);
});