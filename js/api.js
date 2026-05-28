const API = {
  // ============================================
  // 业务员相关
  // ============================================
  async getSalesUsers() {
    const { data, error } = await SUPABASE
      .from('user_profiles')
      .select('id, email, full_name, role')
      .eq('role', 'sales');
    return { data, error };
  },

  // ============================================
  // 订单相关
  // ============================================
  async getOrders(filters = {}) {
    let query = SUPABASE
      .from('orders')
      .select('*, user_profiles(full_name)')
      .order('created_at', { ascending: false });

    if (filters.invoice_no) {
      query = query.eq('invoice_no', filters.invoice_no);
    }

    if (filters.sales_id) {
      query = query.eq('sales_id', filters.sales_id);
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
      .select('*, user_profiles(full_name)')
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
        quantity: orderData.quantity,
        order_status: '调货中',
        sales_id: orderData.sales_id,
        sales_notes: orderData.sales_notes || ''
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
  // 用户管理（管理员用）
  // ============================================

  /** 获取所有用户 */
  async getAllUsers() {
    const { data, error } = await SUPABASE
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });
    return { data, error };
  },

  /** 获取单个用户信息 */
  async getUserProfile(userId) {
    const { data, error } = await SUPABASE
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  /** 更新用户信息（姓名、角色等） */
  async updateUserProfile(userId, updates) {
    const { data, error } = await SUPABASE
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  },

  /** 通过Supabase Auth创建新用户（需要service_role权限）*/
  /** 注意：前端直接调用Auth Admin API需要特殊配置，
   * 这里提供方法但实际创建可能需要走边缘函数或后端。
   * 作为fallback：先插入profile记录，让用户通过注册流程自行创建auth账号。
   * 但更实用的方案是管理员在Dashboard中操作。*/

  /** 更新用户角色 */
  async updateUserRole(userId, role) {
    return this.updateUserProfile(userId, { role });
  },

  /** 更新用户姓名 */
  async updateUserName(userId, fullName) {
    return this.updateUserProfile(userId, { full_name: fullName });
  },

  // ============================================
  // 统计相关
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

    // 各业务员的订单数
    const { data: salesData } = await SUPABASE
      .from('user_profiles')
      .select('id, full_name, email')
      .eq('role', 'sales');

    const salesOrders = [];
    if (salesData && salesData.length > 0) {
      for (const sales of salesData) {
        const { count } = await SUPABASE
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('sales_id', sales.id);
        salesOrders.push({
          ...sales,
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
