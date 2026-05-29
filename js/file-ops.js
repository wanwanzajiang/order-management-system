/**
 * 文件操作工具 - Supabase Storage 版
 * 支持：上传（拖拽+点击）、预览、下载、替换、删除
 * 存储：Supabase Storage bucket "order-files"（公开读）
 * 元数据：orders.file_ids JSONB 数组
 */
const FileOps = {
  _openOrderId: null,
  _currentUser: null,

  getFileType(fileName) {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    if (['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) return 'image';
    if (['mp4','avi','mov','wmv','flv','mkv','webm'].includes(ext)) return 'video';
    return 'other';
  },

  formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + 'B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + 'KB';
    if (bytes < 1024*1024*1024) return (bytes/(1024*1024)).toFixed(1) + 'MB';
    return (bytes/(1024*1024*1024)).toFixed(1) + 'GB';
  },

  formatTime(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('zh-CN', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
    } catch(e) { return ''; }
  },

  getIcon(type) {
    if (type === 'image') return '📷';
    if (type === 'video') return '🎬';
    return '📎';
  },

  /** 获取 Supabase storage URL */
  _storageUrl(path) {
    return `${CONFIG.SUPABASE_URL}/storage/v1/object/public/order-files/${path}`;
  },

  _uploadUrl() {
    return `${CONFIG.SUPABASE_URL}/storage/v1/object/order-files/`;
  },

  _getPanelId() { return 'filePanelOverlay'; },
  _getBodyId() { return 'filePanelBody'; },
  _getTitleId() { return 'filePanelTitle'; },

  async open(orderId, invoiceNo, userRole) {
    this._openOrderId = orderId;
    this._currentUser = Auth.getUser();
    const panel = document.getElementById(this._getPanelId());
    if (!panel) return;

    const titleEl = document.getElementById(this._getTitleId());
    const bodyEl = document.getElementById(this._getBodyId());
    if (titleEl) titleEl.textContent = `📎 文件 - ${invoiceNo}`;
    if (bodyEl) bodyEl.innerHTML = '<p class="file-empty">加载中...</p>';
    panel.classList.add('show');
    await this._loadFiles(orderId, userRole);
  },

  close() {
    const panel = document.getElementById(this._getPanelId());
    if (panel) panel.classList.remove('show');
    this._openOrderId = null;
  },

  async _loadFiles(orderId, userRole) {
    const body = document.getElementById(this._getBodyId());
    if (!body) return;

    // 获取文件元数据（从 orders.file_ids JSONB）
    const { data: order } = await SUPABASE
      .from('orders')
      .select('file_ids')
      .eq('id', orderId)
      .single();

    const files = Array.isArray(order?.file_ids) ? order.file_ids : [];
    const role = userRole || (Auth.getUser()?.role) || 'sales';
    const isUploader = ['warehouse', 'admin', 'super_admin'].includes(role);

    let html = '';

    // 上传区域
    if (isUploader) {
      html += `<div class="file-upload-zone" id="fileUploadZone">
        <div class="file-upload-hint" onclick="document.getElementById('uploadFileInput').click()">
          📤 拖拽文件到此处 或 <span style="color:#3b6d11;cursor:pointer;font-weight:600;text-decoration:underline;">点击上传</span><br>
          <small style="color:#999;">照片/视频，单文件最大 50MB</small>
        </div>
        <input type="file" id="uploadFileInput" accept="image/*,video/*" multiple
          onchange="FileOps._handleUpload(this.files)" style="display:none">
      </div>
      <div class="file-upload-progress" id="uploadProgress">
        <div class="bar" style="width:0%"></div>
      </div>`;
    }

    // 文件列表
    if (!files || files.length === 0) {
      html += '<p class="file-empty">暂无文件 📎</p>';
    } else {
      files.forEach((f, idx) => {
        const ft = f.type || this.getFileType(f.name || f.id || '');
        const icon = this.getIcon(ft);
        const name = f.name || '未知文件';
        const fileId = f.id || '';
        html += `<div class="file-item">
          <div class="file-icon ${ft}">${icon}</div>
          <div class="file-info">
            <div class="name">${App.escapeHtml(name)}</div>
            <div class="meta">${this.formatSize(f.size)} · ${this.formatTime(f.uploaded_at)}${f.uploader ? ' · ' + App.escapeHtml(f.uploader) : ''}</div>
          </div>
          <div class="file-actions">
            <button class="file-dl-btn" onclick="window.open('${this._storageUrl(fileId)}','_blank')">⬇</button>
            ${isUploader ? `<button class="file-replace-btn" onclick="FileOps._replacePrompt('${App.escapeHtml(fileId)}')">🔄</button>` : ''}
            ${isUploader ? `<button class="file-del-btn" onclick="FileOps._deleteFile(${orderId},'${App.escapeHtml(fileId)}')">🗑</button>` : ''}
          </div>
        </div>`;
      });
    }

    body.innerHTML = html;

    // 拖拽上传
    if (isUploader) {
      const zone = document.getElementById('fileUploadZone');
      if (zone) {
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', e => {
          e.preventDefault();
          zone.classList.remove('dragover');
          if (e.dataTransfer.files.length > 0) {
            this._handleUpload(e.dataTransfer.files);
          }
        });
      }
    }
  },

  /** 上传文件到 Supabase Storage */
  async _handleUpload(fileList) {
    if (!fileList || fileList.length === 0) return;
    const orderId = this._openOrderId;
    if (!orderId) return;

    const user = Auth.getUser();
    const uploader = user?.full_name || user?.email || '';
    const session = Auth.getSession();
    const token = session?.access_token || '';

    if (!token) { App.showToast('登录已过期，请重新登录', 'error'); return; }

    const progressBar = document.getElementById('uploadProgress');
    const progressInner = progressBar?.querySelector('.bar');
    if (progressBar) progressBar.style.display = 'block';

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        // 生成唯一文件名
        const ts = new Date().getTime();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${orderId}/${ts}_${safeName}`;

        // 上传到 Supabase Storage
        const res = await fetch(
          `${CONFIG.SUPABASE_URL}/storage/v1/object/order-files/${path}`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': file.type || 'application/octet-stream',
              'x-upsert': 'true'
            },
            body: file
          }
        );

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || `HTTP ${res.status}`);
        }

        // 保存元数据到 orders.file_ids
        await API.attachFileToOrder(orderId, {
          id: path,
          name: file.name,
          size: file.size,
          type: this.getFileType(file.name),
          uploader
        });

        if (progressInner) {
          progressInner.style.width = `${Math.round((i + 1) / fileList.length * 100)}%`;
        }

      } catch (e) {
        App.showToast(`上传失败 ${file.name}: ${e.message}`, 'error');
      }
    }

    if (progressBar) {
      progressBar.style.display = 'none';
      if (progressInner) progressInner.style.width = '0%';
    }

    await this._loadFiles(orderId, '');

    // 通知仓库列表刷新文件按钮
    if (typeof loadOrders === 'function') loadOrders();
  },

  /** 替换文件 */
  _replacePrompt(oldFileId) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) return;
      await this._replaceFile(oldFileId, input.files[0]);
    };
    input.click();
  },

  async _replaceFile(oldFileId, newFile) {
    const orderId = this._openOrderId;
    if (!orderId) return;

    const user = Auth.getUser();
    const uploader = user?.full_name || user?.email || '';
    const session = Auth.getSession();
    const token = session?.access_token || '';

    if (!token) { App.showToast('登录已过期', 'error'); return; }

    try {
      // 1. 上传新文件
      const ts = new Date().getTime();
      const safeName = newFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const newPath = `${orderId}/${ts}_${safeName}`;

      const res = await fetch(
        `${CONFIG.SUPABASE_URL}/storage/v1/object/order-files/${newPath}`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': newFile.type || 'application/octet-stream' },
          body: newFile
        }
      );
      if (!res.ok) throw new Error(`上传失败 HTTP ${res.status}`);

      // 2. 更新 orders.file_ids
      const { error } = await API.replaceFile(orderId, oldFileId, {
        id: newPath,
        name: newFile.name,
        size: newFile.size,
        type: this.getFileType(newFile.name),
        uploader
      });
      if (error) { App.showToast('更新失败', 'error'); return; }

      // 3. 删除旧文件
      await fetch(
        `${CONFIG.SUPABASE_URL}/storage/v1/object/order-files/${oldFileId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      ).catch(() => {});

      App.showToast('文件已替换', 'success');
      await this._loadFiles(orderId, '');

    } catch (e) {
      App.showToast('替换失败: ' + e.message, 'error');
    }
  },

  /** 删除文件 */
  async _deleteFile(orderId, fileId) {
    if (!confirm('确定要删除这个文件吗？')) return;

    const session = Auth.getSession();
    const token = session?.access_token || '';

    // 1. 从 Supabase 元数据移除
    const { error } = await API.removeFileFromOrder(orderId, fileId);
    if (error) { App.showToast('删除失败', 'error'); return; }

    // 2. 从 Storage 删除
    await fetch(
      `${CONFIG.SUPABASE_URL}/storage/v1/object/order-files/${fileId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    ).catch(() => {});

    App.showToast('文件已删除', 'success');
    await this._loadFiles(orderId, '');
  },

  /** 渲染文件按钮 */
  renderFileBtn(order, _roleFallback) {
    const files = Array.isArray(order.file_ids) ? order.file_ids : [];
    const count = files.length;
    const role = (Auth.getUser() || {}).role || _roleFallback || '';
    if (count === 0 && role === 'sales') return '';
    const cls = count > 0 ? 'file-btn has-files' : 'file-btn';
    const label = count > 0 ? `📎 文件(${count})` : '📎 上传';
    return `<button class="${cls}" onclick="FileOps.open(${order.id},'${App.escapeHtml(order.invoice_no)}','${role}')">${label}</button>`;
  }
};

window.FileOps = FileOps;
