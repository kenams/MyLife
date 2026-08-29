/**
 * Legacy compatibility shim.
 *
 * Map screens still call these functions, but simulated residents are now
 * driven by the global Living City runtime and projected locally into MapLibre.
 * Keeping this shim avoids a risky map.web.tsx rewrite while removing the old
 * duplicate system that randomly mutated NPC rows in Supabase every 15–30s.
 */
export function startNpcMapEngine() {
  // Intentionally empty: CityRuntime owns the simulation lifecycle.
}

export function stopNpcMapEngine() {
  // Intentionally empty: CityRuntime owns the simulation lifecycle.
}
