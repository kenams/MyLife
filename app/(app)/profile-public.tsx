import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, ScrollView, Share, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { AvatarSprite } from "@/components/avatar-sprite";
import { getAvatarVisual } from "@/lib/avatar-visual";
import { getLevelTitle } from "@/lib/progression";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

const XP_PER_LEVEL = 200;

// ─── QR Code minimal SVG ──────────────────────────────────────────────────────
// Génère un pattern QR-like décoratif basé sur un hash du texte
function QrCode({ value, size = 140, color = "#8b7cff" }: { value: string; size?: number; color?: string }) {
  const CELLS = 21;
  const cellSize = size / CELLS;

  // Hash simple du texte → bits
  function hashBits(s: string): boolean[][] {
    const grid: boolean[][] = Array.from({ length: CELLS }, () => Array(CELLS).fill(false));
    // Finder patterns (coins)
    const drawFinder = (r: number, c: number) => {
      for (let dr = 0; dr < 7; dr++) for (let dc = 0; dc < 7; dc++) {
        const inner = dr >= 1 && dr <= 5 && dc >= 1 && dc <= 5;
        const core  = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
        if (!inner || core) grid[r + dr][c + dc] = true;
      }
    };
    drawFinder(0, 0);
    drawFinder(0, 14);
    drawFinder(14, 0);
    // Data bits from string hash
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    for (let r = 8; r < CELLS - 8; r++) {
      for (let c = 8; c < CELLS - 8; c++) {
        const bit = ((h ^ (r * 31 + c * 17)) & 1) === 1;
        grid[r][c] = bit;
      }
    }
    // Timing patterns
    for (let i = 8; i < CELLS - 8; i++) {
      grid[6][i] = grid[i][6] = i % 2 === 0;
    }
    return grid;
  }

  const grid = hashBits(value);

  return (
    <Svg width={size} height={size}>
      <Rect x={0} y={0} width={size} height={size} fill="#0b1a2d" rx={8} />
      {grid.map((row, r) =>
        row.map((on, c) =>
          on ? (
            <Rect
              key={`${r}-${c}`}
              x={c * cellSize + 1}
              y={r * cellSize + 1}
              width={cellSize - 1}
              height={cellSize - 1}
              fill={color}
              rx={1}
            />
          ) : null
        )
      )}
    </Svg>
  );
}

function StatChip({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={{ flex: 1, minWidth: "30%", backgroundColor: color + "10", borderRadius: 12, padding: 10,
      borderWidth: 1, borderColor: color + "25", alignItems: "center", gap: 4 }}>
      <Text style={{ fontSize: 18 }}>{icon}</Text>
      <Text style={{ color, fontWeight: "900", fontSize: 16 }}>{Math.round(pct)}</Text>
      <Text style={{ color: colors.muted, fontSize: 9 }}>{label}</Text>
    </View>
  );
}

