const CONFIG = {
  SUPABASE_URL: 'https://omhtrpqdxdwbmwfdkgeg.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taHRycHFkeGR3Ym13ZmRrZ2VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTM4MTIsImV4cCI6MjA5NTQyOTgxMn0.N0jQCl0YoTH21nnrrVpn1nDRPVd4PPb5N9beRCTUx9s',
  SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9taHRycHFkeGR3Ym13ZmRrZ2VnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg1MzgxMiwiZXhwIjoyMDk1NDI5ODEyfQ.edhon60BVpLPJSZ7tWnB1XgA4KRTCJUqshHuFuDxlAo',
  ROLES: {
    ADMIN: 'admin',
    WAREHOUSE: 'warehouse',
    SALES: 'sales'
  },
  ROLE_NAMES: {
    admin: '管理员',
    warehouse: '仓库人员',
    sales: '业务员'
  },
  ORDER_STATUSES: ['调货中', '路途中', '已到货', '已完结']
};

const SUPABASE = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
