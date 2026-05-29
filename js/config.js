const CONFIG = {
  TCB_ENV: 'wanwan-d2gafa9gobac0b79b',
  TCB_REGION: 'ap-shanghai',
  SUPABASE_URL: 'https://nlcudhwgnoljaxmzdiki.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sY3VkaHdnbm9samF4bXpkaWtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMjY1NjcsImV4cCI6MjA5NTYwMjU2N30.fHXfSik9Zybyg8XhSTCyQMfpNhUJnMWy93MqEKQ6sVU',
  SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sY3VkaHdnbm9samF4bXpkaWtpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDAyNjU2NywiZXhwIjoyMDk1NjAyNTY3fQ.xBq9MrQx1q-NU8qqV_9tCh7YlmlAJ84A7VSAkhDpOHM',
  ROLES: {
    SUPER: 'super_admin',
    ADMIN: 'admin',
    WAREHOUSE: 'warehouse',
    SALES: 'sales'
  },
  ROLE_NAMES: {
    super_admin: '超级管理员',
    admin: '管理员',
    warehouse: '仓库人员',
    sales: '业务员'
  },
  ORDER_STATUSES: ['调货中', '路途中', '已到货', '已完结']
};

const SUPABASE = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
