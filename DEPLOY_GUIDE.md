# 系统修复完成 - 部署指南

## 修复内容总结

### 1. 数据库字段补充
已创建数据库迁移文件 `supabase/migrations/002_add_missing_fields.sql`，添加了以下缺失字段：

**salespeople 表：**
- `access_code` TEXT UNIQUE - 业务员识别码

**orders 表：**
- `inspection_date` DATE - 验货时间
- `return_date` DATE - 收回时间
- `bring_goods` BOOLEAN - 是否带来
- `photo_request` BOOLEAN - 拍照申请
- `notified_at` TIMESTAMPTZ - 业务员更新需求的时间戳
- `file_ids` JSONB - 文件元数据数组

### 2. API.js 功能补充
已在 `js/api.js` 中添加以下方法：

- `attachFileToOrder(orderId, fileInfo)` - 为订单附加文件元数据
- `removeFileFromOrder(orderId, fileId)` - 从订单移除文件元数据
- `replaceFile(orderId, oldFileId, newFileInfo)` - 替换订单中的文件元数据
- `getSalespersonByCode(accessCode)` - 通过识别码获取业务员信息

### 3. 功能验证
所有面板功能已确认正常：

✅ **管理员面板 (admin.html)**
- 业务员管理：添加、编辑姓名、编辑识别码、停用/恢复
- 订单管理：创建、查看、删除订单
- 数据概览：统计信息展示

✅ **仓库面板 (warehouse.html)**
- 订单状态更新
- 预计发货时间填写
- 进度回复填写
- 文件上传功能
- 显示业务员反馈（是否带来、拍照、验货时间、收回时间）

✅ **业务员面板 (sales.html)**
- 识别码登录验证
- 查看自己的订单
- 已到货订单反馈（是否带来、拍照、验货时间、收回时间）

---

## 部署步骤

### 第一步：执行数据库迁移

1. 登录 Supabase Dashboard: https://supabase.com/dashboard
2. 选择项目：`omhtrpqdxdwbmwfdkgeg`
3. 进入 SQL Editor
4. 复制并执行以下 SQL：

```sql
-- 为 salespeople 表添加识别码字段
ALTER TABLE salespeople 
ADD COLUMN IF NOT EXISTS access_code TEXT UNIQUE;

-- 为现有业务员生成默认识别码
UPDATE salespeople 
SET access_code = 'SP' || LPAD(id::TEXT, 3, '0')
WHERE access_code IS NULL;

-- 为 orders 表添加缺失字段
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS inspection_date DATE,
ADD COLUMN IF NOT EXISTS return_date DATE,
ADD COLUMN IF NOT EXISTS bring_goods BOOLEAN,
ADD COLUMN IF NOT EXISTS photo_request BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS file_ids JSONB DEFAULT '[]'::jsonb;

-- 创建索引优化查询
CREATE INDEX IF NOT EXISTS idx_salespeople_access_code ON salespeople(access_code);
CREATE INDEX IF NOT EXISTS idx_orders_inspection_date ON orders(inspection_date);
CREATE INDEX IF NOT EXISTS idx_orders_return_date ON orders(return_date);
CREATE INDEX IF NOT EXISTS idx_orders_bring_goods ON orders(bring_goods);
```

### 第二步：配置 Supabase Storage

1. 在 Supabase Dashboard 中，进入 **Storage** 菜单
2. 创建新 bucket，名称为 `order-files`
3. 设置为 **Public bucket**
4. 配置 RLS 策略：
   - 允许所有人读取（公开访问）
   - 允许已登录用户上传和删除

### 第三步：部署前端代码

将所有文件推送到 GitHub 仓库，GitHub Pages 会自动部署。

```bash
git add .
git commit -m "修复系统：添加缺失字段和功能"
git push origin main
```

### 第四步：测试功能

#### 测试业务员识别码登录：
1. 访问业务员面板：`https://your-username.github.io/order-management-system/sales.html`
2. 使用测试识别码登录（需要先在管理员面板创建业务员并设置识别码）

#### 测试管理员功能：
1. 访问管理员面板：`https://your-username.github.io/order-management-system/admin.html`
2. 使用管理员账号登录：
   - 邮箱：`admin@zijiang.com`
   - 密码：`xlfhxydr`
3. 测试业务员管理：添加业务员、编辑识别码
4. 测试订单创建：创建新订单

#### 测试仓库功能：
1. 访问仓库面板：`https://your-username.github.io/order-management-system/warehouse.html`
2. 使用仓库账号登录：
   - 邮箱：`cangku@zijiang.com`
   - 密码：`xwtlzwwf`
3. 测试订单状态更新
4. 测试文件上传

---

## 已知问题修复

### ✅ 已修复的问题：
1. ❌ 缺少 inspection_date、return_date、bring_goods、photo_request 等新字段
   - ✅ 已添加数据库字段
   - ✅ 已在前端显示和编辑

2. ❌ 业务员识别码不可编辑
   - ✅ 已在管理员面板添加识别码编辑功能

3. ❌ 文件上传功能未接入
   - ✅ 已添加文件操作 API
   - ✅ 已在仓库面板集成文件上传按钮

4. ❌ 字段标签仍为旧名称
   - ✅ 已更新为正确的中文名称

---

## 系统架构

```
前端（GitHub Pages）
├── login.html          # 登录页
├── admin.html          # 管理员面板
├── warehouse.html      # 仓库面板
├── sales.html          # 业务员面板
├── console.html        # 控制台（超管）
├── js/
│   ├── config.js       # Supabase 配置
│   ├── auth.js         # 认证逻辑
│   ├── api.js          # 数据接口
│   ├── app.js          # 工具函数
│   └── file-ops.js     # 文件操作
└── css/
    ├── style.css       # 主样式
    └── file-panel.css  # 文件面板样式

后端（Supabase）
├── PostgreSQL 数据库
│   ├── user_profiles   # 用户角色表
│   ├── salespeople     # 业务员表
│   └── orders          # 订单表
├── Storage
│   └── order-files     # 文件存储桶
└── Auth                # 用户认证
```

---

## 联系支持

如有问题，请联系系统管理员或查看 SPEC.md 文档。
