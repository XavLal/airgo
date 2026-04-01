import * as Network from 'expo-network';

/** Indique si une requête réseau a des chances de réussir (Wi‑Fi / données). */
export async function getIsOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isConnected === false) return false;
    if (state.isInternetReachable === false) return false;
    return true;
  } catch {
    return true;
  }
}
