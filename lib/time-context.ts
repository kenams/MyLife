/**
 * Contexte temporel réel — adapte les interactions à l'heure et au jour de la semaine.
 * Utilise l'heure locale de l'appareil (fuseau automatique).
 */

import type { LifeActionId } from "@/lib/types";

export type TimeSlot =
  | "dawn"       // 5h-7h   — lever, marche légère
  | "morning"    // 7h-12h  — petit-déj, travail, productivité
  | "lunch"      // 12h-14h — repas, pause
  | "afternoon"  // 14h-17h — travail, focus, études
  | "evening"    // 17h-22h — sport, sorties, social, dîner
  | "night"      // 22h-1h  — détente, lecture, coucher
  | "late-night";// 1h-5h   — sommeil obligatoire

export type DayKind = "weekday" | "weekend";

export type WeatherKind = "sunny" | "cloudy" | "rainy" | "stormy" | "snowy" | "windy";

export type TimeContext = {
  hour: number;
  minutes: number;
  slot: TimeSlot;
  dayKind: DayKind;
  isWeekend: boolean;
  label: string;
  emoji: string;
  color: string;
  workAvailable: boolean;
  gymPrime: boolean;
  socialPrime: boolean;
  // Nouveaux champs
  isPublicHoliday: boolean;
  holidayName: string | null;
  weather: WeatherKind;
  weatherEmoji: string;
  weatherBonus: number;  // multiplicateur d'action selon météo
  season: "spring" | "summer" | "autumn" | "winter";
};

export type ActionTimeScore = {
  multiplier: number;
  badge: string | null;
  badgeColor: string;
  hint: string | null;
};

// ─── Jours fériés français ────────────────────────────────────────────────────

function getFrenchHolidays(year: number): Map<string, string> {
  const h = new Map<string, string>();
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;

  // Fixes
  h.set(`1/1`,   "Nouvel An");
  h.set(`5/1`,   "Fête du Travail");
  h.set(`5/8`,   "Victoire 1945");
  h.set(`7/14`,  "Fête Nationale");
  h.set(`8/15`,  "Assomption");
  h.set(`11/1`,  "Toussaint");
  h.set(`11/11`, "Armistice");
  h.set(`12/25`, "Noël");

  // Pâques (algorithme de Butcher)
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d2 = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), k = (19 * a + b - d2 - g + 15) % 30;
  const l = Math.floor(c / 4), m = c % 4, n = (32 + 2 * e + 2 * l - k - m) % 7;
  const o = Math.floor((a + 11 * k + 22 * n) / 451);
  const month = Math.floor((k + n - 7 * o + 114) / 31);
  const day   = ((k + n - 7 * o + 114) % 31) + 1;
  const easter = new Date(year, month - 1, day);

  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
  h.set(fmt(addDays(easter, 1)),  "Lundi de Pâques");
  h.set(fmt(addDays(easter, 39)), "Ascension");
  h.set(fmt(addDays(easter, 50)), "Lundi de Pentecôte");

  return h;
}

// ─── Météo simulée basée sur date + hash ─────────────────────────────────────

function getSimulatedWeather(now: Date): { weather: WeatherKind; emoji: string; bonus: number } {
  const month = now.getMonth() + 1;
  const day   = now.getDate();
  // Seed pseudo-aléatoire basé sur la date (stable dans la journée)
  const seed  = (month * 31 + day * 7 + now.getFullYear()) % 100;

  // Pondération selon saison
  const isSummer = month >= 6 && month <= 8;
  const isWinter = month === 12 || month <= 2;
  const isSpring = month >= 3 && month <= 5;

  if (isWinter) {
    if (seed < 10) return { weather: "snowy",  emoji: "❄️",  bonus: 0.7 };
    if (seed < 30) return { weather: "stormy", emoji: "⛈️",  bonus: 0.6 };
    if (seed < 60) return { weather: "rainy",  emoji: "🌧️",  bonus: 0.85 };
    if (seed < 80) return { weather: "cloudy", emoji: "☁️",  bonus: 0.95 };
    return                 { weather: "sunny",  emoji: "🌤️",  bonus: 1.1 };
  }
  if (isSummer) {
    if (seed < 5)  return { weather: "stormy", emoji: "⛈️",  bonus: 0.7 };
    if (seed < 15) return { weather: "rainy",  emoji: "🌧️",  bonus: 0.85 };
    if (seed < 30) return { weather: "cloudy", emoji: "⛅",  bonus: 1.0 };
    if (seed < 40) return { weather: "windy",  emoji: "💨",  bonus: 0.9 };
    return                 { weather: "sunny",  emoji: "☀️",  bonus: 1.2 };
  }
  if (isSpring) {
    if (seed < 20) return { weather: "rainy",  emoji: "🌦️",  bonus: 0.9 };
    if (seed < 40) return { weather: "cloudy", emoji: "⛅",  bonus: 1.0 };
    if (seed < 50) return { weather: "windy",  emoji: "💨",  bonus: 0.95 };
    return                 { weather: "sunny",  emoji: "🌸",  bonus: 1.15 };
  }
  // Automne
  if (seed < 30) return { weather: "rainy",  emoji: "🍂",  bonus: 0.85 };
  if (seed < 50) return { weather: "cloudy", emoji: "☁️",  bonus: 0.95 };
  if (seed < 60) return { weather: "windy",  emoji: "🍃",  bonus: 0.9 };
  return                 { weather: "sunny",  emoji: "🌤️",  bonus: 1.05 };
}

