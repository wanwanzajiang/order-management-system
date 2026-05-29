// Supabase Edge Function: 超管账号操作
// 安全：service_role key 存在环境变量中，前端永远看不到

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  // 仅接受 POST
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 验证调用者身份（必须是登录用户）
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "未登录" }, 401);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SB_URL")!,
    Deno.env.get("SB_SERVICE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 验证调用者是超管
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return json({ error: "身份验证失败" }, 401);

  const { data: profile } = await supabaseAdmin
    .from("user_profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "super_admin") {
    return json({ error: "仅超级管理员可操作" }, 403);
  }

  const body = await req.json() as { action: string; [key: string]: unknown };
  const { action } = body;

  // ======== 创建用户 ========
  if (action === "create-user") {
    const { email, password, role, full_name } = body as {
      email: string; password: string; role: string; full_name?: string;
    };
    if (!email || !password || !role) {
      return json({ error: "邮箱、密码、角色为必填" }, 400);
    }

    // 创建 auth 用户
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || "" },
    });
    if (createErr) return json({ error: `创建失败: ${createErr.message}` }, 400);

    // 更新 profile 角色
    await supabaseAdmin.from("user_profiles").upsert({
      id: newUser.user.id,
      email,
      full_name: full_name || null,
      role,
    });

    return json({ success: true, user: { id: newUser.user.id, email, role } });
  }

  // ======== 删除用户 ========
  if (action === "delete-user") {
    const { user_id } = body as { user_id: string };
    if (!user_id) return json({ error: "缺少 user_id" }, 400);

    // 不能删自己
    if (user_id === user.id) return json({ error: "不能删除自己" }, 400);

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (delErr) return json({ error: `删除失败: ${delErr.message}` }, 400);

    return json({ success: true });
  }

  // ======== 重置密码 ========
  if (action === "reset-password") {
    const { user_id, new_password } = body as { user_id: string; new_password: string };
    if (!user_id || !new_password) return json({ error: "缺少参数" }, 400);
    if (new_password.length < 6) return json({ error: "密码至少6位" }, 400);

    const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: new_password,
    });
    if (pwdErr) return json({ error: `重置失败: ${pwdErr.message}` }, 400);

    return json({ success: true });
  }

  return json({ error: "未知操作" }, 400);
});

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
