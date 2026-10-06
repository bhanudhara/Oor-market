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

export const fetchMarket = createAsyncThunk('market/fetch', () => requestMarket('/api/market'));
export const commitFarmerLot = createAsyncThunk('market/commit', ({ farmerId, sellerId, quantityKg }) => requestMarket('/api/commitments', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farmerId, sellerId, quantityKg }),
}));
export const changeSellerBid = createAsyncThunk('market/bid', ({ sellerId, bidPerKg }) => requestMarket(`/api/sellers/${sellerId}/bid`, {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bidPerKg }),
}));
export const createFarmerListing = createAsyncThunk('market/listing', (listing) => requestMarket('/api/farmers', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(listing),
}));

const mutations = [commitFarmerLot, changeSellerBid, createFarmerListing];
const slice = createSlice({
  name: 'market',
  initialState: { data: null, loading: false, saving: false, error: null },
  reducers: { clearMarketError(state) { state.error = null; } },
  extraReducers(builder) {
    builder
      .addCase(fetchMarket.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchMarket.fulfilled, (state, action) => { state.loading = false; state.data = action.payload; })
      .addCase(fetchMarket.rejected, (state, action) => { state.loading = false; state.error = action.error.message; })
      .addMatcher((action) => mutations.some((thunk) => thunk.pending.match(action)), (state) => { state.saving = true; state.error = null; })
      .addMatcher((action) => mutations.some((thunk) => thunk.fulfilled.match(action)), (state, action) => { state.saving = false; state.data = action.payload; })
      .addMatcher((action) => mutations.some((thunk) => thunk.rejected.match(action)), (state, action) => { state.saving = false; state.error = action.error.message; });
  },
});

export const { clearMarketError } = slice.actions;
export default slice.reducer;