// 超管专用：使用 service_role key 操作账号（仅控制台加载）
// 直接调 Supabase Auth Admin REST API，确保可用

const AdminAPI = {
  _headers() {
    return {
      'Authorization': `Bearer ${CONFIG.SERVICE_ROLE_KEY}`,
      'apikey': CONFIG.SERVICE_ROLE_KEY,
      'Content-Type': 'application/json'
    };
  },

  async createUser(email, password, role) {
    try {
      // 1. 创建 auth 用户
      const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ email, password, email_confirm: true })
      });
      const data = await res.json();
      if (!res.ok) return { error: { message: data.msg || data.message || '创建失败' } };

      // 2. 设置角色
      await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/user_profiles`, {
        method: 'POST',
        headers: { ...this._headers(), 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({ id: data.id, email, role })
      });

      return { data: { user: data } };
    } catch(e) { return { error: { message: e.message } }; }
  },

  async deleteUser(userId) {
    try {
      const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: this._headers()
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { error: { message: data.msg || '删除失败' } };
      }
      return {};
    } catch(e) { return { error: { message: e.message } }; }
  },

  async resetPassword(userId, newPassword) {
    try {
      const res = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: this._headers(),
        body: JSON.stringify({ password: newPassword })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { error: { message: data.msg || data.message || '重置失败' } };
      }
      return {};
    } catch(e) { return { error: { message: e.message } }; }
  }
};
