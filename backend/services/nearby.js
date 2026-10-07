import { transportCostPerKmKg } from '../config/nearby.js';

const earthRadiusKm = 6371.0088;
const toRadians = (degrees) => degrees * Math.PI / 180;

export function haversineKm(first, second) {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.sqrt(Math.min(1, haversine)));
}

export function rankNearby(items, { origin, radiusKm, priceFor = () => 0, costPerKmKg = transportCostPerKmKg() }) {
  if (!origin || !Number.isFinite(origin.latitude) || !Number.isFinite(origin.longitude)) return [];
  return items
    .filter((item) => Number.isFinite(item.latitude) && Number.isFinite(item.longitude))
    .map((item) => {
      const exactDistance = haversineKm(origin, item);
      const bidPerKg = Number(priceFor(item)) || 0;
      const distanceKm = Number(exactDistance.toFixed(1));
      const netPricePerKg = Number((bidPerKg - exactDistance * costPerKmKg).toFixed(2));
      return {
        ...item,
        distanceKm,
        distance_km: distanceKm,
        netPricePerKg,
        net_price_per_kg: netPricePerKg,
        _exactDistanceKm: exactDistance,
        _bidPerKg: bidPerKg,
      };
    })
    .filter((item) => item._exactDistanceKm <= radiusKm)
    .sort((first, second) => second._bidPerKg - first._bidPerKg || first._exactDistanceKm - second._exactDistanceKm)
    .map(({ _exactDistanceKm, _bidPerKg, ...item }) => item);
}

export function approximateCoordinates(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return { latitude: null, longitude: null };
  return {
    latitude: Number(latitude.toFixed(2)),
    longitude: Number(longitude.toFixed(2)),
  };
}