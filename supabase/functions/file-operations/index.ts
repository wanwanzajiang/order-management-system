// Supabase Edge Function: file-operations
// 处理文件相关的业务逻辑，云开发负责实际存储

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const TCB_ENV = Deno.env.get("TCB_ENV") || "";
const TCB_API_KEY = Deno.env.get("TCB_API_KEY") || "";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 验证用户身份
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "未登录" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // 获取用户角色
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, email")
      .eq("id", user.id)
      .single();

    const role = profile?.role || "";

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

    switch (action) {
      case "upload-sign": {
        // 只有仓库和管理员可以上传
        if (!["warehouse", "admin", "super_admin"].includes(role)) {
          return new Response(JSON.stringify({ error: "无上传权限" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        const { fileName, orderId } = body;
        if (!fileName || !orderId) {
          return new Response(JSON.stringify({ error: "缺少参数" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // 验证订单存在
        const { data: order } = await supabase
          .from("orders")
          .select("id")
          .eq("id", orderId)
          .single();

        if (!order) {
          return new Response(JSON.stringify({ error: "订单不存在" }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // 调用云开发云函数获取上传签名
        const uploadRes = await fetch(
          `https://${TCB_ENV}.service.tcloudbase.com/upload-sign`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": TCB_API_KEY },
            body: JSON.stringify({ fileName, orderId, uploaderId: user.id })
          }
        );
        const uploadData = await uploadRes.json();

        return new Response(JSON.stringify(uploadData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "confirm-upload": {
        // 上传完成后，更新 orders.file_ids
        const { orderId, fileId, fileName, fileSize, fileType } = body;
        if (!orderId || !fileId) {
          return new Response(JSON.stringify({ error: "缺少参数" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // 获取当前 file_ids
        const { data: order } = await supabase
          .from("orders")
          .select("file_ids")
          .eq("id", orderId)
          .single();

        const currentFiles = order?.file_ids || [];
        if (!currentFiles.includes(fileId)) {
          currentFiles.push(fileId);
        }

        // 更新 orders 表
        const { error: updateErr } = await supabase
          .from("orders")
          .update({ file_ids: currentFiles })
          .eq("id", orderId);

        if (updateErr) throw updateErr;

        return new Response(JSON.stringify({ success: true, file_ids: currentFiles }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "download-url": {
        const { fileId, orderId } = body;
        if (!fileId || !orderId) {
          return new Response(JSON.stringify({ error: "缺少参数" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // 业务员只能下载自己订单的文件
        if (role === "sales") {
          const { data: order } = await supabase
            .from("orders")
            .select("salesperson_name")
            .eq("id", orderId)
            .single();

          if (!order || order.salesperson_name !== profile?.email) {
            return new Response(JSON.stringify({ error: "无权访问该订单" }), {
              status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
        }

        // 调用云开发获取下载链接
        const dlRes = await fetch(
          `https://${TCB_ENV}.service.tcloudbase.com/download-url`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": TCB_API_KEY },
            body: JSON.stringify({ fileId })
          }
        );
        const dlData = await dlRes.json();

        return new Response(JSON.stringify(dlData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case "delete-file": {
        const { orderId, fileId } = body;
        if (!orderId || !fileId) {
          return new Response(JSON.stringify({ error: "缺少参数" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // 只有管理员和仓库可以删除
        if (!["admin", "super_admin", "warehouse"].includes(role)) {
          return new Response(JSON.stringify({ error: "无删除权限" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }

        // 从 orders.file_ids 中移除
        const { data: order } = await supabase
          .from("orders")
          .select("file_ids")
          .eq("id", orderId)
          .single();

        const updatedFiles = (order?.file_ids || []).filter((id: string) => id !== fileId);

        await supabase.from("orders").update({ file_ids: updatedFiles }).eq("id", orderId);

        // 删除云存储中的文件
        await fetch(
          `https://${TCB_ENV}.service.tcloudbase.com/delete-file`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-api-key": TCB_API_KEY },
            body: JSON.stringify({ fileId })
          }
        );

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        return new Response(JSON.stringify({ error: "未知操作" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
