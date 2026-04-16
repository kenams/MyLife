/**
 * Coach ARIA — Intelligence Artificielle de vie
 *
 * Analyse les stats du joueur et donne des conseils personnalisés :
 * - Détection du life pattern (burnout, grind, social drought…)
 * - Conseils jeu ET vraie vie
 * - Questions pour explorer des sujets
 * - Roadmaps personnalisées
 */

import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors } from "@/lib/theme";
import { detectLifePattern, getMomentumState } from "@/lib/selectors";
import { useGameStore } from "@/stores/game-store";

// ─── Système IA contextuel ────────────────────────────────────────────────────

type AriaMessage = { id: string; from: "aria" | "user"; text: string; timestamp: string };

const ARIA_INTRO = `Bonjour, je suis ARIA — ton coach de vie intelligent.

Je lis ton profil et tes stats en temps réel pour te donner des conseils personnalisés, autant dans le jeu que dans la vraie vie.

Dis-moi ce dont tu as besoin, ou pose-moi une question. Je suis là.`;

// ─── Base de connaissances ARIA ────────────────────────────────────────────────

function getAriaSystemContext(stats: Record<string, number>, pattern: string, momentum: string): string {
  const lines: string[] = [];
  lines.push(`[CONTEXTE JOUEUR]`);
  lines.push(`Pattern de vie détecté : ${pattern}`);
  lines.push(`Momentum : ${momentum}`);

  if (stats.stress > 70)   lines.push("⚠️ Stress critique (${stats.stress}/100)");
  if (stats.energy < 25)   lines.push("⚠️ Énergie très basse");
  if (stats.sociability < 30) lines.push("⚠️ Isolement social");
  if (stats.discipline > 70) lines.push("✅ Discipline forte");
  if (stats.fitness > 60)  lines.push("✅ Santé physique bonne");
  if (stats.money < 100)   lines.push("⚠️ Finances précaires");

  return lines.join("\n");
}

