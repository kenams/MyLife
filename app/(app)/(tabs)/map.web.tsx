import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import {
  fetchNearbyPlayers, goGhost, MOCK_PLAYERS, PARIS_REGION,
  publishPosition, STATUS_CONFIG, subscribeToMap,
} from "@/lib/life-map";
import type { MapPlayer, MapStatus } from "@/lib/life-map";
import { blockUser } from "@/lib/safety";
import { ReportModal } from "@/components/report-modal";
import { useGameStore } from "@/stores/game-store";

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

function StatusBadge({ status }: { status: MapStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <View style={{ backgroundColor: cfg.color + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
      borderWidth: 1, borderColor: cfg.color + "66" }}>
      <Text style={{ color: cfg.color, fontSize: 11, fontWeight: "700" }}>{cfg.emoji} {cfg.label}</Text>
    </View>
  );
}

function PlayerCard({ player, onPress }: { player: MapPlayer; onPress: () => void }) {
  const cfg = STATUS_CONFIG[player.status];
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: L.card, borderRadius: 14, padding: 14,
      borderWidth: 1, borderColor: L.border, gap: 8,
      borderLeftWidth: 3, borderLeftColor: cfg.color }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: cfg.color + "22",
          alignItems: "center", justifyContent: "center",
          borderWidth: 2, borderColor: cfg.color + "55" }}>
          <Text style={{ fontSize: 22 }}>{player.avatar_emoji}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: L.text, fontWeight: "800", fontSize: 14 }}>{player.display_name}</Text>
            {player.is_star && <Text style={{ fontSize: 12 }}>⭐</Text>}
            {player.location_verified && <Text style={{ color: L.green, fontSize: 10 }}>✓</Text>}
          </View>
          <Text style={{ color: L.textSoft, fontSize: 12 }}>📍 {player.location_name ?? "Paris"}</Text>
        </View>
        <StatusBadge status={player.status} />
      </View>
      {player.last_action && (
        <Text style={{ color: L.muted, fontSize: 12 }}>· {player.last_action}</Text>
      )}
    </Pressable>
  );
}

