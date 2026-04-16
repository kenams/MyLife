/**
 * Études & Formations — Système de progression intellectuelle
 *
 * - Modules de formation (dev web, cuisine, fitness coach, droit, finance…)
 * - Progression par niveau (1→3)
 * - Récompenses : discipline, motivation, déblocage de rangs + grands events
 * - Transposition vraie vie intégrée
 */

import { router } from "expo-router";
import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

// ─── Catalogue de formations ──────────────────────────────────────────────────

type StudyModule = {
  id: string;
  category: string;
  title: string;
  description: string;
  emoji: string;
  color: string;
  xpPerSession: number;
  totalSessions: number;   // sessions pour passer de 0 à niveau 3
  rewards: {
    discipline?: number;
    motivation?: number;
    money?: number;
    reputation?: number;
    sociability?: number;
  };
  unlocks: string;         // ce que ça débloque
  realLifeParallel: string;
};

const MODULES: StudyModule[] = [
  {
    id: "dev-web",
    category: "Tech",
    title: "Développement Web",
    description: "Apprends à coder des sites et apps. Très demandé dans le jeu et IRL.",
    emoji: "💻",
    color: "#3498db",
    xpPerSession: 35,
    totalSessions: 9,
    rewards: { discipline: 8, motivation: 10, money: 25 },
    unlocks: "Accès aux missions tech (bonus argent +30%)",
    realLifeParallel: "HTML, CSS, JS → freeCodeCamp, Odin Project (gratuit)",
  },
  {
    id: "finance-perso",
    category: "Finance",
    title: "Finance Personnelle",
    description: "Budget, épargne, investissement. Maîtrise ton argent dans le jeu.",
    emoji: "💰",
    color: "#27ae60",
    xpPerSession: 30,
    totalSessions: 6,
    rewards: { discipline: 6, motivation: 6, money: 50 },
    unlocks: "Déblocage du rang Confortable → Influent",
    realLifeParallel: "Budget 50/30/20, épargne automatique, compte d'investissement",
  },
  {
    id: "nutrition",
    category: "Santé",
    title: "Nutrition & Bien-être",
    description: "Comprends ton corps. Optimise énergie, santé et poids.",
    emoji: "🥗",
    color: "#e67e22",
    xpPerSession: 25,
    totalSessions: 6,
    rewards: { discipline: 5, motivation: 8 },
    unlocks: "Actions alimentaires améliorées (+15% bénéfice)",
    realLifeParallel: "Macros, déficit calorique, hydratation, rythme circadien",
  },
  {
    id: "communication",
    category: "Social",
    title: "Communication & Charisme",
    description: "Améliore tes interactions. Networking, persuasion, leadership.",
    emoji: "🗣️",
    color: "#9b59b6",
    xpPerSession: 28,
    totalSessions: 6,
    rewards: { sociability: 12, reputation: 8, motivation: 5 },
    unlocks: "Déblocage des Grands Events (conférence, networking night)",
    realLifeParallel: "Écoute active, public speaking, CNV (Communication Non Violente)",
  },
  {
    id: "fitness-coach",
    category: "Sport",
    title: "Coach Fitness",
    description: "Programme d'entraînement avancé. Résultats mesurables.",
    emoji: "🏋️",
    color: "#e74c3c",
    xpPerSession: 30,
    totalSessions: 6,
    rewards: { discipline: 10, motivation: 7 },
    unlocks: "Sessions gym x2 efficacité, accès tournois sportifs",
    realLifeParallel: "Progressive overload, récupération, mobilité, HIIT",
  },
  {
    id: "entrepreneuriat",
    category: "Business",
    title: "Entrepreneuriat",
    description: "Lance ton projet. Business plan, marketing, monétisation.",
    emoji: "🚀",
    color: "#f39c12",
    xpPerSession: 40,
    totalSessions: 9,
    rewards: { discipline: 12, motivation: 15, money: 80, reputation: 10 },
    unlocks: "Rang Elite accessible, revenus passifs en jeu",
    realLifeParallel: "Lean startup, validation d'idée, MVP, acquisition client",
  },
  {
    id: "meditation",
    category: "Mental",
    title: "Gestion du Stress & Méditation",
    description: "Techniques avancées de récupération mentale. Anti-burnout.",
    emoji: "🧘",
    color: "#1abc9c",
    xpPerSession: 20,
    totalSessions: 6,
    rewards: { discipline: 4, motivation: 8 },
    unlocks: "Méditation x2 efficacité, résistance au burnout +40%",
    realLifeParallel: "Mindfulness, cohérence cardiaque, journaling, respiration",
  },
  {
    id: "cuisine",
    category: "Lifestyle",
    title: "Cuisine Créative",
    description: "Maîtrise la cuisine maison. Économies + santé + social.",
    emoji: "👨‍🍳",
    color: "#e67e22",
    xpPerSession: 22,
    totalSessions: 6,
    rewards: { discipline: 4, motivation: 6, money: 20 },
    unlocks: "Cuisine maison x1.5 gain santé, invitations dîner",
    realLifeParallel: "Batch cooking, recettes rapides, repas < 5€/portion",
  },
];

