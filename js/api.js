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
        sales_notes: orderData.sales_notes || '',
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
  // 订单留言系统
  // ============================================

  /** 获取某订单的全部留言（按时间正序） */
  async getMessages(orderId) {
    const { data, error } = await SUPABASE
      .from('order_messages')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });
    return { data: data || [], error };
  },

  /** 发送留言 */
  async addMessage(msg) {
    const { data, error } = await SUPABASE
      .from('order_messages')
      .insert({
        order_id: msg.order_id,
        author_role: msg.author_role,
        author_name: msg.author_name,
        content: msg.content,
        is_read: false
      })
      .select()
      .single();
    return { data, error };
  },

  /** 标记某订单的指定角色留言为已读 */
  async markMessagesRead(orderId, targetRole) {
    const { error } = await SUPABASE
      .from('order_messages')
      .update({ is_read: true })
      .eq('order_id', orderId)
      .eq('author_role', targetRole)
      .eq('is_read', false);
    return { error };
  },

  /** 批量获取多个订单的未读留言数 */
  async getUnreadCounts(orderIds) {
    if (!orderIds || orderIds.length === 0) return {};
    const { data, error } = await SUPABASE
      .from('order_messages')
      .select('order_id')
      .eq('is_read', false)
      .in('order_id', orderIds);
    if (error || !data) return {};
    const counts = {};
    data.forEach(m => {
      counts[m.order_id] = (counts[m.order_id] || 0) + 1;
    });
    return counts;
  },

  /** 删除留言（超管/管理员用） */
  async deleteMessage(msgId) {
    const { error } = await SUPABASE
      .from('order_messages')
      .delete()
      .eq('id', msgId);
    return { error };
  },

  // ============================================
  // 统计相关（基于业务员名字 + 订单状态）
  // ============================================

  /** 获取订单统计数据（优化：一次查询替代12+次，容错兜底） */
  async getOrderStats() {
    const empty = { total: 0, by_status: { '调货中': 0, '路途中': 0, '已到货': 0, '已完结': 0 }, by_sales: [] };
    try {
      const { data: orders } = await SUPABASE.from('orders').select('order_status, salesperson_name');
      if (!orders) return empty;

      const total = orders.length;
      const statusCounts = { '调货中': 0, '路途中': 0, '已到货': 0, '已完结': 0 };
      const salesCounts = {};
      orders.forEach(o => {
        if (o.order_status) statusCounts[o.order_status] = (statusCounts[o.order_status] || 0) + 1;
        if (o.salesperson_name) salesCounts[o.salesperson_name] = (salesCounts[o.salesperson_name] || 0) + 1;
      });

      let salesOrders = [];
      try {
        const { data: salesData } = await this.getSalespeople();
        salesOrders = (salesData || []).map(sp => ({ ...sp, order_count: salesCounts[sp.name] || 0 }));
      } catch(e) { /* 业务员查询失败不影响主统计 */ }

      return { total, by_status: statusCounts, by_sales: salesOrders };
    } catch(e) {
      console.error('getOrderStats 失败:', e);
      return empty;
    }
  },

  // ============================================
  // 文件操作相关
  // ============================================

  /** 为订单附加文件元数据 */
  async attachFileToOrder(orderId, fileInfo) {
    const { data: order, error: fetchError } = await SUPABASE
      .from('orders')
      .select('file_ids')
      .eq('id', orderId)
      .single();

    if (fetchError) return { error: fetchError };

    const files = Array.isArray(order.file_ids) ? order.file_ids : [];
    files.push({
      ...fileInfo,
      uploaded_at: new Date().toISOString()
    });

    const { data, error } = await SUPABASE
      .from('orders')
      .update({ file_ids: files })
      .eq('id', orderId)
      .select()
      .single();

    return { data, error };
  },

  /** 从订单移除文件元数据 */
  async removeFileFromOrder(orderId, fileId) {
    const { data: order, error: fetchError } = await SUPABASE
      .from('orders')
      .select('file_ids')
      .eq('id', orderId)
      .single();

    if (fetchError) return { error: fetchError };

    const files = Array.isArray(order.file_ids) 
      ? order.file_ids.filter(f => f.id !== fileId) 
      : [];

    const { data, error } = await SUPABASE
      .from('orders')
      .update({ file_ids: files })
      .eq('id', orderId)
      .select()
      .single();

    return { data, error };
  },

  /** 替换订单中的文件元数据 */
  async replaceFile(orderId, oldFileId, newFileInfo) {
    const { data: order, error: fetchError } = await SUPABASE
      .from('orders')
      .select('file_ids')
      .eq('id', orderId)
      .single();

    if (fetchError) return { error: fetchError };

    const files = Array.isArray(order.file_ids) ? order.file_ids : [];
    const index = files.findIndex(f => f.id === oldFileId);
    
    if (index !== -1) {
      files[index] = {
        ...newFileInfo,
        uploaded_at: new Date().toISOString()
      };
    }

    const { data, error } = await SUPABASE
      .from('orders')
      .update({ file_ids: files })
      .eq('id', orderId)
      .select()
      .single();

    return { data, error };
  },

  // ============================================
  // 业务员识别码验证
  // ============================================

  /** 通过识别码获取业务员信息 */
  async getSalespersonByCode(accessCode) {
    const { data, error } = await SUPABASE
      .from('salespeople')
      .select('*')
      .eq('access_code', accessCode.toUpperCase())
      .maybeSingle();
    return { data, error };
  }
};