function getSeason(month: number): TimeContext["season"] {
  if (month >= 3 && month <= 5)  return "spring";
  if (month >= 6 && month <= 8)  return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

// ─── Contexte courant ─────────────────────────────────────────────────────────

export function getTimeContext(): TimeContext {
  const now = new Date();
  const hour = now.getHours();
  const minutes = now.getMinutes();
  const dow = now.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const dayKind: DayKind = isWeekend ? "weekend" : "weekday";

  const slot = getSlot(hour);
  const { label, emoji, color } = getSlotMeta(slot, isWeekend);

  // Jours fériés
  const holidays = getFrenchHolidays(now.getFullYear());
  const dayKey = `${now.getMonth() + 1}/${now.getDate()}`;
  const holidayName = holidays.get(dayKey) ?? null;
  const isPublicHoliday = !!holidayName;
  const effectiveWeekend = isWeekend || isPublicHoliday;

  const workAvailable = isWorkAvailable(hour, effectiveWeekend);
  const gymPrime   = (hour >= 6 && hour < 9) || (hour >= 17 && hour < 21);
  const socialPrime = (hour >= 17 && hour < 24) || effectiveWeekend;

  // Météo simulée
  const { weather, emoji: weatherEmoji, bonus: weatherBonus } = getSimulatedWeather(now);
  const season = getSeason(now.getMonth() + 1);

  return {
    hour, minutes, slot, dayKind, isWeekend, label, emoji, color,
    workAvailable, gymPrime, socialPrime,
    isPublicHoliday, holidayName, weather, weatherEmoji, weatherBonus, season,
  };
}

function getSlot(hour: number): TimeSlot {
  if (hour >= 5  && hour < 7)  return "dawn";
  if (hour >= 7  && hour < 12) return "morning";
  if (hour >= 12 && hour < 14) return "lunch";
  if (hour >= 14 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 22) return "evening";
  if (hour >= 22 || hour < 1)  return "night";
  return "late-night"; // 1h-5h
}

function isWorkAvailable(hour: number, isWeekend: boolean): boolean {
  if (isWeekend) return hour >= 10 && hour < 16; // réduit le weekend
  return hour >= 8 && hour < 20;
}

function getSlotMeta(slot: TimeSlot, isWeekend: boolean): { label: string; emoji: string; color: string } {
  if (isWeekend) {
    const weekend: Record<TimeSlot, { label: string; emoji: string; color: string }> = {
      "dawn":       { label: "Lever weekend",   emoji: "🌅", color: "#fb923c" },
      "morning":    { label: "Matin libre",      emoji: "☀️",  color: "#fbbf24" },
      "lunch":      { label: "Déjeuner",         emoji: "🍽️",  color: "#34d399" },
      "afternoon":  { label: "Après-midi libre", emoji: "🌤️",  color: "#60a5fa" },
      "evening":    { label: "Soirée weekend",   emoji: "🌆", color: "#a78bfa" },
      "night":      { label: "Nuit weekend",     emoji: "🌙", color: "#6366f1" },
      "late-night": { label: "Nuit profonde",    emoji: "😴", color: "#374151" },
    };
    return weekend[slot];
  }
  const weekday: Record<TimeSlot, { label: string; emoji: string; color: string }> = {
    "dawn":       { label: "Lever matinal",    emoji: "🌅", color: "#fb923c" },
    "morning":    { label: "Journée de travail", emoji: "☀️", color: "#fbbf24" },
    "lunch":      { label: "Pause déjeuner",   emoji: "🍽️",  color: "#34d399" },
    "afternoon":  { label: "Après-midi",        emoji: "🌤️",  color: "#60a5fa" },
    "evening":    { label: "Soirée libre",      emoji: "🌆", color: "#a78bfa" },
    "night":      { label: "Fin de soirée",     emoji: "🌙", color: "#6366f1" },
    "late-night": { label: "Nuit profonde",     emoji: "😴", color: "#374151" },
  };
  return weekday[slot];
}

// ─── Score temporel par action ────────────────────────────────────────────────

const ACTION_WINDOWS: Record<LifeActionId, {
  prime: TimeSlot[];
  ok: TimeSlot[];
  avoid: TimeSlot[];
  primeLabel: string;
  avoidHint: string | null;
}> = {
  "healthy-meal": {
    prime: ["morning", "lunch", "evening"],
    ok: ["afternoon", "dawn"],
    avoid: ["late-night", "night"],
    primeLabel: "Créneau repas idéal",
    avoidHint: "Manger la nuit perturbe le métabolisme"
  },
  "comfort-meal": {
    prime: ["lunch", "evening"],
    ok: ["morning", "afternoon"],
    avoid: ["late-night"],
    primeLabel: "Pause repas",
    avoidHint: "Grignoter la nuit amplifie l'impact calorique"
  },
  "hydrate": {
    prime: ["morning", "afternoon", "dawn"],
    ok: ["lunch", "evening"],
    avoid: ["late-night"],
    primeLabel: "Hydratation matinale optimale",
    avoidHint: "Évite les liquides après 22h (sommeil)"
  },
  "sleep": {
    prime: ["night", "late-night"],
    ok: ["evening"],
    avoid: ["morning", "afternoon"],
    primeLabel: "Heure de coucher idéale",
    avoidHint: "Dormir en journée décale le rythme circadien"
  },
  "nap": {
    prime: ["lunch", "afternoon"],
    ok: ["morning"],
    avoid: ["evening", "night", "late-night"],
    primeLabel: "Sieste stratégique 13h-15h",
    avoidHint: "Sieste trop tardive = nuit compromise"
  },
  "shower": {
    prime: ["morning", "dawn", "evening"],
    ok: ["afternoon", "lunch"],
    avoid: ["late-night"],
    primeLabel: "Routine hygiène idéale",
    avoidHint: null
  },
  "reset": {
    prime: ["morning", "evening"],
    ok: ["afternoon", "dawn"],
    avoid: ["late-night"],
    primeLabel: "Reset matinal",
    avoidHint: null
  },
  "work-shift": {
    prime: ["morning", "afternoon"],
    ok: ["lunch", "evening"],
    avoid: ["night", "late-night", "dawn"],
    primeLabel: "Pic de productivité",
    avoidHint: "Travailler la nuit augmente le stress de 40%"
  },
  "focus-task": {
    prime: ["morning", "afternoon"],
    ok: ["lunch", "evening"],
    avoid: ["night", "late-night"],
    primeLabel: "Focus matinal optimal",
    avoidHint: "La concentration chute après 21h"
  },
  "walk": {
    prime: ["morning", "dawn", "evening"],
    ok: ["afternoon", "lunch"],
    avoid: ["late-night"],
    primeLabel: "Marche matinale recommandée",
    avoidHint: null
  },
  "gym": {
    prime: ["morning", "evening"],
    ok: ["afternoon", "dawn"],
    avoid: ["late-night", "night"],
    primeLabel: "Créneau gym idéal",
    avoidHint: "Exercice intense après 22h perturbe le sommeil"
  },
  "cafe-chat": {
    prime: ["morning", "afternoon", "evening"],
    ok: ["lunch"],
    avoid: ["late-night", "dawn"],
    primeLabel: "Heure sociale active",
    avoidHint: "Peu de monde disponible à cette heure"
  },
  "restaurant-outing": {
    prime: ["lunch", "evening"],
    ok: ["afternoon"],
    avoid: ["morning", "dawn", "late-night"],
    primeLabel: "Service restaurant disponible",
    avoidHint: "Les restos ferment à cette heure"
  },
  "cinema-date": {
    prime: ["evening", "night"],
    ok: ["afternoon"],
    avoid: ["morning", "dawn", "late-night"],
    primeLabel: "Séances du soir disponibles",
    avoidHint: "Peu de séances disponibles le matin"
  },
  "rest-home": {
    prime: ["evening", "night"],
    ok: ["afternoon"],
    avoid: ["morning"],
    primeLabel: "Moment de détente idéal",
    avoidHint: null
  },
  "go-out": {
    prime: ["evening"],
    ok: ["afternoon", "night"],
    avoid: ["morning", "dawn", "late-night"],
    primeLabel: "Soirée parfaite pour sortir",
    avoidHint: "Les lieux sont fermés ou vides à cette heure"
  },
  "meditate": {
    prime: ["morning", "dawn", "evening"],
    ok: ["afternoon"],
    avoid: ["late-night"],
    primeLabel: "Méditation matinale idéale",
    avoidHint: null
  },
  "home-cooking": {
    prime: ["morning", "lunch", "evening"],
    ok: ["afternoon"],
    avoid: ["late-night"],
    primeLabel: "Repas maison au bon moment",
    avoidHint: "Cuisiner la nuit perturbe le sommeil"
  },
  "read-book": {
    prime: ["evening", "night", "morning"],
    ok: ["afternoon", "lunch"],
    avoid: ["late-night"],
    primeLabel: "Lecture soirée idéale",
    avoidHint: null
  },
  "shopping": {
    prime: ["morning", "afternoon"],
    ok: ["lunch"],
    avoid: ["evening", "night", "late-night", "dawn"],
    primeLabel: "Commerces ouverts",
    avoidHint: "La plupart des commerces ferment après 20h"
  },
  "team-sport": {
    prime: ["evening"],
    ok: ["morning", "afternoon"],
    avoid: ["night", "late-night", "dawn"],
    primeLabel: "Créneau sport collectif idéal",
    avoidHint: "Peu de créneaux sportifs disponibles"
  },
};

export function getActionTimeScore(actionId: LifeActionId, ctx: TimeContext): ActionTimeScore {
  const windows = ACTION_WINDOWS[actionId];
  if (!windows) return { multiplier: 1.0, badge: null, badgeColor: "#38c793", hint: null };

  const slot = ctx.slot;

  if (windows.prime.includes(slot)) {
    return {
      multiplier: 1.3,
      badge: windows.primeLabel,
      badgeColor: "#38c793",
      hint: null,
    };
  }
  if (windows.avoid.includes(slot)) {
    return {
      multiplier: 0.75,
      badge: "Hors créneau",
      badgeColor: "#f87171",
      hint: windows.avoidHint,
    };
  }
  return { multiplier: 1.0, badge: null, badgeColor: "#fbbf24", hint: null };
}

// ─── Actions suggérées pour ce créneau ────────────────────────────────────────

export function getSuggestedActions(ctx: TimeContext): LifeActionId[] {
  const { slot, isWeekend } = ctx;

  const map: Record<TimeSlot, LifeActionId[]> = {
    "dawn":       ["shower", "meditate", "walk", "hydrate", "home-cooking"],
    "morning":    isWeekend
      ? ["home-cooking", "healthy-meal", "walk", "meditate", "read-book"]
      : ["healthy-meal", "work-shift", "focus-task", "shower", "hydrate"],
    "lunch":      ["healthy-meal", "home-cooking", "comfort-meal", "rest-home", "cafe-chat"],
    "afternoon":  isWeekend
      ? ["walk", "cafe-chat", "shopping", "cinema-date", "read-book"]
      : ["focus-task", "work-shift", "walk", "hydrate", "read-book"],
    "evening":    ["gym", "team-sport", "restaurant-outing", "cafe-chat", "go-out", "home-cooking", "walk"],
    "night":      ["read-book", "rest-home", "meditate", "cinema-date", "nap"],
    "late-night": ["sleep", "rest-home"],
  };

  return map[slot] ?? [];
}

// ─── Texte contextuel pour le HUD home ────────────────────────────────────────

export function getTimeModeDescription(ctx: TimeContext): string {
  const { slot, isWeekend } = ctx;

  if (slot === "late-night") return "Il est très tard — priorité au sommeil.";
  if (slot === "night") return "Soirée qui se termine — bientôt l'heure de dormir.";
  if (slot === "dawn") return "Lever matinal — bonne heure pour une routine.";

  if (isWeekend) {
    if (slot === "morning")   return "Weekend matin — profite, pas d'obligation.";
    if (slot === "lunch")     return "Déjeuner weekend — repas calme ou sortie.";
    if (slot === "afternoon") return "Après-midi libre — sorties, sport, social.";
    if (slot === "evening")   return "Soirée weekend — sorties, restos, friends.";
  }

  if (slot === "morning")   return "Heure de pointe productive — focus et travail.";
  if (slot === "lunch")     return "Pause déjeuner — repas, détente rapide.";
  if (slot === "afternoon") return "Journée active — travail et focus task.";
  if (slot === "evening")   return "Soirée — sport, social, décompression.";

  return "";
}

// ─── Hook React utilisable dans les composants ────────────────────────────────

import { useEffect, useState } from "react";

export function useTimeContext(): TimeContext {
  const [ctx, setCtx] = useState<TimeContext>(getTimeContext);

  useEffect(() => {
    // Rafraîchit toutes les minutes
    const interval = setInterval(() => setCtx(getTimeContext()), 60_000);
    return () => clearInterval(interval);
  }, []);

  return ctx;
}
