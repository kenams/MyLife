import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

import { getLocationName, getMomentumState, getRecommendedActionMeta, getWellbeingScore } from "@/lib/selectors";
import { colors } from "@/lib/theme";
import { useGameStore } from "@/stores/game-store";

// ─── Barre de stat ────────────────────────────────────────────────────────────
function StatBar({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const isLow = pct < 30;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: isLow ? color : colors.muted, fontSize: 11, fontWeight: isLow ? "800" : "500" }}>
          {icon} {label}{isLow ? " !" : ""}
        </Text>
        <Text style={{ color, fontSize: 11, fontWeight: "700" }}>{Math.round(pct)}</Text>
      </View>
      <View style={{ height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.07)" }}>
        <View style={{ height: 7, borderRadius: 4, width: `${pct}%`, backgroundColor: isLow ? "#ff6b6b" : color }} />
      </View>
    </View>
  );
}

// ─── Action rapide ────────────────────────────────────────────────────────────
function ActionBtn({ emoji, label, cost, reward, onPress, disabled }: {
  emoji: string; label: string; cost: string; reward: string; onPress: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1, minWidth: "45%", backgroundColor: disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
        borderRadius: 16, padding: 14, gap: 6,
        borderWidth: 1, borderColor: disabled ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.1)",
        opacity: disabled ? 0.5 : 1
      }}
    >
      <Text style={{ fontSize: 26 }}>{emoji}</Text>
      <Text style={{ color: colors.text, fontWeight: "800", fontSize: 13 }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Text style={{ color: "#ff8d8d", fontSize: 10 }}>{cost}</Text>
        <Text style={{ color: "#38c793", fontSize: 10 }}>{reward}</Text>
      </View>
    </Pressable>
  );
}

