/**
 * 文件操作 - Supabase Storage版
 * 上传/下载/替换/删除 - 支持拖拽和点击
 */
const FileOps = {
  _openOrderId: null,

  _type(fileName) {
    const ext = (fileName||'').split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) return 'image';
    if (['mp4','avi','mov','wmv','flv','mkv','webm'].includes(ext)) return 'video';
    return 'other';
  },
  _icon(type) { return type==='image'?'📷':type==='video'?'🎬':'📎'; },
  _size(bytes) {
    if (!bytes) return ''; if (bytes<1024) return bytes+'B';
    if (bytes<1024*1024) return (bytes/1024).toFixed(1)+'KB';
    return (bytes/(1024*1024*1024)).toFixed(1)+'MB';
  },
  _time(iso) {
    if (!iso) return ''; try { return new Date(iso).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch(e) { return ''; }
  },
  _url(path) { return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/order-files/${path}`; },

  async open(orderId, invoiceNo, userRole) {
    this._openOrderId = orderId;
    const panel = document.getElementById('filePanelOverlay');
    if (!panel) return;
    document.getElementById('filePanelTitle').textContent = `📎 ${invoiceNo}`;
    document.getElementById('filePanelBody').innerHTML = '<p class="file-empty">加载中...</p>';
    panel.classList.add('show');
    await this._load(orderId, userRole);
  },

  close() {
    document.getElementById('filePanelOverlay').classList.remove('show');
    this._openOrderId = null;
  },

  async _load(orderId, userRole) {
    const body = document.getElementById('filePanelBody');
    const { data: order } = await SUPABASE.from('orders').select('file_ids').eq('id', orderId).single();
    const files = Array.isArray(order?.file_ids) ? order.file_ids : [];
    const role = userRole || (Auth.getUser()||{}).role || '';
    const up = ['warehouse','admin','super_admin'].includes(role);
    let html = '';

    if (up) {
      html += `<div class="file-zone" id="upZone" onclick="document.getElementById('upInput').click()" style="padding:20px;text-align:center;border:2px dashed #ddd;border-radius:10px;margin-bottom:12px;cursor:pointer;">
        📤 点击或拖拽上传照片/视频<br><small style="color:#999;">最大50MB</small>
        <input type="file" id="upInput" accept="image/*,video/*" multiple onchange="FileOps._upload(this.files)" style="display:none">
      </div>`;
    }

    if (!files.length) { html += '<p class="file-empty">暂无文件</p>'; }
    else files.forEach(f => {
      const t = f.type||this._type(f.name||'');
      html += `<div class="file-item"><span>${this._icon(t)}</span> ${App.escapeHtml(f.name||'文件')} <small>${this._size(f.size)} · ${this._time(f.uploaded_at)}</small>
        <a href="${this._url(f.id)}" download="${App.escapeHtml(f.name||'文件')}" style="padding:4px 8px;border:1px solid #ddd;border-radius:6px;text-decoration:none;font-size:14px;">⬇</a>
        ${up?`<button onclick="FileOps._replace('${f.id}')">🔄</button>`:''}
        ${up?`<button onclick="FileOps._del(${orderId},'${f.id}')">🗑</button>`:''}
      </div>`;
    });

    body.innerHTML = html;

    if (up) {
      const z = document.getElementById('upZone');
      if (z) {
        z.addEventListener('dragover', e => { e.preventDefault(); z.style.borderColor='#3b6d11'; });
        z.addEventListener('dragleave', () => z.style.borderColor='#ddd');
        z.addEventListener('drop', e => { e.preventDefault(); z.style.borderColor='#ddd'; if (e.dataTransfer.files.length) FileOps._upload(e.dataTransfer.files); });
      }
    }
  },

  async _upload(fileList) {
    if (!fileList?.length || !this._openOrderId) return;
    const session = Auth.getSession();
    const token = session?.access_token;
    if (!token) return alert('请重新登录');

    for (const file of fileList) {
      try {
        const ts = Date.now();
        const path = `${this._openOrderId}/${ts}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
        const res = await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/order-files/${path}`, {
          method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': file.type||'application/octet-stream' }, body: file
        });
        if (!res.ok) throw new Error((await res.text().catch(()=>'')).slice(0,80));
        await API.attachFileToOrder(this._openOrderId, { id: path, name: file.name, size: file.size, type: this._type(file.name), uploader: Auth.getUser()?.full_name||Auth.getUser()?.email||'' });
      } catch(e) { alert('上传失败: '+e.message); }
    }
    await this._load(this._openOrderId, '');
  },

  _replace(oldId) { const i=document.createElement('input'); i.type='file'; i.accept='image/*,video/*'; i.onchange=async()=>{if(i.files.length)FileOps._replaceDo(oldId,i.files[0])}; i.click(); },

  async _replaceDo(oldId, file) {
    const session = Auth.getSession(); const token = session?.access_token;
    if (!token) return;
    try {
      const ts = Date.now(); const path = `${this._openOrderId}/${ts}_${file.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;
      const res = await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/order-files/${path}`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': file.type||'application/octet-stream' }, body: file
      });
      if (!res.ok) throw new Error('上传失败');
      await API.replaceFile(this._openOrderId, oldId, { id: path, name: file.name, size: file.size, type: this._type(file.name), uploader: Auth.getUser()?.full_name||'' });
      await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/order-files/${oldId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).catch(()=>{});
      alert('已替换'); await this._load(this._openOrderId, '');
    } catch(e) { alert('替换失败: '+e.message); }
  },

  async _del(orderId, fileId) {
    if (!confirm('确定删除？')) return;
    const token = Auth.getSession()?.access_token;
    await API.removeFileFromOrder(orderId, fileId);
    await fetch(`${CONFIG.SUPABASE_URL}/storage/v1/object/order-files/${fileId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }).catch(()=>{});
    await this._load(orderId, '');
  },

  renderFileBtn(order, userRole) {
    const files = Array.isArray(order.file_ids) ? order.file_ids : [];
    const n = files.length;
    if (n > 0) {
      return `<button class="file-btn file-has" style="background:#eaf3de;color:#3b6d11;font-weight:600;" onclick="FileOps.open(${order.id},'${App.escapeHtml(order.invoice_no)}','${userRole}')">📎 ${n}个文件</button>`;
    }
    if (userRole === 'sales') return '';  // 业务员没文件不显示
    // 仓库/管理员：没文件显示灰色提示
    return `<button class="file-btn" style="color:#bbb;border-color:#eee;cursor:default;" disabled>📁 暂无</button>`;
  }
};
window.FileOps = FileOps;
