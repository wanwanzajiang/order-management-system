const API = {
  // ============================================
  // 业务员姓名管理（独立于用户账号）
  // ============================================
  async getSalespeople() {
    const { data, error } = await SUPABASE
      .from('salespeople')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });
    return { data, error };
  },

  async getAllSalespeople(includeInactive = false) {
    let query = SUPABASE
      .from('salespeople')
      .select('*')
      .order('created_at', { ascending: false });
    if (!includeInactive) {
      query = query.eq('is_active', true);
    }
    const { data, error } = await query;
    return { data, error };
  },

  async addSalesperson(spData) {
    // 兼容旧调用方式：传字符串(name)或对象({name, access_code, ...})
    const data = typeof spData === 'string'
      ? { name: spData.trim(), is_active: true }
      : { ...spData, is_active: spData.is_active !== false };
    const { data: result, error } = await SUPABASE
      .from('salespeople')
      .insert(data)
      .select()
      .single();
    return { data: result, error };
  },

  async updateSalesperson(id, updates) {
    const { data, error } = await SUPABASE
      .from('salespeople')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async deleteSalesperson(id) {
    // 软删除：设为不活跃，保留历史订单关联
    const { error } = await SUPABASE
      .from('salespeople')
      .update({ is_active: false })
      .eq('id', id);
    return { error };
  },

  // ============================================
  // 订单相关（含新字段）
  // ============================================
  async getOrders(filters = {}) {
    let query = SUPABASE
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.invoice_no) {
      query = query.eq('invoice_no', filters.invoice_no);
    }
    if (filters.salesperson_name) {
      query = query.eq('salesperson_name', filters.salesperson_name);
    }
    if (filters.order_status) {
      query = query.eq('order_status', filters.order_status);
    }

    const { data, error } = await query;
    return { data, error };
  },

  async getOrderByInvoice(invoiceNo) {
    const { data, error } = await SUPABASE
      .from('orders')
      .select('*')
      .eq('invoice_no', invoiceNo)
      .single();
    return { data, error };
  },

  async createOrder(orderData) {
    const { data, error } = await SUPABASE
      .from('orders')
      .insert({
        invoice_no: orderData.invoice_no,
        product_model: orderData.product_model,
        brand: orderData.brand || null,
        quantity: orderData.quantity || 1,
        order_date: orderData.order_date || null,
        delivery_date: orderData.delivery_date || null,
        // 状态默认为空，由仓库填写
        order_status: orderData.order_status || null,
        salesperson_name: orderData.salesperson_name,
        sales_id: null
      })
      .select()
      .single();
    return { data, error };
  },

  async updateOrder(id, updates) {
    const { data, error } = await SUPABASE
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    return { data, error };
  },

  async deleteOrder(id) {
    const { error } = await SUPABASE
      .from('orders')
      .delete()
      .eq('id', id);
    return { error };
  },

  // ============================================
  // 用户管理（管理员用 - 轻量版）
  // ============================================

  /** 获取所有用户 */
  async getAllUsers() {
    const { data, error } = await SUPABASE
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  /** 更新用户信息 — 修复：去掉.select().single()避免 "Cannot coerce" 错误 */
  async updateUserProfile(userId, updates) {
    const { data, error } = await SUPABASE
      .from('user_profiles')
      .update(updates)
      .eq('id', userId);
    return { data, error };
  },

  /** 更新用户角色 */
  async updateUserRole(userId, role) {
    return this.updateUserProfile(userId, { role });
  },

  /** 更新用户姓名 */
  async updateUserName(userId, fullName) {
    return this.updateUserProfile(userId, { full_name: fullName });
  },

  // ============================================
  // 统计相关（基于业务员名字 + 订单状态）
  // ============================================

  /** 获取订单统计数据 */
  async getOrderStats() {
    // 总订单数
    const { count: total } = await SUPABASE
      .from('orders')
      .select('*', { count: 'exact', head: true });

    // 各状态数量
    const statuses = ['调货中', '路途中', '已到货', '已完结'];
    const statusCounts = {};
    for (const s of statuses) {
      const { count } = await SUPABASE
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('order_status', s);
      statusCounts[s] = count || 0;
    }

    // 各业务员的订单数（从salespeople表取名字关联orders）
    const { data: salesData } = await this.getSalespeople();
    const salesOrders = [];
    if (salesData && salesData.length > 0) {
      for (const sp of salesData) {
        const { count } = await SUPABASE
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('salesperson_name', sp.name);
        salesOrders.push({
          ...sp,
          order_count: count || 0
        });
      }
    }

    return {
      total: total || 0,
      by_status: statusCounts,
      by_sales: salesOrders
    };
  }
};
