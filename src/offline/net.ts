import * as Network from "expo-network";

export async function isOnline() {
  const s = await Network.getNetworkStateAsync();
  return !!s.isConnected && !!s.isInternetReachable;
}