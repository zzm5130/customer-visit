---
name: wanan-message
description: 获取晚安心语内容。Use when user wants warm good night messages or nightly quotes via TianAPI.
license: MIT
metadata:
  id: skill_wanan_message
  display_name: 晚安心语
  trigger: 晚安心语, good night message, 晚安问候
  key_type: user_managed
  scope_platform: all
  version: 1.0.0
---

# 晚安心语

由天行数据提供的晚安心语接口，返回温馨晚安文字内容，适合用于睡前问候、App 晚安推送等场景。

## 能力概述

- **Endpoint**: `POST https://apis.tianapi.com/wanan/index`
- **认证方式**: 通过 form 表单提交 API Key（`key` 参数）
- **无需额外参数**：仅需有效的 API Key 即可获取随机晚安心语

**响应示例：**
```json
{
  "code": 200,
  "msg": "success",
  "result": {}
}
```

> `result` 字段包含晚安心语具体内容，建议以实际响应为准检查字段结构。

## 生成期用法（Agent 直接调用）

需配置环境变量 `TIANAPI_KEY`（天行数据 API 密钥）。

```typescript
const API_KEY = Deno.env.get("TIANAPI_KEY")!;

async function getWananMessage(): Promise<Record<string, unknown>> {
  const response = await fetch("https://apis.tianapi.com/wanan/index", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ key: API_KEY }).toString(),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.result;
}

// Usage
const result = await getWananMessage();
console.log(result);
```

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/wanan-message.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = Deno.env.get("TIANAPI_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch("https://apis.tianapi.com/wanan/index", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ key: apiKey }).toString(),
  });

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
async function fetchWananMessage() {
  const { data, error } = await supabase.functions.invoke("wanan-message", {
    body: {},
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.result;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function fetchWananMessage() {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wanan-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
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

  return json.result;
}
```

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `key` | `string` | 是 | 天行数据 API 密钥，由 `TIANAPI_KEY` 环境变量注入，严禁硬编码到前端 |

### 返回字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | `number` | 状态码（200 表示成功） |
| `msg` | `string` | 状态信息 |
| `result` | `object` | 晚安心语内容（具体字段以实际响应为准） |

### 返回码说明

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 240 | 缺少 key 参数 |

## 注意事项

- **密钥安全**：`TIANAPI_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **获取密钥**：前往 [天行数据](https://www.tianapi.com/) 注册账号并申请 API Key，配置到 `TIANAPI_KEY` 环境变量。
- **错误处理**：调用前确保 `TIANAPI_KEY` 已正确配置，否则接口将返回 240（缺少 key 参数）错误。
- **计费**：天行数据按调用次数计费，请参考其官网定价，避免不必要的重复调用。
