"use client";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, Text, View } from "react-native";

import { SHOP_ITEMS } from "@/lib/inventory";
import type { ItemCategory, ShopItem } from "@/lib/inventory";
import { useGameStore } from "@/stores/game-store";

const D = {
  bg:       "#0f1117",
  card:     "#1a1d27",
  card2:    "#22263a",
  text:     "#e8edf5",
  textSoft: "#8fa3b8",
  muted:    "#4a5568",
  border:   "#2a3148",
  primary:  "#6366f1",
  green:    "#10b981",
  gold:     "#f59e0b",
  red:      "#ef4444",
  purple:   "#8b5cf6",
  teal:     "#14b8a6",
  orange:   "#f97316",
  pink:     "#ec4899",
};

const CAT_COLOR: Record<ItemCategory, string> = {
  food:     D.orange,
  drink:    D.teal,
  care:     D.pink,
  boost:    D.purple,
  cosmetic: D.gold,
};
const CAT_LABEL: Record<ItemCategory, string> = {
  food:     "Nourriture",
  drink:    "Boissons",
  care:     "Soins",
  boost:    "Boosts",
  cosmetic: "Style",
};
const CAT_EMOJI: Record<ItemCategory, string> = {
  food:     "🍱",
  drink:    "🥤",
  care:     "🧴",
  boost:    "⚡",
  cosmetic: "👔",
};

const CATEGORIES: ItemCategory[] = ["food", "drink", "care", "boost", "cosmetic"];

