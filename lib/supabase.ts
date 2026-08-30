import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";

const extra = Constants.expoConfig?.extra ?? {};
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? extra.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

const isWeb = Platform.OS === "web";

/**
 * Adaptateur de stockage de session.
 *
 * IMPORTANT (produit ONE ACCOUNT / cross-device) : sur le web, la session
 * Supabase DOIT persister dans `localStorage` pour qu'un rafraîchissement ou un
 * retour plusieurs heures plus tard garde l'utilisateur connecté, à l'identique
 * de l'app native. On n'utilise `AsyncStorage` que sur natif.
 */
function webStorage() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.getItem("__mylife_probe__");
      return window.localStorage;
    }
  } catch {
    /* Safari privé / storage bloqué → fallback mémoire */
  }
  const mem = new Map<string, string>();
  return {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  } as unknown as Storage;
}

export const supabase = isSupabaseConfigured
  ? createClient(url as string, anonKey as string, {
      auth: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        storage: (isWeb ? webStorage() : AsyncStorage) as any,
        storageKey: "mylife-auth",
        autoRefreshToken: true,
        persistSession: true,
        // Web : capte le lien de réinitialisation de mot de passe (#access_token=...).
        // Natif : géré par deep link, pas d'URL de navigateur.
        detectSessionInUrl: isWeb,
        flowType: "pkce",
      },
    })
  : null;

/** URL de redirection après reset de mot de passe, selon la plateforme. */
export function passwordResetRedirect(): string {
  if (isWeb && typeof window !== "undefined") {
    return `${window.location.origin}/reset-password`;
  }
  return "mylife://reset-password";
}
