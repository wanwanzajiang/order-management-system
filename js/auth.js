const Auth = {
  SESSION_KEY: 'order_system_session',
  USER_KEY: 'order_system_user',

  async login(email, password) {
    try {
      const { data, error } = await SUPABASE.auth.signInWithPassword({ email, password });
      if (error) return { success: false, error: error.message };

      let { data: profile } = await SUPABASE.from('user_profiles').select('role,full_name').eq('id', data.user.id).single();
      if (!profile) profile = { role: 'sales', full_name: null };

      const session = {
        access_token: data.session.access_token,
        user: { id: data.user.id, email: data.user.email, role: profile.role, full_name: profile.full_name || email.split('@')[0] }
      };
      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      sessionStorage.setItem(this.USER_KEY, JSON.stringify(session.user));
      return { success: true, user: session.user };
    } catch (e) {
      return { success: false, error: '登录失败: ' + (e.message || '网络错误') };
    }
  },

  async logout() {
    await SUPABASE.auth.signOut().catch(() => {});
    sessionStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.USER_KEY);
    window.location.href = 'login.html';
  },

  getSession() {
    try { return JSON.parse(sessionStorage.getItem(this.SESSION_KEY)); } catch { return null; }
  },

  getUser() {
    try { return JSON.parse(sessionStorage.getItem(this.USER_KEY)); } catch { return null; }
  },

  isLoggedIn() { return !!this.getSession(); },

  requireAuth() {
    if (!this.isLoggedIn()) { window.location.href = 'login.html'; return false; }
    return true;
  },

  requireRole(roles) {
    if (!this.requireAuth()) return false;
    const user = this.getUser();
    if (!roles.includes(user.role)) { alert('无权限访问'); this.redirectByRole(); return false; }
    return true;
  },

  redirectByRole() {
    const user = this.getUser();
    if (!user) { window.location.href = 'login.html'; return; }
    const map = { super_admin: 'admin.html', admin: 'admin.html', warehouse: 'warehouse.html', sales: 'sales.html' };
    window.location.href = map[user.role] || 'login.html';
  },

  getRoleName(role) { return CONFIG.ROLE_NAMES[role] || role; }
};