function ItemCard({ item, qty, canBuy, onBuy, onUse }: {
  item: ShopItem;
  qty: number;
  canBuy: boolean;
  onBuy: () => void;
  onUse: () => void;
}) {
  const color = CAT_COLOR[item.category];
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleBuy() {
    onBuy();
    setFeedback("Acheté !");
    setTimeout(() => setFeedback(null), 1500);
  }
  function handleUse() {
    onUse();
    setFeedback("Utilisé !");
    setTimeout(() => setFeedback(null), 1500);
  }

  const positiveEffects = Object.entries(item.effects)
    .filter(([, v]) => (v as number) > 0)
    .map(([k, v]) => `+${v} ${k}`);
  const negativeEffects = Object.entries(item.effects)
    .filter(([, v]) => (v as number) < 0)
    .map(([k, v]) => `${v} ${k}`);

  return (
    <View style={{
      backgroundColor: D.card,
      borderRadius: 18, padding: 14,
      borderWidth: 1, borderColor: D.border,
      gap: 10,
    }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ width: 50, height: 50, borderRadius: 15,
          backgroundColor: color + "18", alignItems: "center", justifyContent: "center",
          borderWidth: 1, borderColor: color + "30" }}>
          <Text style={{ fontSize: 24 }}>{item.emoji}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: D.text, fontWeight: "800", fontSize: 14 }}>{item.name}</Text>
          <Text numberOfLines={2} style={{ color: D.textSoft, fontSize: 12, marginTop: 2, lineHeight: 17 }}>
            {item.description}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: D.gold, fontWeight: "900", fontSize: 15 }}>{item.price} cr</Text>
          {qty > 0 && (
            <View style={{ backgroundColor: D.primary + "20", borderRadius: 8,
              paddingHorizontal: 7, paddingVertical: 2, marginTop: 4 }}>
              <Text style={{ color: D.primary, fontSize: 10, fontWeight: "800" }}>×{qty}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Effects */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {positiveEffects.map((e) => (
          <View key={e} style={{ backgroundColor: D.green + "18", borderRadius: 8,
            paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: D.green, fontSize: 10, fontWeight: "700" }}>{e}</Text>
          </View>
        ))}
        {negativeEffects.map((e) => (
          <View key={e} style={{ backgroundColor: D.red + "18", borderRadius: 8,
            paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: D.red, fontSize: 10, fontWeight: "700" }}>{e}</Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable onPress={handleBuy} disabled={!canBuy}
          style={{ flex: 1, backgroundColor: canBuy ? color : D.border,
            borderRadius: 12, paddingVertical: 10, alignItems: "center",
            opacity: canBuy ? 1 : 0.5 }}>
          <Text style={{ color: canBuy ? "#fff" : D.muted, fontWeight: "800", fontSize: 13 }}>
            Acheter
          </Text>
        </Pressable>
        {qty > 0 && (
          <Pressable onPress={handleUse}
            style={{ flex: 1, backgroundColor: D.green + "18",
              borderRadius: 12, paddingVertical: 10, alignItems: "center",
              borderWidth: 1, borderColor: D.green + "30" }}>
            <Text style={{ color: D.green, fontWeight: "800", fontSize: 13 }}>
              Utiliser ×{qty}
            </Text>
          </Pressable>
        )}
      </View>

      {feedback && (
        <Text style={{ color: D.green, fontSize: 12, fontWeight: "700", textAlign: "center" }}>
          {feedback}
        </Text>
      )}
    </View>
  );
}

export default function ShopScreen() {
  const stats    = useGameStore((s) => s.stats);
  const inventory = useGameStore((s) => s.inventory ?? []);
  const buyItem  = useGameStore((s) => s.buyItem);
  const useItem  = useGameStore((s) => s.useItem);
  const currentLocation = useGameStore((s) => s.currentLocationSlug);

  const [selectedCat, setSelectedCat] = useState<ItemCategory | "all" | "inventaire">("all");
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const filteredItems = SHOP_ITEMS.filter((item) => {
    if (selectedCat === "inventaire") {
      return inventory.some((i) => i.itemId === item.id && i.quantity > 0);
    }
    if (selectedCat !== "all" && item.category !== selectedCat) return false;
    return true;
  });

  function handleBuy(item: ShopItem) {
    const result = buyItem(item.id);
    if (!result.ok) {
      setError(result.error ?? "Erreur");
      setTimeout(() => setError(null), 2500);
    }
  }

  function handleUse(item: ShopItem) {
    const result = useItem(item.id);
    if (!result.ok) {
      setError(result.error ?? "Erreur");
      setTimeout(() => setError(null), 2500);
    }
  }

  const inventoryCount = inventory.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <Animated.View style={{ flex: 1, opacity: fadeAnim, backgroundColor: D.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <View style={{ paddingTop: 54, paddingBottom: 24, paddingHorizontal: 20,
          backgroundColor: "#1a0e2e", overflow: "hidden" }}>
          <View style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120,
            borderRadius: 60, backgroundColor: D.purple + "15" }} />
          <Pressable onPress={() => router.back()}
            style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12,
              paddingHorizontal: 12, paddingVertical: 6, alignSelf: "flex-start", marginBottom: 16 }}>
            <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>← Retour</Text>
          </Pressable>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 26 }}>🛍️ Boutique</Text>
          <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 13, marginTop: 4 }}>
            Lieu actuel : {currentLocation} · 💰 {stats.money} cr
          </Text>
          {inventoryCount > 0 && (
            <Text style={{ color: D.gold, fontSize: 13, fontWeight: "700", marginTop: 4 }}>
              📦 {inventoryCount} item(s) en inventaire
            </Text>
          )}
        </View>

        <View style={{ padding: 16, gap: 16, maxWidth: 640, width: "100%", alignSelf: "center" }}>

          {/* Erreur */}
          {error && (
            <View style={{ backgroundColor: D.red + "18", borderRadius: 14, padding: 12,
              borderWidth: 1, borderColor: D.red + "30" }}>
              <Text style={{ color: D.red, fontWeight: "700", fontSize: 13 }}>⚠️ {error}</Text>
            </View>
          )}

          {/* Filtres catégories */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}>
            {(["all", "inventaire", ...CATEGORIES] as const).map((cat) => {
              const isActive = selectedCat === cat;
              const color = cat === "all" ? D.text : cat === "inventaire" ? D.gold : CAT_COLOR[cat];
              return (
                <Pressable key={cat} onPress={() => setSelectedCat(cat)}
                  style={{ flexDirection: "row", alignItems: "center", gap: 5,
                    backgroundColor: isActive ? color + "20" : D.card,
                    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
                    borderWidth: 1, borderColor: isActive ? color + "50" : D.border }}>
                  <Text style={{ fontSize: 13 }}>
                    {cat === "all" ? "🏪" : cat === "inventaire" ? "📦" : CAT_EMOJI[cat]}
                  </Text>
                  <Text style={{ color: isActive ? color : D.textSoft, fontSize: 12, fontWeight: "700" }}>
                    {cat === "all" ? "Tout" : cat === "inventaire" ? `Inventaire (${inventoryCount})` : CAT_LABEL[cat]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Stats rapides */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              { emoji: "⚡", label: "Énergie", value: stats.energy, color: "#3b82f6" },
              { emoji: "😊", label: "Moral",   value: stats.mood,   color: D.purple },
              { emoji: "🍱", label: "Faim",    value: stats.hunger,  color: D.orange },
            ].map((stat) => (
              <View key={stat.label} style={{ flex: 1, backgroundColor: D.card, borderRadius: 14,
                padding: 10, borderWidth: 1, borderColor: D.border, gap: 5 }}>
                <Text style={{ fontSize: 16 }}>{stat.emoji}</Text>
                <Text style={{ color: stat.color, fontWeight: "900", fontSize: 16 }}>{stat.value}</Text>
                <Text style={{ color: D.muted, fontSize: 10 }}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Items */}
          <Text style={{ color: D.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }}>
            ARTICLES ({filteredItems.length})
          </Text>

          {filteredItems.length === 0 ? (
            <View style={{ backgroundColor: D.card, borderRadius: 18, padding: 24,
              alignItems: "center", gap: 10 }}>
              <Text style={{ fontSize: 32 }}>📦</Text>
              <Text style={{ color: D.textSoft, fontSize: 14, textAlign: "center" }}>
                {selectedCat === "inventaire"
                  ? "Ton inventaire est vide."
                  : "Aucun article dans cette catégorie."}
              </Text>
            </View>
          ) : (
            filteredItems.map((item) => {
              const qty = inventory.find((i) => i.itemId === item.id)?.quantity ?? 0;
              return (
                <ItemCard
                  key={item.id}
                  item={item}
                  qty={qty}
                  canBuy={stats.money >= item.price && qty < item.maxStack}
                  onBuy={() => handleBuy(item)}
                  onUse={() => handleUse(item)}
                />
              );
            })
          )}

        </View>
      </ScrollView>
    </Animated.View>
  );
}
