const API = {
  async getSalespeople(activeOnly = true) {
    let q = SUPABASE.from('salespeople').select('*').order('name');
    if (activeOnly) q = q.eq('is_active', true);
    const { data, error } = await q;
    return { data, error };
  },

  async addSalesperson(name, code) {
    return await SUPABASE.from('salespeople').insert({ name, access_code: code, is_active: true }).select().single();
  },

  async toggleSalesperson(id, active) {
    return await SUPABASE.from('salespeople').update({ is_active: active }).eq('id', id);
  },

  async getOrders(filters = {}) {
    let q = SUPABASE.from('orders').select('*').order('created_at', { ascending: false });
    if (filters.status) q = q.eq('order_status', filters.status);
    if (filters.sp) q = q.eq('salesperson_name', filters.sp);
    if (filters.invoice) q = q.ilike('invoice_no', '%' + filters.invoice + '%');
    const { data, error } = await q;
    return { data, error };
  },

  async createOrder(order) {
    return await SUPABASE.from('orders').insert({
      invoice_no: order.invoice_no, order_date: order.order_date || null,
      brand: order.brand || null, product_model: order.product_model,
      quantity: order.quantity || 1, delivery_date: order.delivery_date || null,
      salesperson_name: order.salesperson_name
    }).select().single();
  },

  async updateOrder(id, updates) {
    return await SUPABASE.from('orders').update(updates).eq('id', id).select().single();
  },

  async deleteOrder(id) {
    return await SUPABASE.from('orders').delete().eq('id', id);
  },

  async getOrderStats() {
    const { count: total } = await SUPABASE.from('orders').select('*', { count: 'exact', head: true });
    const statuses = ['调货中', '路途中', '已到货', '已完结'];
    const sc = {};
    for (const s of statuses) {
      const { count } = await SUPABASE.from('orders').select('*', { count: 'exact', head: true }).eq('order_status', s);
      sc[s] = count || 0;
    }
    const { data: sp } = await this.getSalespeople(false);
    const bySp = [];
    if (sp) {
      for (const s of sp) {
        const { count } = await SUPABASE.from('orders').select('*', { count: 'exact', head: true }).eq('salesperson_name', s.name);
        bySp.push({ name: s.name, count: count || 0 });
      }
    }
    return { total: total || 0, byStatus: sc, bySalesperson: bySp };
  },

  async getProfiles() {
    const { data, error } = await SUPABASE.from('user_profiles').select('*').order('email');
    return { data, error };
  },

  async updateProfileRole(id, role) {
    return await SUPABASE.from('user_profiles').update({ role }).eq('id', id);
  }
};
