---
name: bing-daily-image
description: 获取必应每日壁纸图片URL。Use when user needs Bing daily wallpaper or background image for websites/apps.
license: MIT
metadata:
  id: skill_bing_daily_image
  display_name: 必应每日图片
  trigger: [必应图片, 壁纸, Bing wallpaper]
  key_type: user_managed
  scope_platform: [web, mobile]
  version: 1.0.0
---

# 必应每日图片

获取必应（Bing）每日精选壁纸图片的 URL 地址，适用于网站背景、应用壁纸等场景。

## 能力概述

- **Endpoint**: `GET https://cn.apihz.cn/api/img/bingapi.php`
- 返回当日必应精选壁纸的高清图片链接（1920×1080），图片托管于 `cn.bing.com`
- 可直接用作 `<img src>` 或 CSS `background-image`

**响应示例：**

```json
{
  "code": 200,
  "msg": "https://cn.bing.com/th?id=OHR.VeniceView_ZH-CN3088407995_1920x1080.jpg&rf=LaDigue_1920x1080.jpg&pid=hp"
}
```

## 生成期用法（Agent 直接调用）

认证通过查询参数 `id`（账号 ID）和 `key`（API 密钥）传入，无需请求头。

```typescript
const API_ID = Deno.env.get("BING_API_ID") ?? "10005541";
const API_KEY = Deno.env.get("BING_API_KEY") ?? "";

async function getBingDailyImage(type?: number): Promise<string> {
  const params = new URLSearchParams({ id: API_ID, key: API_KEY });
  if (type !== undefined) params.set("type", String(type));

  const response = await fetch(`https://cn.apihz.cn/api/img/bingapi.php?${params}`);
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.msg; // 图片 URL
}

// 调用示例
const imageUrl = await getBingDailyImage(1);
console.log(imageUrl);
```

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function (`edge-functions/bing-daily-image.ts`)

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let type: number | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    type = body.type;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiId = Deno.env.get("BING_API_ID") ?? "10005541";
  const apiKey = Deno.env.get("BING_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const params = new URLSearchParams({ id: apiId, key: apiKey });
  if (type !== undefined) params.set("type", String(type));

  const upstream = await fetch(`https://cn.apihz.cn/api/img/bingapi.php?${params}`);

  if (upstream.status === 429 || upstream.status === 402) {
    const errText = await upstream.text();
    return new Response(errText, {
      status: upstream.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!upstream.ok) {
    return new Response(
      JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const data = await upstream.json();
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### 前端调用

**推荐方式（supabase client 可用时）：**

```typescript
async function fetchBingDailyImage(type?: number): Promise<string> {
  const { data, error } = await supabase.functions.invoke("bing-daily-image", {
    body: { type },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.msg;
}
```

**备用方式：**

```typescript
async function fetchBingDailyImage(type?: number): Promise<string> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bing-daily-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type }),
  });

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`配额已用尽：${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`余额不足：${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`请求失败：${res.status}`);

  const json = await res.json();
  if (json.code !== 200) throw new Error(`API 错误 ${json.code}：${json.msg}`);
  return json.msg;
}
```

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | 账号 ID（通过 `BING_API_ID` 环境变量注入，默认 `10005541`） |
| `key` | `string` | 是 | API 访问密钥（通过 `BING_API_KEY` 环境变量注入） |
| `type` | `integer` | 否 | 图片类型参数（可选，示例值 `1`） |

### 返回字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | `number` | 状态码，`200` 表示成功 |
| `msg` | `string` | 必应每日壁纸图片 URL（失败时为错误说明） |

## 注意事项

- **密钥安全**：`BING_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 `429`（配额超限）和 `402`（余额不足）响应。
- **图片时效性**：返回的 Bing 图片链接为当天精选，链接可能随时间失效，建议按需实时获取而非长期缓存。
- **计费**：每次调用消耗一定 API 配额，避免在高频场景下不必要的重复调用。
