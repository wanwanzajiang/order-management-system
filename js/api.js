const API = {
  // 订单
  async getOrders(filters = {}) {
    let q = SUPABASE.from('orders').select('*').order('created_at', { ascending: false });
    if (filters.status) q = q.eq('order_status', filters.status);
    if (filters.salesperson) q = q.eq('salesperson_name', filters.salesperson);
    const { data, error } = await q;
    return { data, error };
  },

  async createOrder(order) {
    return await SUPABASE.from('orders').insert(order).select().single();
  },

  async updateOrder(id, updates) {
    return await SUPABASE.from('orders').update(updates).eq('id', id);
  },

  async deleteOrder(id) {
    return await SUPABASE.from('orders').delete().eq('id', id);
  },

  async getOrderStats() {
    const { data } = await SUPABASE.from('orders').select('order_status,salesperson_name');
    if (!data) return { total: 0, by_status: {}, by_sales: [] };
    const by_status = {}; const by_sales = {};
    data.forEach(o => {
      by_status[o.order_status] = (by_status[o.order_status] || 0) + 1;
      by_sales[o.salesperson_name] = (by_sales[o.salesperson_name] || 0) + 1;
    });
    return {
      total: data.length,
      by_status,
      by_sales: Object.entries(by_sales).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
    };
  },

  // 业务员
  async getSalespeople() {
    const { data } = await SUPABASE.from('salespeople').select('*').eq('is_active', true).order('name');
    return data || [];
  },

  async addSalesperson(name, access_code) {
    return await SUPABASE.from('salespeople').insert({ name, access_code, is_active: true }).select().single();
  },

  async updateSalesperson(id, updates) {
    return await SUPABASE.from('salespeople').update(updates).eq('id', id);
  },

  // 用户
  async getUsers() {
    const { data } = await SUPABASE.from('user_profiles').select('id,email,role').order('email');
    return data || [];
  },

  async updateUserRole(id, role) {
    return await SUPABASE.from('user_profiles').update({ role }).eq('id', id);
  },

  // 文件
  async attachFile(orderId, meta) {
    const { data: order } = await SUPABASE.from('orders').select('file_ids').eq('id', orderId).single();
    const files = Array.isArray(order?.file_ids) ? [...order.file_ids] : [];
    files.push({ ...meta, uploaded_at: new Date().toISOString() });
    return await SUPABASE.from('orders').update({ file_ids: files }).eq('id', orderId);
  },

  async replaceFile(orderId, oldId, meta) {
    const { data: order } = await SUPABASE.from('orders').select('file_ids').eq('id', orderId).single();
    let files = Array.isArray(order?.file_ids) ? order.file_ids : [];
    files = files.filter(f => (typeof f === 'string' ? f : f.id) !== oldId);
    files.push({ ...meta, uploaded_at: new Date().toISOString() });
    return await SUPABASE.from('orders').update({ file_ids: files }).eq('id', orderId);
  },

  async removeFile(orderId, fileId) {
    const { data: order } = await SUPABASE.from('orders').select('file_ids').eq('id', orderId).single();
    const files = Array.isArray(order?.file_ids) ? order.file_ids.filter(f => (typeof f === 'string' ? f : f.id) !== fileId) : [];
    return await SUPABASE.from('orders').update({ file_ids: files }).eq('id', orderId);
  }
};
