# 进度回复系统 - 项目记忆

## 最新架构（2026-05-29）
- **Supabase**: 认证 + PostgreSQL数据库 + Edge Functions
  - 项目: wanwanzi (nlcudhwgnoljaxmzdiki)
  - 表: user_profiles, salespeople, orders
- **腾讯云开发**: 文件存储 + CDN
  - 环境: wanwan-d2gafa9gobac0b79b
- **前端**: GitHub Pages静态托管

## orders 表字段
- invoice_no（到款单号）, order_date, brand, product_model, quantity
- delivery_date, order_status（调货中→路途中→已到货→已完结）
- shipping_date（预计发货时间）, warehouse_notes（进度回复）
- salesperson_name, inspection_date（验货时间）, return_date（收回时间）
- file_ids（云开发文件ID数组）
- 已删除: tracking_no（快递单号）, sales_notes（业务员备注）

## 技术约定
- 纯前端静态HTML，无构建工具
- CDN引入: supabase-js@2
- 玻璃半透明泡泡风格UI (#fdfbf7背景, #e07a5f强调色)
- 角色: super_admin/admin/warehouse/sales

## 文件功能
- 仓库端上传照片/视频到订单
- 业务员下载自己订单的文件
- 文件走云开发CDN，不消耗Supabase带宽
