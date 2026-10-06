# Oor Market Link

## Local development

Requirements: Node.js 20+ and a local PostgreSQL database.

1. Create a database named `Oor market` in your local PostgreSQL instance.
2. Create a local `.env` file with `DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/Oor%20market` and `PORT=3001`. Keep `.env` private; it is ignored by Git.
3. Install the Node dependencies with `npm install`.
4. Start the API and React app with `npm run dev`.
5. Open `http://localhost:5173`.

The API creates its PostgreSQL tables on startup and imports the current `backend/data/market.json` sample records only when the farmers and sellers tables are empty. Once imported, PostgreSQL is the source of truth.

The project is separated into `frontend/` (React + Redux) and `backend/` (Express API, authentication, and PostgreSQL schema/services).

## Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Farmer | `farmer@oor.local` | `Farmer@123` |
| Seller | `seller@oor.local` | `Seller@123` |
| Admin | `admin@oor.local` | `Admin@123` |

Demo passwords are for local development only. Set a private `JWT_SECRET` in `.env` and change the demo passwords before deploying.

Alternatively, if PostgreSQL is not already running and port 5432 is available, start the included local container with `npm run db:up`. It creates the `oor_market` database with local development credentials. Docker Desktop is required for this option.

Stop a container started by Compose with `npm run db:down`. Its data remains in the `oor_market_data` Docker volume.