// ─── Env bindings (définis dans wrangler.toml + wrangler secret) ─────────────

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  WORKER_SECRET: string;          // Secret partagé pour valider les webhooks Supabase
  APP_ENV: string;
}

// ─── Payload webhook Supabase (Database Webhooks) ────────────────────────────

export interface SupabaseWebhookPayload<T = Record<string, unknown>> {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: T | null;
  old_record: T | null;
}

// ─── Tables pertinentes pour les webhooks ─────────────────────────────────────

export interface InvitationRow {
  id: string;
  sender_avatar_id: string;
  receiver_avatar_id: string;
  activity_slug: string;
  status: string;
  created_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  avatar_id: string;
  body: string;
  kind: string;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  avatar_id: string;
  kind: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

// ─── Expo Push API ────────────────────────────────────────────────────────────

export interface ExpoPushMessage {
  to: string;               // "ExponentPushToken[...]"
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;       // Android
}

export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

// ─── Résultat interne ─────────────────────────────────────────────────────────

export interface WorkerResponse {
  ok: boolean;
  message?: string;
  error?: string;
}
