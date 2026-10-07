import 'dotenv/config';
import express from 'express';
import authRoutes from './routes/authRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import { initializeDatabase } from './db/initializeDatabase.js';
import { pool } from './db/pool.js';
import { jwtSecret } from './auth/authMiddleware.js';

const app = express();
const port = process.env.PORT || 3001;

try {
  jwtSecret();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api', marketRoutes);

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(error.statusCode || 500).json({
    error: error.statusCode ? error.message : 'The market could not be updated. Please try again.',
  });
});

initializeDatabase()
  .then(() => app.listen(port, () => console.log(`Market API listening on http://localhost:${port}`)))
  .catch(async (error) => {
    console.error('Could not initialize PostgreSQL:', error.message);
    await pool.end();
    process.exitCode = 1;
  });