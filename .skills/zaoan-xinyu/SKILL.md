---
name: zaoan-xinyu
description: 获取每日早安励志语录。Use when user needs daily morning quotes, inspirational greetings, or motivational content.
license: MIT
metadata:
  id: skill_zaoan_xinyu
  display_name: 早安心语
  trigger: [早安, 心语, 励志]
  key_type: user_managed
  scope_platform: tianapi
  version: "1.0.0"
---

# 早安心语

每日早安励志语录接口，返回随机正能量早安问候内容，适用于社交应用、小程序等场景中的每日问候功能。

## 能力概述

- **Endpoint**: `GET https://apis.tianapi.com/zaoan/index`
- **功能**: 获取随机早安励志语录
- **适用场景**: 社交应用、小程序、每日问候、正能量内容推送

### 返回示例

```json
{
  "code": 200,
  "msg": "success",
  "result": {
    "content": "不去做永远不会有收获，未来是靠把握机会和努力奋斗的。最能激励你坚持前行的不是励志语录，也不是励志的故事，而是充满正能量的自己。"
  }
}
```

## 生成期用法（Agent 直接调用）

密钥从环境变量读取，作为查询参数传递。

```typescript
const apiKey = Deno.env.get("ZAOAN_API_KEY")!; // 天行数据API密钥，user_managed

async function getZaoanXinyu(): Promise<string> {
  const url = new URL("https://apis.tianapi.com/zaoan/index");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.result.content;
}

// 使用示例
const content = await getZaoanXinyu();
console.log(content);
```

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/zaoan-xinyu.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = Deno.env.get("ZAOAN_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL("https://apis.tianapi.com/zaoan/index");
  url.searchParams.set("key", apiKey);

  const upstream = await fetch(url.toString(), { method: "GET" });

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
async function fetchZaoanXinyu(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("zaoan-xinyu", {
    body: {},
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.result.content;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function fetchZaoanXinyu(): Promise<string> {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zaoan-xinyu`, {
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

  return json.result.content;
}
```

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `key` | `string` | 是 | 天行数据API密钥（由环境变量 `ZAOAN_API_KEY` 注入，严禁暴露到前端） |

### 返回字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | `number` | 状态码，200 表示成功 |
| `msg` | `string` | 状态描述 |
| `result.content` | `string` | 早安励志语录正文 |

## 注意事项

- **密钥安全**: `ZAOAN_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端或客户端代码中。
- **错误处理**: 务必处理 429（配额超限）和 402（余额不足）场景。
- **计费**: 该接口按调用次数计费，建议每日定时拉取一次后缓存结果，避免页面每次刷新均触发请求。
- **内容随机**: 每次调用返回不同语录，适合晨间推送、开屏问候等低频场景。
