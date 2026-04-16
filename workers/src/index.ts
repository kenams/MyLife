/**
 * MyLife — Cloudflare Worker principal
 *
 * Routes :
 *   POST /webhook/invitation  — nouvelle invitation créée dans Supabase
 *   POST /webhook/message     — nouveau message DM reçu
 *   POST /webhook/notification — nouvelle notification DB → push Expo
 *
 * Cron (wrangler.toml) :
 *   0 0 * * *   → daily-decay  : marque les avatars à décay (log dans analytics)
 *   0 * * * *   → room-cleanup : supprime les rooms expirées
 *
 * Toutes les routes webhook sont protégées par le header X-Worker-Secret.
 */

import type {
  Env,
  ExpoPushMessage,
  ExpoPushTicket,
  InvitationRow,
  MessageRow,
  NotificationRow,
  SupabaseWebhookPayload,
  WorkerResponse,
} from "./types";

export default {
  // ── Requêtes HTTP ──────────────────────────────────────────────────────────
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Valider le secret partagé sur tous les webhooks
    if (!validateSecret(request, env)) {
      return json({ ok: false, error: "Unauthorized" }, 401);
    }

    if (request.method !== "POST") {
      return json({ ok: false, error: "Method not allowed" }, 405);
    }

    try {
      const body = await request.json() as SupabaseWebhookPayload;

      switch (url.pathname) {
        case "/webhook/invitation":
          return await handleInvitationWebhook(body as unknown as SupabaseWebhookPayload<InvitationRow>, env);

        case "/webhook/message":
          return await handleMessageWebhook(body as unknown as SupabaseWebhookPayload<MessageRow>, env);

        case "/webhook/notification":
          return await handleNotificationWebhook(body as unknown as SupabaseWebhookPayload<NotificationRow>, env);

        default:
          return json({ ok: false, error: "Route inconnue" }, 404);
      }
    } catch (err) {
      return json({ ok: false, error: String(err) }, 500);
    }
  },

  // ── Cron triggers ──────────────────────────────────────────────────────────
  async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const hour = new Date(event.scheduledTime).getUTCHours();

    if (hour === 0) {
      // Minuit UTC → daily-decay log
      await runDailyDecayLog(env);
    } else {
      // Toutes les autres heures → nettoyage rooms expirées
      await runRoomCleanup(env);
    }
  },
};

// ─── Validation secret ────────────────────────────────────────────────────────

function validateSecret(request: Request, env: Env): boolean {
  const header = request.headers.get("X-Worker-Secret");
  return header === env.WORKER_SECRET;
}

// ─── Webhook : nouvelle invitation ───────────────────────────────────────────

async function handleInvitationWebhook(
  payload: SupabaseWebhookPayload<InvitationRow>,
  env: Env
): Promise<Response> {
  if (payload.type !== "INSERT" || !payload.record) {
    return json({ ok: true, message: "Événement ignoré" });
  }

  const inv = payload.record;

  // Récupérer le push token du destinataire via Supabase
  const token = await getPushTokenForAvatar(inv.receiver_avatar_id, env);
  if (!token) return json({ ok: true, message: "Pas de push token" });

  // Récupérer le nom de l'expéditeur
  const senderName = await getAvatarName(inv.sender_avatar_id, env);

  const result = await sendPushNotification(
    {
      to: token,
      title: "Nouvelle invitation",
      body: `${senderName} t'invite à ${inv.activity_slug.replace("-", " ")}.`,
      data: { type: "invitation", invitationId: inv.id },
      sound: "default",
    },
    env
  );

  return json({ ok: result.ok, message: result.message });
}

// ─── Webhook : nouveau message DM ────────────────────────────────────────────

async function handleMessageWebhook(
  payload: SupabaseWebhookPayload<MessageRow>,
  env: Env
): Promise<Response> {
  if (payload.type !== "INSERT" || !payload.record) {
    return json({ ok: true, message: "Événement ignoré" });
  }

  const msg = payload.record;

  // Trouver le destinataire de la conversation (l'autre membre)
  const recipientAvatarId = await getConversationRecipient(
    msg.conversation_id,
    msg.avatar_id,
    env
  );
  if (!recipientAvatarId) return json({ ok: true, message: "Pas de destinataire" });

  const token = await getPushTokenForAvatar(recipientAvatarId, env);
  if (!token) return json({ ok: true, message: "Pas de push token" });

  const senderName = await getAvatarName(msg.avatar_id, env);

  const preview = msg.body.length > 80 ? msg.body.slice(0, 77) + "..." : msg.body;

  const result = await sendPushNotification(
    {
      to: token,
      title: senderName,
      body: preview,
      data: { type: "message", conversationId: msg.conversation_id },
      sound: "default",
    },
    env
  );

  return json({ ok: result.ok, message: result.message });
}

