const Auth = {
  SESSION_KEY: 'order_system_session',
  USER_KEY: 'order_system_user',

  async login(email, password) {
    try {
      const { data, error } = await SUPABASE.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { success: false, error: error.message };
      }

      const { data: profile, error: profileError } = await SUPABASE
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        await SUPABASE.auth.signOut();
        return { success: false, error: '获取用户信息失败' };
      }

      const session = {
        access_token: data.session.access_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          role: profile.role,
          full_name: profile.full_name || data.user.email.split('@')[0]
        }
      };

      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      sessionStorage.setItem(this.USER_KEY, JSON.stringify(session.user));

      return { success: true, user: session.user };
    } catch (err) {
      return { success: false, error: '登录失败，请检查网络连接' };
    }
  },

  async logout() {
    await SUPABASE.auth.signOut();
    sessionStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.USER_KEY);
    window.location.href = 'login.html';
  },

  getSession() {
    const sessionStr = sessionStorage.getItem(this.SESSION_KEY);
    if (!sessionStr) return null;
    try {
      return JSON.parse(sessionStr);
    } catch {
      return null;
    }
  },

  getUser() {
    const userStr = sessionStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  isLoggedIn() {
    return this.getSession() !== null;
  },

  isAdmin() {
    const user = this.getUser();
    return user && user.role === CONFIG.ROLES.ADMIN;
  },

  isWarehouse() {
    const user = this.getUser();
    return user && user.role === CONFIG.ROLES.WAREHOUSE;
  },

  isSales() {
    const user = this.getUser();
    return user && user.role === CONFIG.ROLES.SALES;
  },

  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  },

  requireRole(roles) {
    if (!this.requireAuth()) return false;
    const user = this.getUser();
    if (!roles.includes(user.role)) {
      alert('您没有权限访问此页面');
      this.redirectByRole();
      return false;
    }
    return true;
  },

  redirectByRole() {
    const user = this.getUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }
    switch (user.role) {
      case CONFIG.ROLES.ADMIN:
        window.location.href = 'admin.html';
        break;
      case CONFIG.ROLES.WAREHOUSE:
        window.location.href = 'warehouse.html';
        break;
      case CONFIG.ROLES.SALES:
        window.location.href = 'sales.html';
        break;
      default:
        window.location.href = 'login.html';
    }
  }
};
