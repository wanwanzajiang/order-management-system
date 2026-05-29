// 云开发云函数：media-auth
// 负责文件上传签名、下载鉴权、删除操作
// 通过 Supabase JWT 验证用户身份

const cloud = require('wx-server-sdk');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// Supabase 配置（从环境变量获取）
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nlcudhwgnoljaxmzdiki.supabase.co';
const SUPABASE_JWKS_URL = `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`;

// JWKS 客户端（用于验证 Supabase JWT）
const jwks = jwksClient({ jwksUri: SUPABASE_JWKS_URL, cache: true, rateLimit: true });

function getKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) { callback(err); return; }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// 验证 Supabase JWT，返回用户信息
function verifyToken(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, getKey, {
      algorithms: ['RS256'],
      issuer: SUPABASE_URL,
      audience: 'authenticated'
    }, (err, decoded) => {
      if (err) return reject(err);
      resolve(decoded);
    });
  });
}

exports.main = async (event, context) => {
  const { action, token, fileName, fileId, orderId, uploaderId } = event;

  // 验证必需参数
  if (!action) return { code: 400, message: '缺少 action 参数' };

  try {
    // 验证用户身份
    if (!token) return { code: 401, message: '未提供认证信息' };
    let user;
    try {
      user = await verifyToken(token);
    } catch (e) {
      return { code: 401, message: '认证失败: ' + e.message };
    }

    // 从 Supabase 获取用户角色（通过 HTTP 调用）
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseKey) return { code: 500, message: '服务端配置错误' };

    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${user.sub}&select=role,email`,
      { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
    );
    const profiles = await profileRes.json();
    const profile = profiles?.[0];
    const role = profile?.role || '';
    const email = profile?.email || '';

    switch (action) {
      // ==================== 上传签名 ====================
      case 'upload-sign': {
        if (!['warehouse', 'admin', 'super_admin'].includes(role)) {
          return { code: 403, message: '无上传权限' };
        }
        if (!fileName || !orderId) {
          return { code: 400, message: '缺少 fileName 或 orderId' };
        }

        // 生成云存储上传路径
        const timestamp = Date.now();
        const ext = fileName.split('.').pop();
        const cloudPath = `orders/${orderId}/${timestamp}_${Math.random().toString(36).substr(2, 8)}.${ext}`;

        // 获取上传签名
        const uploadResult = await cloud.uploadFile({ cloudPath, fileContent: '' });
        // 注意：实际上 cloud.uploadFile 需要 buffer，这里只获取上传地址
        // 使用 getTempFileURL 配合上传

        return {
          code: 0,
          data: {
            cloudPath,
            uploadUrl: `https://${process.env.TCB_ENV}.tcb.qcloud.la/${cloudPath}`,
          }
        };
      }

      // ==================== 下载链接 ====================
      case 'download-url': {
        if (!fileId) return { code: 400, message: '缺少 fileId' };

        // 验证权限：业务员只能下载自己订单的文件
        if (role === 'sales') {
          // 检查订单是否属于该业务员
          const orderRes = await fetch(
            `${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId || 0}&select=salesperson_name`,
            { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
          );
          const orders = await orderRes.json();
          if (!orders?.[0] || orders[0].salesperson_name !== email) {
            return { code: 403, message: '无权下载该订单文件' };
          }
        }

        // 获取临时下载链接（1小时有效）
        const result = await cloud.getTempFileURL({
          fileList: [fileId]
        });

        const fileInfo = result.fileList?.[0];
        if (fileInfo?.status !== 0 || !fileInfo?.tempFileURL) {
          return { code: 404, message: '文件不存在或已过期' };
        }

        return { code: 0, data: { downloadUrl: fileInfo.tempFileURL } };
      }

      // ==================== 删除文件 ====================
      case 'delete-file': {
        if (!fileId) return { code: 400, message: '缺少 fileId' };
        if (!['admin', 'super_admin', 'warehouse'].includes(role)) {
          return { code: 403, message: '无删除权限' };
        }

        const result = await cloud.deleteFile({ fileList: [fileId] });
        return { code: 0, data: result.fileList?.[0] };
      }

      // ==================== 文件列表 ====================
      case 'list-files': {
        if (!orderId) return { code: 400, message: '缺少 orderId' };

        // 从 Supabase 获取订单的 file_ids
        const orderRes = await fetch(
          `${SUPABASE_URL}/rest/v1/orders?id=eq.${orderId}&select=file_ids`,
          { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }
        );
        const orders = await orderRes.json();
        const fileIds = orders?.[0]?.file_ids || [];

        if (fileIds.length === 0) {
          return { code: 0, data: { files: [] } };
        }

        // 获取文件下载链接
        const result = await cloud.getTempFileURL({ fileList: fileIds });
        const files = (result.fileList || []).map(f => ({
          fileId: f.fileID,
          downloadUrl: f.tempFileURL || '',
          status: f.status
        }));

        return { code: 0, data: { files } };
      }

      default:
        return { code: 400, message: '未知操作: ' + action };
    }
  } catch (e) {
    console.error('media-auth error:', e);
    return { code: 500, message: '服务器错误: ' + e.message };
  }
};
