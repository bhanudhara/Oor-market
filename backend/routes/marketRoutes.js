import { Router } from 'express';
import {
  commitFarmerLot,
  createFarmerListing,
  getMarket,
  getDeals,
  updateFarmerListing,
  withdrawFarmerListing,
  updateSellerBid,
} from '../services/marketService.js';
import { authenticate, authorize } from '../auth/authMiddleware.js';

const router = Router();
router.use(authenticate);

router.get('/market', async (request, response) => {
  response.json(await getMarket(request.user, request.query.radiusKm));
});

router.get('/deals', async (request, response) => {
  response.json(await getDeals(request.user));
});

router.post('/commitments', authorize('farmer'), async (request, response) => {
  const market = await commitFarmerLot(request.body, request.user, request.query.radiusKm);
  response.status(201).json(market);
});

router.patch('/sellers/:sellerId/bid', authorize('seller'), async (request, response) => {
  const market = await updateSellerBid(request.params.sellerId, request.body.bidPerKg, request.user, request.query.radiusKm);
  response.json(market);
});

router.post('/farmers', authorize('farmer'), async (request, response) => {
  const market = await createFarmerListing(request.body, request.user, request.query.radiusKm);
  response.status(201).json(market);
});

router.patch('/farmers/:farmerId', authorize('farmer'), async (request, response) => {
  const market = await updateFarmerListing(request.params.farmerId, request.body, request.user, request.query.radiusKm);
  response.json(market);
});

router.delete('/farmers/:farmerId', authorize('farmer'), async (request, response) => {
  const market = await withdrawFarmerListing(request.params.farmerId, request.user, request.query.radiusKm);
  response.json(market);
});

export default router;