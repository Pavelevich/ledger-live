import {registerSlice} from '@shared/mobile-host-runtime';
import swapReducer, {SWAP_SLICE_NAME} from './swapSlice';

// Side-effect: as soon as the remote module is evaluated by the host,
// inject the swap slice into the host's combined reducer.
registerSlice({name: SWAP_SLICE_NAME, reducer: swapReducer});
