/**
 * 文件操作工具 v2
 * 支持：上传（带时间记录）、替换、批量删除、元数据显示
 */
const FileOps = {
  _openOrderId: null,
  _currentUser: null,

  _typeMap: {
    image: ['jpg','jpeg','png','gif','webp','bmp','svg'],
    video: ['mp4','avi','mov','wmv','flv','mkv','webm']
  },

  getFileType(fileName) {
    const ext = (fileName || '').split('.').pop().toLowerCase();
    if (this._typeMap.image.includes(ext)) return 'image';
    if (this._typeMap.video.includes(ext)) return 'video';
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

  _getPanelId() { return 'filePanelOverlay'; },
  _getBodyId() { return 'filePanelBody'; },
  _getTitleId() { return 'filePanelTitle'; },

  async open(orderId, invoiceNo, userRole) {
    this._openOrderId = orderId;
    this._currentUser = Auth.getUser();
    const panel = document.getElementById(this._getPanelId());
    if (!panel) return;

    document.getElementById(this._getTitleId()).textContent = `📎 文件 - ${invoiceNo}`;
    document.getElementById(this._getBodyId()).innerHTML = '<p class="file-empty">加载中...</p>';
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

    const { data: files } = await API.getOrderFiles(orderId);
    const isUploader = ['warehouse', 'admin', 'super_admin'].includes(userRole);

    let html = '';

    if (isUploader) {
      html += `
        <div class="file-upload-zone" id="fileUploadZone">
          <div class="file-upload-hint">
            📤 拖拽文件或<span onclick="document.getElementById('fileInput').click()" style="color:#639922;cursor:pointer;font-weight:500;">点击上传</span><br>
            <small style="color:#aaa;">支持照片/视频，不限数量</small>
          </div>
          <input type="file" id="fileInput" accept="image/*,video/*" multiple
            onchange="FileOps._handleUpload(this.files)" style="display:none">
        </div>
        <div class="file-upload-progress" id="uploadProgress"><div class="bar" style="width:0%"></div></div>
      `;
    }

    if (!files || files.length === 0) {
      html += '<p class="file-empty">暂无文件 📎</p>';
    } else {
      files.forEach((f, idx) => {
        const ft = f.type || this.getFileType(f.name || f.id || '');
        const icon = this.getIcon(ft);
        const name = f.name || (f.id || '').split('/').pop() || '未知文件';
        html += `
          <div class="file-item" id="fileItem${idx}">
            <div class="file-icon ${ft}">${icon}</div>
            <div class="file-info">
              <div class="name">${App.escapeHtml(name)}</div>
              <div class="meta">${this.formatSize(f.size)} · ${this.formatTime(f.uploaded_at)}${f.uploader ? ' · ' + App.escapeHtml(f.uploader) : ''}</div>
            </div>
            <div class="file-actions">
              <button class="file-dl-btn" onclick="FileOps._download('${App.escapeHtml(f.id || '')}', ${orderId})">⬇</button>
              ${isUploader ? `<button class="file-replace-btn" onclick="FileOps._replacePrompt('${App.escapeHtml(f.id || '')}')" title="替换">🔄</button>` : ''}
              ${isUploader ? `<button class="file-del-btn" onclick="FileOps._deleteFile(${orderId}, '${App.escapeHtml(f.id || '')}')">🗑</button>` : ''}
            </div>
          </div>
        `;
      });
    }

    body.innerHTML = html;
    if (isUploader) this._initDragDrop();
  },

  _initDragDrop() {
    const zone = document.getElementById('fileUploadZone');
    if (!zone) return;
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      this._handleUpload(e.dataTransfer.files);
    });
  },

  async _handleUpload(fileList) {
    if (!fileList || fileList.length === 0) return;
    const orderId = this._openOrderId;
    if (!orderId) return;

    const user = this._currentUser || Auth.getUser();
    const uploader = user.full_name || user.email || '';
    const session = sessionStorage.getItem('order_system_session');
    const token = session ? JSON.parse(session).access_token : '';
    const env = CONFIG.TCB_ENV || 'wanwan-d2gafa9gobac0b79b';

    for (const file of fileList) {
      try {
        const signRes = await fetch(
          `https://${env}.service.tcloudbase.com/media-auth`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'upload-sign', token, fileName: file.name, orderId })
          }
        );
        const signData = await signRes.json();
        if (signData.code !== 0) { App.showToast('上传失败: ' + signData.message, 'error'); continue; }

        const uploadUrl = signData.data.uploadUrl;
        await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });

        const fileId = signData.data.cloudPath;

        await API.attachFileToOrder(orderId, {
          id: fileId,
          name: file.name,
          size: file.size,
          type: this.getFileType(file.name),
          uploader
        });

        App.showToast(`上传成功: ${file.name}`, 'success');
      } catch (e) {
        App.showToast(`上传失败 ${file.name}: ${e.message}`, 'error');
      }
    }

    const { data: userProfile } = await API.getUserProfile();
    await this._loadFiles(orderId, userProfile?.role || '');
  },

  /** 替换文件 - 弹出文件选择器 */
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

    const user = this._currentUser || Auth.getUser();
    const uploader = user.full_name || user.email || '';
    const session = sessionStorage.getItem('order_system_session');
    const token = session ? JSON.parse(session).access_token : '';
    const env = CONFIG.TCB_ENV || 'wanwan-d2gafa9gobac0b79b';

    try {
      // 1. 上传新文件
      const signRes = await fetch(
        `https://${env}.service.tcloudbase.com/media-auth`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upload-sign', token, fileName: newFile.name, orderId })
        }
      );
      const signData = await signRes.json();
      if (signData.code !== 0) { App.showToast('上传失败', 'error'); return; }

      await fetch(signData.data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': newFile.type },
        body: newFile
      });

      // 2. 更新 orders.file_ids（替换）
      const { error, oldFiles } = await API.replaceFile(orderId, oldFileId, {
        id: signData.data.cloudPath,
        name: newFile.name,
        size: newFile.size,
        type: this.getFileType(newFile.name),
        uploader
      });

      if (error) { App.showToast('更新失败', 'error'); return; }

      // 3. 删除云存储中的旧文件
      if (oldFiles && oldFiles.length > 0) {
        await fetch(
          `https://${env}.service.tcloudbase.com/media-auth`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete-file', token, fileId: oldFileId })
          }
        ).catch(() => {});
      }

      App.showToast('文件已替换', 'success');
      const { data: userProfile } = await API.getUserProfile();
      await this._loadFiles(orderId, userProfile?.role || '');
    } catch (e) {
      App.showToast('替换失败: ' + e.message, 'error');
    }
  },

  async _download(fileId, orderId) {
    const { url, error } = await API.getFileDownloadUrl(fileId, orderId);
    if (error) { App.showToast('获取下载链接失败: ' + error, 'error'); return; }
    if (url) window.open(url, '_blank');
  },

  async _deleteFile(orderId, fileId) {
    if (!confirm('确定要删除这个文件吗？')) return;

    const env = CONFIG.TCB_ENV || 'wanwan-d2gafa9gobac0b79b';
    const session = sessionStorage.getItem('order_system_session');
    const token = session ? JSON.parse(session).access_token : '';

    // 1. 从 Supabase 移除
    const { error } = await API.removeFileFromOrder(orderId, fileId);
    if (error) { App.showToast('删除失败', 'error'); return; }

    // 2. 从云存储删除
    await fetch(
      `https://${env}.service.tcloudbase.com/media-auth`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-file', token, fileId })
      }
    ).catch(() => {});

    App.showToast('文件已删除', 'success');
    const { data: userProfile } = await API.getUserProfile();
    await this._loadFiles(orderId, userProfile?.role || '');
  },

  /** 批量清理旧文件（超管用） */
  async cleanOldFiles(days) {
    if (!confirm(`确定删除 ${days} 天前的所有文件吗？此操作不可撤销！`)) return;

    const { error, deleted, orders } = await API.cleanOldFiles(days);
    if (error) { App.showToast('清理失败: ' + error.message, 'error'); return; }

    // 从云存储删除这些文件
    const env = CONFIG.TCB_ENV || 'wanwan-d2gafa9gobac0b79b';
    const session = sessionStorage.getItem('order_system_session');
    const token = session ? JSON.parse(session).access_token : '';

    for (const o of orders) {
      for (const fid of o.deletedFileIds) {
        await fetch(
          `https://${env}.service.tcloudbase.com/media-auth`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete-file', token, fileId: fid })
          }
        ).catch(() => {});
      }
    }

    App.showToast(`已清理 ${deleted} 个文件`, 'success');
  },

  /** 渲染文件按钮（订单行中） */
  renderFileBtn(order, userRole) {
    const files = Array.isArray(order.file_ids) ? order.file_ids : [];
    const count = files.length;
    if (count === 0 && userRole === 'sales') return '';
    const cls = count > 0 ? 'file-btn has-files' : 'file-btn';
    const label = count > 0 ? `📎 文件(${count})` : '📎 上传';
    return `<button class="${cls}" onclick="FileOps.open(${order.id},'${App.escapeHtml(order.invoice_no)}','${userRole}')">${label}</button>`;
  }
};
window.FileOps = FileOps;