function TalentBadge({ id, unlockedTalents }: { id: string; unlockedTalents: string[] }) {
  const unlocked = unlockedTalents.includes(id);
  if (!unlocked) return null;

  const TALENT_MAP: Record<string, { emoji: string; name: string; color: string }> = {
    "iron-body":      { emoji: "💪", name: "Corps d'acier",     color: "#f6b94f" },
    "natural-athlete":{ emoji: "🏆", name: "Athlète naturel",   color: "#f6b94f" },
    "zen-mind":       { emoji: "🧘", name: "Esprit zen",        color: "#c084fc" },
    "charming":       { emoji: "😎", name: "Charmeur",          color: "#38c793" },
    "hard-worker":    { emoji: "💼", name: "Bourreau de travail", color: "#60a5fa" },
    "networker":      { emoji: "🤝", name: "Networker",         color: "#38c793" },
    "entrepreneur":   { emoji: "🚀", name: "Entrepreneur",      color: "#60a5fa" },
    "boss":           { emoji: "👑", name: "Le Boss",           color: "#f6b94f" },
    "influencer":     { emoji: "⭐", name: "Influenceur",       color: "#38c793" },
    "philosopher":    { emoji: "🦉", name: "Philosophe",        color: "#c084fc" },
  };

  const t = TALENT_MAP[id];
  if (!t) return null;

  return (
    <View style={{ backgroundColor: t.color + "18", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
      borderWidth: 1, borderColor: t.color + "40", flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Text style={{ fontSize: 14 }}>{t.emoji}</Text>
      <Text style={{ color: t.color, fontWeight: "700", fontSize: 11 }}>{t.name}</Text>
    </View>
  );
}

export default function ProfilePublicScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const avatar          = useGameStore((s) => s.avatar);
  const stats           = useGameStore((s) => s.stats);
  const playerXp        = useGameStore((s) => s.playerXp ?? 0);
  const playerLevel     = useGameStore((s) => s.playerLevel ?? 1);
  const unlockedTalents = useGameStore((s) => s.unlockedTalents ?? []);
  const isPremium       = useGameStore((s) => s.isPremium);
  const missionProgresses = useGameStore((s) => s.missionProgresses ?? []);
  const relationships   = useGameStore((s) => s.relationships);

  const [showQr, setShowQr] = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  const levelTitle    = getLevelTitle(playerLevel);
  const xpInLevel     = playerXp % XP_PER_LEVEL;
  const xpPct         = (xpInLevel / XP_PER_LEVEL) * 100;
  const missionsDone  = missionProgresses.filter((p) => p.status === "claimed").length;
  const friendCount   = relationships.filter((r) => r.status === "ami" || r.status === "cercle-proche").length;

  const avatarColor =
    stats.reputation >= 80 ? "#f6b94f" :
    stats.reputation >= 50 ? "#c084fc" :
    stats.reputation >= 30 ? "#38c793" : "#60a5fa";

  async function handleShare() {
    try {
      await Share.share({
        message: `🎮 ${avatar?.displayName ?? "Joueur"} — Niveau ${playerLevel} "${levelTitle}" sur MyLife !\n🏆 ${stats.reputation} de réputation · 🔥 ${stats.streak} jours de streak\nJoue toi aussi sur MyLife !`,
      });
    } catch { /* ignore */ }
  }

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={{
          backgroundColor: "#060d18",
          paddingHorizontal: 20, paddingTop: 56, paddingBottom: 24,
          borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)",
          alignItems: "center", gap: 12,
        }}>
          <Pressable onPress={() => router.back()} style={{ alignSelf: "flex-start", marginBottom: 4 }}>
            <Text style={{ color: colors.muted, fontSize: 13 }}>← Retour</Text>
          </Pressable>

          {/* Avatar circle */}
          <View style={{ width: 88, height: 88, borderRadius: 44,
            backgroundColor: avatarColor + "20",
            borderWidth: 3, borderColor: avatarColor,
            alignItems: "center", justifyContent: "center",
            overflow: "hidden" }}>
            {avatar ? (
              <AvatarSprite visual={getAvatarVisual(avatar)} action="waving" size="sm" />
            ) : (
              <Text style={{ fontSize: 40 }}>🧑</Text>
            )}
          </View>

          <View style={{ alignItems: "center", gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 22 }}>
                {avatar?.displayName ?? "Joueur"}
              </Text>
              {isPremium && (
                <View style={{ backgroundColor: "#f6b94f20", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2,
                  borderWidth: 1, borderColor: "#f6b94f40" }}>
                  <Text style={{ color: "#f6b94f", fontSize: 10, fontWeight: "800" }}>⭐ PRO</Text>
                </View>
              )}
            </View>
            <Text style={{ color: avatarColor, fontWeight: "700", fontSize: 15 }}>
              Niveau {playerLevel} — {levelTitle}
            </Text>
            {avatar?.bio ? (
              <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 18, maxWidth: 280 }}>
                {avatar.bio}
              </Text>
            ) : null}
          </View>

          {/* XP bar */}
          <View style={{ width: "100%", gap: 4 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
              <View style={{ height: 6, borderRadius: 3, width: `${xpPct}%`, backgroundColor: "#f6b94f" }} />
            </View>
            <Text style={{ color: colors.muted, fontSize: 10, textAlign: "center" }}>
              {xpInLevel}/{XP_PER_LEVEL} XP · {playerXp} XP total
            </Text>
          </View>

          {/* Boutons partager + QR */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={handleShare}
              style={{ flex: 1, backgroundColor: colors.accent + "20", borderRadius: 14,
                paddingHorizontal: 16, paddingVertical: 10,
                borderWidth: 1, borderColor: colors.accent + "40",
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Text style={{ fontSize: 16 }}>📤</Text>
              <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 13 }}>Partager</Text>
            </Pressable>
            <Pressable onPress={() => setShowQr(true)}
              style={{ backgroundColor: "#c084fc20", borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10,
                borderWidth: 1, borderColor: "#c084fc40",
                flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Text style={{ fontSize: 16 }}>📱</Text>
              <Text style={{ color: "#c084fc", fontWeight: "700", fontSize: 13 }}>QR Code</Text>
            </Pressable>
          </View>

          {/* Modal QR */}
          <Modal visible={showQr} transparent animationType="fade" onRequestClose={() => setShowQr(false)}>
            <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)",
              justifyContent: "center", alignItems: "center" }}
              onPress={() => setShowQr(false)}>
              <View style={{ backgroundColor: "#0b1a2d", borderRadius: 24, padding: 28, alignItems: "center", gap: 16,
                borderWidth: 1.5, borderColor: "#c084fc30" }}>
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 16 }}>
                  {avatar?.displayName ?? "Mon profil"}
                </Text>
                <QrCode value={`mylife://profile/${avatar?.displayName ?? "player"}`} size={180} color="#c084fc" />
                <Text style={{ color: colors.muted, fontSize: 11 }}>Scanne pour voir mon profil</Text>
                <Pressable onPress={() => setShowQr(false)}
                  style={{ paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12,
                    backgroundColor: "rgba(255,255,255,0.08)" }}>
                  <Text style={{ color: colors.muted, fontWeight: "700" }}>Fermer</Text>
                </Pressable>
              </View>
            </Pressable>
          </Modal>
        </View>

        <View style={{ padding: 20, gap: 22 }}>

          {/* Stats vitrines */}
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>PROFIL</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <StatChip icon="⭐" label="Réputation"  value={stats.reputation}  color="#f6b94f" />
              <StatChip icon="💪" label="Forme"       value={stats.fitness}     color="#38c793" />
              <StatChip icon="🧠" label="Zen"         value={100 - stats.stress} color="#c084fc" />
              <StatChip icon="👥" label="Social"      value={stats.sociability}  color="#60a5fa" />
              <StatChip icon="♥" label="Santé"        value={stats.health}       color="#f87171" />
              <StatChip icon="💰" label="Crédits"     value={Math.min(100, stats.money / 5)} color="#34d399" />
            </View>
          </View>

          {/* Scores rapides */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1, backgroundColor: "#f6b94f12", borderRadius: 14, padding: 14, alignItems: "center",
              borderWidth: 1, borderColor: "#f6b94f25" }}>
              <Text style={{ fontSize: 22 }}>🔥</Text>
              <Text style={{ color: "#f6b94f", fontWeight: "900", fontSize: 22 }}>{stats.streak}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>jours streak</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "#38c79312", borderRadius: 14, padding: 14, alignItems: "center",
              borderWidth: 1, borderColor: "#38c79325" }}>
              <Text style={{ fontSize: 22 }}>🎯</Text>
              <Text style={{ color: "#38c793", fontWeight: "900", fontSize: 22 }}>{missionsDone}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>missions</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "#60a5fa12", borderRadius: 14, padding: 14, alignItems: "center",
              borderWidth: 1, borderColor: "#60a5fa25" }}>
              <Text style={{ fontSize: 22 }}>👥</Text>
              <Text style={{ color: "#60a5fa", fontWeight: "900", fontSize: 22 }}>{friendCount}</Text>
              <Text style={{ color: colors.muted, fontSize: 10 }}>amis</Text>
            </View>
          </View>

          {/* Talents débloqués */}
          {unlockedTalents.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
                TALENTS
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {unlockedTalents.map((t) => (
                  <TalentBadge key={t} id={t} unlockedTalents={unlockedTalents} />
                ))}
              </View>
            </View>
          )}

          {/* Infos avatar */}
          {avatar && (
            <View style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 16, padding: 16, gap: 10,
              borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" }}>
              <Text style={{ color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 }}>
                STYLE DE VIE
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {[
                  avatar.personalGoal && `🎯 ${avatar.personalGoal}`,
                  avatar.lifeRhythm && `⏰ ${avatar.lifeRhythm}`,
                  avatar.ambition && `🚀 ${avatar.ambition}`,
                  avatar.sociabilityStyle && `👥 ${avatar.sociabilityStyle}`,
                ].filter(Boolean).map((tag, i) => (
                  <View key={i} style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 10,
                    paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={{ gap: 8 }}>
            <Pressable onPress={() => router.push("/(app)/missions")}
              style={{ backgroundColor: "rgba(56,199,147,0.1)", borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: "rgba(56,199,147,0.25)", flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 22 }}>🎯</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#38c793", fontWeight: "700", fontSize: 13 }}>Voir mes missions</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{missionsDone} réclamées</Text>
              </View>
              <Text style={{ color: colors.muted }}>›</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(app)/progression")}
              style={{ backgroundColor: "rgba(246,185,79,0.1)", borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: "rgba(246,185,79,0.25)", flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Text style={{ fontSize: 22 }}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#f6b94f", fontWeight: "700", fontSize: 13 }}>Progression & Talents</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{unlockedTalents.length} talents débloqués</Text>
              </View>
              <Text style={{ color: colors.muted }}>›</Text>
            </Pressable>
          </View>

        </View>
      </ScrollView>
    </Animated.View>
  );
}
