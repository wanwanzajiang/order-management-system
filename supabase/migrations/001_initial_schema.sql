-- ============================================
-- 进度回复系统 - 数据库初始化脚本
-- 项目：wanwanzi (nlcudhwgnoljaxmzdiki)
-- ============================================

-- 1. 创建用户角色表
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'warehouse', 'sales', 'super_admin')) DEFAULT 'sales',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 创建业务员姓名表（独立于用户账号）
CREATE TABLE IF NOT EXISTS salespeople (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建订单表
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    invoice_no TEXT NOT NULL UNIQUE,       -- 到款单号（前端标签）
    order_date DATE,                        -- 单据日期
    brand TEXT,                             -- 品牌
    product_model TEXT NOT NULL,            -- 产品型号
    quantity INTEGER NOT NULL CHECK (quantity >= 0),
    delivery_date TEXT,                     -- 合同货期
    order_status TEXT DEFAULT '调货中' CHECK (order_status IN ('调货中', '路途中', '已到货', '已完结')),
    shipping_date DATE,                     -- 预计发货时间（前端标签）
    warehouse_notes TEXT,                   -- 进度回复（前端标签）
    salesperson_name TEXT,                  -- 业务员姓名
    sales_id UUID,                          -- 业务员ID（保留兼容）
    inspection_date DATE,                   -- 验货时间（业务员选填）
    return_date DATE,                       -- 收回时间（业务员选填）
    bring_goods BOOLEAN DEFAULT NULL,       -- 是否带来（已到货时业务员选择）
    photo_request BOOLEAN DEFAULT false,    -- 申请拍照（业务员需求）
    notified_at TIMESTAMPTZ DEFAULT NULL,   -- 业务员更新需求的时间（仓库通知铃用）
    file_ids JSONB DEFAULT '[]',           -- 文件元数据数组
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
-- RLS 策略 - 所有已登录用户可读写（内部系统）
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE salespeople ENABLE ROW LEVEL SECURITY;

-- user_profiles
CREATE POLICY "authenticated_can_read_profiles"
    ON user_profiles FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "users_can_insert_own_profile"
    ON user_profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "users_can_update_own_profile"
    ON user_profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- salespeople
CREATE POLICY "authenticated_can_read_salespeople"
    ON salespeople FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_manage_salespeople"
    ON salespeople FOR ALL
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

-- orders
CREATE POLICY "authenticated_can_read_orders"
    ON orders FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_insert_orders"
    ON orders FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_update_orders"
    ON orders FOR UPDATE
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "authenticated_can_delete_orders"
    ON orders FOR DELETE
    USING (auth.role() = 'authenticated');

-- ============================================
-- 触发器
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'sales');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
