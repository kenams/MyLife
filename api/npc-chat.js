// Vercel serverless function — les clés IA restent exclusivement côté serveur.
async function callAnthropic(key, systemPrompt, messages) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      system: systemPrompt,
      messages,
    }),
  });
  if (!r.ok) throw new Error((await r.text()).slice(0, 300));
  const data = await r.json();
  return data?.content?.[0]?.text?.trim() || "...";
}

async function callOpenAI(key, systemPrompt, messages) {
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 200,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });
  if (!r.ok) throw new Error((await r.text()).slice(0, 300));
  const data = await r.json();
  return data?.choices?.[0]?.message?.content?.trim() || "...";
}

function clean(value, max = 160) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({ error: "Configuration indisponible" });
    return;
  }

  try {
    const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: supabaseAnonKey },
    });
    if (!authRes.ok) {
      res.status(401).json({ error: "Session invalide" });
      return;
    }
  } catch {
    res.status(401).json({ error: "Session invalide" });
    return;
  }

  const { npcName, npcMood, personality, goal, history, message } = req.body || {};
  const safeName = clean(npcName, 60);
  const safeMessage = clean(message, 500);
  if (!safeName || !safeMessage) {
    res.status(400).json({ error: "Requête invalide" });
    return;
  }

  const tone = clean(personality?.tone, 40) || "naturel";
  const interest = clean(personality?.interest, 80) || "la vie locale";
  const district = clean(personality?.district, 80) || "Toulouse";
  const goalLabel = clean(goal?.label, 160) || "profiter de sa semaine";
  const goalMotivation = clean(goal?.motivation, 180);
  const goalProgress = Number.isFinite(Number(goal?.progress))
    ? Math.max(0, Math.min(100, Math.round(Number(goal.progress))))
    : 0;

  const systemPrompt = [
    `Tu incarnes ${safeName}, un habitant SIMULÉ et fictif de Toulouse dans le jeu MyLife.`,
    `Humeur actuelle : ${clean(npcMood, 50) || "détendu"}.`,
    `Personnalité : ton ${tone}, intérêt principal ${interest}, quartier familier ${district}.`,
    `Objectif actuel sur plusieurs jours : ${goalLabel} (${goalProgress}% de sa période).`,
    goalMotivation ? `Motivation : ${goalMotivation}.` : "",
    "Réponds comme une personne cohérente avec cette personnalité et cet objectif.",
    "Style jeune adulte, direct et naturel, 1 à 3 phrases maximum. Pas de monologue.",
    "Tu peux accepter, hésiter, refuser, être occupé ou changer d'avis selon le contexte.",
    "N'invente jamais la position précise, le trajet en temps réel ou des informations privées d'un vrai joueur.",
    "Ne prétends jamais être une personne réelle hors du jeu. Reste respectueux et inoffensif.",
  ].filter(Boolean).join(" ");

  const messages = [
    ...(Array.isArray(history) ? history.slice(-10).map((m) => ({
      role: m?.role === "npc" ? "assistant" : "user",
      content: clean(m?.text, 500),
    })).filter((m) => m.content) : []),
    { role: "user", content: safeMessage },
  ];

  const anthKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  let lastError = null;

  if (anthKey) {
    try {
      const reply = await callAnthropic(anthKey, systemPrompt, messages);
      res.status(200).json({ reply, provider: "anthropic" });
      return;
    } catch (e) {
      lastError = e;
    }
  }

  if (openaiKey) {
    try {
      const reply = await callOpenAI(openaiKey, systemPrompt, messages);
      res.status(200).json({ reply, provider: "openai" });
      return;
    } catch (e) {
      lastError = e;
    }
  }

  res.status(502).json({
    error: "PNJ momentanément indisponible",
    detail: lastError ? String(lastError.message).slice(0, 200) : "Aucune clé configurée",
  });
}
