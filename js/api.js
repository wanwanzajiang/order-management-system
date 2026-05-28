const API = {
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
    const user = Auth.getUser();
    const { data, error } = await SUPABASE
      .from('orders')
      .insert({
        invoice_no: orderData.invoice_no,
        product_model: orderData.product_model,
        quantity: orderData.quantity,
        order_status: '调货中',
        sales_id: user.id,
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

  async getUserProfile(userId) {
    const { data, error } = await SUPABASE
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    return { data, error };
  },

  async updateUserProfile(userId, updates) {
    const { data, error } = await SUPABASE
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();
    return { data, error };
  }
};
