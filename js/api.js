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
  // 文件管理（照片/视频 - JSONB元数据存储）
  // file_ids 格式: [{id, name, size, type, uploaded_at, uploader}]
  // ============================================

  /** 获取订单文件列表（返回带元数据的文件对象） */
  async getOrderFiles(orderId) {
    const { data: order, error } = await SUPABASE
      .from('orders')
      .select('file_ids')
      .eq('id', orderId)
      .single();
    if (error || !order) return { data: [], error };

    const files = order.file_ids || [];
    if (!Array.isArray(files) || files.length === 0) return { data: [], error: null };

    // 获取文件下载链接
    const fileIds = files.map(f => (typeof f === 'string' ? f : f.id)).filter(Boolean);
    const session = sessionStorage.getItem('order_system_session');
    const token = session ? JSON.parse(session).access_token : '';

    try {
      const res = await fetch(
        `https://${CONFIG.TCB_ENV}.service.tcloudbase.com/media-auth`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'list-files', token, orderId })
        }
      );
      const result = await res.json();
      const dlMap = {};
      (result.data?.files || []).forEach(f => { dlMap[f.fileId] = f.downloadUrl; });

      // 合并元数据和下载链接
      return {
        data: files.map(f => {
          const meta = typeof f === 'string' ? { id: f, name: f, size: 0, type: 'other', uploaded_at: '', uploader: '' } : f;
          return { ...meta, downloadUrl: dlMap[meta.id] || '' };
        }),
        error: null
      };
    } catch (e) {
      return { data: files.map(f => typeof f === 'string' ? { id: f, name: f } : f), error: null };
    }
  },

  /** 获取文件下载链接 */
  async getFileDownloadUrl(fileId, orderId) {
    const session = sessionStorage.getItem('order_system_session');
    const token = session ? JSON.parse(session).access_token : '';
    try {
      const res = await fetch(
        `https://${CONFIG.TCB_ENV}.service.tcloudbase.com/media-auth`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'download-url', token, fileId, orderId })
        }
      );
      const result = await res.json();
      return { url: result.data?.downloadUrl || '', error: result.code !== 0 ? result.message : null };
    } catch (e) {
      return { url: '', error: e.message };
    }
  },

  /** 添加文件到订单（带元数据） */
  async attachFileToOrder(orderId, fileMeta) {
    const { data: order, error: readErr } = await SUPABASE
      .from('orders')
      .select('file_ids')
      .eq('id', orderId)
      .single();
    if (readErr) return { error: readErr };

    const files = Array.isArray(order?.file_ids) ? [...order.file_ids] : [];
    files.push({
      id: fileMeta.id || fileMeta.cloudPath || '',
      name: fileMeta.name || 'unknown',
      size: fileMeta.size || 0,
      type: fileMeta.type || 'other',
      uploaded_at: new Date().toISOString(),
      uploader: fileMeta.uploader || ''
    });

    const { error } = await SUPABASE
      .from('orders')
      .update({ file_ids: files })
      .eq('id', orderId);
    return { error };
  },

  /** 替换文件（删除旧文件元数据，添加新文件元数据） */
  async replaceFile(orderId, oldFileId, newFileMeta) {
    const { data: order, error: readErr } = await SUPABASE
      .from('orders')
      .select('file_ids')
      .eq('id', orderId)
      .single();
    if (readErr) return { error: readErr };

    let files = Array.isArray(order?.file_ids) ? [...order.file_ids] : [];
    // 移除旧文件
    files = files.filter(f => (typeof f === 'string' ? f : f.id) !== oldFileId);
    // 添加新文件
    files.push({
      id: newFileMeta.id || newFileMeta.cloudPath || '',
      name: newFileMeta.name || 'unknown',
      size: newFileMeta.size || 0,
      type: newFileMeta.type || 'other',
      uploaded_at: new Date().toISOString(),
      uploader: newFileMeta.uploader || ''
    });

    const { error } = await SUPABASE
      .from('orders')
      .update({ file_ids: files })
      .eq('id', orderId);
    return { error, oldFiles: [oldFileId] };
  },

  /** 从订单批量删除N天前的文件 */
  async cleanOldFiles(days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    // 获取所有有文件的订单
    const { data: orders, error } = await SUPABASE
      .from('orders')
      .select('id, file_ids')
      .not('file_ids', 'eq', '[]');

    if (error || !orders) return { error, deleted: 0, orders: [] };

    let totalDeleted = 0;
    const updatedOrders = [];

    for (const order of orders) {
      const files = Array.isArray(order.file_ids) ? order.file_ids : [];
      const oldFiles = files.filter(f => {
        const t = (typeof f === 'string' ? '' : f.uploaded_at);
        return t && t < cutoffStr;
      });
      const keptFiles = files.filter(f => {
        const t = (typeof f === 'string' ? '' : f.uploaded_at);
        return !t || t >= cutoffStr;
      });

      if (oldFiles.length > 0) {
        await SUPABASE.from('orders').update({ file_ids: keptFiles }).eq('id', order.id);
        totalDeleted += oldFiles.length;
        updatedOrders.push({ orderId: order.id, deletedFileIds: oldFiles.map(f => typeof f === 'string' ? f : f.id) });
      }
    }

    return { error: null, deleted: totalDeleted, orders: updatedOrders };
  },

  /** 从订单移除单个文件 */
  async removeFileFromOrder(orderId, fileId) {
    const { data: order, error: readErr } = await SUPABASE
      .from('orders')
      .select('file_ids')
      .eq('id', orderId)
      .single();
    if (readErr) return { error: readErr };

    const files = Array.isArray(order?.file_ids)
      ? order.file_ids.filter(f => (typeof f === 'string' ? f : f.id) !== fileId)
      : [];

    const { error } = await SUPABASE
      .from('orders')
      .update({ file_ids: files })
      .eq('id', orderId);
    return { error };
  },

  /** 获取待处理通知数（仓库用） */
  async getPendingCount() {
    const lastSeen = localStorage.getItem('wh_last_seen') || new Date(0).toISOString();
    const { count, error } = await SUPABASE
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('order_status', '已到货')
      .not('notified_at', 'is', null)
      .gt('notified_at', lastSeen);
    return { count: count || 0, error };
  },

  /** 标记通知已读 */
  markNotified() {
    localStorage.setItem('wh_last_seen', new Date().toISOString());
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
