// This function is web-only as native doesn't currently support server (or build-time) rendering.
export function useClientOnlyValue<S, C>(server: S, client: C): S | C {
  return client;
}

// Default export for Expo Router
export default function UseClientOnlyValueComponent() {
  return null;
}
