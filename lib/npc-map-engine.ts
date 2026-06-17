import { supabase } from "./supabase";
import { publishFeedEvent } from "./life-feed";

// Destinations NPC — points chauds de Toulouse avec noms humains
const PARIS_SPOTS = [
  { name: "Capitole — Place",             lat: 43.6043, lng: 1.4437 },
  { name: "Saint-Cyprien — Terrasse",     lat: 43.5997, lng: 1.4285 },
  { name: "Carmes — Marché",             lat: 43.5967, lng: 1.4446 },
  { name: "Wilson — Place",              lat: 43.6071, lng: 1.4500 },
  { name: "Jean Jaurès — Café",          lat: 43.6129, lng: 1.4458 },
  { name: "Arnaud-Bernard — Bar",        lat: 43.6130, lng: 1.4380 },
  { name: "Les Minimes — Terrain",       lat: 43.6310, lng: 1.4380 },
  { name: "Compans — Skatepark",         lat: 43.6170, lng: 1.4270 },
  { name: "Rangueil — Fac",             lat: 43.5650, lng: 1.4680 },
  { name: "Mirail — Dalle",             lat: 43.5760, lng: 1.4030 },
  { name: "Purpan — Village",           lat: 43.6200, lng: 1.4030 },
  { name: "Jolimont — Parc",            lat: 43.6100, lng: 1.4650 },
  { name: "Côte Pavée — Allées",        lat: 43.5900, lng: 1.4600 },
  { name: "Saint-Michel — Resto",       lat: 43.5920, lng: 1.4440 },
  { name: "Garonne — Berges",           lat: 43.6010, lng: 1.4370 },
  { name: "Esquirol — Place",           lat: 43.5993, lng: 1.4430 },
  { name: "Canal du Midi — Piste",      lat: 43.5940, lng: 1.4750 },
  { name: "Toulouse FC — Stade",        lat: 43.5836, lng: 1.4316 },
];

const STATUSES: Array<"free"|"vibe"|"charo"|"ghost"> = ["free","vibe","charo","ghost"];
const MOVE_MESSAGES = [
  "{name} quitte {from} direction {to}",
  "{name} vient de s'installer à {to}",
  "{name} bouge — {to} maintenant",
  "{name} change d'air : {to}",
  "{name} s'éloigne de {from}, cap sur {to}",
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

async function moveRandomNpc() {
  if (!supabase) return;

  // Prendre un NPC aléatoire
  const { data: npcs } = await supabase
    .from("life_map_players")
    .select("id, display_name, avatar_emoji, location_name, status, lat, lng, is_star")
    .eq("is_npc", true)
    .neq("status", "ghost") // les ghosts ne bougent pas visiblement
    .order("updated_at", { ascending: true })
    .limit(8);

  if (!npcs || npcs.length === 0) return;

  // Prendre les 3 plus anciens et en bouger 1-2
  const toMove = npcs.slice(0, Math.random() > 0.5 ? 2 : 1);

  for (const npc of toMove) {
    const dest = pick(PARIS_SPOTS);
    const newStatus = Math.random() > 0.7 ? pick(STATUSES) : npc.status;

    // Ajouter un léger random autour du spot (±200m)
    const jitter = () => (Math.random() - 0.5) * 0.003;
    const newLat = dest.lat + jitter();
    const newLng = dest.lng + jitter();

    await supabase.from("life_map_players").update({
      lat: newLat, lng: newLng,
      location_name: dest.name,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", npc.id);

    // Publier dans le feed (1 fois sur 3 seulement pour ne pas spammer)
    if (Math.random() > 0.65) {
      const tpl = pick(MOVE_MESSAGES);
      const body = tpl
        .replace("{name}", npc.display_name)
        .replace("{from}", npc.location_name ?? "quelque part")
        .replace("{to}", dest.name);

      await publishFeedEvent({
        kind: "location_change",
        emoji: "📍",
        body,
        player_name: npc.display_name,
        player_emoji: npc.avatar_emoji ?? "🧢",
        location: dest.name,
        is_npc: true,
        is_star: npc.is_star ?? false,
      });
    }
  }
}

// Interactions spontanées entre NPCs proches
async function triggerNpcEncounter() {
  if (!supabase) return;

  const { data: npcs } = await supabase
    .from("life_map_players")
    .select("id, display_name, avatar_emoji, lat, lng, is_star, location_name")
    .eq("is_npc", true)
    .neq("status", "ghost")
    .limit(20);

  if (!npcs || npcs.length < 2) return;

  // Trouver deux NPCs proches (< 0.8km)
  for (let i = 0; i < npcs.length; i++) {
    for (let j = i + 1; j < npcs.length; j++) {
      const a = npcs[i], b = npcs[j];
      const dist = Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2);
      if (dist < 0.008 && Math.random() > 0.7) {
        const encounters = [
          `${a.display_name} et ${b.display_name} viennent de se croiser à ${a.location_name}`,
          `Rencontre inattendue : ${a.display_name} tombe sur ${b.display_name}`,
          `${a.display_name} et ${b.display_name} dans le même spot — ambiance électrique`,
          `${b.display_name} aperçoit ${a.display_name} — ils se parlent`,
        ];
        await publishFeedEvent({
          kind: "encounter",
          emoji: pick(["🤝","👀","😳","🔥","💬"]),
          body: pick(encounters),
          player_name: a.display_name,
          player_emoji: a.avatar_emoji ?? "🧢",
          location: a.location_name ?? undefined,
          is_npc: true,
          is_star: a.is_star || b.is_star,
        });
        return; // une seule rencontre par tick
      }
    }
  }
}

// ── Engine principal ───────────────────────────────────────────────────────────
let engineTimer: ReturnType<typeof setTimeout> | null = null;

export function startNpcMapEngine() {
  if (engineTimer) return; // déjà lancé

  const tick = async () => {
    await moveRandomNpc();
    // Rencontre 1 fois sur 2
    if (Math.random() > 0.5) await triggerNpcEncounter();
    // Prochain tick dans 15-30s
    const delay = 15_000 + Math.random() * 15_000;
    engineTimer = setTimeout(tick, delay);
  };

  // Premier tick dans 5s
  engineTimer = setTimeout(tick, 5_000);
}

export function stopNpcMapEngine() {
  if (engineTimer) { clearTimeout(engineTimer); engineTimer = null; }
}
