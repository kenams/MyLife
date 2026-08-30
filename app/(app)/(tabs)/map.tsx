import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated, Modal, Platform, Pressable, ScrollView,
  Text, View, ActivityIndicator,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

import { hapticImpact } from "@/lib/safe-haptics";
import {
  fetchAllPlayers, goGhost, TOULOUSE_REGION,
  publishPosition, requestAndGetLocation, STATUS_CONFIG, subscribeToMap,
  isPresenceFresh,
} from "@/lib/life-map";
import type { MapPlayer, MapStatus } from "@/lib/life-map";
import {
  fetchBastions, subscribeToBastionTakeovers,
  type TakeoverNotif,
} from "@/lib/crews";
import type { CrewZone } from "@/lib/crews";
import { sendLocalNotification } from "@/lib/push-notifications";
import { blockUser } from "@/lib/safety";
import { ReportModal } from "@/components/report-modal";
import { MapFirstSessionHint, MapPrimarySuggestion } from "@/components/map-session-guidance";
import { NpcInteraction } from "@/components/npc-interaction";
import { useWorldEnvironment } from "@/hooks/use-world-environment";
import { mapAmbientOverlay, weatherOverlay } from "@/lib/world-environment";
import { ACTIVE_CITY } from "@/lib/city-config";
import { useGameStore } from "@/stores/game-store";
import {
  groupMapOpportunities,
  MAP_OPPORTUNITY_SECTION_LABELS,
  mapOpportunityKindLabel,
  mapOpportunityIcon,
  type MapOpportunitySection,
} from "@/lib/map-opportunity-presentation";
import {
  cityPulseRoute,
  crewDominanceByDistrict,
  livingCityEventsToCityPulse,
  selectCityPulseOpportunities,
  type CityPulseSignal,
  type DistrictCrewDominance,
} from "@/lib/city-pulse";

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const aa = Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

const L = {
  bg:       "#080808",
  card:     "#111111",
  cardAlt:  "#181818",
  text:     "#F5F2E8",
  textSoft: "#A8A49A",
  muted:    "#4A4844",
  border:   "rgba(255,255,255,0.07)",
  primary:  "#FFD600",
  red:      "#FF3B3B",
  green:    "#39FF14",
};

function playerKind(player: MapPlayer): { label: string; color: string } {
  if (!player.is_npc) return { label: "JOUEUR RÉEL", color: L.green };
  if (player.is_star) return { label: "OFFICIEL", color: L.primary };
  return { label: "HABITANT SIMULÉ", color: "#BF5FFF" };
}

// ── Marqueur joueur sur la map ────────────────────────────────────────────────
function PlayerMarker({ player, onPress }: { player: MapPlayer; onPress: () => void }) {
  const cfg   = STATUS_CONFIG[player.status];
  const isStar = player.is_star;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isStar) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, [isStar]);

  return (
    <Marker
      coordinate={{ latitude: player.lat, longitude: player.lng }}
      onPress={onPress}
      tracksViewChanges={false}
    >
      <View style={{ alignItems: "center" }}>
        {isStar && (
          <Animated.View style={{
            position: "absolute", width: 54, height: 54, borderRadius: 27,
            backgroundColor: cfg.color + "22",
            transform: [{ scale: pulse }],
          }} />
        )}
        <View style={{
          width: isStar ? 46 : 38, height: isStar ? 46 : 38,
          borderRadius: isStar ? 23 : 19,
          backgroundColor: L.card,
          borderWidth: isStar ? 3 : 2,
          borderColor: cfg.color,
          alignItems: "center", justifyContent: "center",
          shadowColor: cfg.color, shadowOpacity: 0.6, shadowRadius: 8,
        }}>
          <Text style={{ fontSize: isStar ? 20 : 16 }}>{player.avatar_emoji}</Text>
        </View>
        {/* Bulle nom */}
        <View style={{
          marginTop: 3, backgroundColor: L.card, borderRadius: 6,
          paddingHorizontal: 6, paddingVertical: 2,
          borderWidth: 1, borderColor: cfg.color + "30",
        }}>
          <Text style={{ color: L.text, fontSize: 9, fontWeight: "800" }}>
            {player.display_name.split(" ")[0]}
            {player.location_verified ? " ✓" : ""}
          </Text>
        </View>
      </View>
    </Marker>
  );
}

