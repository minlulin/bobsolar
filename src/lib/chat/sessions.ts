import { and, desc, eq, gt, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  type ChatConversation,
  type ChatMessage,
  type ChatSession,
  type ChatSessionStatus,
  chatConversations,
  chatMessages,
  chatSessions,
  chatUsageLogs,
  type NewChatConversation,
  type NewChatMessage,
  type NewChatUsageLog,
} from "@/lib/db/schema";
import {
  CHAT_MAX_ACTIVE_SESSIONS_PER_USER,
  CHAT_MAX_MESSAGES_PER_CONVERSATION,
  CHAT_SESSION_TTL_MS,
} from "@/lib/domain/policies";

// ── Conversation CRUD ────────────────────────────────────────────────

export async function createConversation(
  userId: string,
  data: Pick<NewChatConversation, "title" | "brand" | "lastErrorCode"> & { id?: string },
): Promise<ChatConversation> {
  const rows = await db
    .insert(chatConversations)
    .values({ userId, ...data })
    .returning();
  return rows[0] as ChatConversation;
}

export async function getConversation(
  conversationId: string,
  userId: string,
): Promise<ChatConversation | null> {
  const rows = await db
    .select()
    .from(chatConversations)
    .where(and(eq(chatConversations.id, conversationId), eq(chatConversations.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listConversations(userId: string, limit = 50): Promise<ChatConversation[]> {
  return db
    .select()
    .from(chatConversations)
    .where(eq(chatConversations.userId, userId))
    .orderBy(chatConversations.updatedAt)
    .limit(limit);
}

// ── Message CRUD ─────────────────────────────────────────────────────

export async function saveMessage(
  data: Pick<
    NewChatMessage,
    "conversationId" | "userId" | "role" | "content" | "parts" | "parentMessageId" | "metadata"
  >,
): Promise<ChatMessage> {
  const rows = await db.insert(chatMessages).values(data).returning();
  // Touch the conversation's updatedAt
  await db
    .update(chatConversations)
    .set({ updatedAt: new Date() })
    .where(eq(chatConversations.id, data.conversationId));
  return rows[0] as ChatMessage;
}

export async function getConversationMessages(
  conversationId: string,
  limit = CHAT_MAX_MESSAGES_PER_CONVERSATION,
): Promise<ChatMessage[]> {
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversationId, conversationId))
    .orderBy(chatMessages.createdAt)
    .limit(limit);
}

// ── Session Management ───────────────────────────────────────────────

export async function createSession(userId: string, conversationId?: string): Promise<ChatSession> {
  // Enforce max active sessions per user
  await evictExpiredSessions(userId);

  const activeCount = await countActiveSessions(userId);
  if (activeCount >= CHAT_MAX_ACTIVE_SESSIONS_PER_USER) {
    // Revoke the oldest active session to make room
    await revokeOldestSession(userId);
  }

  const expiresAt = new Date(Date.now() + CHAT_SESSION_TTL_MS);
  const rows = await db
    .insert(chatSessions)
    .values({
      userId,
      conversationId: conversationId ?? null,
      expiresAt,
    })
    .returning();
  return rows[0] as ChatSession;
}

export async function getOrCreateSession(
  userId: string,
  conversationId: string,
): Promise<ChatSession> {
  const existing = await db
    .select()
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.userId, userId),
        eq(chatSessions.conversationId, conversationId),
        eq(chatSessions.status, "active"),
        gt(chatSessions.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(chatSessions.lastActivityAt))
    .limit(1);

  return existing[0] ?? createSession(userId, conversationId);
}

export async function getSession(sessionId: string): Promise<ChatSession | null> {
  const rows = await db.select().from(chatSessions).where(eq(chatSessions.id, sessionId)).limit(1);
  return rows[0] ?? null;
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  await db
    .update(chatSessions)
    .set({ lastActivityAt: new Date() })
    .where(eq(chatSessions.id, sessionId));
}

export async function setSessionStatus(
  sessionId: string,
  status: ChatSessionStatus,
): Promise<void> {
  await db.update(chatSessions).set({ status }).where(eq(chatSessions.id, sessionId));
}

export async function expireSession(sessionId: string): Promise<void> {
  await setSessionStatus(sessionId, "expired");
}

async function evictExpiredSessions(userId: string): Promise<void> {
  await db
    .update(chatSessions)
    .set({ status: "expired" })
    .where(
      and(
        eq(chatSessions.userId, userId),
        eq(chatSessions.status, "active"),
        lt(chatSessions.expiresAt, new Date()),
      ),
    );
}

async function countActiveSessions(userId: string): Promise<number> {
  const rows = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, userId), eq(chatSessions.status, "active")));
  return rows.length;
}

async function revokeOldestSession(userId: string): Promise<void> {
  const oldest = await db
    .select({ id: chatSessions.id })
    .from(chatSessions)
    .where(and(eq(chatSessions.userId, userId), eq(chatSessions.status, "active")))
    .orderBy(chatSessions.lastActivityAt)
    .limit(1);

  if (oldest.length > 0 && oldest[0]) {
    await setSessionStatus(oldest[0].id, "revoked");
  }
}

// ── Usage Logging ────────────────────────────────────────────────────

export async function logUsage(
  data: Pick<
    NewChatUsageLog,
    | "userId"
    | "sessionId"
    | "conversationId"
    | "messageId"
    | "model"
    | "promptTokens"
    | "completionTokens"
    | "totalTokens"
    | "costUsd"
    | "latencyMs"
    | "errorCode"
    | "ipAddress"
    | "userAgent"
  >,
): Promise<void> {
  await db.insert(chatUsageLogs).values(data);
}
