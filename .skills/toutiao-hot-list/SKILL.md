---
name: toutiao-hot-list
description: 获取今日头条实时热榜。Use when fetching Toutiao trending topics, hot news, or real-time headline rankings.
license: MIT
metadata:
  id: skill_toutiao_hot_list
  display_name: 今日头条热榜
  trigger: [今日头条, 热榜, 热点新闻]
  key_type: user_managed
  scope_platform: all
  version: 1.0.0
---

## 能力概述

获取今日头条当前实时热榜，返回热门话题与新闻列表。

- **Endpoint**: POST https://apis.tianapi.com/toutiaohot/index
- **认证方式**: API Key 作为表单参数 `key` 传入（天行数据平台密钥）
- **内容类型**: `application/x-www-form-urlencoded`

### 响应示例

```json
{
  "code": 200,
  "msg": "success",
  "result": [
    { "热榜条目字段": "..." }
  ]
}
```

---

## 生成期用法（Agent 直接调用）

```typescript
const TOUTIAO_API_KEY = Deno.env.get("TOUTIAO_API_KEY") ?? "YOUR_API_KEY";
// 在控制台-数据管理中获取，或直接替换为真实密钥

async function getToutiaoHotList(): Promise<unknown[]> {
  const response = await fetch("https://apis.tianapi.com/toutiaohot/index", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ key: TOUTIAO_API_KEY }).toString(),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.result as unknown[];
}

// 调用
const hotList = await getToutiaoHotList();
console.log(hotList);
```

---

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function（服务端，`edge-functions/toutiao-hot-list.ts`）

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // 从服务端环境变量读取密钥，绝不暴露给前端
  const apiKey = Deno.env.get("TOUTIAO_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch("https://apis.tianapi.com/toutiaohot/index", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
async function fetchToutiaoHotList() {
  const { data, error } = await supabase.functions.invoke("toutiao-hot-list", {
    body: {},
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.result;
}
```

**备用方式：**

```typescript
async function fetchToutiaoHotList() {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/toutiao-hot-list`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }
  );

  if (res.status === 429) throw new Error("配额已用尽");
  if (res.status === 402) throw new Error("余额不足");
  if (!res.ok) throw new Error(`请求失败：${res.status}`);

  const json = await res.json();
  if (json.code !== 200) throw new Error(`API 错误 ${json.code}：${json.msg}`);
  return json.result;
}
```

---

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `key` | `string` | 是 | 天行数据 API 密钥，在控制台-数据管理中获取 |

### 返回字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | `number` | 状态码，200 表示成功 |
| `msg` | `string` | 状态描述 |
| `result` | `array` | 热榜条目列表 |

### 错误码

| code | 说明 |
|------|------|
| 200 | 成功 |
| 240 | 缺少 key 参数 |

---

## 注意事项

- **密钥安全**: `TOUTIAO_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端或写入客户端代码。
- **错误处理**: 务必处理 429（配额超限）和 402（余额不足）错误，避免用户体验中断。
- **计费**: 本接口按调用次数计费（以天行数据控制台显示为准），避免不必要的重复调用，建议在客户端做适当缓存。
- **数据时效**: 热榜数据为实时抓取，频繁轮询请控制调用频率。
