import * as Network from "expo-network";

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type ConnectivityState = {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
};

/**
 * iOS puede informar `isInternetReachable: null` mientras termina de validar
 * la conexión. Solo consideramos la aplicación offline cuando el sistema lo
 * confirma explícitamente; si el estado es transitorio, dejamos que la
 * petición real al backend determine el resultado.
 */
export function isNetInfoStateOnline(state: ConnectivityState): boolean {
  // `isInternetReachable` no es una fuente fiable para bloquear la app en
  // iOS: puede permanecer en false/null aun cuando Wi-Fi o datos funcionan.
  // La petición HTTP real es la comprobación definitiva.
  return state.isConnected !== false;
}

function hasConfirmedInternet(state: Network.NetworkState): boolean | null {
  if (state.isConnected === false) return false;
  if (state.isConnected === true) return true;
  // El sistema puede entregar null/undefined mientras detecta la interfaz.
  return null;
}

export async function isOnline() {
  const first = await Network.getNetworkStateAsync();
  const firstResult = hasConfirmedInternet(first);
  if (firstResult === true) return true;

  // Evita declarar modo offline por el estado transitorio del arranque.
  await wait(450);
  const second = await Network.getNetworkStateAsync();
  const secondResult = hasConfirmedInternet(second);
  if (secondResult !== null) return secondResult;

  // Si el sistema aún no ha confirmado alcance, permitimos intentar el
  // backend. La petición real decidirá si existe conexión.
  return second.isConnected !== false;
}
