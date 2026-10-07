import { useEffect } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const fallbackCenter = [10.86, 79.18];
const farmerIcon = L.divIcon({
  className: 'oor-pin-shell',
  html: '<span class="oor-map-pin"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});
const marketIcon = L.divIcon({
  className: 'oor-pin-shell',
  html: '<span class="oor-map-pin market-pin"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function FitNearby({ points, origin }) {
  const map = useMap();
  const signature = points.map((point) => `${point.latitude},${point.longitude}`).join('|');
  useEffect(() => {
    const boundsPoints = points
      .map((point) => [point.latitude ?? point.approximateLatitude, point.longitude ?? point.approximateLongitude])
      .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));
    if (origin && Number.isFinite(origin.latitude) && Number.isFinite(origin.longitude)) {
      boundsPoints.push([origin.latitude, origin.longitude]);
    }
    if (boundsPoints.length > 1) map.fitBounds(boundsPoints, { padding: [28, 28], maxZoom: 12 });
  }, [map, signature, origin?.latitude, origin?.longitude]);
  return null;
}

export default function NearbyMap({ role, origin, farmers = [], sellers = [], markets = [], deals = [], radiusKm = 10 }) {
  const acceptedDeals = deals.filter((deal) => deal.status === 'Accepted');
  const points = [...farmers, ...sellers, ...markets, ...acceptedDeals.map((deal) => ({
    latitude: role === 'seller' ? deal.farmerLatitude : deal.sellerLatitude,
    longitude: role === 'seller' ? deal.farmerLongitude : deal.sellerLongitude,
  }))];
  const firstCoordinate = points.find((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  const center = origin && Number.isFinite(origin.latitude) && Number.isFinite(origin.longitude)
    ? [origin.latitude, origin.longitude]
    : firstCoordinate ? [firstCoordinate.latitude, firstCoordinate.longitude] : fallbackCenter;

  return <section className="nearby-map-panel" aria-label="Nearby market map">
    <div className="map-panel-heading"><span>LOCAL MAP</span><span>{radiusKm} km radius</span></div>
    <MapContainer center={center} zoom={10} scrollWheelZoom={false} className="nearby-map">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitNearby points={points} origin={origin} />
      {origin && Number.isFinite(origin.latitude) && Number.isFinite(origin.longitude) && <Circle center={[origin.latitude, origin.longitude]} radius={radiusKm * 1000} pathOptions={{ color: '#71965e', fillColor: '#b6ce8c', fillOpacity: 0.1, weight: 1 }} />}
      {farmers.map((farmer) => {
        const latitude = role === 'seller' ? farmer.approximateLatitude : farmer.latitude;
        const longitude = role === 'seller' ? farmer.approximateLongitude : farmer.longitude;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        const title = role === 'seller' ? farmer.village : `${farmer.name} · ${farmer.village}`;
        return <Marker key={`farmer-${farmer.id}`} position={[latitude, longitude]} icon={farmerIcon}>
          <Popup>{title}{Number.isFinite(farmer.distanceKm) ? ` · ${farmer.distanceKm} km away` : ''}</Popup>
        </Marker>;
      })}
      {sellers.map((seller) => {
        if (!Number.isFinite(seller.latitude) || !Number.isFinite(seller.longitude)) return null;
        return <Marker key={`seller-${seller.id}`} position={[seller.latitude, seller.longitude]} icon={marketIcon}>
          <Popup>{seller.name} · {seller.crop} · Rs {seller.bidPerKg}/kg{Number.isFinite(seller.distanceKm) ? ` · ${seller.distanceKm} km away` : ''}</Popup>
        </Marker>;
      })}
      {markets.map((market) => {
        if (!Number.isFinite(market.latitude) || !Number.isFinite(market.longitude)) return null;
        return <Marker key={`market-${market.name}`} position={[market.latitude, market.longitude]} icon={marketIcon}>
          <Popup>{market.name}</Popup>
        </Marker>;
      })}
      {acceptedDeals.map((deal) => {
        const latitude = role === 'seller' ? deal.farmerLatitude : deal.sellerLatitude;
        const longitude = role === 'seller' ? deal.farmerLongitude : deal.sellerLongitude;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        return <Marker key={`deal-${deal.id}`} position={[latitude, longitude]} icon={farmerIcon}>
          <Popup>Accepted {deal.crop} pickup · {deal.quantityKg} kg{role === 'seller' && deal.village ? ` · ${deal.village}` : ''}</Popup>
        </Marker>;
      })}
    </MapContainer>
  </section>;
}