---
name: en-tokenize
description: Tokenizes English text via Tianapi. Use when splitting English text into words or tokens for NLP tasks.
license: MIT
metadata:
  id: skill_en-tokenize
  display_name: 英文智能分词
  trigger: [tokenize, 分词, english text]
  key_type: user_managed
  scope_platform: tianapi
  version: 1.0.0
---

# 英文智能分词

## 能力概述

调用天行数据英文分词接口，将英文文本拆分为单词/词元（token）序列，返回结构化分词结果。

- **Endpoint**: `POST https://apis.tianapi.com/entokenize/index`
- **Content-Type**: `application/x-www-form-urlencoded`
- **鉴权方式**: 表单参数 `key`（user_managed，使用 `TIANAPI_KEY`）

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `key`  | string | 是 | 天行数据 API 密钥（`TIANAPI_KEY`） |
| `text` | string | 是 | 待分词的英文文本 |

### 返回字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code`   | number | 状态码，200 表示成功 |
| `msg`    | string | 状态描述 |
| `result` | object | 分词结果数据 |

### 响应示例

```json
{
  "code": 200,
  "msg": "success",
  "result": {}
}
```

---

## 生成期用法（Agent 直接调用）

```typescript
const AUTH_KEY = "<YOUR_TIANAPI_KEY>"; // 替换为实际 TIANAPI_KEY

async function tokenizeEnglish(text: string): Promise<unknown> {
  const response = await fetch("https://apis.tianapi.com/entokenize/index", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ key: AUTH_KEY, text }).toString(),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.result;
}
```

**Python 示例：**

```python
import http.client, urllib, json

conn = http.client.HTTPSConnection('apis.tianapi.com')
params = urllib.parse.urlencode({'key': 'YOUR_TIANAPI_KEY', 'text': 'hello there'})
headers = {'Content-type': 'application/x-www-form-urlencoded'}
conn.request('POST', '/entokenize/index', params, headers)
tianapi = conn.getresponse()
data = json.loads(tianapi.read().decode('utf-8'))
print(data)
```

---

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function（`edge-functions/en-tokenize.ts`）

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let text: string;
  try {
    const body = await req.json();
    text = body.text;
    if (!text) throw new Error("Missing text");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("TIANAPI_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch("https://apis.tianapi.com/entokenize/index", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: apiKey, text }).toString(),
  });

  if (upstream.status === 429 || upstream.status === 402) {
    return new Response(await upstream.text(), {
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

### 前端调用（推荐方式）

```typescript
async function fetchEnTokenize(text: string) {
  const { data, error } = await supabase.functions.invoke("en-tokenize", {
    body: { text },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.result;
}
```

### 前端调用（备用方式）

```typescript
async function fetchEnTokenize(text: string) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/en-tokenize`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }
  );

  if (res.status === 429) throw new Error(`配额已用尽：${(await res.json()).message}`);
  if (res.status === 402) throw new Error(`余额不足：${(await res.json()).message}`);
  if (!res.ok) throw new Error(`请求失败：${res.status}`);

  const json = await res.json();
  if (json.code !== 200) throw new Error(`API 错误 ${json.code}：${json.msg}`);
  return json.result;
}
```

---

## 注意事项

- **密钥安全**: `TIANAPI_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**: 务必处理 429（配额超限）和 402（余额不足）响应。
- **仅支持英文**: 本接口专用于英文文本分词，中文或其他语言文本不适用。
- **计费**: 请参考天行数据平台定价，避免不必要的重复调用。
