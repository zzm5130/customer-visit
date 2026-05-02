#!/usr/bin/env node
/**
 * 创建管理员账号脚本
 * 运行方式: node scripts/create-admin.js
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("错误: 缺少环境变量 VITE_SUPABASE_URL 或 SUPABASE_SERVICE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "VisitMgr@2026#Xk9!";
const ADMIN_EMAIL = `${ADMIN_USERNAME}@miaoda.com`;
const ADMIN_FULL_NAME = "系统管理员";

async function createAdmin() {
  try {
    console.log("正在创建管理员账号...");
    console.log(`用户名: ${ADMIN_USERNAME}`);
    console.log(`邮箱: ${ADMIN_EMAIL}`);

    // Step 1: 注册账号（触发 handle_new_user 创建profiles行）
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      options: {
        data: {
          username: ADMIN_USERNAME,
          full_name: ADMIN_FULL_NAME,
        },
      },
    });

    if (signUpError) {
      if (signUpError.message.includes("already registered")) {
        console.log("管理员账号已存在，跳过创建步骤...");
      } else {
        throw signUpError;
      }
    } else {
      console.log("账号注册成功，用户ID:", authData.user?.id);
    }

    // 等待触发器执行
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Step 2: 使用 service role 将角色更新为 admin
    const { error: updateError } = await supabaseAdmin
      .from("profiles")
      .update({ role: "admin", full_name: ADMIN_FULL_NAME })
      .eq("username", ADMIN_USERNAME);

    if (updateError) {
      throw updateError;
    }

    console.log("\n✅ 管理员账号创建成功！");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`用户名: ${ADMIN_USERNAME}`);
    console.log(`密码:   ${ADMIN_PASSWORD}`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("请妥善保管以上凭据！");

  } catch (error) {
    console.error("创建管理员失败:", error.message);
    process.exit(1);
  }
}

createAdmin();
