export const radiusOptionsKm = [5, 10, 25, 50];
export const defaultRadiusKm = 10;

export function transportCostPerKmKg() {
  const configured = Number(process.env.TRANSPORT_COST_PER_KM_KG);
  return Number.isFinite(configured) && configured >= 0 ? configured : 0.5;
}

export const villageCoordinates = {
  Kandiyur: { latitude: 10.8602519, longitude: 79.1077238 },
  Thiruvaiyaru: { latitude: 10.8797198, longitude: 79.1039298 },
  Thogur: { latitude: 10.8303344, longitude: 78.8110685 },
  Papanasam: { latitude: 10.8604181, longitude: 79.235816 },
  Ayyampettai: { latitude: 10.8962881, longitude: 79.1886395 },
  Thirumanur: { latitude: 10.9351706, longitude: 79.1034943 },
};

export const marketCoordinates = {
  'Thanjavur Central Market': { latitude: 10.659037, longitude: 79.2014278 },
  'Kumbakonam Market': { latitude: 10.9604108, longitude: 79.3820861 },
  'Papanasam Uzhavar Sandhai': { latitude: 10.8604181, longitude: 79.235816 },
  'Ayyampettai Market': { latitude: 10.8962881, longitude: 79.1886395 },
};