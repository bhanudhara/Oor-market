# Oor Market Link

## Local development

Requirements: Node.js 20+ and a local PostgreSQL database.

1. Create a database named `Oor market` in your local PostgreSQL instance.
2. Create a local `.env` file with `DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/Oor%20market`, `PORT=3001`, a private random `JWT_SECRET` of at least 32 characters, and `TRANSPORT_COST_PER_KM_KG=0.5`. Keep `.env` private; it is ignored by Git.
3. Install the Node dependencies with `npm install`.
4. Start the API and React app with `npm run dev`.
5. Open `http://localhost:5173`.

The API creates its base PostgreSQL tables on startup, applies numbered SQL files in `backend/db/migrations/` once, then imports the current `backend/data/market.json` sample records only when the farmers and sellers tables are empty. Migration `002_nearby_search_deals.sql` backfills coordinates and creates the deals table; existing listings and commitments are preserved. PostgreSQL is the source of truth after import.

The project is separated into `frontend/` (React + Redux) and `backend/` (Express API, authentication, migrations, and PostgreSQL services). See [Nearby Market Guide](docs/NEARBY_MARKET_GUIDE.md) for map privacy, radius controls, API routes, and deals.

## Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Farmer | `farmer@oor.local` | `Farmer@123` |
| Seller | `seller@oor.local` | `Seller@123` |
| Admin | `admin@oor.local` | `Admin@123` |

Demo passwords are for local development only. The API refuses to start without a private `JWT_SECRET` of at least 32 characters. Sign-in is rate limited, passwords are bcrypt-hashed, and private routes require a valid JWT and role. Change demo passwords and rotate JWT/database secrets before deploying.

## Nearby search

Farmers and sellers can choose a 5, 10, 25, or 50 km search radius. The API uses the Haversine great-circle formula, ranks offers by bid and then distance, and returns both `distance_km` and `net_price_per_kg`. Net price is calculated as bid minus distance multiplied by `TRANSPORT_COST_PER_KM_KG`; the default is Rs 0.50 per km per kg.

Use the farmer form's **Use my current location** control to save browser coordinates. If permission is denied, the village remains the location fallback. Seller supply responses contain village and rounded approximate coordinates only; exact farmer coordinates are exposed to that seller only in an accepted deal.

## API routes

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Public, rate limited |
| `GET` | `/api/auth/me` | Signed-in user |
| `PATCH` | `/api/auth/location` | Signed-in user |
| `GET` | `/api/market?radiusKm=10` | Signed-in role; response scoped to role |
| `POST` | `/api/farmers` | Farmer |
| `PATCH` | `/api/farmers/:farmerId` | Listing owner, uncommitted listing |
| `DELETE` | `/api/farmers/:farmerId` | Listing owner, uncommitted listing |
| `POST` | `/api/commitments` | Farmer; transactional accept |
| `PATCH` | `/api/sellers/:sellerId/bid` | Matching seller |
| `GET` | `/api/deals` | Signed-in user's deals; admin sees all |

Run distance and transaction tests with `npm test`. `TRANSPORT_COST_PER_KM_KG` defaults to Rs 0.50 when omitted. Apply schema changes as numbered migrations; do not edit an existing database by hand.

Alternatively, if PostgreSQL is not already running and port 5432 is available, start the included local container with `npm run db:up`. It creates the `oor_market` database with local development credentials. Docker Desktop is required for this option.

Stop a container started by Compose with `npm run db:down`. Its data remains in the `oor_market_data` Docker volume.