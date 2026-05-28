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

-- 2. 创建订单表
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    invoice_no TEXT NOT NULL UNIQUE,
    product_model TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    order_status TEXT NOT NULL DEFAULT '调货中' CHECK (order_status IN ('调货中', '路途中', '已到货', '已完结')),
    warehouse_notes TEXT,
    sales_notes TEXT,
    sales_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建索引
CREATE INDEX IF NOT EXISTS idx_orders_sales_id ON orders(sales_id);
CREATE INDEX IF NOT EXISTS idx_orders_invoice_no ON orders(invoice_no);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- ============================================
-- RLS (Row Level Security) 策略
-- ============================================

-- 启用 RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------
-- user_profiles 表的 RLS 策略
-- -------------------------------------------

-- 允许用户读取自己的 profile
CREATE POLICY "users_can_read_own_profile"
    ON user_profiles FOR SELECT
    USING (auth.uid() = id);

-- 允许管理员读取所有 profiles
CREATE POLICY "admins_can_read_all_profiles"
    ON user_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 允许用户更新自己的 profile（但不能修改 role）
CREATE POLICY "users_can_update_own_profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 允许管理员更新任何用户的 profile（包括 role）
CREATE POLICY "admins_can_update_any_profile"
    ON user_profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 允许管理员插入用户 profile
CREATE POLICY "admins_can_insert_profile"
    ON user_profiles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
        OR auth.uid() = id
    );

-- -------------------------------------------
-- orders 表的 RLS 策略
-- -------------------------------------------

-- 管理员：可读所有订单
CREATE POLICY "admins_can_read_all_orders"
    ON orders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 仓库人员：可读所有订单
CREATE POLICY "warehouse_can_read_all_orders"
    ON orders FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'warehouse'
        )
    );

-- 业务员：仅可读本人订单（sales_id = auth.uid()）
CREATE POLICY "sales_can_read_own_orders"
    ON orders FOR SELECT
    USING (sales_id = auth.uid());

-- 管理员：可插入订单
CREATE POLICY "admins_can_insert_orders"
    ON orders FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 管理员：可更新任何订单
CREATE POLICY "admins_can_update_all_orders"
    ON orders FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 仓库人员：可更新 order_status 和 warehouse_notes
CREATE POLICY "warehouse_can_update_orders"
    ON orders FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'warehouse'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'warehouse'
        )
        AND (order_status = ANY(ARRAY['调货中', '路途中', '已到货', '已完结']))
    );

-- 仓库人员：可删除已完结订单
CREATE POLICY "warehouse_can_delete_completed_orders"
    ON orders FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'warehouse'
        )
        AND order_status = '已完结'
    );

-- 管理员：可删除任何订单
CREATE POLICY "admins_can_delete_any_orders"
    ON orders FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

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

-- ============================================
-- 初始数据：创建测试用户（可选）
-- 注释掉以下内容，在 Supabase Dashboard 中手动创建
-- ============================================
-- INSERT INTO auth.users (email, encrypted_password)
-- VALUES ('admin@example.com', 'hashed_password_here');
