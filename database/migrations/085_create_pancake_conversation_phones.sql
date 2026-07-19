-- Migration 085: Map Pancake conversation_id → phone (extension multi-device sync)
-- Key ổn định dạng pageId_threadId (vd. 821625704326996_1590464469454703)

CREATE TABLE IF NOT EXISTS pancake_conversation_phones (
    conversation_id TEXT PRIMARY KEY NOT NULL,
    phone TEXT NOT NULL,
    source TEXT DEFAULT 'extension',
    page_id TEXT,
    created_at_unix INTEGER NOT NULL,
    updated_at_unix INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pancake_conv_phones_phone
    ON pancake_conversation_phones(phone);

CREATE INDEX IF NOT EXISTS idx_pancake_conv_phones_updated
    ON pancake_conversation_phones(updated_at_unix);