function getAriaResponse(
  userInput: string,
  stats: Record<string, number>,
  pattern: string,
  momentum: string
): string {
  const input = userInput.toLowerCase();

  // ── Stress / burnout ──────────────────────────────────────────────────────
  if (input.includes("stress") || input.includes("burnout") || input.includes("fatigué")) {
    const advice = stats.stress > 70
      ? [
          "Ton niveau de stress est critique. Dans le jeu, tu peux :",
          "• Faire une action **Méditer** (stress -18)",
          "• Rentrer chez toi et te **Reposer** (énergie +20)",
          "• Éviter le travail pendant 1-2 cycles",
          "",
          "Dans la vraie vie, ça ressemble à quoi ? Si tu te sens surchargé, essaie :",
          "• 10 min de respiration carrée (4-4-4-4)",
          "• Identifier la source principale du stress",
          "• Supprimer 1 obligation de ta to-do list pour demain",
          "",
          "Rappelle-toi : dans le jeu comme dans la vie, **personne ne performe bien sous stress chronique**.",
        ]
      : [
          "Ton stress est gérable. Pour rester au vert :",
          "• Continue les actions **Méditer** ou **Lecture** régulièrement",
          "• Planifie des sorties sociales légères",
          "",
          "Conseil vie réelle : intègre un rituel de décompression quotidien de 10-15 min.",
        ];
    return advice.join("\n");
  }

  // ── Argent / finances ─────────────────────────────────────────────────────
  if (input.includes("argent") || input.includes("finances") || input.includes("fric") || input.includes("money")) {
    return [
      `Tes finances actuelles : ${stats.money ?? 0} crédits.`,
      "",
      stats.money < 200
        ? "Situation précaire. Actions recommandées :"
        : "Situation stable. Pour croître :",
      "• Prendre des **shifts de travail** réguliers (+argent, +discipline)",
      "• Éviter les achats impulsifs (shopping coûte 35 crédits)",
      "• Objectif : atteindre 500 crédits pour accéder aux opportunités premium",
      "",
      "**Parallèle vraie vie** : l'argent dans le jeu simule la gestion budgétaire réelle.",
      "Dans ta vraie vie, est-ce que tu as :",
      "• Un budget mensuel défini ?",
      "• Une épargne automatique, même petite (5-10% du revenu) ?",
      "• Une vision claire de tes dépenses fixes vs. variables ?",
      "",
      "Si non, commence par juste noter tes dépenses pendant 7 jours. Ça change tout.",
    ].join("\n");
  }

  // ── Relations / solitude ──────────────────────────────────────────────────
  if (input.includes("solitude") || input.includes("seul") || input.includes("relation") || input.includes("amis")) {
    return [
      `Ton niveau de sociabilité : ${stats.sociability ?? 0}/100.`,
      "",
      stats.sociability < 35
        ? "Tu es en isolement social. C'est un signal important."
        : "Ton réseau social est actif. Pour l'approfondir :",
      "",
      "**Dans le jeu :**",
      "• Va au **Café** ou au **Parc** pour rencontrer des résidents",
      "• Propose des activités aux NPCs via la carte Live",
      "• Organise une **Room** avec d'autres joueurs",
      "",
      "**Dans la vraie vie :**",
      "Le jeu simule quelque chose de réel : les connexions se dégradent si on ne les entretient pas.",
      "• Envoie un message à quelqu'un que tu n'as pas contacté depuis +1 mois",
      "• Planifie 1 activité sociale cette semaine — même courte",
      "• Si tu te sens structurellement isolé, c'est souvent lié à des habitudes, pas à la chance.",
      "",
      "Qu'est-ce qui te retient de socialiser en ce moment ?",
    ].join("\n");
  }

  // ── Travail / carrière ────────────────────────────────────────────────────
  if (input.includes("travail") || input.includes("carrière") || input.includes("job") || input.includes("boulot")) {
    return [
      "La progression professionnelle dans le jeu fonctionne comme dans la vraie vie.",
      "",
      "**Mécaniques jeu :**",
      "• Chaque shift améliore discipline + réputation",
      "• La discipline élevée débloque des opportunités (events quotidiens)",
      "• Les études accélèrent la progression de rang",
      "",
      "**Transposition vraie vie :**",
      "• La **discipline** dans le jeu = tes habitudes régulières IRL",
      "• La **réputation** = ton personal branding, comment les autres te perçoivent",
      "• Les **études** = la formation continue, même 15-20 min/jour",
      "",
      "Quelle est ta vraie situation professionnelle ?",
      "Je peux t'aider à définir une direction ou structurer une progression.",
    ].join("\n");
  }

  // ── Études / formation ────────────────────────────────────────────────────
  if (input.includes("étude") || input.includes("formation") || input.includes("apprendre") || input.includes("apprentissage")) {
    return [
      "Les études dans le jeu donnent de la **motivation**, de la **discipline** et débloquent des rangs.",
      "",
      "**Roadmap jeu :**",
      "1. Débloque des sessions d'étude via l'onglet **Formation**",
      "2. Complète des modules (chaque module = +discipline, +motivation)",
      "3. Atteins le niveau 3 pour débloquer les **Grands Events** (conférences, networking)",
      "",
      "**Transposition vraie vie :**",
      "L'apprentissage continu est la compétence la plus sous-évaluée de notre époque.",
      "• Identifie 1 compétence que tu veux développer",
      "• Trouve une ressource (cours, livre, vidéo) — 20 min/jour suffit",
      "• Mesure ta progression tous les 30 jours",
      "",
      "Qu'est-ce que tu as envie d'apprendre en ce moment, dans le jeu ou dans la vie ?",
    ].join("\n");
  }

  // ── Santé / sport ─────────────────────────────────────────────────────────
  if (input.includes("santé") || input.includes("sport") || input.includes("gym") || input.includes("forme")) {
    return [
      `Ton état physique : fitness ${stats.fitness ?? 0}/100 · poids ${stats.weight ?? 70}kg · hygiene ${stats.hygiene ?? 0}/100.`,
      "",
      "**Jeu :**",
      "• Gym et marche → fitness +",
      "• Sport collectif → fitness + sociabilité simultanément (double gain !)",
      "• Hygiène basse = malus sur réputation et humeur",
      "",
      "**Vraie vie — les bases :**",
      "La forme physique impacte tout : énergie, clarté mentale, confiance.",
      "• Tu n'as pas besoin d'une salle de gym chère. 3x30 min de marche rapide/semaine = résultat mesurable",
      "• La récupération (sommeil, alimentation) est aussi importante que l'effort",
      "• 1 petit changement tient mieux que 5 grands changements simultanés",
      "",
      "Est-ce que tu as une routine sport en ce moment ?",
    ].join("\n");
  }

  // ── Motivation / objectifs ────────────────────────────────────────────────
  if (input.includes("motiv") || input.includes("objectif") || input.includes("but") || input.includes("goal")) {
    return [
      `Momentum actuel : **${momentum}** · Motivation : ${stats.motivation ?? 0}/100`,
      "",
      "La motivation dans le jeu fonctionne comme dans la vie : elle ne dure pas sans structure.",
      "",
      "**Pour remonter la motivation dans le jeu :**",
      "• Complète des **objectifs journaliers** (onglet Objectifs)",
      "• Enchaîne des actions liées (exemple : gym → douche → café → travail = combo)",
      "• Utilise les événements quotidiens pour booster le streak",
      "",
      "**Vraie vie :**",
      "La motivation est un résultat, pas un point de départ.",
      "• Commence par une **action** (même minime) — la motivation suit l'action, pas l'inverse",
      "• Crée un système, pas un objectif. Ex : au lieu de 'perdre 5kg', 'marcher 20 min après le dîner'",
      "• Identifie ce qui te donne de l'énergie vs ce qui en prend — alloue ton temps en conséquence",
      "",
      "Quel est ton objectif principal en ce moment ?",
    ].join("\n");
  }

  // ── Life pattern spécifique ───────────────────────────────────────────────
  if (pattern === "burnout" || input.includes("burnout")) {
    return [
      "⚠️ **ARIA détecte un burnout.**",
      "",
      "C'est l'une des situations les plus importantes à prendre au sérieux — dans le jeu ET dans la vie.",
      "",
      "**Signaux que j'ai détectés :**",
      `• Stress : ${stats.stress}/100`,
      `• Énergie : ${stats.energy}/100`,
      `• Motivation : ${stats.motivation}/100`,
      "",
      "**Plan de récupération jeu (5 actions prioritaires) :**",
      "1. Se reposer à la maison (+énergie)",
      "2. Méditer 2-3 fois (-stress)",
      "3. Suspendre le travail 24h",
      "4. Sortie légère au parc (+humeur sans fatigue)",
      "5. Cuisine maison (+faim sans dépense)",
      "",
      "**Vraie vie — le burnout n'attend pas :**",
      "Si tu te reconnais dans ce pattern, ce n'est pas une faiblesse — c'est un signal biologique.",
      "• Identifie la source principale d'épuisement",
      "• Supprime ou délègue 1 chose cette semaine",
      "• Parle à quelqu'un de confiance",
      "",
      "Comment tu te sens vraiment en ce moment ?",
    ].join("\n");
  }

  // ── Réponse générique contextuelle ────────────────────────────────────────
  const genericResponses: Record<string, string[]> = {
    grind_mode: [
      `Tu es en mode **grind** — discipliné, focus, mais attention à l'isolement.`,
      "",
      "Ton point fort : la régularité. Ton risque : oublier de vivre.",
      "",
      "Intègre au moins 1 activité sociale par cycle. Le jeu le récompense, la vie aussi.",
    ],
    social_drought: [
      "Tu manques de connexions. Le jeu te signale un isolement réel.",
      "",
      "Petite action : parle à un NPC sur la carte Live. Dans la vraie vie : envoie 1 message.",
    ],
    momentum: [
      "Tu es en **élan** — c'est le bon moment pour viser plus haut.",
      "",
      "• Tente des actions difficiles (grand événement, formation avancée)",
      "• Propose une activité à quelqu'un que tu n'as pas encore rejoint",
    ],
    equilibre: [
      "Ta vie est équilibrée. C'est rare — préserve cet état.",
      "",
      "Pour progresser : fixe 1 objectif ambitieux à long terme et travaille-y régulièrement.",
    ],
  };

  if (genericResponses[pattern]) {
    return genericResponses[pattern].join("\n");
  }

  // Réponse sur le niveau/XP
  if (input.includes("niveau") || input.includes("xp") || input.includes("progression") || input.includes("talent")) {
    const lvl = stats.playerLevel ?? 1;
    const xp  = stats.playerXp ?? 0;
    const talents = stats.talentCount ?? 0;
    return [
      `Tu es actuellement **niveau ${lvl}** avec ${xp} XP.`,
      "",
      "**Pour progresser plus vite :**",
      "• Effectue des actions en créneau idéal (+30% XP)",
      "• Réclamez vos missions terminées — chaque claim rapporte 40-300 XP",
      "• Les actions de travail rapportent 30 XP chacune",
      "• Un boost XP ×2 (disponible en premium) double tout ça",
      "",
      `Tu as ${talents} talent(s) débloqué(s). Chaque groupe de 3 niveaux = 1 point talent.`,
      "",
      "**Conseil :** concentre-toi d'abord sur un arbre de talents (corps, esprit, social ou travail).",
      "La spécialisation est plus efficace que la dispersion.",
    ].join("\n");
  }

  // Réponse sur les missions
  if (input.includes("mission") || input.includes("quête") || input.includes("objectif")) {
    const done   = stats.missionsDone ?? 0;
    const active = stats.missionsActive ?? 0;
    return [
      `Tu as complété **${done} missions** et en as **${active} en cours**.`,
      "",
      "**Stratégie missions :**",
      "• Les missions daily se réinitialisent chaque jour — commence par elles",
      "• Les missions weekly rapportent 2-4× plus de XP",
      "• Les missions story sont permanentes et débloqueables par niveau",
      "",
      "Tip : certaines actions font progresser plusieurs missions simultanément.",
      "Exemple : 'team-sport' avance la mission sport ET la mission sociale.",
    ].join("\n");
  }

  return [
    "Je t'écoute. Voici quelques pistes selon ton profil actuel :",
    "",
    `Pattern : **${pattern}** · Momentum : ${momentum}`,
    "",
    "Tu peux me poser des questions sur :",
    "• Ton **stress** ou burnout",
    "• Tes **finances** et argent",
    "• Tes **relations** et sociabilité",
    "• Ton **travail** et carrière",
    "• Ta **santé** et sport",
    "• Tes **études** et formation",
    "• Ta **motivation** et objectifs",
    "• Ton **niveau** et XP",
    "• Tes **missions** actives",
    "",
    "Je suis là pour aller au fond des choses, pas juste pour les chiffres.",
  ].join("\n");
}