// ── Fiche profil joueur (bottom sheet) ───────────────────────────────────────
function PlayerSheet({ player, onClose, onInvite, onReport, onBlock, npcOpportunity, onFeedback }: {
  player: MapPlayer | null;
  onClose: () => void;
  onInvite: (p: MapPlayer) => void;
  onReport: (p: MapPlayer) => void;
  onBlock: (p: MapPlayer) => void;
  npcOpportunity: { label: string; route: string } | null;
  onFeedback: (t: string) => void;
}) {
  if (!player) return null;
  const cfg = STATUS_CONFIG[player.status];
  const kind = playerKind(player);
  const minutesAgo = Math.round(
    (Date.now() - new Date(player.updated_at).getTime()) / 60000
  );
  const freshness = minutesAgo < 2
    ? "À l'instant"
    : minutesAgo < 60
    ? `Il y a ${minutesAgo} min`
    : "Il y a + d'1h";

  return (
    <Modal transparent animationType="slide" visible={!!player} onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <View style={{
        backgroundColor: L.card, borderTopLeftRadius: 28, borderTopRightRadius: 28,
        padding: 24, paddingBottom: 44, gap: 20,
        borderTopWidth: 1, borderColor: L.border,
      }}>
        {/* Handle */}
        <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: L.border, alignSelf: "center" }} />

        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <View style={{
            width: 60, height: 60, borderRadius: 30,
            backgroundColor: L.cardAlt,
            borderWidth: 3, borderColor: cfg.color,
            alignItems: "center", justifyContent: "center",
            shadowColor: cfg.color, shadowOpacity: 0.4, shadowRadius: 10,
          }}>
            <Text style={{ fontSize: 28 }}>{player.avatar_emoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ color: L.text, fontSize: 18, fontWeight: "900" }}>
                {player.display_name}
              </Text>
              <View style={{ backgroundColor: kind.color + "22", borderRadius: 4,
                paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: kind.color + "55" }}>
                <Text style={{ color: kind.color, fontSize: 9, fontWeight: "900" }}>{kind.label}</Text>
              </View>
            </View>
            <Text style={{ color: L.muted, fontSize: 12, marginTop: 3 }}>
              Niveau {player.level} · {player.location_name ?? "Toulouse"}
            </Text>
          </View>
          {/* Statut */}
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 20 }}>{cfg.emoji}</Text>
            <Text style={{ color: cfg.color, fontSize: 10, fontWeight: "800" }}>{cfg.label}</Text>
          </View>
        </View>

        {/* Infos */}
        <View style={{ backgroundColor: L.cardAlt, borderRadius: 14, padding: 14, gap: 10 }}>
          {player.last_action && (
            <View style={{ gap: 3 }}>
              <Text style={{ color: player.is_npc ? "#BF5FFF" : L.muted, fontSize: 9, fontWeight: "900" }}>
                {player.is_npc ? "ACTIVITÉ ACTUELLE" : "DERNIÈRE ACTIVITÉ"}
              </Text>
              <Text style={{ color: L.textSoft, fontSize: 13 }}>
                {player.last_action}
              </Text>
            </View>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Text style={{ fontSize: 16 }}>📍</Text>
            <Text style={{ color: L.textSoft, fontSize: 13 }}>
              {player.location_name ?? "Toulouse"}
              {player.location_verified
                ? <Text style={{ color: L.green }}> · Zone vérifiée</Text>
                : <Text style={{ color: L.muted }}> · Zone déclarée</Text>}
            </Text>
          </View>
          {!player.is_npc && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 16 }}>🕐</Text>
              <Text style={{ color: L.muted, fontSize: 13 }}>{freshness}</Text>
            </View>
          )}
        </View>

        {player.is_npc && (
          <NpcInteraction
            player={player}
            playerId="local_user"
            nearbyOpportunity={npcOpportunity}
            palette={{ surface: L.cardAlt, border: L.border, text: L.text, muted: L.muted, accent: L.primary }}
            onFeedback={onFeedback}
            onNavigate={(r) => { onClose(); router.push(r as never); }}
            onClose={onClose}
          />
        )}

        {/* CTA */}
        {!player.is_npc && player.status !== "ghost" && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                onPress={() => { hapticImpact("light"); onInvite(player); onClose(); }}
                style={{
                  flex: 1, backgroundColor: L.cardAlt, borderRadius: 14,
                  paddingVertical: 14, alignItems: "center",
                  borderWidth: 1, borderColor: L.border,
                }}>
                <Text style={{ color: L.text, fontSize: 13, fontWeight: "900" }}>👋 Saluer</Text>
              </Pressable>
              <Pressable
                onPress={() => { hapticImpact("medium"); onInvite(player); onClose(); }}
                style={{
                  flex: 1, backgroundColor: cfg.color, borderRadius: 14,
                  paddingVertical: 14, alignItems: "center",
                  shadowColor: cfg.color, shadowOpacity: 0.35, shadowRadius: 12,
                }}>
                <Text style={{ color: "#080808", fontSize: 13, fontWeight: "900" }}>💫 Feeling</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => { hapticImpact("medium"); onInvite(player); onClose(); }}
              style={{
                backgroundColor: cfg.color + "18", borderRadius: 14,
                paddingVertical: 13, alignItems: "center",
                borderWidth: 1, borderColor: cfg.color + "45",
              }}>
              <Text style={{ color: cfg.color, fontSize: 13, fontWeight: "900" }}>
                Proposer une activité publique
              </Text>
            </Pressable>
          </View>
        )}
        {/* Actions modération */}
        {!player.is_npc && <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable onPress={() => { onReport(player); onClose(); }}
            style={{ flex: 1, paddingVertical: 12, alignItems: "center",
              backgroundColor: L.cardAlt, borderRadius: 10,
              borderWidth: 1, borderColor: L.border }}>
            <Text style={{ color: L.muted, fontSize: 12, fontWeight: "700" }}>🚩 Signaler</Text>
          </Pressable>
          <Pressable onPress={() => { onBlock(player); onClose(); }}
            style={{ flex: 1, paddingVertical: 12, alignItems: "center",
              backgroundColor: L.cardAlt, borderRadius: 10,
              borderWidth: 1, borderColor: L.border }}>
            <Text style={{ color: L.red, fontSize: 12, fontWeight: "700" }}>🚫 Bloquer</Text>
          </Pressable>
        </View>}
      </View>
    </Modal>
  );
}

