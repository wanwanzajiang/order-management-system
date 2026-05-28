-- ============================================
-- 订单管理系统 - 数据库初始化脚本
-- ============================================

-- 1. 创建用户角色表
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'warehouse', 'sales')) DEFAULT 'sales',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建业务员姓名表（独立于用户账号）
CREATE TABLE IF NOT EXISTS salespeople (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建订单表（增强版）
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    invoice_no TEXT NOT NULL UNIQUE,
    order_date DATE,              -- 单据日期
    brand TEXT,                    -- 品牌
    product_model TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    delivery_date TEXT,            -- 合同货期/交期（自由文本，如"7天内"、"月底前"）
    order_status TEXT NOT NULL DEFAULT '调货中' CHECK (order_status IN ('调货中', '路途中', '已到货', '已完结')),
    shipping_date DATE,           -- 仓库发货时间（由仓库填写）
    tracking_no TEXT,             -- 快递单号（由仓库填写）
    warehouse_notes TEXT,
    sales_notes TEXT,
    salesperson_name TEXT,         -- 业务员姓名（关联salespeople.name）
    sales_id UUID,                 -- 保留兼容字段（允许为空）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 创建索引
CREATE INDEX IF NOT EXISTS idx_orders_sales_id ON orders(sales_id);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_no ON orders(invoice_no);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_orders_salesperson_name ON orders(salesperson_name);
CREATE INDEX IF NOT EXISTS idx_salespeople_name ON salespeople(name);

-- ============================================
-- RLS (Row Level Security) 策略
-- 设计原则：简洁明了，避免自引用导致无限递归
-- 所有已登录用户可读写所有数据（内部管理系统）
-- ============================================

-- 启用 RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE salespeople ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------
-- user_profiles 表的 RLS 策略
-- -------------------------------------------
-- 所有登录用户可读取用户信息
CREATE POLICY "authenticated_can_read_profiles"
    ON user_profiles FOR SELECT
    USING (auth.role() = 'authenticated');

-- 用户只能插入自己的 profile
CREATE POLICY "users_can_insert_own_profile"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- 用户只能更新自己的 profile
CREATE POLICY "users_can_update_own_profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- -------------------------------------------
-- salespeople 表的 RLS 策略
-- -------------------------------------------
-- 所有登录用户可读取业务员列表
CREATE POLICY "authenticated_can_read_salespeople"
    ON salespeople FOR SELECT
    USING (auth.role() = 'authenticated');

-- 所有登录用户可管理业务员（增删改）
CREATE POLICY "authenticated_can_manage_salespeople"
    ON salespeople FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- -------------------------------------------
-- orders 表的 RLS 简化策略
-- 所有已登录用户可完整 CRUD 操作
-- -------------------------------------------

-- 读取订单
CREATE POLICY "authenticated_can_read_orders"
    ON orders FOR SELECT
    USING (auth.role() = 'authenticated');

-- 新增订单
CREATE POLICY "authenticated_can_insert_orders"
    ON orders FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- 更新订单
CREATE POLICY "authenticated_can_update_orders"
    ON orders FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- 删除订单
CREATE POLICY "authenticated_can_delete_orders"
    ON orders FOR DELETE
    USING (auth.role() = 'authenticated');

-- ============================================
-- 触发器：自动更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 触发器：创建新用户时自动创建 profile
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'sales');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
