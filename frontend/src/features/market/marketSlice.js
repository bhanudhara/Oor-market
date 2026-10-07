import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

async function requestMarket(url, options) {
  const token = localStorage.getItem('oor-market-token');
  const headers = { ...options?.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Market request failed.');
  return data;
}

const withRadius = (url, radiusKm) => `${url}?radiusKm=${encodeURIComponent(radiusKm ?? 10)}`;

export const fetchMarket = createAsyncThunk('market/fetch', (radiusKm = 10) => requestMarket(withRadius('/api/market', radiusKm)));
export const fetchDeals = createAsyncThunk('market/deals', () => requestMarket('/api/deals'));
export const commitFarmerLot = createAsyncThunk('market/commit', ({ farmerId, sellerId, quantityKg, radiusKm }) => requestMarket(withRadius('/api/commitments', radiusKm), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farmerId, sellerId, quantityKg }),
}));
export const changeSellerBid = createAsyncThunk('market/bid', ({ sellerId, bidPerKg, radiusKm }) => requestMarket(withRadius(`/api/sellers/${sellerId}/bid`, radiusKm), {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bidPerKg }),
}));
export const createFarmerListing = createAsyncThunk('market/listing', ({ radiusKm, ...listing }) => requestMarket(withRadius('/api/farmers', radiusKm), {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(listing),
}));
export const updateFarmerListing = createAsyncThunk('market/listingUpdate', ({ farmerId, radiusKm, ...listing }) => requestMarket(withRadius(`/api/farmers/${farmerId}`, radiusKm), {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(listing),
}));
export const withdrawFarmerListing = createAsyncThunk('market/listingWithdraw', ({ farmerId, radiusKm }) => requestMarket(withRadius(`/api/farmers/${farmerId}`, radiusKm), { method: 'DELETE' }));
export const saveUserLocation = createAsyncThunk('market/location', ({ latitude, longitude }) => requestMarket('/api/auth/location', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ latitude, longitude }),
}));

const mutations = [commitFarmerLot, changeSellerBid, createFarmerListing, updateFarmerListing, withdrawFarmerListing];
const slice = createSlice({
  name: 'market',
  initialState: { data: null, deals: [], dealsLoading: false, loading: false, saving: false, error: null },
  reducers: { clearMarketError(state) { state.error = null; } },
  extraReducers(builder) {
    builder
      .addCase(fetchMarket.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchMarket.fulfilled, (state, action) => { state.loading = false; state.data = action.payload; })
      .addCase(fetchMarket.rejected, (state, action) => { state.loading = false; state.error = action.error.message; })
      .addCase(fetchDeals.pending, (state) => { state.dealsLoading = true; })
      .addCase(fetchDeals.fulfilled, (state, action) => { state.dealsLoading = false; state.deals = action.payload; })
      .addCase(fetchDeals.rejected, (state, action) => { state.dealsLoading = false; state.error = action.error.message; })
      .addMatcher((action) => mutations.some((thunk) => thunk.pending.match(action)), (state) => { state.saving = true; state.error = null; })
      .addMatcher((action) => mutations.some((thunk) => thunk.fulfilled.match(action)), (state, action) => { state.saving = false; state.data = action.payload; })
      .addMatcher((action) => mutations.some((thunk) => thunk.rejected.match(action)), (state, action) => { state.saving = false; state.error = action.error.message; });
  },
});

export const { clearMarketError } = slice.actions;
export default slice.reducer;