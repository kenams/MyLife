/**
 * Sécurité & modération — couche centralisée
 * Signalement, suppression compte, export RGPD, rate limiting
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const RESEND_API_KEY = process.env.EXPO_PUBLIC_RESEND_KEY ?? "";
const ADMIN_EMAIL    = "kahdigital42@gmail.com";
const APP_NAME       = "MyLife";

// ── Rate limiting local (anti-spam actions) ───────────────────────────────────
const rateLimitStore: Record<string, number[]> = {};

export function rateLimit(key: string, maxPerMinute: number): boolean {
  const now = Date.now();
  const hits = (rateLimitStore[key] ?? []).filter((t) => now - t < 60_000);
  if (hits.length >= maxPerMinute) return false;
  rateLimitStore[key] = [...hits, now];
  return true;
}

// ── Types de signalement ──────────────────────────────────────────────────────
export type ReportReason =
  | "harassment"
  | "fake_profile"
  | "underage"
  | "inappropriate_content"
  | "spam"
  | "scam"
  | "other";

export const REPORT_REASONS: { id: ReportReason; label: string; emoji: string }[] = [
  { id: "harassment",            label: "Harcèlement / menaces",    emoji: "😡" },
  { id: "fake_profile",          label: "Faux profil / usurpation", emoji: "🎭" },
  { id: "underage",              label: "Mineur présumé",           emoji: "⚠️" },
  { id: "inappropriate_content", label: "Contenu inapproprié",      emoji: "🚫" },
  { id: "spam",                  label: "Spam / pub non sollicitée", emoji: "📢" },
  { id: "scam",                  label: "Arnaque",                  emoji: "💸" },
  { id: "other",                 label: "Autre",                    emoji: "❓" },
];

// ── Envoyer un signalement ────────────────────────────────────────────────────
export async function sendReport(params: {
  reporterUserId: string;
  reporterName: string;
  targetUserId: string;
  targetName: string;
  reason: ReportReason;
  details?: string;
}): Promise<{ ok: boolean; error?: string }> {
  // Rate limit : max 5 signalements par minute
  if (!rateLimit(`report_${params.reporterUserId}`, 5)) {
    return { ok: false, error: "Trop de signalements. Réessaie dans une minute." };
  }

  // Sauvegarde Supabase
  if (supabase) {
    await supabase.from("reports").insert({
      reporter_user_id: params.reporterUserId,
      reporter_name:    params.reporterName,
      target_user_id:   params.targetUserId,
      target_name:      params.targetName,
      reason:           params.reason,
      details:          params.details ?? null,
      status:           "pending",
    });
  }

  // Email admin via Resend
  if (RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    `${APP_NAME} Safety <safety@kah-digital.ch>`,
        to:      [ADMIN_EMAIL],
        subject: `🚩 [${APP_NAME}] Signalement — ${params.reason}`,
        html: `
          <h2>Nouveau signalement</h2>
          <p><strong>Raison :</strong> ${params.reason}</p>
          <p><strong>Signalé par :</strong> ${params.reporterName} (${params.reporterUserId})</p>
          <p><strong>Profil signalé :</strong> ${params.targetName} (${params.targetUserId})</p>
          ${params.details ? `<p><strong>Détails :</strong> ${params.details}</p>` : ""}
          <p><strong>Date :</strong> ${new Date().toISOString()}</p>
          <hr/>
          <p><em>Réponse requise sous 72h (CGU MyLife)</em></p>
        `,
      }),
    });
  }

  return { ok: true };
}

// ── Suppression de compte (RGPD droit à l'effacement) ────────────────────────
export async function deleteAccount(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: "Service indisponible." };

  // Supprime les données locales
  await AsyncStorage.multiRemove([
    "@mylife_age_verified",
    "@mylife_consent_v1",
    "@mylife_geoloc_consent",
    "@mylife_store",
  ]);

  // Supprime les données Supabase (RLS : user peut supprimer son propre enregistrement)
  await supabase.from("life_map_players").delete().eq("user_id", userId);

  // Email de confirmation
  if (RESEND_API_KEY) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from:    `${APP_NAME} <no-reply@kah-digital.ch>`,
        to:      [ADMIN_EMAIL],
        subject: `🗑️ [${APP_NAME}] Demande suppression compte ${userId}`,
        html: `<p>L'utilisateur <strong>${userId}</strong> a demandé la suppression de son compte le ${new Date().toISOString()}.</p><p>Suppression complète requise sous 72h (RGPD).</p>`,
      }),
    });
  }

  // Déconnecte la session Supabase Auth
  await supabase.auth.signOut();

  return { ok: true };
}

// ── Export RGPD (droit à la portabilité) ─────────────────────────────────────
export async function exportUserData(userId: string): Promise<object | null> {
  if (!supabase) return null;

  const [mapData] = await Promise.all([
    supabase.from("life_map_players").select("*").eq("user_id", userId).single(),
  ]);

  const localKeys = ["@mylife_store", "@mylife_consent_v1", "@mylife_geoloc_consent"];
  const localData: Record<string, string | null> = {};
  for (const key of localKeys) {
    localData[key] = await AsyncStorage.getItem(key);
  }

  return {
    export_date: new Date().toISOString(),
    user_id:     userId,
    map_profile: mapData.data,
    local_data:  localData,
    note:        "Export RGPD MyLife — Conformément à l'article 20 du RGPD",
  };
}

// ── Bloc utilisateur ──────────────────────────────────────────────────────────
const BLOCKED_KEY = "@mylife_blocked_users";

export async function getBlockedUsers(): Promise<string[]> {
  const v = await AsyncStorage.getItem(BLOCKED_KEY);
  return v ? JSON.parse(v) : [];
}

export async function blockUser(targetId: string): Promise<void> {
  const blocked = await getBlockedUsers();
  if (!blocked.includes(targetId)) {
    await AsyncStorage.setItem(BLOCKED_KEY, JSON.stringify([...blocked, targetId]));
  }
}

export async function unblockUser(targetId: string): Promise<void> {
  const blocked = await getBlockedUsers();
  await AsyncStorage.setItem(BLOCKED_KEY, JSON.stringify(blocked.filter((id) => id !== targetId)));
}

export function filterBlocked<T extends { user_id: string }>(items: T[], blocked: string[]): T[] {
  return items.filter((i) => !blocked.includes(i.user_id));
}