// ── Sélecteur de statut ───────────────────────────────────────────────────────
function StatusPicker({ current, onChange, onClose }: {
  current: MapStatus;
  onChange: (s: MapStatus) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
        justifyContent: "center", padding: 24 }} onPress={onClose}>
        <View style={{ backgroundColor: L.card, borderRadius: 24, padding: 20, gap: 10,
          borderWidth: 1, borderColor: L.border }}>
          <Text style={{ color: L.text, fontSize: 16, fontWeight: "900",
            marginBottom: 8, textAlign: "center" }}>
            Ton statut sur la map
          </Text>
          {(Object.keys(STATUS_CONFIG) as MapStatus[]).map((key) => {
            const cfg = STATUS_CONFIG[key];
            const active = key === current;
            return (
              <Pressable key={key}
                onPress={() => { hapticImpact("light"); onChange(key); onClose(); }}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 14,
                  padding: 16, borderRadius: 14,
                  backgroundColor: active ? cfg.color + "15" : L.cardAlt,
                  borderWidth: active ? 1 : 0, borderColor: cfg.color + "40",
                }}>
                <Text style={{ fontSize: 22 }}>{cfg.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: active ? cfg.color : L.text,
                    fontSize: 15, fontWeight: "800" }}>
                    {cfg.label}
                  </Text>
                  <Text style={{ color: L.muted, fontSize: 12, marginTop: 2 }}>
                    {cfg.desc}
                  </Text>
                </View>
                {active && (
                  <Text style={{ color: cfg.color, fontSize: 18 }}>✓</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

// ── Filtre statut (pills en haut) ─────────────────────────────────────────────
function FilterPills({ active, onChange }: {
  active: MapStatus | "all";
  onChange: (f: MapStatus | "all") => void;
}) {
  const filters: { key: MapStatus | "all"; label: string; color: string }[] = [
    { key: "all",   label: "Tous",   color: L.primary },
    { key: "free",  label: "🟡 Libre",  color: STATUS_CONFIG.free.color },
    { key: "vibe",  label: "💜 Sortie", color: STATUS_CONFIG.vibe.color },
    { key: "charo", label: "💫 Feeling", color: STATUS_CONFIG.charo.color },
    { key: "taken", label: "🤝 Crew",   color: STATUS_CONFIG.taken.color },
  ];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}
      style={{ position: "absolute", top: 104, left: 0, right: 72 }}
      contentContainerStyle={{ paddingHorizontal: 16, gap: 8, flexDirection: "row" }}>
      {filters.map((f) => {
        const on = active === f.key;
        return (
          <Pressable key={f.key} onPress={() => onChange(f.key)}
            style={{
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
              backgroundColor: on ? f.color : L.card + "EE",
              borderWidth: 1, borderColor: on ? f.color : L.border,
            }}>
            <Text style={{ color: on ? "#080808" : L.text,
              fontSize: 12, fontWeight: "800" }}>
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function MapContextDrawer({
  visible,
  signals,
  districts,
  takeoverAlert,
  onClose,
  onPulsePress,
  onCrewPress,
}: {
  visible: boolean;
  signals: CityPulseSignal[];
  districts: DistrictCrewDominance[];
  takeoverAlert: TakeoverNotif | null;
  onClose: () => void;
  onPulsePress: (signal: CityPulseSignal) => void;
  onCrewPress: () => void;
}) {
  const translateX = useRef(new Animated.Value(380)).current;

  useEffect(() => {
    if (!visible) return;
    translateX.setValue(380);
    Animated.timing(translateX, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [translateX, visible]);

  function closeDrawer() {
    Animated.timing(translateX, {
      toValue: 380,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  }

  const groupedSignals = groupMapOpportunities(signals);
  const renderSignalCard = (signal: CityPulseSignal) => (
    <Pressable key={signal.id} onPress={() => onPulsePress(signal)} style={{
      backgroundColor: L.cardAlt, borderRadius: 8, padding: 12, borderWidth: 1,
      borderColor: signal.kind === "CHALLENGE" ? L.red + "70" : signal.kind === "MISSION" ? L.primary + "70" : L.border,
    }}>
      <Text style={{ color: signal.kind === "CHALLENGE" ? L.red : L.primary, fontSize: 10, fontWeight: "900" }} numberOfLines={1}>
        {mapOpportunityIcon(signal.kind)} {mapOpportunityKindLabel(signal.kind)}{signal.district ? ` · ${signal.district}` : ""}
      </Text>
      <Text style={{ color: L.text, fontSize: 13, fontWeight: "900", marginTop: 3 }} numberOfLines={2}>{signal.title}</Text>
      <Text style={{ color: L.textSoft, fontSize: 11, marginTop: 3 }} numberOfLines={3}>{signal.body}</Text>
    </Pressable>
  );
  const renderSignalSection = (section: MapOpportunitySection) => {
    const items = groupedSignals[section];
    if (items.length === 0) return null;
    return (
      <View key={section} style={{ gap: 8 }}>
        <Text style={{ color: L.textSoft, fontSize: 10, fontWeight: "900", marginTop: 4 }}>
          {MAP_OPPORTUNITY_SECTION_LABELS[section].toUpperCase()}
        </Text>
        {items.map(renderSignalCard)}
      </View>
    );
  };

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={closeDrawer}>
      <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end" }}>
        <Pressable
          accessibilityLabel="Fermer les informations de la carte"
          onPress={closeDrawer}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.45)" }}
        />
        <Animated.View style={{
          width: "86%", maxWidth: 360, height: "100%",
          backgroundColor: L.card, borderLeftWidth: 1, borderColor: L.border,
          paddingTop: 52, paddingBottom: 28,
          transform: [{ translateX }],
        }}>
          <View style={{
            paddingHorizontal: 18, paddingBottom: 14,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
            borderBottomWidth: 1, borderColor: L.border,
          }}>
            <View>
              <Text style={{ color: L.text, fontSize: 17, fontWeight: "900" }}>Autour de toi</Text>
              <Text style={{ color: L.textSoft, fontSize: 11, marginTop: 2 }}>Toulouse en ce moment</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              onPress={closeDrawer}
              hitSlop={10}
              style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: L.cardAlt }}>
              <Text style={{ color: L.text, fontSize: 22 }}>×</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, gap: 10 }}>
            {renderSignalSection("now")}
            {renderSignalSection("nearby")}

            {(takeoverAlert || districts.length > 0 || groupedSignals.crew.length > 0) && (
              <View style={{ gap: 8 }}>
                <Text style={{ color: L.textSoft, fontSize: 10, fontWeight: "900", marginTop: 4 }}>CREW / TERRITOIRES</Text>
                {groupedSignals.crew.map(renderSignalCard)}
                {takeoverAlert && (
                  <Pressable onPress={onCrewPress} style={{
                    backgroundColor: takeoverAlert.newCrewColor + "18", borderRadius: 8, padding: 12,
                    borderWidth: 1, borderColor: takeoverAlert.newCrewColor + "70",
                    flexDirection: "row", alignItems: "center", gap: 10,
                  }}>
                    <Text style={{ fontSize: 22 }}>{takeoverAlert.newCrewEmoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: takeoverAlert.newCrewColor, fontSize: 10, fontWeight: "900" }}>CONQUÊTE</Text>
                      <Text style={{ color: L.text, fontSize: 12, fontWeight: "800", marginTop: 2 }} numberOfLines={2}>
                        [{takeoverAlert.newCrewTag}] a pris {takeoverAlert.bastionName}
                      </Text>
                    </View>
                  </Pressable>
                )}
                {districts.map((item) => (
                  <Pressable key={`${item.district}:${item.dominant.id}`} onPress={onCrewPress} style={{
                    backgroundColor: item.state === "contested" ? L.red + "12" : L.cardAlt,
                    borderRadius: 8, padding: 12, borderWidth: 1,
                    borderColor: item.state === "contested" ? L.red + "60" : L.border,
                  }}>
                    <Text style={{ color: item.state === "contested" ? L.red : L.primary, fontSize: 10, fontWeight: "900" }}>
                      {item.state === "contested" ? "DISTRICT CONTESTÉ" : "CREW DOMINANT"} · {item.district}
                    </Text>
                    <Text style={{ color: L.text, fontSize: 12, fontWeight: "800", marginTop: 3 }} numberOfLines={2}>
                      {item.dominant.name}{item.challenger ? ` vs ${item.challenger.name}` : ""} · {item.trend}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {renderSignalSection("city")}

            {!takeoverAlert && signals.length === 0 && districts.length === 0 && (
              <Text style={{ color: L.muted, fontSize: 13, textAlign: "center", paddingVertical: 36 }}>
                Rien de prioritaire autour de toi pour le moment.
              </Text>
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ── Screen principal ──────────────────────────────────────────────────────────
export default function LifeMapScreen() {
  const avatar      = useGameStore((s) => s.avatar);
  const playerLevel = useGameStore((s) => s.playerLevel ?? 1);
  const livingCity  = useGameStore((s) => s.livingCity);
  const hasHydrated       = useGameStore((s) => s.hasHydrated);
  const mapIntroDismissed = useGameStore((s) => s.mapIntroDismissed);
  const dismissMapIntro   = useGameStore((s) => s.dismissMapIntro);
  const worldEnv          = useWorldEnvironment();
  const mapAmbient        = mapAmbientOverlay(worldEnv);
  const mapWeather        = weatherOverlay(worldEnv);

  const [players,       setPlayers]       = useState<MapPlayer[]>([]);
  const [myStatus,      setMyStatus]      = useState<MapStatus>("ghost");
  const [myLocation,    setMyLocation]    = useState<{ lat: number; lng: number } | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [selected,      setSelected]      = useState<MapPlayer | null>(null);
  const [showPicker,    setShowPicker]    = useState(false);
  const [filter,        setFilter]        = useState<MapStatus | "all">("all");
  const [reportTarget,  setReportTarget]  = useState<MapPlayer | null>(null);
  const [blocked,       setBlocked]       = useState<string[]>([]);
  const [bastions,      setBastions]      = useState<(CrewZone & { crew: { color: string; tag: string; emoji: string; name: string; member_count?: number; reputation?: number } })[]>([]);
  const [showNearby,    setShowNearby]    = useState(false);
  const [nearbyPlayers, setNearbyPlayers] = useState<MapPlayer[]>([]);
  const [takeoverAlert, setTakeoverAlert] = useState<TakeoverNotif | null>(null);
  const [recentPulseIds, setRecentPulseIds] = useState<string[]>([]);
  const [showMapContext, setShowMapContext] = useState(false);
  const [primarySuggestionDismissed, setPrimarySuggestionDismissed] = useState(false);
  const [mapFeedback, setMapFeedback] = useState<string | null>(null);

  const mapRef = useRef<MapView>(null);
  const districtMomentRef = useRef<{ name: string; at: number }>({ name: "", at: 0 });

  useEffect(() => {
    if (!mapFeedback) return;
    const t = setTimeout(() => setMapFeedback(null), 3500);
    return () => clearTimeout(t);
  }, [mapFeedback]);

  // Subscribe Realtime
  useEffect(() => {
    fetchAllPlayers().then(setPlayers);
    const sub = subscribeToMap((updated) => {
      if (updated.status === "ghost") {
        setPlayers((prev) => prev.filter((p) => p.id !== updated.id));
        return;
      }
      setPlayers((prev) => {
        const idx = prev.findIndex((p) => p.id === updated.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [...prev, updated];
      });
    });
    return () => { sub?.unsubscribe(); };
  }, []);

  // Bastions
  useEffect(() => {
    fetchBastions().then(setBastions);
  }, []);

  // Subscribe takeovers
  useEffect(() => {
    const sub = subscribeToBastionTakeovers((notif) => {
      setTakeoverAlert(notif);
      void sendLocalNotification("🏴 Bastion pris !", notif.bastionName ? `${notif.newCrewEmoji} [${notif.newCrewTag}] a conquis ${notif.bastionName}` : "Un bastion vient d'être conquis");
      setTimeout(() => setTakeoverAlert(null), 8000);
    });
    return () => { sub?.unsubscribe(); };
  }, []);

  // Active géoloc + publie position
  async function activateLocation() {
    setLoading(true);
    const loc = await requestAndGetLocation();
    setLoading(false);
    if (!loc) return;

    setMyLocation({ lat: loc.lat, lng: loc.lng });
    mapRef.current?.animateToRegion({
      latitude: loc.lat, longitude: loc.lng,
      latitudeDelta: 0.04, longitudeDelta: 0.04,
    }, 800);

    if (avatar) {
      await publishPosition({
        userId:            "local_user",
        displayName:       avatar.displayName,
        avatarEmoji:       "🧢",
        status:            myStatus === "ghost" ? "free" : myStatus,
        level:             playerLevel,
        lastAction:        null,
        lat:               loc.lat,
        lng:               loc.lng,
        locationName:      loc.locationName,
        locationVerified:  loc.verified,
      });
      if (myStatus === "ghost") setMyStatus("free");
      setMapFeedback("Tu apparais dans MyLife");
    }
  }

  async function handleStatusChange(s: MapStatus) {
    setMyStatus(s);
    setMapFeedback(s === "ghost" ? "Mode invisible activé" : "Statut mis à jour");
    if (s === "ghost") {
      await goGhost("local_user");
    } else if (myLocation) {
      await publishPosition({
        userId:           "local_user",
        displayName:      avatar?.displayName ?? "Moi",
        avatarEmoji:      "🧢",
        status:           s,
        level:            playerLevel,
        lastAction:       null,
        lat:              myLocation.lat,
        lng:              myLocation.lng,
        locationName:     null,
        locationVerified: true,
      });
    }
  }

  function handleInvite(p: MapPlayer) {
    hapticImpact("medium");
    router.push(`/(app)/dm?targetId=${p.user_id}&targetName=${encodeURIComponent(p.display_name)}&targetEmoji=${encodeURIComponent(p.avatar_emoji)}` as never);
  }

  async function handleBlock(p: MapPlayer) {
    await blockUser(p.user_id);
    setBlocked((prev) => [...prev, p.user_id]);
    hapticImpact("medium");
  }

  function handleShowNearby() {
    if (!myLocation) return;
    const nearby = players.filter((p) =>
      p.status !== "ghost" &&
      !blocked.includes(p.user_id) &&
      haversineMeters(myLocation, { lat: p.lat, lng: p.lng }) < 500
    );
    setNearbyPlayers(nearby);
    setShowNearby(true);
  }

  const visiblePlayers = players.filter((p) =>
    p.status !== "ghost" &&
    !blocked.includes(p.user_id) &&
    (p.is_npc || isPresenceFresh(p.updated_at)) &&
    (filter === "all" || p.status === filter)
  );
  const visibleRealCount = visiblePlayers.filter((p) => !p.is_npc).length;
  const visibleNpcCount = visiblePlayers.length - visibleRealCount;
  const cityPulseSignals = useMemo(() => {
    const livingSignals = livingCityEventsToCityPulse(livingCity?.events ?? []);
    const lookingFor = avatar?.lookingFor ?? [];
    return selectCityPulseOpportunities(livingSignals, {
      district: avatar?.homeDistrict ?? "Capitole",
      // Respecte le choix fait à la création de l'avatar (pas de nouveau système).
      wantsDating: lookingFor.some((x) => /rencontre/i.test(x)),
      wantsSocial: lookingFor.some((x) => /ami|sortie|discussion|social/i.test(x)),
      recentSignalIds: recentPulseIds,
    });
  }, [avatar?.homeDistrict, avatar?.lookingFor, livingCity?.events, recentPulseIds]);

  const npcOpportunity = useMemo(() => {
    const s = cityPulseSignals[0];
    if (!s) return null;
    return {
      label: s.district ? `Voir ${mapOpportunityKindLabel(s.kind)} · ${s.district}` : `Voir ${mapOpportunityKindLabel(s.kind)}`,
      route: cityPulseRoute(s),
    };
  }, [cityPulseSignals]);
  const crewDominance = useMemo(() => {
    const inputs = bastions.length > 0
      ? bastions.map((zone) => ({
          id: zone.crew_id,
          name: zone.crew.name,
          district: zone.name,
          reputation: zone.crew.reputation ?? 50,
          activity: Math.min(100, Math.max(0, (zone.crew.member_count ?? 1) * 7)),
          territoryCount: zone.is_bastion ? 2 : 1,
          trend24h: zone.last_activity_at ? 2 : 0,
        }))
      : (livingCity?.crews ?? []).map((crew) => ({
          id: crew.id,
          name: crew.name,
          district: crew.district,
          reputation: crew.reputation,
          activity: crew.activity,
          territoryCount: 1,
          trend24h: 0,
        }));
    return Object.values(crewDominanceByDistrict(inputs))
      .sort((a, b) => (b.state === "contested" ? 1 : 0) - (a.state === "contested" ? 1 : 0) || b.dominant.score - a.dominant.score)
      .slice(0, 3);
  }, [bastions, livingCity?.crews]);

  // ── Moment d'entrée de quartier (P1) — cooldown + dedupe ──────────────
  useEffect(() => {
    if (!myLocation) return;
    let nearest: { name: string; d: number } | null = null;
    for (const q of ACTIVE_CITY.quartiers) {
      const d = haversineMeters(myLocation, { lat: q.lat, lng: q.lng });
      if (!nearest || d < nearest.d) nearest = { name: q.name, d };
    }
    if (!nearest || nearest.d > 900) return;
    const prev = districtMomentRef.current;
    if (nearest.name === prev.name || Date.now() - prev.at < 90_000) return;
    districtMomentRef.current = { name: nearest.name, at: Date.now() };

    const dom = crewDominance.find((c) => c.district === nearest!.name);
    const mood = livingCity?.districtStates?.[nearest.name]?.mood;
    let sub = "";
    if (dom?.state === "contested") sub = " · District contesté";
    else if (dom) sub = ` · [${dom.dominant.name}] domine ce quartier`;
    else if (mood === "nocturne") sub = " · Ambiance nocturne";
    else if (mood === "social") sub = " · Quartier animé";
    else if (mood === "competitif") sub = " · Tensions de crews";
    setMapFeedback(`${nearest.name.toUpperCase()}${sub}`);
  }, [myLocation, crewDominance, livingCity?.districtStates]);

  function handleCityPulsePress(signal: CityPulseSignal) {
    setShowMapContext(false);
    setRecentPulseIds((ids) => [signal.id, ...ids.filter((id) => id !== signal.id)].slice(0, 12));
    router.push(cityPulseRoute(signal) as never);
  }

  function handleCrewContextPress() {
    setShowMapContext(false);
    router.push("/(app)/territories" as never);
  }

  const cfg = STATUS_CONFIG[myStatus];
  const mapContextCount = cityPulseSignals.length + crewDominance.length + (takeoverAlert ? 1 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: L.bg }}>
      {/* MAP */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        initialRegion={TOULOUSE_REGION}
        mapType={Platform.OS === "ios" ? "mutedStandard" : "standard"}
        showsUserLocation={!!myLocation}
        showsMyLocationButton={false}
        customMapStyle={DARK_MAP_STYLE}
      >
        {visiblePlayers.map((p) => (
          <PlayerMarker key={p.id} player={p}
            onPress={() => { hapticImpact("light"); setSelected(p); }} />
        ))}
      </MapView>

      {/* Ambiance World Environment (sous les contrôles) */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: mapAmbient.color, opacity: mapAmbient.opacity,
        }}
      />
      {mapWeather.kind && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: mapWeather.color, opacity: mapWeather.opacity,
          }}
        />
      )}

      {/* Filtre pills */}
      <FilterPills active={filter} onChange={setFilter} />

      {/* Header overlay */}
      <View style={{
        position: "absolute", top: 0, left: 0, right: 0,
        paddingTop: 54, paddingHorizontal: 20, paddingBottom: 10,
        flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      }}>
        <View style={{
          backgroundColor: L.card + "F0", borderRadius: 10,
          paddingHorizontal: 10, paddingVertical: 6,
          borderWidth: 1, borderColor: L.border,
          flex: 1, maxWidth: 176, gap: 1,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3,
              backgroundColor: L.green,
              shadowColor: L.green, shadowOpacity: 1, shadowRadius: 4 }} />
            <Text style={{ color: L.text, fontSize: 11, fontWeight: "800" }} numberOfLines={1}>
              {visiblePlayers.length} actifs · Toulouse
            </Text>
          </View>
          <Text style={{ color: L.primary, fontSize: 9, fontWeight: "800" }} numberOfLines={1}>
            {visibleRealCount} réels · {visibleNpcCount} simulés
          </Text>
        </View>

        {/* Mon statut */}
        <Pressable onPress={() => setShowPicker(true)}
          style={{
            backgroundColor: L.card + "F0", borderRadius: 14,
            paddingHorizontal: 14, paddingVertical: 8,
            borderWidth: 1, borderColor: cfg.color + "40",
            flexDirection: "row", alignItems: "center", gap: 8,
          }}>
          <Text style={{ fontSize: 16 }}>{cfg.emoji}</Text>
          <Text style={{ color: cfg.color, fontSize: 13, fontWeight: "800" }}>
            {cfg.label}
          </Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${mapContextCount} informations autour de toi`}
        onPress={() => setShowMapContext(true)}
        style={{
          position: "absolute", top: 103, right: 14,
          minWidth: 48, height: 38, borderRadius: 19,
          paddingHorizontal: 11, backgroundColor: L.card + "F2",
          borderWidth: 1, borderColor: L.primary + "55",
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
          shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 6,
        }}>
        <Text style={{ color: L.text, fontSize: 16, fontWeight: "900" }}>☰</Text>
        <Text style={{ color: L.primary, fontSize: 11, fontWeight: "900" }}>{mapContextCount}</Text>
      </Pressable>

      {/* Bouton géoloc / activer */}
      {!myLocation && (
        <View style={{
          position: "absolute", bottom: 110, left: 20, right: 20,
        }}>
          <Pressable onPress={activateLocation}
            style={{
              backgroundColor: L.primary, borderRadius: 18,
              paddingVertical: 18, alignItems: "center",
              shadowColor: L.primary, shadowOpacity: 0.4, shadowRadius: 16,
              flexDirection: "row", justifyContent: "center", gap: 10,
            }}>
            {loading
              ? <ActivityIndicator color="#080808" />
              : <>
                  <Text style={{ fontSize: 20 }}>📍</Text>
                  <Text style={{ color: "#080808", fontSize: 16, fontWeight: "900" }}>
                    Apparaître sur la map
                  </Text>
                </>
            }
          </Pressable>
          <Text style={{ color: L.muted, fontSize: 11, textAlign: "center", marginTop: 8 }}>
            Position partagée en zone approximative · Ghost à tout moment
          </Text>
        </View>
      )}

      {/* Bouton centrer sur moi */}
      {myLocation && (
        <Pressable
          onPress={() => mapRef.current?.animateToRegion({
            latitude: myLocation.lat, longitude: myLocation.lng,
            latitudeDelta: 0.025, longitudeDelta: 0.025,
          }, 500)}
          style={{
            position: "absolute", bottom: 110, right: 20,
            width: 50, height: 50, borderRadius: 25,
            backgroundColor: L.card, borderWidth: 1, borderColor: L.border,
            alignItems: "center", justifyContent: "center",
            shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 8,
          }}>
          <Text style={{ fontSize: 22 }}>🎯</Text>
        </Pressable>
      )}


      {/* Bouton À proximité */}
      {myLocation && (
        <Pressable onPress={handleShowNearby}
          style={{
            position: "absolute", bottom: 170, right: 20,
            backgroundColor: L.card, borderRadius: 12,
            paddingHorizontal: 14, paddingVertical: 10,
            borderWidth: 1, borderColor: L.border,
            flexDirection: "row", alignItems: "center", gap: 8,
            shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 6,
          }}>
          <Text style={{ fontSize: 16 }}>👥</Text>
          <Text style={{ color: L.text, fontSize: 12, fontWeight: "800" }}>À proximité</Text>
        </Pressable>
      )}

      <MapContextDrawer
        visible={showMapContext}
        signals={cityPulseSignals}
        districts={crewDominance}
        takeoverAlert={takeoverAlert}
        onClose={() => setShowMapContext(false)}
        onPulsePress={handleCityPulsePress}
        onCrewPress={handleCrewContextPress}
      />

      {/* Panel joueurs à proximité */}
      <Modal visible={showNearby} transparent animationType="slide">
        <Pressable style={{ flex: 1 }} onPress={() => setShowNearby(false)} />
        <View style={{
          backgroundColor: L.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          padding: 20, paddingBottom: 44, maxHeight: "50%",
          borderTopWidth: 1, borderColor: L.border,
        }}>
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: L.border,
            alignSelf: "center", marginBottom: 16 }} />
          <Text style={{ color: L.text, fontSize: 16, fontWeight: "900", marginBottom: 12 }}>
            👥 Joueurs dans une zone proche
          </Text>
          {nearbyPlayers.length === 0 ? (
            <Text style={{ color: L.muted, fontSize: 13, textAlign: "center", paddingVertical: 20 }}>
              Aucun joueur à proximité pour l'instant.
            </Text>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {nearbyPlayers.map((p) => {
                const cfg = STATUS_CONFIG[p.status];
                return (
                  <Pressable key={p.id}
                    onPress={() => { setShowNearby(false); setSelected(p); }}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 12,
                      backgroundColor: L.cardAlt, borderRadius: 12, padding: 12, marginBottom: 8,
                      borderWidth: 1, borderColor: cfg.color + "30",
                    }}>
                    <Text style={{ fontSize: 24 }}>{p.avatar_emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: L.text, fontSize: 14, fontWeight: "800" }}>{p.display_name}</Text>
                      <Text style={{ color: cfg.color, fontSize: 11 }}>{cfg.label}</Text>
                    </View>
                    <Text style={{ color: L.muted, fontSize: 12 }}>Niv. {p.level}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Modals */}
      <PlayerSheet player={selected} onClose={() => setSelected(null)}
        onInvite={handleInvite}
        onReport={(p) => { setSelected(null); setReportTarget(p); }}
        onBlock={handleBlock}
        npcOpportunity={npcOpportunity}
        onFeedback={setMapFeedback} />
      {reportTarget && (
        <ReportModal
          visible={!!reportTarget}
          targetUserId={reportTarget.user_id}
          targetName={reportTarget.display_name}
          onClose={() => setReportTarget(null)}
        />
      )}
      <MapFirstSessionHint
        visible={hasHydrated && !mapIntroDismissed && !showMapContext && !selected}
        onDismiss={dismissMapIntro}
        bottom={myLocation ? 220 : 200}
        palette={{ background: L.card + "F5", border: L.primary + "70", text: L.text, muted: L.muted, accent: L.primary }}
      />

      <MapPrimarySuggestion
        signal={cityPulseSignals[0] ?? null}
        visible={hasHydrated && mapIntroDismissed && !primarySuggestionDismissed && !showMapContext && !selected && !takeoverAlert}
        onPress={handleCityPulsePress}
        onDismiss={() => {
          const id = cityPulseSignals[0]?.id;
          if (id) setRecentPulseIds((ids) => [id, ...ids.filter((x) => x !== id)].slice(0, 12));
          setPrimarySuggestionDismissed(true);
        }}
        bottom={myLocation ? 220 : 200}
        palette={{ background: L.card + "F5", border: L.primary + "55", text: L.text, muted: L.textSoft, accent: L.primary }}
      />

      {mapFeedback && (
        <View pointerEvents="none" style={{
          position: "absolute", bottom: 110, alignSelf: "center", zIndex: 45,
          backgroundColor: L.green + "E8", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10,
          borderWidth: 1, borderColor: L.green,
        }}>
          <Text style={{ color: "#04040A", fontSize: 12, fontWeight: "900" }}>{mapFeedback}</Text>
        </View>
      )}

      {showPicker && (
        <StatusPicker current={myStatus} onChange={handleStatusChange} onClose={() => setShowPicker(false)} />
      )}
    </View>
  );
}

// ── Style map dark Toulouse ───────────────────────────────────────────────────
const DARK_MAP_STYLE = [
  { elementType: "geometry",                  stylers: [{ color: "#0a0a0a" }] },
  { elementType: "labels.text.fill",          stylers: [{ color: "#4A4844" }] },
  { elementType: "labels.text.stroke",        stylers: [{ color: "#080808" }] },
  { featureType: "road",      elementType: "geometry",           stylers: [{ color: "#1a1a1a" }] },
  { featureType: "road",      elementType: "geometry.stroke",    stylers: [{ color: "#111111" }] },
  { featureType: "road.highway", elementType: "geometry",        stylers: [{ color: "#222222" }] },
  { featureType: "water",     elementType: "geometry",           stylers: [{ color: "#050a12" }] },
  { featureType: "water",     elementType: "labels.text.fill",   stylers: [{ color: "#00B4FF" }] },
  { featureType: "poi",       elementType: "geometry",           stylers: [{ color: "#0d0d0d" }] },
  { featureType: "poi.park",  elementType: "geometry",           stylers: [{ color: "#091A03" }] },
  { featureType: "transit",   elementType: "geometry",           stylers: [{ color: "#111111" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#1a1a1a" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#A8A49A" }] },
];
