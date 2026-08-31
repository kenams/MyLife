import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.E2E_QA_PASSWORD;
const email = (process.env.E2E_QA_EMAIL || "kah.qa@mylife.test").trim().toLowerCase();

if (!url || !serviceRoleKey || !password) {
  throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and E2E_QA_PASSWORD are required");
}
if (password.length < 12) throw new Error("E2E_QA_PASSWORD must contain at least 12 characters");

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function requireOk(label, promise) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function findUserByEmail() {
  for (let page = 1; page <= 20; page += 1) {
    const data = await requireOk("list users", supabase.auth.admin.listUsers({ page, perPage: 100 }));
    const user = data.users.find((item) => item.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }
  throw new Error("QA user lookup exceeded 2000 users");
}

let user = await findUserByEmail();
if (!user) {
  user = await requireOk("create QA user", supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { qa_account: true },
    user_metadata: { username: "kah-qa", qa_account: true },
  })).then((data) => data.user);
} else {
  user = await requireOk("update QA user", supabase.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    app_metadata: { ...user.app_metadata, qa_account: true },
    user_metadata: { ...user.user_metadata, username: "kah-qa", qa_account: true },
  })).then((data) => data.user);
}

if (!user) throw new Error("QA user was not created");
const userId = user.id;
const now = new Date().toISOString();

// These rows are required by the legacy avatar foreign keys. Production
// normally already has them; upsert makes local/cold environments reliable.
await requireOk("seed QA neighborhood", supabase.from("neighborhoods").upsert({
  slug: "central-district", name: "Toulouse Centre", vibe: "vivant", lifestyle: "urbain", cost_level: "balanced",
}));
await requireOk("seed QA location", supabase.from("locations").upsert({
  slug: "home", neighborhood_slug: "central-district", name: "Chez toi", kind: "home",
  summary: "Point de depart personnel", cost_hint: "gratuit", social_energy: 0, capacity: 1,
}));
await requireOk("seed QA job", supabase.from("jobs").upsert({
  slug: "support-tech", name: "Support tech", reward_coins: 75, energy_cost: 12,
  hunger_cost: 6, stress_cost: 5, discipline_reward: 8, reputation_reward: 4,
}));

await requireOk("mark QA account", supabase.from("qa_test_accounts").upsert({
  user_id: userId,
  email,
  // This legacy column is required, but the real password is never stored here.
  password_plain: "managed-by-provision-script",
  label: "KAH-QA",
}, { onConflict: "user_id" }));

await requireOk("upsert public profile", supabase.from("profiles").upsert({
  id: userId, username: "kah-qa", bio: "Compte QA cross-device MyLife",
}, { onConflict: "id" }));

const avatar = {
  displayName: "Kah QA", ageRange: "26-30", gender: "Homme", originStyle: "Mediterranee",
  photoStyle: "Street premium", bio: "Compte QA cross-device MyLife", heightCm: 178, weightKg: 74,
  bodyFrame: "athletique", skinTone: "ambre", hairType: "ondule", hairColor: "noir",
  hairLength: "court", eyeColor: "marron", outfitStyle: "business", facialHair: "barbe courte",
  silhouette: "tonique", personalityTrait: "Strategique", sociabilityStyle: "ouvert",
  ambition: "croissance", lifeRhythm: "equilibre", relationshipStyle: "stable",
  personalGoal: "tester MyLife", lifeHabit: "structure", starterJob: "support-tech",
  homeDistrict: "Capitole", interests: ["business", "fitness", "networking"],
  leisureStyles: ["fitness", "cinema"], lookingFor: ["amis", "relation amoureuse", "sorties"],
  favoriteActivities: ["fitness", "coffee"], favoriteOutings: ["coffee", "cinema"],
  appreciatedTraits: ["fiable", "discipline"], preferredVibe: "ambitieux",
  friendshipIntent: "Tester les relations", romanceIntent: "Tester Feeling",
};
const stats = {
  hunger: 80, hydration: 80, energy: 90, hygiene: 85, mood: 80, sociability: 75,
  health: 85, fitness: 75, stress: 20, money: 5000, socialRankScore: 70, reputation: 70,
  discipline: 75, motivation: 80, weight: 74, attractiveness: 70, mentalStability: "stable",
  streak: 5, lastDecayAt: now, lastMealAt: now, lastWorkoutAt: now, lastSocialAt: now,
};