// ─── Webhook : notification DB ───────────────────────────────────────────────

async function handleNotificationWebhook(
  payload: SupabaseWebhookPayload<NotificationRow>,
  env: Env
): Promise<Response> {
  if (payload.type !== "INSERT" || !payload.record) {
    return json({ ok: true, message: "Événement ignoré" });
  }

  const notif = payload.record;

  const token = await getPushTokenForAvatar(notif.avatar_id, env);
  if (!token) return json({ ok: true, message: "Pas de push token" });

  const result = await sendPushNotification(
    {
      to: token,
      title: notif.title,
      body: notif.body,
      data: { type: "notification", notificationId: notif.id, kind: notif.kind },
      sound: "default",
    },
    env
  );

  return json({ ok: result.ok, message: result.message });
}

// ─── Cron : daily decay log ───────────────────────────────────────────────────

async function runDailyDecayLog(env: Env): Promise<void> {
  // Compte les avatars actifs depuis les dernières 24h
  const res = await supabaseRequest(
    env,
    "POST",
    "/rest/v1/rpc/count_active_avatars",
    {}
  );

  if (res.ok) {
    // Log dans analytics_events pour suivi
    await supabaseRequest(env, "POST", "/rest/v1/analytics_events", {
      user_id: null,
      event_name: "cron_daily_decay",
      properties: { triggered_at: new Date().toISOString() },
      platform: "server",
      app_version: "worker-v1",
    });
  }
}

// ─── Cron : room cleanup ──────────────────────────────────────────────────────

async function runRoomCleanup(env: Env): Promise<void> {
  // Supprimer les rooms expirées (secret rooms avec expires_at < now())
  await supabaseRequest(
    env,
    "DELETE",
    `/rest/v1/rooms?expires_at=lt.${new Date().toISOString()}&is_active=eq.true`,
    null
  );
}

// ─── Helpers Supabase ─────────────────────────────────────────────────────────

async function supabaseRequest(
  env: Env,
  method: string,
  path: string,
  body: unknown
): Promise<{ ok: boolean; data?: unknown }> {
  const headers: Record<string, string> = {
    "apikey": env.SUPABASE_SERVICE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
  };

  const res = await fetch(`${env.SUPABASE_URL}${path}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) return { ok: false };
  return { ok: true };
}

async function getPushTokenForAvatar(avatarId: string, env: Env): Promise<string | null> {
  // Lire le push token stocké dans avatar_stats (ou une table dédiée push_tokens)
  // On s'attend à une table push_tokens(avatar_id, token, platform)
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/push_tokens?avatar_id=eq.${avatarId}&select=token&limit=1`,
    {
      headers: {
        "apikey": env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  if (!res.ok) return null;
  const rows = await res.json() as Array<{ token: string }>;
  return rows[0]?.token ?? null;
}

async function getAvatarName(avatarId: string, env: Env): Promise<string> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/avatars?id=eq.${avatarId}&select=display_name&limit=1`,
    {
      headers: {
        "apikey": env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  if (!res.ok) return "Quelqu'un";
  const rows = await res.json() as Array<{ display_name: string }>;
  return rows[0]?.display_name ?? "Quelqu'un";
}

async function getConversationRecipient(
  conversationId: string,
  senderAvatarId: string,
  env: Env
): Promise<string | null> {
  const res = await fetch(
    `${env.SUPABASE_URL}/rest/v1/conversation_members?conversation_id=eq.${conversationId}&avatar_id=neq.${senderAvatarId}&select=avatar_id&limit=1`,
    {
      headers: {
        "apikey": env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
    }
  );
  if (!res.ok) return null;
  const rows = await res.json() as Array<{ avatar_id: string }>;
  return rows[0]?.avatar_id ?? null;
}

// ─── Expo Push API ────────────────────────────────────────────────────────────

async function sendPushNotification(
  message: ExpoPushMessage,
  _env: Env
): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    return { ok: false, message: `Expo Push erreur HTTP ${res.status}` };
  }

  const result = await res.json() as { data: ExpoPushTicket };
  if (result.data?.status === "error") {
    return { ok: false, message: result.data.message ?? "Push refusé" };
  }

  return { ok: true, message: "Push envoyé" };
}

// ─── Utilitaires ──────────────────────────────────────────────────────────────

function json(body: WorkerResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