function PlayerSheet({ player, onClose, onDm, onBlock, onReport }: {
  player: MapPlayer;
  onClose: () => void;
  onDm: () => void;
  onBlock: () => void;
  onReport: () => void;
}) {
  const cfg = STATUS_CONFIG[player.status];
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)" }} onPress={onClose} />
      <View style={{ backgroundColor: L.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
        padding: 24, gap: 16, borderTopWidth: 2, borderTopColor: cfg.color + "66" }}>
        <View style={{ alignItems: "center", gap: 12 }}>
          <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: cfg.color + "22",
            alignItems: "center", justifyContent: "center",
            borderWidth: 3, borderColor: cfg.color }}>
            <Text style={{ fontSize: 34 }}>{player.avatar_emoji}</Text>
          </View>
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ color: L.text, fontWeight: "900", fontSize: 20 }}>
              {player.display_name} {player.is_star ? "⭐" : ""}
            </Text>
            <Text style={{ color: L.textSoft, fontSize: 13 }}>
              Niv. {player.level} · {player.location_name ?? "Paris"}
              {player.location_verified ? " ✓" : ""}
            </Text>
          </View>
          <StatusBadge status={player.status} />
          {player.last_action && (
            <Text style={{ color: L.muted, fontSize: 13 }}>« {player.last_action} »</Text>
          )}
        </View>
        <Pressable onPress={onDm} style={{ backgroundColor: L.primary, borderRadius: 14,
          padding: 14, alignItems: "center" }}>
          <Text style={{ color: "#000", fontWeight: "900", fontSize: 15 }}>💬 Dire wesh</Text>
        </Pressable>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable onPress={onBlock} style={{ flex: 1, backgroundColor: L.cardAlt, borderRadius: 12,
            padding: 12, alignItems: "center", borderWidth: 1, borderColor: L.border }}>
            <Text style={{ color: L.textSoft, fontSize: 13, fontWeight: "700" }}>🚫 Bloquer</Text>
          </Pressable>
          <Pressable onPress={onReport} style={{ flex: 1, backgroundColor: L.cardAlt, borderRadius: 12,
            padding: 12, alignItems: "center", borderWidth: 1, borderColor: L.red + "44" }}>
            <Text style={{ color: L.red, fontSize: 13, fontWeight: "700" }}>🚩 Signaler</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function StatusPicker({ current, onChange, onClose }: {
  current: MapStatus;
  onChange: (s: MapStatus) => void;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 24 }} onPress={onClose}>
        <View style={{ backgroundColor: L.card, borderRadius: 20, padding: 20, gap: 10 }}>
          <Text style={{ color: L.text, fontWeight: "900", fontSize: 16, marginBottom: 4 }}>Mon statut</Text>
          {(Object.keys(STATUS_CONFIG) as MapStatus[]).map((s) => {
            const cfg = STATUS_CONFIG[s];
            const active = s === current;
            return (
              <Pressable key={s} onPress={() => { onChange(s); onClose(); }}
                style={{ backgroundColor: active ? cfg.color + "22" : L.cardAlt,
                  borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12,
                  borderWidth: 1.5, borderColor: active ? cfg.color : L.border }}>
                <Text style={{ fontSize: 20 }}>{cfg.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: active ? cfg.color : L.text, fontWeight: "700", fontSize: 14 }}>{cfg.label}</Text>
                  <Text style={{ color: L.muted, fontSize: 12 }}>{cfg.desc}</Text>
                </View>
                {active && <Text style={{ color: cfg.color }}>✓</Text>}
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

export default function MapScreen() {
  const avatar   = useGameStore((s) => s.avatar);
  const stats    = useGameStore((s) => s.stats);

  const [players, setPlayers]           = useState<MapPlayer[]>(MOCK_PLAYERS);
  const [blocked, setBlocked]           = useState<string[]>([]);
  const [selectedPlayer, setSelected]   = useState<MapPlayer | null>(null);
  const [myStatus, setMyStatus]         = useState<MapStatus>("free");
  const [statusPicker, setStatusPicker] = useState(false);
  const [reportTarget, setReportTarget] = useState<MapPlayer | null>(null);
  const [filterStatus, setFilterStatus] = useState<MapStatus | null>(null);
  const [isGhost, setIsGhost]           = useState(false);

  useEffect(() => {
    fetchNearbyPlayers(PARIS_REGION.latitude, PARIS_REGION.longitude)
      .then((p) => setPlayers(p));
    const sub = subscribeToMap((updated) => {
      setPlayers((prev) => {
        const idx = prev.findIndex((p) => p.user_id === updated.user_id);
        if (idx >= 0) { const next = [...prev]; next[idx] = updated; return next; }
        return [...prev, updated];
      });
    });
    return () => { sub?.unsubscribe(); };
  }, []);

  const visiblePlayers = players.filter((p) =>
    !blocked.includes(p.user_id) &&
    p.status !== "ghost" &&
    (!filterStatus || p.status === filterStatus)
  );

  function handleBlock(p: MapPlayer) {
    void blockUser(p.user_id).then(() => setBlocked((b) => [...b, p.user_id]));
    setSelected(null);
  }

  function handleDm(p: MapPlayer) {
    setSelected(null);
    router.push(`/(app)/dm?targetId=${p.user_id}&targetName=${encodeURIComponent(p.display_name)}&targetEmoji=${encodeURIComponent(p.avatar_emoji)}`);
  }

  async function toggleGhost() {
    if (!avatar) return;
    if (isGhost) {
      setIsGhost(false);
    } else {
      await goGhost(avatar.id ?? "local");
      setIsGhost(true);
    }
  }

  const statusFilters: (MapStatus | null)[] = [null, "free", "vibe", "charo", "taken"];

  return (
    <View style={{ flex: 1, backgroundColor: L.bg }}>
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 }}>
        <Text style={{ color: L.text, fontWeight: "900", fontSize: 20 }}>🗺️ Life Map</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => setStatusPicker(true)}
            style={{ backgroundColor: STATUS_CONFIG[myStatus].color + "22", borderRadius: 20,
              paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1,
              borderColor: STATUS_CONFIG[myStatus].color + "66" }}>
            <Text style={{ color: STATUS_CONFIG[myStatus].color, fontWeight: "700", fontSize: 13 }}>
              {STATUS_CONFIG[myStatus].emoji} {STATUS_CONFIG[myStatus].label}
            </Text>
          </Pressable>
          <Pressable onPress={() => void toggleGhost()}
            style={{ backgroundColor: isGhost ? "#4A484422" : L.card, borderRadius: 20,
              paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: L.border }}>
            <Text style={{ color: isGhost ? L.muted : L.text, fontSize: 13, fontWeight: "700" }}>
              {isGhost ? "⚫ Ghost" : "👁️ Visible"}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Filtres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 8, flexDirection: "row", marginBottom: 12 }}>
        {statusFilters.map((s) => {
          const active = filterStatus === s;
          const label  = s ? `${STATUS_CONFIG[s].emoji} ${STATUS_CONFIG[s].label}` : "🌍 Tous";
          const color  = s ? STATUS_CONFIG[s].color : L.primary;
          return (
            <Pressable key={s ?? "all"} onPress={() => setFilterStatus(s)}
              style={{ backgroundColor: active ? color + "22" : L.card,
                borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
                borderWidth: 1.5, borderColor: active ? color : L.border }}>
              <Text style={{ color: active ? color : L.textSoft, fontWeight: "700", fontSize: 12 }}>{label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Zone Paris — info web */}
      <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: L.card,
        borderRadius: 14, padding: 14, borderWidth: 1, borderColor: L.border }}>
        <Text style={{ color: L.textSoft, fontSize: 12, textAlign: "center" }}>
          📍 Paris & banlieue · {visiblePlayers.length} joueur{visiblePlayers.length > 1 ? "s" : ""} visible{visiblePlayers.length > 1 ? "s" : ""}
        </Text>
      </View>

      {/* Liste joueurs */}
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}>
        {visiblePlayers.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 40, gap: 12 }}>
            <Text style={{ fontSize: 40 }}>👻</Text>
            <Text style={{ color: L.muted, fontSize: 15 }}>Personne dans ce filtre</Text>
          </View>
        ) : (
          visiblePlayers.map((p) => (
            <PlayerCard key={p.id} player={p} onPress={() => setSelected(p)} />
          ))
        )}
      </ScrollView>

      {/* Sheets & modals */}
      {selectedPlayer && (
        <PlayerSheet
          player={selectedPlayer}
          onClose={() => setSelected(null)}
          onDm={() => handleDm(selectedPlayer)}
          onBlock={() => handleBlock(selectedPlayer)}
          onReport={() => { setReportTarget(selectedPlayer); setSelected(null); }}
        />
      )}
      {statusPicker && (
        <StatusPicker current={myStatus} onChange={setMyStatus} onClose={() => setStatusPicker(false)} />
      )}
      {reportTarget && (
        <ReportModal
          targetUserId={reportTarget.user_id}
          targetName={reportTarget.display_name}
          reporterUserId={avatar?.id ?? "local"}
          reporterName={avatar?.name ?? "Joueur"}
          onClose={() => setReportTarget(null)}
        />
      )}
    </View>
  );
}
