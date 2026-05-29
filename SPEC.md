# 订单管理系统 - 技术规格文档

## 1. 项目概述

### 项目名称
Order Management System (订单管理系统)

### 项目类型
前端静态网页 + Supabase 后端

### 核心功能
基于角色的订单管理系统，支持管理员、仓库人员和业务员三种角色，实现订单的录入、查询、状态管理和权限隔离。

### 目标用户
- 管理员：负责订单录入和全部订单管理
- 仓库人员：负责订单状态更新和仓库备注填写
- 业务员：仅能查询本人订单

---

## 2. 技术栈

### 前端
- 纯 HTML5 + CSS3 + JavaScript (ES6+)
- 部署至 GitHub Pages
- 无框架依赖，轻量级实现

### 后端
- Supabase (PostgreSQL + Auth + Realtime)
- Row Level Security (RLS) 行级安全策略

### 认证方式
- Supabase Auth (邮箱/密码登录)
- 角色存储在 `user_profiles` 表

---

## 3. 数据库设计

### 表结构

#### 3.1 `user_profiles` (用户角色表)
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | UUID | PRIMARY KEY, REFERENCES auth.users(id) | 用户ID |
| email | TEXT | NOT NULL | 登录邮箱 |
| full_name | TEXT | | 用户姓名 |
| role | TEXT | NOT NULL, CHECK (role IN ('admin', 'warehouse', 'sales')) | 角色 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |

**RLS 策略：**
- 所有用户可读取自己的 profile
- 只有 admin 可读取所有 profiles
- 用户可更新自己的 profile (除了 role)
- 只有 admin 可设置/修改 role

#### 3.2 `orders` (订单表)
| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | BIGSERIAL | PRIMARY KEY | 订单ID |
| invoice_no | TEXT | NOT NULL, UNIQUE | 发票号（唯一） |
| product_model | TEXT | NOT NULL | 产品型号 |
| quantity | INTEGER | NOT NULL, CHECK (quantity > 0) | 数量 |
| order_status | TEXT | NOT NULL, DEFAULT '调货中', CHECK (order_status IN ('调货中', '路途中', '已到货', '已完结')) | 订单状态 |
| warehouse_notes | TEXT | | 仓库备注 |
| sales_notes | TEXT | | 业务员备注 |
| sales_id | UUID | NOT NULL, REFERENCES auth.users(id) | 所属业务员ID |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

**RLS 策略：**
- Admin：可读、可写（增删改查）所有订单
- Warehouse：可读所有订单，可更新 order_status 和 warehouse_notes，可删除 status='已完结' 的订单
- Sales：仅可读本人创建的订单（通过 sales_id 判断）

---

## 4. 角色权限矩阵

| 功能 | 管理员 | 仓库人员 | 业务员 |
|------|--------|----------|--------|
| 登录系统 | ✅ | ✅ | ✅ |
| 新增订单 | ✅ | ❌ | ❌ |
| 查看所有订单 | ✅ | ✅ | ❌ |
| 查看本人订单 | ✅ | ✅ | ✅ |
| 修改订单状态 | ✅ | ✅ | ❌ |
| 填写仓库备注 | ✅ | ✅ | ❌ |
| 填写业务员备注 | ✅ | ❌ | ❌ |
| 删除任何订单 | ✅ | ❌ | ❌ |
| 删除已完结订单 | ✅ | ✅ | ❌ |

---

## 5. 订单状态流转

```
调货中 → 路途中 → 已到货 → 已完结
```

- 状态修改权限：管理员、仓库人员
- 已完结订单可被仓库人员删除
- 业务员备注仅限管理员和业务员本人编辑

---

## 6. 界面设计

### 6.1 登录页面 (`login.html`)
- 邮箱输入框
- 密码输入框
- 登录按钮
- 错误提示区域
- 简洁的企业风格设计

### 6.2 管理员界面 (`admin.html`)
- 顶部导航栏（Logo、用户名、角色标识、退出按钮）
- 新增订单表单（发票号、产品型号、数量）
- 全部订单列表表格
- 支持删除订单操作
- 业务员备注编辑功能

### 6.3 仓库人员界面 (`warehouse.html`)
- 顶部导航栏
- 全部订单列表表格
- 订单状态修改下拉框
- 仓库备注编辑输入框
- 删除已完结订单按钮

### 6.4 业务员界面 (`sales.html`)
- 顶部导航栏
- 发票号查询输入框
- 本人订单列表（仅显示创建的订单）
- 仅查看功能，无编辑权限

---

## 7. 安全性要求

### 7.1 前端安全
- 登录状态存储在 sessionStorage
- 角色信息存储在 sessionStorage
- 页面加载时验证登录状态，未登录重定向至登录页
- 前端根据角色动态显示/隐藏功能按钮

### 7.2 后端安全 (RLS)
- 所有表启用 RLS
- Supabase Auth 验证用户身份
- RLS 策略精确定义每种角色的数据访问权限
- 业务员无法通过 API 直接访问他人订单

### 7.3 越权防护
- 管理员使用 service_role key（仅限服务端）
- 前端使用 anon key（受 RLS 限制）
- 所有敏感操作经 RLS 验证

---

## 8. 文件结构

```
/
├── login.html          # 登录页面
├── admin.html          # 管理员页面
├── warehouse.html      # 仓库人员页面
├── sales.html          # 业务员页面
├── css/
│   └── style.css       # 全局样式
├── js/
│   ├── config.js       # Supabase 配置
│   ├── auth.js         # 认证模块
│   ├── api.js          # API 调用模块
│   └── app.js          # 主应用逻辑
└── supabase/
    └── migrations/
        └── 001_initial_schema.sql  # 数据库初始化脚本
```

---

## 9. 部署

### GitHub Pages 部署
1. 创建 GitHub 仓库
2. 将静态文件推送至 `gh-pages` 分支
3. 在仓库 Settings → Pages 中启用 GitHub Pages
4. 访问 `https://username.github.io/repo-name/`

### 环境变量
- `SUPABASE_URL`: Supabase 项目地址
- `SUPABASE_ANON_KEY`: Supabase Anon Key (公开)

---

## 10. 验收标准

### 功能验收
- [ ] 用户可使用邮箱密码登录
- [ ] 管理员可新增订单
- [ ] 管理员可查看所有订单
- [ ] 管理员可删除任何订单
- [ ] 仓库人员可修改订单状态
- [ ] 仓库人员可填写仓库备注
- [ ] 仓库人员可删除已完结订单
- [ ] 业务员可通过发票号查询本人订单
- [ ] 业务员无法查看他人订单
- [ ] 业务员无法编辑或删除订单

### 安全验收
- [ ] 未登录用户访问其他页面被重定向至登录页
- [ ] 业务员通过直接 URL 访问管理员页面被拒绝
- [ ] 业务员无法通过 API 获取他人订单
- [ ] RLS 策略正确实施

### 界面验收
- [ ] 登录页面正常显示
- [ ] 各角色界面正确显示对应功能
- [ ] 错误提示信息清晰
