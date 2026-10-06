import { Router } from 'express';
import {
  commitFarmerLot,
  createFarmerListing,
  getMarket,
  updateSellerBid,
} from '../services/marketService.js';
import { authenticate, authorize } from '../auth/authMiddleware.js';

const router = Router();
router.use(authenticate);

router.get('/market', async (request, response) => {
  response.json(await getMarket(request.user));
});

router.post('/commitments', authorize('farmer'), async (request, response) => {
  const market = await commitFarmerLot(request.body, request.user);
  response.status(201).json(market);
});

router.patch('/sellers/:sellerId/bid', authorize('seller'), async (request, response) => {
  const market = await updateSellerBid(request.params.sellerId, request.body.bidPerKg, request.user);
  response.json(market);
});

router.post('/farmers', authorize('farmer'), async (request, response) => {
  const market = await createFarmerListing(request.body, request.user);
  response.status(201).json(market);
});

export default router;