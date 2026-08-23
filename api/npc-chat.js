// Vercel serverless function — jamais côté client : c'est ici et seulement
// ici que ANTHROPIC_API_KEY / OPENAI_API_KEY sont lues. Le client n'a accès
// qu'à ce endpoint, jamais aux clés elles-mêmes.
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
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(errText.slice(0, 300));
  }
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
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(errText.slice(0, 300));
  }
  const data = await r.json();
  return data?.choices?.[0]?.message?.content?.trim() || "...";
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

  // Vérifie que le token est une vraie session Supabase valide — sans ça
  // n'importe qui sur internet pourrait taper ce endpoint et consommer les
  // clés partagées avec kah-digital-site.
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
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

  const { npcName, npcMood, history, message } = req.body || {};
  if (!npcName || typeof message !== "string" || message.trim().length === 0) {
    res.status(400).json({ error: "Requête invalide" });
    return;
  }
  if (message.length > 500) {
    res.status(400).json({ error: "Message trop long" });
    return;
  }

  const systemPrompt = `Tu incarnes ${npcName}, un habitant fictif de Toulouse dans le jeu MyLife. ` +
    `Humeur actuelle : ${npcMood || "détendu"}. Style : jeune adulte toulousain, direct, chaleureux, ` +
    `un peu d'humour et d'accent local sans forcer, phrases courtes (1 à 3 phrases max). ` +
    `Tu ne sors JAMAIS du personnage, tu ne dis jamais que tu es une IA. Reste inoffensif et respectueux.`;

  const messages = [
    ...(Array.isArray(history) ? history.slice(-10).map((m) => ({
      role: m.role === "npc" ? "assistant" : "user",
      content: String(m.text || "").slice(0, 500),
    })) : []),
    { role: "user", content: message.trim() },
  ];

  const anthKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  let lastError = null;

  // Anthropic d'abord, bascule automatique sur OpenAI si indisponible
  // (crédit épuisé, clé invalide, erreur réseau, etc.) — le joueur ne voit
  // jamais laquelle des deux a répondu, juste que le PNJ répond.
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
