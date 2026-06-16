/**
 * NPC Engine — PNJ autonomes MyLife
 * Lance en local : npx ts-node scripts/npc-engine.ts
 * Ou déployer comme cron sur Render/Railway toutes les 15 min
 *
 * Comportement :
 * - Chaque NPC suit son emploi du temps (matin/aprem/soir/nuit)
 * - Ils postent des messages dans leurs quartiers
 * - Ils répondent aux vrais joueurs qui les mentionnent
 * - Ils changent de statut et de position selon l'heure
 * - Ils interagissent entre eux pour créer de la vie
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "https://vlofsaivgydbzghptlfj.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

type TimeSlot = "matin" | "aprem" | "soir" | "nuit";
type NpcStatus = "free" | "vibe" | "charo" | "taken" | "ghost";

interface Npc {
  id: string;
  display_name: string;
  avatar_emoji: string;
  backstory: string;
  personality: string;
  current_mood: string;
  home_quartier: string;
  status: NpcStatus;
  lat: number;
  lng: number;
  level: number;
  is_star: boolean;
  last_action: string;
  schedule: Record<TimeSlot, string>;
}

function getTimeSlot(): TimeSlot {
  const h = new Date().getHours();
  if (h >= 6  && h < 12) return "matin";
  if (h >= 12 && h < 18) return "aprem";
  if (h >= 18 && h < 23) return "soir";
  return "nuit";
}

// Messages par NPC selon l'heure et le mood — banco réaliste
const NPC_MESSAGES: Record<string, Record<TimeSlot, string[]>> = {
  "Jok'air ✓": {
    matin:  ["Studio ouvert dès 9h si t'as un projet 🎤", "Nouvelle instru ce matin, on est chauds"],
    aprem:  ["Pause terrain, qui est dispo pour un match rapide ?", "Le 93 represents toujours 👑"],
    soir:   ["Soirée freestyle ce soir à Saint-Denis, venez nombreux", "Le quartier il dort jamais frères 🎤"],
    nuit:   [],
  },
  "Yasmine.SD": {
    matin:  [],
    aprem:  ["Sortie de garde, enfin 😮‍💨 quelqu'un a vu un bon café ouvert ?", "Bonjour les vivants ! Moi je viens de finir ma nuit"],
    soir:   ["Le soleil ! J'avais oublié c'était quoi", "Quelqu'un sort ce soir dans le coin ? Besoin de voir des gens normaux"],
    nuit:   [],
  },
  "Bilal.Coach": {
    matin:  ["Entraînement à 9h au stade Waldeck, venez les jeunes 🏆", "Bonne journée le quartier ! On donne tout aujourd'hui"],
    aprem:  ["Match amical à 15h, il manque 2 joueurs — qui est là ?", "La séance d'aprem c'est technique aujourd'hui, concentration"],
    soir:   ["Belle journée sur le terrain. Le prochain tournoi c'est samedi !", "Apéro foot au café d'en bas, passez"],
    nuit:   [],
  },
  "Céline.Night": {
    matin:  [],
    aprem:  [],
    soir:   ["La nuit commence 🌙 Le bar est ouvert, les esprits aussi", "Ce soir on philosophe au comptoir. Entrée libre"],
    nuit:   ["3h du matin et encore du monde ici... Paris s'arrête jamais", "'On ne choisit pas ce dont on tombe amoureux' — une cliente de ce soir"],
  },
  "Moussa.Beat": {
    matin:  ["Livraison en cours, j'écoute ma playlist dans le vélo 🎧", "Nouveau son ce matin — lien dans ma bio TikTok, 30 sec c'est tout"],
    aprem:  ["Entre deux livraisons, j'écris des lyrics sur mon téléphone 📝", "Quelqu'un cherche un beatmaker dans le 93 ?"],
    soir:   ["Studio chambre activé 🔊 on enregistre ce soir", "Pantin represent ! Le son monte doucement"],
    nuit:   ["Minuit passé encore dans le micro... le sacrifice c'est maintenant", "Son envoyé à 3 labels ce soir. On verra"],
  },
  "Inès.Murs": {
    matin:  ["Matinale créative — l'atelier est ouvert si vous voulez passer", "Nouveau sketch de la nuit, je l'aime beaucoup cette fois"],
    aprem:  ["En train de travailler sur une fresque rue Ramponeau 🖼️", "L'art de rue c'est le patrimoine des sans patrimoine"],
    soir:   ["Vernissage chez Seb ce soir Belleville — entrée libre, venez !", "La fresque est terminée ! Venez voir avant qu'il pleuve"],
    nuit:   [],
  },
  "Rachid.Moto": {
    matin:  ["Atelier ouvert à 8h30 comme d'hab. Bonne journée la République 🏍️", "Vidange + révision rapide ce matin si quelqu'un en a besoin"],
    aprem:  ["Devis gratuit si vous passez entre 14h et 17h", "Le temps est beau, les motos sont heureuses"],
    soir:   ["Apéro terrasse avec les gars de l'atelier, rejoignez-nous !", "Semaine chargée mais bonne. Le travail ça paye toujours"],
    nuit:   [],
  },
  "Léa.Livres": {
    matin:  ["La librairie ouvre à 10h 📚 Nouveau stock SF afrofuturisme arrivé"],
    aprem:  ["On lit quoi en ce moment dans le quartier ?", "Conseil du jour : 'Les Dépossédés' de Le Guin si t'as jamais lu"],
    soir:   ["Fermeture dans 1h — dernier passage bienvenu", "Quelqu'un cherche un associé pour un projet culturel dans le Marais ?"],
    nuit:   [],
  },
  "Kevin.Sécu": {
    matin:  ["Boxe terminée. La journée peut commencer.", "Calme ce matin dans le quartier. C'est bien."],
    aprem:  [],
    soir:   [],
    nuit:   ["Garde de nuit. Tout calme. C'est comme ça qu'on aime.", "Les nuits de Paris ont leurs propres règles."],
  },
  "Aïcha.Réseau": {
    matin:  ["Bonjour tout le monde ! Belle journée pour avancer 🌍", "Réunion réseau ce matin — on construit des ponts"],
    aprem:  ["2 offres d'insertion disponibles dans le 93, DM-moi si ça intéresse", "Le terrain c'est maintenant. On y va."],
    soir:   ["Journée bien remplie. Le changement ça se passe au quotidien", "Merci à tous ceux qui se sont engagés aujourd'hui 💪"],
    nuit:   [],
  },
};

// Réponses des NPCs quand un vrai joueur leur écrit (pattern matching)
const NPC_RESPONSES: Record<string, string[]> = {
  "Jok'air ✓": [
    "Wesh frère, tu passes sur le quartier ?",
    "Viens on parle musique si t'as un projet 🎤",
    "Le 93 c'est une famille. Bienvenue si t'es là pour du bien.",
    "J'écoute ce que tu fais avant de juger. Envoie 🔊",
  ],
  "Yasmine.SD": [
    "Ça va toi ? Tu as l'air fatigué(e) sur ta fiche 😊",
    "Je suis soignante, je vois les gens... tu vas bien ?",
    "Rejoins le groupe ce soir si tu veux voir du monde !",
  ],
  "Bilal.Coach": [
    "Tu joues au foot ? Viens samedi matin au stade Waldeck !",
    "Ici tout le monde est bienvenu sur le terrain. Niveau 0 ou 10.",
    "Le sport ça règle beaucoup de choses dans la tête. Confiance.",
  ],
  "Moussa.Beat": [
    "Frère ! Écoute mon dernier son et dis-moi ce que tu penses 🙏",
    "T'as des contacts dans la musique ? Je cherche des portes à ouvrir",
    "On peut collaborer si tu fais quelque chose de créatif !",
  ],
  "Aïcha.Réseau": [
    "T'as besoin de quoi exactement ? Je connais beaucoup de monde.",
    "Je mets des gens en relation, dis-moi ce que tu cherches.",
    "Le réseau ça s'entretient. On fait comment pour te aider ?",
  ],
};

async function fetchNpcs(): Promise<Npc[]> {
  const { data } = await supabase.from("npcs").select("*");
  return (data ?? []) as Npc[];
}

async function updateNpcOnMap(npc: Npc, slot: TimeSlot) {
  const newStatus: NpcStatus = slot === "nuit" ? "ghost" : npc.status;

  // Variations de position légère selon l'heure
  const latDrift = (Math.random() - 0.5) * 0.003;
  const lngDrift = (Math.random() - 0.5) * 0.003;

  await supabase
    .from("life_map_players")
    .update({
      status: newStatus,
      lat: npc.lat + latDrift,
      lng: npc.lng + lngDrift,
      last_action: npc.last_action,
      updated_at: new Date().toISOString(),
    })
    .eq("display_name", npc.display_name)
    .eq("is_npc", true);

  await supabase
    .from("npcs")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", npc.id);
}

async function postNpcMessage(npc: Npc, slot: TimeSlot) {
  const msgs = NPC_MESSAGES[npc.display_name]?.[slot] ?? [];
  if (msgs.length === 0) return;

  // 40% de chance de poster pour éviter le spam
  if (Math.random() > 0.4) return;

  const body = msgs[Math.floor(Math.random() * msgs.length)];
  if (!body) return;

  await supabase.from("quartier_messages").insert({
    quartier:     npc.home_quartier,
    display_name: npc.display_name,
    avatar_emoji: npc.avatar_emoji,
    body,
    is_star:      npc.is_star,
    is_npc:       true,
  });

  console.log(`[NPC] ${npc.display_name} → ${npc.home_quartier}: ${body}`);
}

async function respondToRecentMessages(npc: Npc) {
  const responses = NPC_RESPONSES[npc.display_name];
  if (!responses) return;

  // Regarde les 5 derniers messages dans son quartier (non-NPC)
  const { data: recentMsgs } = await supabase
    .from("quartier_messages")
    .select("*")
    .eq("quartier", npc.home_quartier)
    .eq("is_npc", false)
    .order("created_at", { ascending: false })
    .limit(5);

  if (!recentMsgs || recentMsgs.length === 0) return;

  // 25% de chance de répondre au dernier message d'un vrai joueur
  if (Math.random() > 0.25) return;

  const lastMsg = recentMsgs[0];
  const response = responses[Math.floor(Math.random() * responses.length)];

  // Délai réaliste de 2-8 minutes après le message
  const msgTime = new Date(lastMsg.created_at).getTime();
  const now     = Date.now();
  const delay   = Math.floor(Math.random() * 6 + 2) * 60 * 1000;

  if (now - msgTime < delay) return; // Pas encore le temps de répondre

  await supabase.from("quartier_messages").insert({
    quartier:     npc.home_quartier,
    display_name: npc.display_name,
    avatar_emoji: npc.avatar_emoji,
    body:         response,
    is_star:      npc.is_star,
    is_npc:       true,
  });

  console.log(`[NPC] ${npc.display_name} répond à ${lastMsg.display_name}: ${response}`);
}

async function runNpcCycle() {
  console.log(`\n[NPC Engine] ${new Date().toLocaleTimeString("fr-FR")} — Cycle démarré`);
  const slot = getTimeSlot();
  const npcs = await fetchNpcs();

  console.log(`[NPC Engine] ${npcs.length} NPCs, créneau: ${slot}`);

  for (const npc of npcs) {
    try {
      await updateNpcOnMap(npc, slot);
      await postNpcMessage(npc, slot);
      await respondToRecentMessages(npc);
    } catch (e) {
      console.error(`[NPC] Erreur pour ${npc.display_name}:`, e);
    }
  }

  console.log(`[NPC Engine] Cycle terminé. Prochain dans 15 min.`);
}

// Lance le cycle immédiatement puis toutes les 15 min
runNpcCycle();
setInterval(runNpcCycle, 15 * 60 * 1000);
