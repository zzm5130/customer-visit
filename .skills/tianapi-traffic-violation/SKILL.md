---
name: tianapi-traffic-violation
description: 查询交通违法代码对应的违法行为详情。Use when looking up traffic violation details by violation code.
license: MIT
metadata:
  id: skill_tianapi_traffic_violation
  display_name: 天行数据交通违法代码查询
  trigger: 交通违法, 违法代码, 违章查询
  key_type: user_managed
  scope_platform: all
  version: 1.0.0
---

# 天行数据交通违法代码查询

## 能力概述

通过交通违法代码查询对应的违法行为详细说明。

- **Endpoint**: `POST https://apis.tianapi.com/jtwfcode/index`
- **Content-Type**: `application/x-www-form-urlencoded`
- **认证方式**: API Key 通过请求体 `key` 字段传入（user_managed）

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `key` | string | 是 | 天行数据 API 密钥（`TIANAPI_API_KEY`） |
| `code` | string | 是 | 交通违法代码，如 `17216` |

### 返回字段

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `msg` | string | 状态描述 |
| `result.code` | string | 查询的违法代码 |
| `result.description` | string | 对应的违法行为详细描述 |

### 响应示例

```json
{
  "code": 200,
  "msg": "success",
  "result": {
    "code": "17216",
    "description": "违法行为描述"
  }
}
```

---

## 生成期用法（Agent 直接调用）

```typescript
const AUTH_VALUE = "<your-TIANAPI_API_KEY>"; // 替换为实际 TIANAPI_API_KEY

async function queryTrafficViolation(code: string): Promise<{ code: string; description: string }> {
  const response = await fetch("https://apis.tianapi.com/jtwfcode/index", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ key: AUTH_VALUE, code }).toString(),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.result;
}
```

---

## 生成后用法（应用内通过 Edge Function 调用）

Edge Function 在服务端注入 `TIANAPI_API_KEY`，避免密钥暴露到前端。

### Edge Function

```typescript
// edge-functions/traffic-violation.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let code: string;
  try {
    const body = await req.json();
    code = body.code;
    if (!code) throw new Error("Missing code");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("TIANAPI_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch("https://apis.tianapi.com/jtwfcode/index", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: apiKey, code }).toString(),
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
async function queryTrafficViolation(code: string) {
  const { data, error } = await supabase.functions.invoke("traffic-violation", {
    body: { code },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.result;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function queryTrafficViolation(code: string) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/traffic-violation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
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

---

## 注意事项

- **密钥安全**: `TIANAPI_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**: 务必处理 429（配额超限）和 402（余额不足）响应。
- **计费**: 天行数据按调用次数计费，请避免重复或无效查询。
- **违法代码格式**: `code` 为数字字符串，如 `"17216"`，请确保传入有效的交通违法代码。