// ─── Types progression ────────────────────────────────────────────────────────

type StudyProgress = {
  moduleId: string;
  sessionsCompleted: number;
  level: number;           // 0, 1, 2, 3
};

function getLevelFromSessions(sessions: number, total: number): number {
  if (sessions === 0) return 0;
  if (sessions >= total) return 3;
  if (sessions >= Math.floor(total * 0.67)) return 2;
  if (sessions >= Math.floor(total * 0.33)) return 1;
  return 0;
}

function getLevelLabel(level: number): string {
  return ["Débutant", "Intermédiaire", "Avancé", "Expert"][level];
}

function getLevelColor(level: number): string {
  return ["rgba(255,255,255,0.3)", "#f39c12", "#3498db", "#27ae60"][level];
}

// ─── Carte module ─────────────────────────────────────────────────────────────
function ModuleCard({
  module,
  progress,
  onStudy,
}: {
  module: StudyModule;
  progress: StudyProgress | undefined;
  onStudy: () => void;
}) {
  const sessions = progress?.sessionsCompleted ?? 0;
  const level    = getLevelFromSessions(sessions, module.totalSessions);
  const pct      = Math.min(100, (sessions / module.totalSessions) * 100);
  const maxed    = level === 3;
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={{
      backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16,
      borderWidth: 1, borderColor: maxed ? module.color + "66" : "rgba(255,255,255,0.08)",
      overflow: "hidden",
    }}>
      {/* En-tête */}
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={{ padding: 14, gap: 8 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{
            width: 46, height: 46, borderRadius: 12,
            backgroundColor: module.color + "22",
            borderWidth: 1, borderColor: module.color + "55",
            alignItems: "center", justifyContent: "center",
          }}>
            <Text style={{ fontSize: 22 }}>{module.emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>{module.title}</Text>
              {maxed && <Text style={{ fontSize: 12 }}>✅</Text>}
            </View>
            <Text style={{ color: colors.muted, fontSize: 11 }}>{module.category}</Text>
          </View>
          {/* Badge niveau */}
          <View style={{
            backgroundColor: getLevelColor(level) + (level > 0 ? "33" : ""),
            borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
            borderWidth: 1, borderColor: getLevelColor(level) + "66",
          }}>
            <Text style={{ color: getLevelColor(level), fontSize: 10, fontWeight: "800" }}>
              {getLevelLabel(level)}
            </Text>
          </View>
        </View>

        {/* Barre progression */}
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 10 }}>
              {sessions}/{module.totalSessions} sessions
            </Text>
            <Text style={{ color: module.color, fontSize: 10, fontWeight: "700" }}>
              {Math.round(pct)}%
            </Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <View style={{
              width: `${pct}%`, height: "100%", borderRadius: 3,
              backgroundColor: maxed ? "#27ae60" : module.color,
            }} />
          </View>
        </View>
      </Pressable>

      {/* Détails expandés */}
      {expanded && (
        <View style={{
          borderTopWidth: 1, borderColor: "rgba(255,255,255,0.06)",
          padding: 14, gap: 10,
        }}>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{module.description}</Text>

          {/* Récompenses */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(module.rewards).map(([key, val]) => (
              <View key={key} style={{
                backgroundColor: "rgba(56,199,147,0.12)", borderRadius: 8,
                paddingHorizontal: 8, paddingVertical: 4,
                borderWidth: 1, borderColor: "rgba(56,199,147,0.2)",
              }}>
                <Text style={{ color: "#38c793", fontSize: 11, fontWeight: "700" }}>
                  +{val} {key}
                </Text>
              </View>
            ))}
          </View>

          {/* Débloque */}
          <View style={{
            backgroundColor: module.color + "15", borderRadius: 8,
            padding: 8, borderWidth: 1, borderColor: module.color + "30",
          }}>
            <Text style={{ color: module.color, fontSize: 11, fontWeight: "700" }}>🔓 Débloque : {module.unlocks}</Text>
          </View>

          {/* Vie réelle */}
          <View style={{
            backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8,
            padding: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
          }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", marginBottom: 3 }}>
              📱 DANS TA VRAIE VIE
            </Text>
            <Text style={{ color: colors.text, fontSize: 11, lineHeight: 17 }}>{module.realLifeParallel}</Text>
          </View>

          {/* Bouton étudier */}
          {!maxed && (
            <Pressable
              onPress={onStudy}
              style={{
                backgroundColor: module.color, borderRadius: 12,
                paddingVertical: 12, alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
                📖 Étudier (+{module.xpPerSession} XP)
              </Text>
            </Pressable>
          )}
          {maxed && (
            <View style={{
              backgroundColor: "rgba(39,174,96,0.15)", borderRadius: 12,
              paddingVertical: 12, alignItems: "center",
              borderWidth: 1, borderColor: "rgba(39,174,96,0.3)",
            }}>
              <Text style={{ color: "#27ae60", fontWeight: "800", fontSize: 13 }}>✅ Formation terminée</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Grands Events ─────────────────────────────────────────────────────────────
const BIG_EVENTS = [
  {
    id: "networking-night",
    title: "Networking Night",
    emoji: "🤝",
    description: "Soirée networking prestige. Rencontres professionnelles de haut niveau.",
    color: "#f39c12",
    requirement: "Formation Communication niveau 2+",
    rewards: "+reputation +sociability +money",
    available: false,
  },
  {
    id: "hackathon",
    title: "Hackathon 48h",
    emoji: "⚡",
    description: "Compétition de développement intensive. Équipes de 3-4 joueurs.",
    color: "#3498db",
    requirement: "Formation Dev Web niveau 2+",
    rewards: "+money +reputation +discipline",
    available: false,
  },
  {
    id: "conference-finance",
    title: "Conférence Finance",
    emoji: "📈",
    description: "Conférence investissement et entrepreneuriat. Speakers IRL.",
    color: "#27ae60",
    requirement: "Formation Finance niveau 2+",
    rewards: "+money +motivation +reputation",
    available: false,
  },
  {
    id: "tournament-sport",
    title: "Tournoi Sportif",
    emoji: "🏆",
    description: "Compétition multi-joueurs. Sport collectif en grande salle.",
    color: "#e74c3c",
    requirement: "Formation Fitness niveau 2+",
    rewards: "+fitness +sociability +reputation",
    available: false,
  },
];

// ─── Screen principal ──────────────────────────────────────────────────────────
export default function StudiesScreen() {
  const stats = useGameStore((s) => s.stats);
  const performAction = useGameStore((s) => s.performAction);

  const [studyProgress, setStudyProgress] = useState<StudyProgress[]>([]);
  const [tab, setTab] = useState<"modules" | "events">("modules");
  const [studiedNow, setStudiedNow] = useState<string | null>(null);

  function handleStudy(module: StudyModule) {
    const current = studyProgress.find((p) => p.moduleId === module.id);
    const sessions = (current?.sessionsCompleted ?? 0) + 1;
    const level    = getLevelFromSessions(sessions, module.totalSessions);

    setStudyProgress((prev) => {
      const existing = prev.find((p) => p.moduleId === module.id);
      if (existing) {
        return prev.map((p) => p.moduleId === module.id ? { ...p, sessionsCompleted: sessions, level } : p);
      }
      return [...prev, { moduleId: module.id, sessionsCompleted: sessions, level }];
    });

    setStudiedNow(module.id);
    setTimeout(() => setStudiedNow(null), 2000);

    // Appliquer les effets via le store (action focus-task)
    performAction("focus-task");
  }

  const totalModules  = MODULES.length;
  const completedMods = studyProgress.filter((p) => p.level === 3).length;
  const totalSessions = studyProgress.reduce((acc, p) => acc + p.sessionsCompleted, 0);

  const categories = [...new Set(MODULES.map((m) => m.category))];
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const filteredModules = filterCategory
    ? MODULES.filter((m) => m.category === filterCategory)
    : MODULES;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
        backgroundColor: "rgba(7,17,31,0.97)",
        borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.06)",
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Pressable onPress={() => router.back()} style={{ padding: 6 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 18 }}>📚 Études & Formations</Text>
            <Text style={{ color: colors.muted, fontSize: 11 }}>
              {completedMods}/{totalModules} terminées · {totalSessions} sessions
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/(app)/coach")}
            style={{
              backgroundColor: "rgba(56,199,147,0.15)", borderRadius: 10,
              paddingHorizontal: 10, paddingVertical: 6,
              borderWidth: 1, borderColor: "rgba(56,199,147,0.3)",
            }}
          >
            <Text style={{ color: "#38c793", fontSize: 12, fontWeight: "700" }}>🤖 Coach</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {([
            { key: "modules", label: "📚 Formations" },
            { key: "events",  label: "🏆 Grands Events" },
          ] as const).map(({ key, label }) => (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              style={{
                flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center",
                backgroundColor: tab === key ? colors.accent + "25" : "rgba(255,255,255,0.05)",
                borderWidth: 1, borderColor: tab === key ? colors.accent + "50" : "rgba(255,255,255,0.08)",
              }}
            >
              <Text style={{ color: tab === key ? colors.accent : colors.muted, fontWeight: "700", fontSize: 12 }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Toast étude */}
      {studiedNow && (
        <View style={{
          position: "absolute", top: 120, left: 20, right: 20, zIndex: 50,
          backgroundColor: "#27ae60", borderRadius: 12,
          paddingHorizontal: 16, paddingVertical: 10,
          flexDirection: "row", alignItems: "center", gap: 8,
        }}>
          <Text style={{ fontSize: 20 }}>📖</Text>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>Session d'étude terminée !</Text>
        </View>
      )}

      {/* Modules */}
      {tab === "modules" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
          {/* Filtre par catégorie */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
            <View style={{ flexDirection: "row", gap: 8, paddingRight: 8 }}>
              <Pressable
                onPress={() => setFilterCategory(null)}
                style={{
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                  backgroundColor: !filterCategory ? colors.accent + "25" : "rgba(255,255,255,0.05)",
                  borderWidth: 1, borderColor: !filterCategory ? colors.accent + "50" : "rgba(255,255,255,0.1)",
                }}
              >
                <Text style={{ color: !filterCategory ? colors.accent : colors.muted, fontWeight: "700", fontSize: 12 }}>
                  Tout
                </Text>
              </Pressable>
              {categories.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setFilterCategory(cat === filterCategory ? null : cat)}
                  style={{
                    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
                    backgroundColor: filterCategory === cat ? colors.accent + "25" : "rgba(255,255,255,0.05)",
                    borderWidth: 1, borderColor: filterCategory === cat ? colors.accent + "50" : "rgba(255,255,255,0.1)",
                  }}
                >
                  <Text style={{ color: filterCategory === cat ? colors.accent : colors.muted, fontWeight: "700", fontSize: 12 }}>
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {filteredModules.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              progress={studyProgress.find((p) => p.moduleId === module.id)}
              onStudy={() => handleStudy(module)}
            />
          ))}

          {/* Info vraie vie */}
          <View style={{
            backgroundColor: "rgba(56,199,147,0.08)", borderRadius: 14,
            borderWidth: 1, borderColor: "rgba(56,199,147,0.2)",
            padding: 14, gap: 6,
          }}>
            <Text style={{ color: "#38c793", fontWeight: "800", fontSize: 13 }}>
              💡 Apprendre dans le jeu = apprendre dans la vie
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
              Chaque formation dans MyLife te donne des ressources IRL concrètes.
              Le jeu simule les efforts réels : la progression est lente mais cumulative.
              {"\n"}20 min/jour = résultat visible en 30 jours.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Grands Events */}
      {tab === "events" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
          <View style={{
            backgroundColor: "rgba(243,156,18,0.1)", borderRadius: 14,
            borderWidth: 1, borderColor: "rgba(243,156,18,0.25)",
            padding: 14, marginBottom: 4,
          }}>
            <Text style={{ color: "#f39c12", fontWeight: "800", fontSize: 13, marginBottom: 4 }}>
              🏆 Grands Events — Bientôt disponibles
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
              Les Grands Events sont des rencontres multi-joueurs (networking, hackathons, tournois).
              Complète les formations requises pour les débloquer.
            </Text>
          </View>

          {BIG_EVENTS.map((event) => (
            <View
              key={event.id}
              style={{
                backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 16,
                borderWidth: 1, borderColor: event.color + "33",
                padding: 16, gap: 8, opacity: event.available ? 1 : 0.7,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ fontSize: 28 }}>{event.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "800", fontSize: 15 }}>{event.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{event.description}</Text>
                </View>
                <View style={{
                  backgroundColor: event.available ? "#27ae60" : "rgba(255,255,255,0.1)",
                  borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
                }}>
                  <Text style={{ color: event.available ? "#fff" : colors.muted, fontSize: 10, fontWeight: "700" }}>
                    {event.available ? "Disponible" : "🔒 Verrouillé"}
                  </Text>
                </View>
              </View>

              <View style={{ gap: 4 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>
                  📋 Prérequis : {event.requirement}
                </Text>
                <Text style={{ color: "#38c793", fontSize: 11, fontWeight: "600" }}>
                  🎁 Récompenses : {event.rewards}
                </Text>
              </View>

              {!event.available && (
                <Pressable
                  onPress={() => setTab("modules")}
                  style={{
                    backgroundColor: event.color + "20", borderRadius: 10,
                    paddingVertical: 8, alignItems: "center",
                    borderWidth: 1, borderColor: event.color + "40",
                  }}
                >
                  <Text style={{ color: event.color, fontWeight: "700", fontSize: 12 }}>
                    → Voir les formations requises
                  </Text>
                </Pressable>
              )}
            </View>
          ))}

          {/* Coming soon */}
          <View style={{
            backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 14,
            borderWidth: 1, borderStyle: "dashed" as const, borderColor: "rgba(255,255,255,0.15)",
            padding: 16, alignItems: "center", gap: 6,
          }}>
            <Text style={{ fontSize: 28 }}>🌟</Text>
            <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>Prochainement</Text>
            <Text style={{ color: colors.muted, fontSize: 12, textAlign: "center" }}>
              Concert en plein air · Conférence TEDx · Tournoi e-sport · Gala de charité
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
