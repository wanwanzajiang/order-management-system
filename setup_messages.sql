-- ============================================
-- 订单留言系统 - 数据库初始化脚本
-- 请在 Supabase Dashboard → SQL Editor 中执行
-- ============================================

-- 1. 留言表
DROP TABLE IF EXISTS order_messages CASCADE;

CREATE TABLE order_messages (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  author_role TEXT NOT NULL CHECK (author_role IN ('sales','warehouse','admin','super_admin')),
  author_name TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_msg_order ON order_messages(order_id, created_at DESC);
CREATE INDEX idx_msg_unread ON order_messages(order_id) WHERE is_read = FALSE AND author_role = 'sales';

ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY msg_select ON order_messages FOR SELECT USING (TRUE);
CREATE POLICY msg_insert ON order_messages FOR INSERT WITH CHECK (TRUE);
CREATE POLICY msg_update ON order_messages FOR UPDATE USING (TRUE);
CREATE POLICY msg_delete ON order_messages FOR DELETE USING (TRUE);