// ─── Quête du jour ────────────────────────────────────────────────────────────
function QuestRow({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8,
      borderBottomWidth: 1, borderColor: "rgba(255,255,255,0.04)" }}>
      <View style={{
        width: 22, height: 22, borderRadius: 11,
        backgroundColor: done ? "#38c793" : "rgba(255,255,255,0.08)",
        alignItems: "center", justifyContent: "center"
      }}>
        {done && <Text style={{ fontSize: 12 }}>✓</Text>}
      </View>
      <Text style={{ color: done ? colors.muted : colors.text, fontSize: 13, flex: 1,
        textDecorationLine: done ? "line-through" : "none" }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Daily Event Modal ────────────────────────────────────────────────────────
function DailyEventModal() {
  const dailyEvent       = useGameStore((s) => s.dailyEvent);
  const resolveDailyEvent = useGameStore((s) => s.resolveDailyEvent);
  const [visible, setVisible] = useState(true);

  if (!dailyEvent || dailyEvent.resolved || !visible) return null;

  const kindColor =
    dailyEvent.kind === "opportunity" ? "#38c793" :
    dailyEvent.kind === "windfall"    ? "#f6b94f" :
    dailyEvent.kind === "encounter"   ? colors.accent :
    dailyEvent.kind === "social"      ? "#60a5fa" : "#ff8d8d";

  const kindLabel =
    dailyEvent.kind === "opportunity" ? "Opportunité" :
    dailyEvent.kind === "windfall"    ? "Coup de chance" :
    dailyEvent.kind === "encounter"   ? "Rencontre" :
    dailyEvent.kind === "social"      ? "Événement social" : "Alerte";

  const kindEmoji =
    dailyEvent.kind === "opportunity" ? "✨" :
    dailyEvent.kind === "windfall"    ? "🎁" :
    dailyEvent.kind === "encounter"   ? "👤" :
    dailyEvent.kind === "social"      ? "🤝" : "⚠️";

  function accept() {
    resolveDailyEvent("accepted");
    setVisible(false);
  }
  function skip() {
    resolveDailyEvent("skipped");
    setVisible(false);
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={() => setVisible(false)}>
      <View style={{
        flex: 1, backgroundColor: "rgba(0,0,0,0.75)",
        justifyContent: "center", alignItems: "center", padding: 24
      }}>
        <View style={{
          width: "100%", maxWidth: 400,
          backgroundColor: "#0b1a2d",
          borderRadius: 24, padding: 24, gap: 16,
          borderWidth: 1.5, borderColor: kindColor + "40"
        }}>
          {/* Header */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: kindColor + "20",
              alignItems: "center", justifyContent: "center"
            }}>
              <Text style={{ fontSize: 22 }}>{kindEmoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: kindColor, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>
                {kindLabel.toUpperCase()}
              </Text>
              <Text style={{ color: colors.text, fontWeight: "900", fontSize: 17, marginTop: 2 }}>
                {dailyEvent.title}
              </Text>
            </View>
          </View>

          {/* Body */}
          <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 21 }}>{dailyEvent.body}</Text>

          {/* Effects preview */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{
              flex: 1, backgroundColor: kindColor + "10", borderRadius: 12, padding: 12,
              borderWidth: 1, borderColor: kindColor + "30"
            }}>
              <Text style={{ color: kindColor, fontWeight: "800", fontSize: 12, marginBottom: 6 }}>
                ✓ {dailyEvent.actionLabel}
              </Text>
              {Object.entries(dailyEvent.effects).filter(([, v]) => v).map(([k, v]) => (
                <Text key={k} style={{ color: colors.muted, fontSize: 11 }}>
                  {(v as number) > 0 ? "+" : ""}{v} {k}
                </Text>
              ))}
            </View>
            {dailyEvent.kind !== "windfall" && (
              <View style={{
                flex: 1, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 12,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.08)"
              }}>
                <Text style={{ color: colors.muted, fontWeight: "700", fontSize: 12, marginBottom: 6 }}>
                  ✗ {dailyEvent.skipLabel}
                </Text>
                {Object.entries(dailyEvent.skipEffects).filter(([, v]) => v).map(([k, v]) => (
                  <Text key={k} style={{ color: "#ff8d8d", fontSize: 11 }}>
                    {(v as number) > 0 ? "+" : ""}{v} {k}
                  </Text>
                ))}
              </View>
            )}
          </View>

          {/* Actions */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable
              onPress={accept}
              style={{
                flex: 2, paddingVertical: 14, borderRadius: 14,
                backgroundColor: kindColor + "20",
                borderWidth: 1.5, borderColor: kindColor + "60",
                alignItems: "center"
              }}
            >
              <Text style={{ color: kindColor, fontWeight: "800", fontSize: 14 }}>
                {dailyEvent.actionLabel}
              </Text>
            </Pressable>
            {dailyEvent.kind !== "windfall" && (
              <Pressable
                onPress={skip}
                style={{
                  flex: 1, paddingVertical: 14, borderRadius: 14,
                  backgroundColor: "rgba(255,255,255,0.04)",
                  borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
                  alignItems: "center"
                }}
              >
                <Text style={{ color: colors.muted, fontWeight: "600", fontSize: 13 }}>
                  {dailyEvent.skipLabel}
                </Text>
              </Pressable>
            )}
          </View>

          {/* Dismiss */}
          <Pressable onPress={() => setVisible(false)} style={{ alignItems: "center", paddingTop: 4 }}>
            <Text style={{ color: "rgba(255,255,255,0.2)", fontSize: 12 }}>Fermer sans choisir</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const avatar              = useGameStore((s) => s.avatar);
  const stats               = useGameStore((s) => s.stats);
  const currentLocationSlug = useGameStore((s) => s.currentLocationSlug);
  const performAction       = useGameStore((s) => s.performAction);
  const claimDailyReward    = useGameStore((s) => s.claimDailyReward);
  const dailyGoals          = useGameStore((s) => s.dailyGoals);
  const bootstrap           = useGameStore((s) => s.bootstrap);
  const signOut             = useGameStore((s) => s.signOut);
  const resetAll            = useGameStore((s) => s.resetAll);
  const dailyEvent          = useGameStore((s) => s.dailyEvent);

  useFocusEffect(useCallback(() => { bootstrap(); }, [bootstrap]));

  const wellbeing = getWellbeingScore(stats);
  const momentum  = getMomentumState(stats);
  const recommended = getRecommendedActionMeta(stats);
  const doneCount = dailyGoals.filter((g) => g.completed).length;
  const totalGoals = dailyGoals.length;
  const questPct = totalGoals > 0 ? (doneCount / totalGoals) * 100 : 0;

  const wbColor = wellbeing > 65 ? "#38c793" : wellbeing > 40 ? "#f6b94f" : "#ff6b6b";

  const hasPendingEvent = dailyEvent && !dailyEvent.resolved;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} showsVerticalScrollIndicator={false}>
      {/* Daily Event Modal */}
      <DailyEventModal />

      {/* ── TOP HUD ── */}
      <View style={{ backgroundColor: "#0b1a2d", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 }}>
        {/* Header row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <View>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>
              📍 {getLocationName(currentLocationSlug).toUpperCase()}
            </Text>
            <Text style={{ color: colors.text, fontWeight: "900", fontSize: 20, marginTop: 2 }}>
              {avatar?.displayName ?? "Joueur"}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", gap: 4 }}>
            <View style={{
              paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
              backgroundColor: wbColor + "22", borderWidth: 1, borderColor: wbColor + "55"
            }}>
              <Text style={{ color: wbColor, fontWeight: "800", fontSize: 13 }}>
                ♥ {wellbeing}%
              </Text>
            </View>
            <Text style={{ color: "#f6b94f", fontWeight: "700", fontSize: 13 }}>
              💰 {stats.money} cr
            </Text>
          </View>
        </View>

        {/* Stats vitales 2 colonnes */}
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ flex: 1 }}>
              <StatBar label="Faim"       value={stats.hunger}     color="#f6b94f" icon="🍽️" />
            </View>
            <View style={{ flex: 1 }}>
              <StatBar label="Énergie"    value={stats.energy}     color="#60a5fa" icon="⚡" />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ flex: 1 }}>
              <StatBar label="Humeur"     value={stats.mood}       color="#c084fc" icon="😊" />
            </View>
            <View style={{ flex: 1 }}>
              <StatBar label="Social"     value={stats.sociability} color="#38c793" icon="👥" />
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <View style={{ flex: 1 }}>
              <StatBar label="Hygiène"    value={stats.hygiene}    color="#34d399" icon="🚿" />
            </View>
            <View style={{ flex: 1 }}>
              <StatBar label="Zen"        value={100 - stats.stress} color="#a78bfa" icon="🧘" />
            </View>
          </View>
        </View>

        {/* Streak + momentum */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 10, alignItems: "center" }}>
            <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 22 }}>{stats.streak}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>jours de suite</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 10, alignItems: "center" }}>
            <Text style={{ color: "#f6b94f", fontWeight: "900", fontSize: 18 }}>x{momentum.multiplier.toFixed(1)}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>multiplicateur</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 10, alignItems: "center" }}>
            <Text style={{ color: "#60a5fa", fontWeight: "900", fontSize: 18 }}>{stats.reputation}</Text>
            <Text style={{ color: colors.muted, fontSize: 10 }}>réputation</Text>
          </View>
        </View>
      </View>

      <View style={{ padding: 20, gap: 24 }}>

        {/* ── ÉVÉNEMENT DU JOUR (banner si non résolu) ── */}
        {hasPendingEvent && (
          <Pressable
            onPress={() => {/* le modal s'ouvre automatiquement au montage, forcer re-render */ bootstrap(); }}
            style={{
              backgroundColor: "rgba(246,185,79,0.12)", borderRadius: 16, padding: 14,
              borderWidth: 1.5, borderColor: "rgba(246,185,79,0.4)",
              flexDirection: "row", alignItems: "center", gap: 12
            }}
          >
            <Text style={{ fontSize: 24 }}>📅</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#f6b94f", fontWeight: "800", fontSize: 13 }}>Événement du jour</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>{dailyEvent!.title}</Text>
            </View>
            <View style={{
              width: 8, height: 8, borderRadius: 4, backgroundColor: "#f6b94f"
            }} />
          </Pressable>
        )}

        {/* ── ACTION RECOMMANDÉE ── */}
        <View>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", marginBottom: 10, letterSpacing: 1 }}>
            PRIORITÉ DU MOMENT
          </Text>
          <Pressable
            onPress={() => performAction(recommended.action)}
            style={{
              backgroundColor: colors.accent + "18",
              borderRadius: 18, padding: 18,
              borderWidth: 1.5, borderColor: colors.accent + "60",
              flexDirection: "row", alignItems: "center", gap: 14
            }}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent + "25",
              alignItems: "center", justifyContent: "center" }}>
              <Text style={{ fontSize: 24 }}>⚡</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.accent, fontWeight: "900", fontSize: 16 }}>{recommended.label}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{recommended.copy}</Text>
            </View>
            <Text style={{ color: colors.accent, fontSize: 20 }}>→</Text>
          </Pressable>
        </View>

        {/* ── ACTIONS RAPIDES ── */}
        <View>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", marginBottom: 10, letterSpacing: 1 }}>
            ACTIONS
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <ActionBtn emoji="🍽️" label="Repas sain"    cost="-14 cr"   reward="+faim +santé"    onPress={() => performAction("healthy-meal")} />
            <ActionBtn emoji="🥘" label="Cuisiner"      cost="-8 cr"    reward="+faim ×2"        onPress={() => performAction("home-cooking")} />
            <ActionBtn emoji="😴" label="Dormir"        cost="-temps"   reward="+44 énergie"     onPress={() => performAction("sleep")} />
            <ActionBtn emoji="💤" label="Sieste"        cost="-temps"   reward="+22 énergie"     onPress={() => performAction("nap")} />
            <ActionBtn emoji="🚿" label="Douche"        cost="-3 cr"    reward="+hygiène"        onPress={() => performAction("shower")} />
            <ActionBtn emoji="💼" label="Travailler"    cost="-énergie" reward="+argent"         onPress={() => performAction("work-shift")} disabled={stats.energy < 20} />
            <ActionBtn emoji="🏃" label="Marcher"       cost="-énergie" reward="+humeur"         onPress={() => performAction("walk")} />
            <ActionBtn emoji="🏀" label="Sport collectif" cost="-énergie" reward="+social +forme" onPress={() => performAction("team-sport")} disabled={stats.energy < 25} />
            <ActionBtn emoji="🧘" label="Méditer"       cost="-énergie" reward="+zen +motivation" onPress={() => performAction("meditate")} />
            <ActionBtn emoji="📚" label="Lire"          cost="-énergie" reward="+motivation"     onPress={() => performAction("read-book")} />
            <ActionBtn emoji="☕" label="Café social"   cost="-argent"  reward="+social"         onPress={() => performAction("cafe-chat")} disabled={stats.money < 5} />
            <ActionBtn emoji="🛍️" label="Shopping"      cost="-35 cr"   reward="+image"          onPress={() => performAction("shopping")} disabled={stats.money < 35} />
          </View>
        </View>

        {/* ── RACCOURCIS MONDE ── */}
        <View>
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", marginBottom: 10, letterSpacing: 1 }}>
            EXPLORER
          </Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Pressable onPress={() => router.push("/(app)/world-live")}
              style={{ flex: 1, backgroundColor: "rgba(139,124,255,0.12)", borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: "rgba(139,124,255,0.3)", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 28 }}>🗺️</Text>
              <Text style={{ color: "#8b7cff", fontWeight: "800", fontSize: 12 }}>Carte Live</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(app)/rooms")}
              style={{ flex: 1, backgroundColor: "rgba(56,199,147,0.12)", borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: "rgba(56,199,147,0.3)", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 28 }}>🏠</Text>
              <Text style={{ color: "#38c793", fontWeight: "800", fontSize: 12 }}>Rooms</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(app)/dates")}
              style={{ flex: 1, backgroundColor: "rgba(255,107,107,0.12)", borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: "rgba(255,107,107,0.3)", alignItems: "center", gap: 6 }}>
              <Text style={{ fontSize: 28 }}>💘</Text>
              <Text style={{ color: "#ff6b6b", fontWeight: "800", fontSize: 12 }}>Dates</Text>
            </Pressable>
          </View>
        </View>

        {/* ── QUÊTES DU JOUR ── */}
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>QUÊTES DU JOUR</Text>
            <Text style={{ color: colors.accent, fontWeight: "700", fontSize: 12 }}>{doneCount}/{totalGoals}</Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.07)", marginBottom: 12 }}>
            <View style={{ height: 6, borderRadius: 3, width: `${questPct}%`, backgroundColor: colors.accent }} />
          </View>
          <View style={{ backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 16, paddingHorizontal: 16,
            borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
            {dailyGoals.slice(0, 5).map((g) => (
              <QuestRow key={g.id} label={g.label} done={g.completed} />
            ))}
          </View>
          {doneCount === totalGoals && totalGoals > 0 && (
            <Pressable
              onPress={claimDailyReward}
              style={{ marginTop: 12, backgroundColor: "#f6b94f22", borderRadius: 14, padding: 14,
                borderWidth: 1, borderColor: "#f6b94f66", alignItems: "center", flexDirection: "row",
                justifyContent: "center", gap: 8 }}>
              <Text style={{ fontSize: 20 }}>🎁</Text>
              <Text style={{ color: "#f6b94f", fontWeight: "800", fontSize: 14 }}>Réclamer la reward du jour</Text>
            </Pressable>
          )}
        </View>

        {/* ── NAVIGATION SECONDAIRE ── */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {[
            { label: "💪 Sport & Santé", route: "/(app)/health" },
            { label: "💼 Travailler",    route: "/(app)/work"   },
            { label: "🍷 Sorties",       route: "/(app)/outings"},
            { label: "💘 Rendez-vous",   route: "/(app)/dates"  },
            { label: "👥 Relations",     route: "/(app)/relations"},
            { label: "🔐 Secret Chat",   route: "/(app)/secret-room"},
            { label: "🤖 Coach ARIA",    route: "/(app)/coach"  },
            { label: "📚 Études",        route: "/(app)/studies"},
            { label: "📊 Stats",         route: "/(app)/tips"   },
            { label: "⭐ Premium",       route: "/(app)/premium" },
          ].map((item) => (
            <Pressable key={item.route} onPress={() => router.push(item.route as never)}
              style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
              <Text style={{ color: colors.text, fontWeight: "600", fontSize: 12 }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ── SESSION ── */}
        <View style={{ flexDirection: "row", gap: 8, paddingTop: 4 }}>
          <Pressable onPress={() => { signOut(); router.replace("/(auth)/sign-in"); }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(255,80,80,0.08)",
              borderWidth: 1, borderColor: "rgba(255,80,80,0.2)", alignItems: "center" }}>
            <Text style={{ color: "#ff8d8d", fontWeight: "700", fontSize: 12 }}>⏏ Déconnexion</Text>
          </Pressable>
          <Pressable onPress={() => { resetAll(); router.replace("/(auth)/welcome"); }}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(255,80,80,0.04)",
              borderWidth: 1, borderColor: "rgba(255,80,80,0.1)", alignItems: "center" }}>
            <Text style={{ color: "#ff8d8d77", fontWeight: "700", fontSize: 12 }}>↺ Reset</Text>
          </Pressable>
        </View>

      </View>
    </ScrollView>
  );
}
