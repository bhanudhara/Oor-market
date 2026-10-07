# Oor Market Link: Nearby Search and Deals

## Nearby market controls

Farmer and seller dashboards include a **Radius** selector with 5, 10, 25, and 50 km options. Changing it refreshes the market query and map. Results are measured with the Haversine formula; matching offers are sorted by bid, then distance.

Farmer offers show distance and estimated net price per kg. The calculation is:

`net price = seller bid - (distance in km × transport cost per km per kg)`

The default transport cost is Rs 0.50 per km per kg. Set `TRANSPORT_COST_PER_KM_KG` in `.env` to change it. The API returns `distance_km` and `net_price_per_kg` as well as the frontend-friendly camelCase aliases.

## Location and privacy

**Use my current location** requests browser geolocation and saves the coordinates to the signed-in user. If permission is denied or unavailable, the village field remains the fallback; known seed villages have district coordinates.

Leaflet displays OpenStreetMap buyer and harvest pins. Before a deal is accepted, seller API responses contain only the farmer's village and coordinates rounded to approximately 1 km. After acceptance, the seller's deal history and map contain the exact pickup coordinates.

## Farmer workflow

1. Choose a radius and review the nearby map and ranked crop offers.
2. Add a harvest with village, crop, weight, and grade, or use current location.
3. Use **Edit** or **Withdraw** on an uncommitted listing. Listings with accepted commitments cannot be edited or withdrawn.
4. Select **Review offer** to open the inline confirmation panel. Set a whole-number kg amount within the farmer stock and buyer capacity, review the bid and total, then choose **Confirm sale**.
5. Check accepted transactions in **My deals**.

The accept operation locks the farmer and seller rows and writes inventory changes, commitment, accepted deal, and activity in one PostgreSQL transaction. Weight must be a whole number of at least 1 kg; seller bids must be Rs 1-10,000 per kg. Server validation runs even if a client is modified.

## Seller workflow

Choose a radius, adjust the bid, and choose **Publish bid**. The supply table displays village, available kg, grade, and approximate distance. Swipe the table horizontally on mobile to reveal all columns. Accepted pickups appear in **My deals** and their precise location is then available on the map.

## Admin workflow

The admin dashboard remains read-only. It summarizes average nearby distance and best price, displays the network map and load data, and includes **Export CSV** for farmer supply and distance/price fields. The CSV is created in the browser and does not add another endpoint.

## API reference

| Method | Route | Purpose / access |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Sign in; rate limited |
| `GET` | `/api/auth/me` | Validate the signed-in session |
| `PATCH` | `/api/auth/location` | Save current coordinates for the signed-in user |
| `GET` | `/api/market?radiusKm=10` | Role-scoped, distance-ranked marketplace data |
| `POST` | `/api/farmers` | Farmer creates a listing |
| `PATCH` | `/api/farmers/:farmerId` | Owner edits an uncommitted listing |
| `DELETE` | `/api/farmers/:farmerId` | Owner withdraws an uncommitted listing |
| `POST` | `/api/commitments` | Farmer accepts an offer in one transaction |
| `PATCH` | `/api/sellers/:sellerId/bid` | Seller updates only their own bid; Rs 1-10,000 |
| `GET` | `/api/deals` | Farmer/seller sees own deals; admin sees all |

A radius outside 5, 10, 25, or 50 km falls back to 10 km. Login passwords are bcrypt-hashed, sign-in is rate limited, private routes require a JWT plus role authorization, and startup requires a private `JWT_SECRET` of at least 32 characters. Coordinates/deals schema changes are applied by the numbered `backend/db/migrations/002_nearby_search_deals.sql` migration, not by manual database edits.

Run focused backend tests with `npm test`.
