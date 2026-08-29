/** Manche 2 — quiz Toulouse. Pool statique, pur (testable). */

export type QuizQuestion = {
  q: string;
  choices: string[];
  answer: number; // index dans choices
};

export const TOULOUSE_QUIZ: QuizQuestion[] = [
  { q: "Quel fleuve traverse Toulouse ?", choices: ["La Garonne", "Le Rhône", "La Loire", "La Seine"], answer: 0 },
  { q: "Surnom de Toulouse ?", choices: ["La ville blanche", "La ville rose", "La ville bleue", "La ville verte"], answer: 1 },
  { q: "Quel avionneur est basé à Toulouse ?", choices: ["Boeing", "Airbus", "Embraer", "Dassault seul"], answer: 1 },
  { q: "Le Capitole abrite surtout…", choices: ["Un musée d'art", "L'hôtel de ville", "Une gare", "Une université"], answer: 1 },
  { q: "Quelle basilique romane célèbre à Toulouse ?", choices: ["Saint-Sernin", "Notre-Dame", "Saint-Michel", "Sacré-Cœur"], answer: 0 },
  { q: "Le canal qui rejoint la Garonne à la Méditerranée ?", choices: ["Canal du Nord", "Canal du Midi", "Canal Saint-Martin", "Canal de Bourgogne"], answer: 1 },
  { q: "Couleur dominante des briques toulousaines ?", choices: ["Grise", "Ocre-rose", "Noire", "Beige clair"], answer: 1 },
  { q: "Le club de rugby de la ville ?", choices: ["Stade Toulousain", "RC Toulon", "ASM", "UBB"], answer: 0 },
  { q: "Place centrale des marchés et terrasses, à côté du Capitole ?", choices: ["Place Wilson", "Place du Capitole", "Place Esquirol", "Place Saint-Georges"], answer: 1 },
  { q: "La Cité de l'espace se visite pour…", choices: ["L'histoire médiévale", "L'astronomie et le spatial", "La gastronomie", "L'art moderne"], answer: 1 },
];

/** Tire `n` questions déterministes à partir d'une graine (id de battle). */
export function pickQuiz(seed: string, n = 3): QuizQuestion[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const pool = [...TOULOUSE_QUIZ];
  const out: QuizQuestion[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push(pool.splice(h % pool.length, 1)[0]);
  }
  return out;
}
