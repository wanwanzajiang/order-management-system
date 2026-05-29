# 进度回复系统 - 技术规格文档

## 1. 项目概述

### 项目名称
进度回复系统

### 项目类型
前端静态网页 + Supabase 后端 + 腾讯云开发存储

### 核心功能
基于角色的订单进度回复系统，支持管理员、仓库人员和业务员三种角色，实现订单的录入、查询、状态管理、文件管理和权限隔离。

### 目标用户
- 管理员：负责订单录入和全部进度管理
- 仓库人员：负责订单状态更新和进度回复填写、文件上传
- 业务员：查询本人订单、填写验货/收回时间、下载文件

---

## 2. 技术栈

### 前端
- 纯 HTML5 + CSS3 + JavaScript (ES6+)
- 部署至 GitHub Pages
- 无框架依赖，轻量级实现

### 后端
- Supabase (PostgreSQL + Auth + Edge Functions)

### 文件存储
- 腾讯云开发云存储 + CDN

### 认证方式
- Supabase Auth (邮箱/密码登录)

---

## 3. 数据库设计

#### `orders` 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL PK | 订单ID |
| invoice_no | TEXT UNIQUE | 到款单号 |
| order_date | DATE | 单据日期 |
| brand | TEXT | 品牌 |
| product_model | TEXT | 产品型号 |
| quantity | INTEGER | 数量 |
| delivery_date | TEXT | 合同货期 |
| order_status | TEXT | 状态：调货中/路途中/已到货/已完结 |
| shipping_date | DATE | 预计发货时间 |
| warehouse_notes | TEXT | 进度回复 |
| salesperson_name | TEXT | 业务员姓名 |
| inspection_date | DATE | 验货时间（业务员选填） |
| return_date | DATE | 收回时间（业务员选填） |
| file_ids | TEXT[] | 云开发文件ID数组 |
| created_at | TIMESTAMPTZ | 创建时间 |
| updated_at | TIMESTAMPTZ | 更新时间 |

## 4. 角色权限矩阵

| 功能 | 管理员 | 仓库人员 | 业务员 |
|------|--------|----------|--------|
| 登录系统 | ✅ | ✅ | ✅ |
| 新增订单 | ✅ | ❌ | ❌ |
| 查看所有订单 | ✅ | ✅ | ❌ |
| 查看本人订单 | ✅ | ✅ | ✅ |
| 修改订单状态 | ✅ | ✅ | ❌ |
| 填写进度回复 | ✅ | ✅ | ❌ |
| 填写验货时间 | ✅ | ❌ | ✅ |
| 填写收回时间 | ✅ | ❌ | ✅ |
| 上传文件 | ✅ | ✅ | ❌ |
| 下载文件 | ✅ | ✅ | ✅(仅本人) |
| 删除订单 | ✅ | ❌ | ❌ |

## 5. 订单状态流转

调货中 → 路途中 → 已到货 → 已完结

## 6. 文件结构

```
/
├── login.html
├── admin.html
├── warehouse.html
├── sales.html
├── console.html
├── css/
│   ├── style.css
│   └── file-panel.css
├── js/
│   ├── config.js
│   ├── auth.js
│   ├── api.js
│   ├── app.js
│   └── file-ops.js
├── cloudbase/
│   └── functions/media-auth/
├── supabase/
│   ├── functions/file-operations/
│   └── migrations/001_initial_schema.sql
```