// ─── Suggestions rapides ───────────────────────────────────────────────────────
const QUICK_TOPICS = [
  { label: "Je suis stressé", icon: "😰" },
  { label: "Comment gagner de l'argent ?", icon: "💰" },
  { label: "Je me sens seul", icon: "😔" },
  { label: "Comment progresser ?", icon: "📈" },
  { label: "Conseils burnout", icon: "🔥" },
  { label: "Plan santé", icon: "💪" },
  { label: "Études et formation", icon: "📚" },
  { label: "Objectifs de vie", icon: "🎯" },
  { label: "Mon niveau et XP", icon: "⚡" },
  { label: "Mes missions actives", icon: "🎯" },
];

// ─── Screen principal ──────────────────────────────────────────────────────────
export default function CoachScreen() {
  const stats             = useGameStore((s) => s.stats);
  const avatar            = useGameStore((s) => s.avatar);
  const playerLevel       = useGameStore((s) => s.playerLevel ?? 1);
  const playerXp          = useGameStore((s) => s.playerXp ?? 0);
  const unlockedTalents   = useGameStore((s) => s.unlockedTalents ?? []);
  const missionProgresses = useGameStore((s) => s.missionProgresses ?? []);

  const pattern  = detectLifePattern(stats);
  const momentum = getMomentumState(stats);

  const missionsDone    = missionProgresses.filter((p) => p.status === "claimed").length;
  const missionsActive  = missionProgresses.filter((p) => p.status === "active").length;
  const talentCount     = unlockedTalents.length;

  const [messages, setMessages] = useState<AriaMessage[]>([{
    id: "intro",
    from: "aria",
    text: ARIA_INTRO,
    timestamp: new Date().toISOString(),
  }]);
  const [input, setInput]   = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef           = useRef<ScrollView>(null);

  function sendMessage(text: string) {
    const userMsg: AriaMessage = {
      id: `user-${Date.now()}`,
      from: "user",
      text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);

    // Génération réponse ARIA (simulée avec base de connaissance)
    setTimeout(() => {
      const statsObj: Record<string, number> = {
        stress:      stats.stress,
        energy:      stats.energy,
        money:       stats.money,
        sociability: stats.sociability,
        discipline:  stats.discipline,
        fitness:     stats.fitness,
        hygiene:     stats.hygiene,
        motivation:  stats.motivation,
        mood:        stats.mood,
        weight:      stats.weight,
        playerLevel,
        playerXp,
        missionsDone,
        talentCount,
      };
      const response = getAriaResponse(text, statsObj, pattern, String(momentum));
      const ariaMsg: AriaMessage = {
        id: `aria-${Date.now()}`,
        from: "aria",
        text: response,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, ariaMsg]);
      setTyping(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, 800 + Math.random() * 600);
  }

  function handleSend() {
    const t = input.trim();
    if (!t || typing) return;
    sendMessage(t);
  }

  // Couleur pattern
  const patternColors: Record<string, string> = {
    burnout: "#e74c3c",
    social_drought: "#e67e22",
    grind_mode: "#f39c12",
    momentum: "#27ae60",
    equilibre: "#3498db",
    productive_isolated: "#9b59b6",
    recovery_needed: "#e74c3c",
    neglect: "#e67e22",
    image_gap: "#f39c12",
  };
  const patternColor = patternColors[pattern] ?? colors.accent;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
        backgroundColor: "rgba(7,17,31,0.97)",
        borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.06)",
        gap: 12,
      }}>
        <Pressable onPress={() => router.back()} style={{ padding: 6 }}>
          <Text style={{ color: colors.muted, fontSize: 13 }}>←</Text>
        </Pressable>
        {/* Avatar ARIA */}
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: "rgba(56,199,147,0.15)",
          borderWidth: 2, borderColor: "#38c793",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 20 }}>🤖</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>Coach ARIA</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>
            Niv. {playerLevel} · {missionsDone} missions · {talentCount} talents
          </Text>
        </View>
        {/* Badge pattern */}
        <View style={{
          backgroundColor: patternColor + "22", borderRadius: 8,
          borderWidth: 1, borderColor: patternColor + "55",
          paddingHorizontal: 8, paddingVertical: 4,
        }}>
          <Text style={{ color: patternColor, fontSize: 10, fontWeight: "800" }}>{pattern.replace("_", " ").toUpperCase()}</Text>
        </View>
      </View>

      {/* Stats rapides */}
      <View style={{
        flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10,
        borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.05)",
      }}>
        {[
          { label: "Stress", value: stats.stress, color: stats.stress > 70 ? "#e74c3c" : "#38c793" },
          { label: "Énergie", value: stats.energy, color: stats.energy < 30 ? "#e74c3c" : "#3498db" },
          { label: "Social", value: stats.sociability, color: stats.sociability < 30 ? "#e67e22" : "#9b59b6" },
          { label: "Discipline", value: stats.discipline, color: "#f39c12" },
        ].map((s) => (
          <View key={s.label} style={{ flex: 1, alignItems: "center", gap: 3 }}>
            <View style={{ width: "100%", height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <View style={{ width: `${s.value}%`, height: "100%", backgroundColor: s.color, borderRadius: 2 }} />
            </View>
            <Text style={{ color: colors.muted, fontSize: 9 }}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Messages */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => {
            const isAria = msg.from === "aria";
            return (
              <View key={msg.id} style={{
                flexDirection: "row",
                justifyContent: isAria ? "flex-start" : "flex-end",
                alignItems: "flex-end", gap: 8,
              }}>
                {isAria && (
                  <View style={{
                    width: 28, height: 28, borderRadius: 14,
                    backgroundColor: "rgba(56,199,147,0.15)",
                    borderWidth: 1, borderColor: "#38c793",
                    alignItems: "center", justifyContent: "center",
                    marginBottom: 2,
                  }}>
                    <Text style={{ fontSize: 14 }}>🤖</Text>
                  </View>
                )}
                <View style={{
                  maxWidth: "82%",
                  backgroundColor: isAria ? "rgba(56,199,147,0.1)" : colors.accent,
                  borderRadius: 16,
                  borderTopLeftRadius: isAria ? 4 : 16,
                  borderTopRightRadius: isAria ? 16 : 4,
                  paddingHorizontal: 14, paddingVertical: 10,
                  borderWidth: isAria ? 1 : 0,
                  borderColor: isAria ? "rgba(56,199,147,0.2)" : "transparent",
                }}>
                  <Text style={{
                    color: isAria ? colors.text : "#07111f",
                    fontSize: 13, fontWeight: "600", lineHeight: 20,
                  }}>
                    {msg.text}
                  </Text>
                </View>
              </View>
            );
          })}

          {typing && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{
                width: 28, height: 28, borderRadius: 14,
                backgroundColor: "rgba(56,199,147,0.15)",
                borderWidth: 1, borderColor: "#38c793",
                alignItems: "center", justifyContent: "center",
              }}>
                <Text style={{ fontSize: 14 }}>🤖</Text>
              </View>
              <View style={{
                backgroundColor: "rgba(56,199,147,0.1)", borderRadius: 16,
                borderTopLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10,
                borderWidth: 1, borderColor: "rgba(56,199,147,0.2)",
              }}>
                <Text style={{ color: colors.muted, fontSize: 13 }}>ARIA analyse…</Text>
              </View>
            </View>
          )}

          {/* Suggestions rapides (affichées seulement au début) */}
          {messages.length <= 1 && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>
                SUJETS FRÉQUENTS
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {QUICK_TOPICS.map((topic) => (
                  <Pressable
                    key={topic.label}
                    onPress={() => sendMessage(topic.label)}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 20,
                      paddingHorizontal: 12, paddingVertical: 7,
                      borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
                      flexDirection: "row", alignItems: "center", gap: 5,
                    }}
                  >
                    <Text style={{ fontSize: 14 }}>{topic.icon}</Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{topic.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input */}
        <View style={{
          flexDirection: "row", gap: 8, alignItems: "flex-end",
          paddingHorizontal: 16, paddingVertical: 10,
          borderTopWidth: 1, borderColor: "rgba(255,255,255,0.06)",
        }}>
          <TextInput
            style={{
              flex: 1, backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 16,
              paddingHorizontal: 16, paddingVertical: 11,
              color: colors.text, fontSize: 13, fontWeight: "600",
              maxHeight: 100,
            }}
            value={input}
            onChangeText={setInput}
            placeholder="Pose une question à ARIA…"
            placeholderTextColor={colors.muted}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
          />
          <Pressable
            onPress={handleSend}
            disabled={typing}
            style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: input.trim() && !typing ? "#38c793" : "rgba(255,255,255,0.1)",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20 }}>→</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
