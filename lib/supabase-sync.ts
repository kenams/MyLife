import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { AvatarProfile, AvatarStats, Conversation, DailyEvent } from "@/lib/types";

// ─── Avatar ──────────────────────────────────────────────────────────────────

export async function syncAvatarToSupabase(
  userId: string,
  avatar: AvatarProfile,
  stats: AvatarStats
): Promise<{ ok: boolean; avatarId?: string; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configuré" };

  const { data: existing, error: fetchErr } = await supabase
    .from("avatars")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchErr) return { ok: false, error: fetchErr.message };

  const avatarRow = {
    user_id: userId,
    display_name: avatar.displayName,
    age_range: avatar.ageRange,
    gender: avatar.gender,
    origin_style: avatar.originStyle,
    photo_style: avatar.photoStyle,
    bio: avatar.bio,
    height_cm: avatar.heightCm,
    weight_kg: avatar.weightKg,
    body_frame: avatar.bodyFrame,
    skin_tone: avatar.skinTone,
    hair_type: avatar.hairType,
    hair_color: avatar.hairColor,
    hair_length: avatar.hairLength,
    eye_color: avatar.eyeColor,
    outfit_style: avatar.outfitStyle,
    facial_hair: avatar.facialHair,
    silhouette: avatar.silhouette,
    personality_trait: avatar.personalityTrait,
    sociability_style: avatar.sociabilityStyle,
    ambition: avatar.ambition,
    life_rhythm: avatar.lifeRhythm,
    relationship_style: avatar.relationshipStyle,
    personal_goal: avatar.personalGoal,
    life_habit: avatar.lifeHabit,
    starter_job: avatar.starterJob,
    reputation: stats.reputation,
    district_slug: "central-district",
    location_slug: "home",
    updated_at: new Date().toISOString()
  };

  let avatarId: string;

  if (existing) {
    const { error } = await supabase.from("avatars").update(avatarRow).eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    avatarId = existing.id as string;
  } else {
    const { data, error } = await supabase.from("avatars").insert(avatarRow).select("id").single();
    if (error) return { ok: false, error: error.message };
    avatarId = (data as { id: string }).id;
  }

  // sync preferences
  const prefRow = {
    avatar_id: avatarId,
    interests: avatar.interests,
    leisure_styles: avatar.leisureStyles,
    looking_for: avatar.lookingFor,
    favorite_activities: avatar.favoriteActivities,
    favorite_outings: avatar.favoriteOutings,
    appreciated_traits: avatar.appreciatedTraits,
    preferred_vibe: avatar.preferredVibe,
    friendship_intent: avatar.friendshipIntent,
    romance_intent: avatar.romanceIntent
  };

  await supabase.from("avatar_preferences").upsert(prefRow, { onConflict: "avatar_id" });

  return { ok: true, avatarId };
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export async function syncStatsToSupabase(
  avatarId: string,
  stats: AvatarStats
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configuré" };

  const statsRow = {
    avatar_id: avatarId,
    hunger: stats.hunger,
    hydration: stats.hydration,
    energy: stats.energy,
    hygiene: stats.hygiene,
    mood: stats.mood,
    sociability: stats.sociability,
    health: stats.health,
    fitness: stats.fitness,
    stress: stats.stress,
    money: stats.money,
    social_rank_score: stats.socialRankScore,
    reputation: stats.reputation,
    discipline: stats.discipline,
    motivation: stats.motivation,
    weight: stats.weight,
    attractiveness: stats.attractiveness,
    mental_stability: stats.mentalStability,
    streak: stats.streak,
    last_decay_at: stats.lastDecayAt,
    last_meal_at: stats.lastMealAt,
    last_workout_at: stats.lastWorkoutAt,
    last_social_at: stats.lastSocialAt
  };

  const { error } = await supabase
    .from("avatar_stats")
    .upsert(statsRow, { onConflict: "avatar_id" });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export async function syncMessageToSupabase(
  avatarId: string,
  conversationId: string,
  body: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configuré" };

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    avatar_id: avatarId,
    body,
    kind: "message",
    created_at: new Date().toISOString()
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Premium ──────────────────────────────────────────────────────────────────

export async function syncPremiumToSupabase(
  userId: string,
  tier: string,
  expiresAt: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configuré" };

  const { error } = await supabase.from("user_premium").upsert(
    { user_id: userId, tier, expires_at: expiresAt, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Social Transfer ──────────────────────────────────────────────────────────

export async function logSocialTransferToSupabase(
  avatarId: string,
  toResidentId: string | null,
  amount: number,
  description: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configuré" };

  const { error } = await supabase.from("social_transfers").insert({
    avatar_id: avatarId,
    to_resident_id: toResidentId,
    amount,
    description,
    created_at: new Date().toISOString()
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Realtime messages listener ───────────────────────────────────────────────

export function subscribeToMessages(
  conversationId: string,
  onMessage: (msg: { id: string; authorId: string; body: string; createdAt: string }) => void
) {
  if (!isSupabaseConfigured || !supabase) return () => {};

  const channel = supabase
    .channel(`messages-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        const row = payload.new as { id: string; avatar_id: string; body: string; created_at: string };
        onMessage({
          id: row.id,
          authorId: row.avatar_id,
          body: row.body,
          createdAt: row.created_at
        });
      }
    )
    .subscribe();

  return () => {
    void supabase?.removeChannel(channel);
  };
}

// ─── Studies ─────────────────────────────────────────────────────────────────

export async function syncStudyProgressToSupabase(
  avatarId: string,
  courseSlug: string,
  courseName: string,
  progressPct: number,
  level: number,
  xp: number,
  completedAt?: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configuré" };

  const { error } = await supabase.from("studies").upsert(
    {
      avatar_id: avatarId,
      course_slug: courseSlug,
      course_name: courseName,
      progress_pct: progressPct,
      level,
      xp,
      completed_at: completedAt ?? null,
      updated_at: new Date().toISOString()
    },
    { onConflict: "avatar_id,course_slug" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Currency ledger ──────────────────────────────────────────────────────────

export async function registerPushTokenToSupabase(
  userId: string,
  avatarId: string,
  token: string,
  platform: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configuré" };

  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: userId,
      avatar_id: avatarId,
      token,
      platform,
      updated_at: new Date().toISOString()
    },
    { onConflict: "avatar_id" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function logCurrencyEventToSupabase(
  avatarId: string,
  kind: "coins" | "gems" | "tokens",
  delta: number,
  source: string,
  balanceAfter: number
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configuré" };

  const { error } = await supabase.from("currencies").insert({
    avatar_id: avatarId,
    kind,
    delta,
    source,
    balance_after: balanceAfter,
    created_at: new Date().toISOString()
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Daily event log ──────────────────────────────────────────────────────────

export async function logDailyEventToSupabase(
  avatarId: string,
  event: DailyEvent
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configuré" };

  const { error } = await supabase.from("events").insert({
    id: event.id,
    avatar_id: avatarId,
    kind: event.kind,
    title: event.title,
    body: event.body,
    choice: event.choice,
    effects: event.effects,
    created_at: event.createdAt
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function trackAnalyticsEvent(
  userId: string | null,
  eventName: string,
  properties: Record<string, unknown> = {},
  platform: "ios" | "android" | "web" | "mobile" = "mobile",
  appVersion?: string
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;

  // Fire-and-forget — on ne bloque pas l'UI sur l'analytics
  void supabase.from("analytics_events").insert({
    user_id: userId,
    event_name: eventName,
    properties,
    platform,
    app_version: appVersion ?? null,
    created_at: new Date().toISOString()
  });
}

// ─── Report / Block ───────────────────────────────────────────────────────────

export async function submitReport(
  reporterUserId: string,
  reason: string,
  details: string,
  reportedUserId?: string,
  reportedMessageId?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configuré" };

  const { error } = await supabase.from("reports").insert({
    reporter_user_id: reporterUserId,
    reported_user_id: reportedUserId ?? null,
    reported_message_id: reportedMessageId ?? null,
    reason,
    details,
    created_at: new Date().toISOString()
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function blockUser(
  blockerUserId: string,
  blockedUserId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configuré" };

  const { error } = await supabase.from("blocks").upsert(
    { blocker_user_id: blockerUserId, blocked_user_id: blockedUserId },
    { onConflict: "blocker_user_id,blocked_user_id" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unblockUser(
  blockerUserId: string,
  blockedUserId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configuré" };

  const { error } = await supabase
    .from("blocks")
    .delete()
    .eq("blocker_user_id", blockerUserId)
    .eq("blocked_user_id", blockedUserId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Progression (XP, missions, talents) ─────────────────────────────────────

export async function syncProgressionToSupabase(
  avatarId: string,
  data: {
    playerXp: number;
    playerLevel: number;
    unlockedTalents: string[];
    missionsClaimed: number;
  }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configuré" };

  const { error } = await supabase.from("progression").upsert(
    {
      avatar_id: avatarId,
      player_xp: data.playerXp,
      player_level: data.playerLevel,
      unlocked_talents: data.unlockedTalents,
      missions_claimed: data.missionsClaimed,
      updated_at: new Date().toISOString()
    },
    { onConflict: "avatar_id" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─── Pull avatar from Supabase (for sign-in restore) ─────────────────────────

export async function pullAvatarFromSupabase(userId: string): Promise<{
  ok: boolean;
  avatar?: Partial<AvatarProfile>;
  stats?: Partial<AvatarStats>;
  avatarId?: string;
  error?: string;
}> {
  if (!isSupabaseConfigured || !supabase) return { ok: false, error: "Supabase non configuré" };

  const { data, error } = await supabase
    .from("avatars")
    .select("*, avatar_preferences(*), avatar_stats(*)")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true };

  const row = data as Record<string, unknown> & {
    avatar_preferences: Record<string, unknown> | null;
    avatar_stats: Record<string, unknown> | null;
  };

  const avatar: Partial<AvatarProfile> = {
    displayName: row.display_name as string,
    ageRange: row.age_range as string,
    gender: row.gender as string,
    originStyle: row.origin_style as string,
    photoStyle: row.photo_style as string,
    bio: row.bio as string,
    heightCm: row.height_cm as number,
    weightKg: row.weight_kg as number,
    bodyFrame: row.body_frame as string,
    skinTone: row.skin_tone as string,
    hairType: row.hair_type as string,
    hairColor: row.hair_color as string,
    hairLength: row.hair_length as string,
    eyeColor: row.eye_color as string,
    outfitStyle: row.outfit_style as string,
    facialHair: row.facial_hair as string,
    silhouette: row.silhouette as string,
    personalityTrait: row.personality_trait as string,
    sociabilityStyle: row.sociability_style as string,
    ambition: row.ambition as string,
    lifeRhythm: row.life_rhythm as string,
    relationshipStyle: row.relationship_style as string,
    personalGoal: row.personal_goal as string,
    lifeHabit: row.life_habit as string,
    starterJob: row.starter_job as string,
    ...(row.avatar_preferences
      ? {
          interests: row.avatar_preferences.interests as string[],
          leisureStyles: row.avatar_preferences.leisure_styles as string[],
          lookingFor: row.avatar_preferences.looking_for as string[],
          favoriteActivities: row.avatar_preferences.favorite_activities as string[],
          favoriteOutings: row.avatar_preferences.favorite_outings as string[],
          appreciatedTraits: row.avatar_preferences.appreciated_traits as string[],
          preferredVibe: row.avatar_preferences.preferred_vibe as string,
          friendshipIntent: row.avatar_preferences.friendship_intent as string,
          romanceIntent: row.avatar_preferences.romance_intent as string
        }
      : {})
  };

  const s = row.avatar_stats;
  const stats: Partial<AvatarStats> | undefined = s
    ? {
        hunger: s.hunger as number,
        hydration: s.hydration as number,
        energy: s.energy as number,
        hygiene: s.hygiene as number,
        mood: s.mood as number,
        sociability: s.sociability as number,
        health: s.health as number,
        fitness: s.fitness as number,
        stress: s.stress as number,
        money: s.money as number,
        socialRankScore: s.social_rank_score as number,
        reputation: s.reputation as number,
        discipline: s.discipline as number,
        motivation: s.motivation as number,
        weight: s.weight as number,
        attractiveness: s.attractiveness as number,
        mentalStability: s.mental_stability as AvatarStats["mentalStability"],
        streak: s.streak as number,
        lastDecayAt: s.last_decay_at as string,
        lastMealAt: s.last_meal_at as string,
        lastWorkoutAt: s.last_workout_at as string,
        lastSocialAt: s.last_social_at as string
      }
    : undefined;

  return { ok: true, avatar, stats, avatarId: row.id as string };
}
