import { Router } from 'express';
import {
  commitFarmerLot,
  createFarmerListing,
  getMarket,
  updateSellerBid,
} from '../services/marketService.js';

const router = Router();

router.get('/market', async (_request, response) => {
  response.json(await getMarket());
});

router.post('/commitments', async (request, response) => {
  const market = await commitFarmerLot(request.body);
  response.status(201).json(market);
});

router.patch('/sellers/:sellerId/bid', async (request, response) => {
  const market = await updateSellerBid(request.params.sellerId, request.body.bidPerKg);
  response.json(market);
});

router.post('/farmers', async (request, response) => {
  const market = await createFarmerListing(request.body);
  response.status(201).json(market);
});

export default router;