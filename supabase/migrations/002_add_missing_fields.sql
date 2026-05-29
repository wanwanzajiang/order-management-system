-- ============================================
-- 补充缺失字段 - 数据库迁移脚本
-- ============================================

-- 1. 为 salespeople 表添加识别码字段
ALTER TABLE salespeople 
ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;

-- 为现有业务员生成默认识别码
UPDATE salespeople 
SET access_code = 'SP' || LPAD(id::TEXT, 3, '0')
WHERE access_code IS NULL;

-- 2. 为 orders 表添加缺失字段
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS inspection_date DATE,
ADD COLUMN IF NOT EXISTS return_date DATE,
ADD COLUMN IF NOT EXISTS bring_goods BOOLEAN,
ADD COLUMN IF NOT EXISTS photo_request BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS file_ids JSONB DEFAULT '[]'::jsonb;

-- 3. 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_salespeople_access_code ON salespeople(access_code);
CREATE INDEX IF NOT EXISTS idx_orders_inspection_date ON orders(inspection_date);
CREATE INDEX IF NOT EXISTS idx_orders_return_date ON orders(return_date);
CREATE INDEX IF NOT EXISTS idx_orders_bring_goods ON orders(bring_goods);

-- 4. 更新 RLS 策略（如果需要）
-- 文件存储策略会在 Supabase Dashboard 中配置
