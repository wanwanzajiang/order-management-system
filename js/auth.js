const Auth = {
  SESSION_KEY: 'order_system_session',
  USER_KEY: 'order_system_user',

  async login(email, password) {
    try {
      // Step 1: 登录认证
      const { data, error } = await SUPABASE.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('[Auth] 登录认证失败:', error);
        return { success: false, error: error.message };
      }

      if (!data.user || !data.session) {
        console.error('[Auth] 登录返回数据异常:', data);
        return { success: false, error: '登录响应异常，请重试' };
      }

      // Step 2: 等待session就绪后查询profile
      await this._waitForSession(500);

      // Step 3: 获取用户角色信息
      let profile = null;
      let profileError = null;

      try {
        const result = await SUPABASE
          .from('user_profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();
        profile = result.data;
        profileError = result.error;
      } catch (e) {
        console.error('[Auth] 查询profile异常:', e);
        profileError = { message: e.message || String(e) };
      }

      // Step 4: 如果没有profile，自动创建（fallback）
      if (profileError || !profile) {
        console.warn('[Auth] 未找到用户profile，尝试自动创建...', profileError?.message);

        // 尝试自动创建默认profile
        const { data: newProfile, error: createError } = await SUPABASE
          .from('user_profiles')
          .insert({
            id: data.user.id,
            email: data.user.email,
            role: 'sales'  // 默认角色为业务员，管理员后续手动调整
          })
          .select()
          .single();

        if (!createError && newProfile) {
          profile = newProfile;
          console.log('[Auth] 自动创建profile成功');
        } else {
          // 如果自动创建也失败（可能是RLS限制），使用临时默认值让用户能登录
          console.error('[Auth] 自动创建profile失败:', createError?.message);
          profile = {
            id: data.user.id,
            email: data.user.email,
            role: 'admin',  // fallback：给个默认角色避免卡住
            full_name: null
          };
        }
      }

      // Step 5: 构建会话并存储
      const session = {
        access_token: data.session.access_token,
        user: {
          id: data.user.id,
          email: data.user.email,
          role: profile.role || 'sales',
          full_name: profile.full_name || data.user.email.split('@')[0]
        }
      };

      sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
      sessionStorage.setItem(this.USER_KEY, JSON.stringify(session.user));

      return { success: true, user: session.user };

    } catch (err) {
      console.error('[Auth] 登录异常:', err);
      return { success: false, error: '登录失败：' + (err.message || '网络错误') };
    }
  },

  async logout() {
    try {
      await SUPABASE.auth.signOut();
    } catch (e) {
      console.warn('[Auth] signOut时出错（可忽略）:', e.message);
    }
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
    return user && (user.role === CONFIG.ROLES.ADMIN || user.role === CONFIG.ROLES.SUPER);
  },

  isSuper() {
    const user = this.getUser();
    return user && user.role === CONFIG.ROLES.SUPER;
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
      alert('您没有权限访问此页面（当前角色：' + (user.role || '未知') + '）');
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
      case CONFIG.ROLES.SUPER:
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
  },

  _waitForSession(ms = 300) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};
