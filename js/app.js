const App = {
  showLoading(element) {
    element.innerHTML = '<div class="loading">加载中...</div>';
  },

  showError(element, message) {
    element.innerHTML = `<div class="error">${message}</div>`;
  },

  showEmpty(element, message = '暂无数据') {
    element.innerHTML = `<div class="empty">${message}</div>`;
  },

  formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  getStatusClass(status) {
    const classMap = {
      '调货中': 'status-pending',
      '路途中': 'status-transit',
      '已到货': 'status-arrived',
      '已完结': 'status-completed'
    };
    return classMap[status] || '';
  },

  getRoleName(role) {
    const nameMap = {
      'super_admin': '超级管理员',
      'admin': '管理员',
      'warehouse': '仓库人员',
      'sales': '业务员'
    };
    return nameMap[role] || role;
  },

  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
