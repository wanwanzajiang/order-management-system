// 超管专用：使用 service_role key 操作账号（仅控制台加载）
// 注意：此文件仅在 console.html 加载，普通用户看不到

const AdminAPI = {
  _client: null,
  _getClient() {
    if (!this._client) {
      this._client = window.supabase.createClient(
        CONFIG.SUPABASE_URL,
        CONFIG.SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } }
      );
    }
    return this._client;
  },

  async createUser(email, password, role) {
    const client = this._getClient();
    const { data, error } = await client.auth.admin.createUser({
      email, password, email_confirm: true
    });
    if (error) return { error };
    // 设置角色
    await client.from('user_profiles').upsert({
      id: data.user.id, email, role
    });
    return { data };
  },

  async deleteUser(userId) {
    const client = this._getClient();
    const { error } = await client.auth.admin.deleteUser(userId);
    return { error };
  },

  async resetPassword(userId, newPassword) {
    const client = this._getClient();
    const { error } = await client.auth.admin.updateUserById(userId, {
      password: newPassword
    });
    return { error };
  }
};