const avatarRow = await requireOk("upsert QA avatar", supabase.from("avatars").upsert({
  user_id: userId, display_name: avatar.displayName, age_range: avatar.ageRange, gender: avatar.gender,
  origin_style: avatar.originStyle, photo_style: avatar.photoStyle, bio: avatar.bio,
  height_cm: avatar.heightCm, weight_kg: avatar.weightKg, body_frame: avatar.bodyFrame,
  skin_tone: avatar.skinTone, hair_type: avatar.hairType, hair_color: avatar.hairColor,
  hair_length: avatar.hairLength, eye_color: avatar.eyeColor, outfit_style: avatar.outfitStyle,
  facial_hair: avatar.facialHair, silhouette: avatar.silhouette, personality_trait: avatar.personalityTrait,
  sociability_style: avatar.sociabilityStyle, ambition: avatar.ambition, life_rhythm: avatar.lifeRhythm,
  relationship_style: avatar.relationshipStyle, personal_goal: avatar.personalGoal,
  life_habit: avatar.lifeHabit, starter_job: avatar.starterJob, reputation: stats.reputation,
  district_slug: "central-district", location_slug: "home", updated_at: now,
}, { onConflict: "user_id" }).select("id").single());

await requireOk("upsert QA preferences", supabase.from("avatar_preferences").upsert({
  avatar_id: avatarRow.id, interests: avatar.interests, leisure_styles: avatar.leisureStyles,
  looking_for: avatar.lookingFor, favorite_activities: avatar.favoriteActivities,
  favorite_outings: avatar.favoriteOutings, appreciated_traits: avatar.appreciatedTraits,
  preferred_vibe: avatar.preferredVibe, friendship_intent: avatar.friendshipIntent,
  romance_intent: avatar.romanceIntent,
}, { onConflict: "avatar_id" }));

await requireOk("upsert QA stats", supabase.from("avatar_stats").upsert({
  avatar_id: avatarRow.id, hunger: stats.hunger, hydration: stats.hydration, energy: stats.energy,
  hygiene: stats.hygiene, mood: stats.mood, sociability: stats.sociability, health: stats.health,
  fitness: stats.fitness, stress: stats.stress, money: stats.money,
  social_rank_score: stats.socialRankScore, reputation: stats.reputation, discipline: stats.discipline,
  motivation: stats.motivation, weight: stats.weight, attractiveness: stats.attractiveness,
  mental_stability: stats.mentalStability, streak: stats.streak, last_decay_at: now,
  last_meal_at: now, last_workout_at: now, last_social_at: now,
}, { onConflict: "avatar_id" }));

await requireOk("upsert QA gameplay profile", supabase.from("player_profiles").upsert({
  player_id: `qa-${userId}`, display_name: avatar.displayName, player_emoji: "QA",
  level: 8, player_xp: 1400, money: stats.money, reputation: stats.reputation,
  streak: stats.streak, housing: "studio", is_premium: false, user_id: userId, updated_at: now,
}, { onConflict: "user_id" }));

await requireOk("upsert QA cloud state", supabase.from("player_cloud_state").upsert({
  user_id: userId,
  state: {
    avatar, stats, playerXp: 1400, playerLevel: 8, appTheme: "quartier-life", tutorialDone: true,
    missionProgresses: [], unlockedTalents: [], notifications: [{
      id: "qa-device-parity-notification", kind: "social", title: "QA cross-device",
      body: "Notification reservee au test de parite", createdAt: now, read: false,
    }], relationships: [],
    invitations: [], datePlans: [], dailyQuests: [], inventory: [], npcRelations: [],
  },
  revision: 0,
  updated_at: now,
}, { onConflict: "user_id" }));

const ledger = await requireOk("read QA Wory", supabase.from("wory_ledger").select("delta").eq("user_id", userId));
const balance = ledger.reduce((sum, row) => sum + Number(row.delta), 0);
if (balance === 0) {
  await requireOk("seed QA Wory ledger", supabase.rpc("record_wory", {
    p_user_id: userId, p_crew_id: null, p_delta: stats.money, p_reason: "qa_bootstrap",
    p_idempotency_key: `wory:qa-bootstrap:${userId}`, p_source: "qa", p_source_id: null,
    p_metadata: { qa: true }, p_allow_negative: false,
  }));
}

console.log(JSON.stringify({ email, userId, level: 8, xp: 1400, wory: stats.money, qa: true }));
