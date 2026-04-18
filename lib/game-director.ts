import type { AvatarStats, DailyGoal, LifeActionId } from "@/lib/types";

export type GameDirectorPlan = {
  title: string;
  body: string;
  action: LifeActionId;
  actionLabel: string;
  tone: "danger" | "focus" | "social" | "growth";
  steps: string[];
};

function openGoalLabel(goals: Pick<DailyGoal, "label" | "completed">[]) {
  return goals.find((goal) => !goal.completed)?.label ?? "Garder le rythme";
}

export function getGameDirectorPlan(stats: AvatarStats, goals: Pick<DailyGoal, "label" | "completed">[]): GameDirectorPlan {
  const nextGoal = openGoalLabel(goals);

  if (stats.hunger < 25 || stats.energy < 20 || stats.hygiene < 20) {
    const action: LifeActionId = stats.energy < 20 ? "sleep" : stats.hunger < 25 ? "healthy-meal" : "shower";
    return {
      title: "IA Directeur: stabilisation urgente",
      body: "Ton avatar ne doit pas avancer en dette physique. On remet les bases avant social, travail ou sorties.",
      action,
      actionLabel: action === "sleep" ? "Dormir" : action === "healthy-meal" ? "Manger" : "Douche",
      tone: "danger",
      steps: ["Regler le besoin critique", "Relancer une action courte", `Finir: ${nextGoal}`]
    };
  }

  if (stats.sociability < 35 || stats.mood < 35) {
    return {
      title: "IA Directeur: relance sociale",
      body: "Le jeu devient plus vivant quand tu parles aux residents. Ouvre une room ou fais un cafe social.",
      action: "cafe-chat",
      actionLabel: "Cafe social",
      tone: "social",
      steps: ["Ouvrir le chat", "Dire bonjour a un bot", "Rejoindre une room live"]
    };
  }

  if (stats.money < 45) {
    return {
      title: "IA Directeur: economie propre",
      body: "Ton budget est trop bas pour jouer confortablement. Fais rentrer des credits avant les achats.",
      action: "work-shift",
      actionLabel: "Travailler",
      tone: "focus",
      steps: ["Faire un shift", "Eviter shopping", `Finir: ${nextGoal}`]
    };
  }

  if (stats.stress > 70) {
    return {
      title: "IA Directeur: pression haute",
      body: "Tu peux progresser, mais le stress va casser le rendement. Baisse la pression maintenant.",
      action: "meditate",
      actionLabel: "Mediter",
      tone: "danger",
      steps: ["Meditation courte", "Marche douce", "Reprendre une action utile"]
    };
  }

  return {
    title: "IA Directeur: momentum actif",
    body: "Les bases sont correctes. C'est le bon moment pour progresser, explorer la ville et renforcer le social.",
    action: "walk",
    actionLabel: "Explorer",
    tone: "growth",
    steps: ["Explorer la ville", "Parler a un resident", `Finir: ${nextGoal}`]
  };
}
