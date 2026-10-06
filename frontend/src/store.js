import { configureStore } from '@reduxjs/toolkit';
import marketReducer from './features/market/marketSlice.js';

export const store = configureStore({ reducer: { market: marketReducer } });