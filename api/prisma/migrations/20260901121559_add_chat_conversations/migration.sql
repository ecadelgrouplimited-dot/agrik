-- CreateTable
CREATE TABLE "chat_conversations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New conversation',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chat_conversations_user_id_idx" ON "chat_conversations"("user_id");

-- AddForeignKey
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN "conversation_id" TEXT;

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_idx" ON "chat_messages"("conversation_id");

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "chat_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: group each user's existing (pre-migration) messages into one
-- conversation per user, titled from their earliest message, so no chat
-- history is orphaned by this migration.
INSERT INTO "chat_conversations" ("id", "user_id", "title", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  sub."user_id",
  COALESCE(NULLIF(LEFT(sub."first_message", 60), ''), 'Chat history'),
  sub."min_created",
  sub."max_created"
FROM (
  SELECT DISTINCT ON (m."user_id")
    m."user_id",
    m."message" AS "first_message",
    MIN(m."created_at") OVER (PARTITION BY m."user_id") AS "min_created",
    MAX(m."created_at") OVER (PARTITION BY m."user_id") AS "max_created"
  FROM "chat_messages" m
  WHERE m."conversation_id" IS NULL
  ORDER BY m."user_id", m."created_at" ASC
) sub;

-- Attach every previously-orphaned message to its user's new legacy conversation.
UPDATE "chat_messages" m
SET "conversation_id" = c."id"
FROM "chat_conversations" c
WHERE m."conversation_id" IS NULL
  AND c."user_id" = m."user_id";
