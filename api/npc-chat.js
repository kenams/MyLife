// Vercel serverless function — jamais côté client : c'est ici et seulement
// ici que ANTHROPIC_API_KEY est lue. Le client n'a accès qu'à ce endpoint,
// jamais à la clé elle-même.
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
  // n'importe qui sur internet pourrait taper ce endpoint et consommer la
  // clé Anthropic partagée avec kah-digital-site.
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

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    res.status(500).json({ error: "PNJ indisponible (clé manquante)" });
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

  try {
    const anthRes = await fetch("https://api.anthropic.com/v1/messages", {
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

    if (!anthRes.ok) {
      const errText = await anthRes.text();
      res.status(502).json({ error: "PNJ momentanément indisponible", detail: errText.slice(0, 200) });
      return;
    }

    const data = await anthRes.json();
    const reply = data?.content?.[0]?.text?.trim() || "...";
    res.status(200).json({ reply });
  } catch (e) {
    res.status(502).json({ error: "PNJ momentanément indisponible" });
  }
}
