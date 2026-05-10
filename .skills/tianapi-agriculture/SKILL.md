---
name: tianapi-agriculture
description: "天行数据农业信息查询接口。Use when fetching agricultural news or data from Tianxing API."
license: MIT
metadata:
  id: skill_tianapi_agriculture
  display_name: 天行数据农业信息接口
  trigger: ["农业信息", "农业数据", "天行数据"]
  key_type: user_managed
  scope_platform: all
  version: "1.0.0"
---

## 能力概述

通过天行数据 POST 接口获取农业相关信息数据。

- **Endpoint**: `POST https://apis.tianapi.com/nongye/index`
- **认证方式**: API Key（通过请求体参数 `key` 传递）
- **Content-Type**: `application/x-www-form-urlencoded`
- **返回格式**: JSON

**响应示例：**

```json
{
  "code": 200,
  "msg": "success",
  "result": []
}
```

## 生成期用法（Agent 直接调用）

从环境变量读取用户配置的密钥，直接调用接口：

```typescript
const TIANAPI_KEY = Deno.env.get("TIANAPI_KEY")!; // 用户设置的天行数据 API 密钥

async function fetchAgricultureInfo(num: number = 10): Promise<unknown[]> {
  const response = await fetch("https://apis.tianapi.com/nongye/index", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      key: TIANAPI_KEY,
      num: String(num),
    }).toString(),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.result;
}
```

或使用 Python：

```python
import http.client, urllib, json, os

def fetch_agriculture_info(num=10):
    key = os.environ["TIANAPI_KEY"]
    conn = http.client.HTTPSConnection("apis.tianapi.com")
    params = urllib.parse.urlencode({"key": key, "num": str(num)})
    headers = {"Content-type": "application/x-www-form-urlencoded"}
    conn.request("POST", "/nongye/index", params, headers)
    data = json.loads(conn.getresponse().read().decode("utf-8"))
    if data["code"] != 200:
        raise Exception(f"API error {data['code']}: {data['msg']}")
    return data["result"]
```

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/tianapi-agriculture.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let num = 10;
  try {
    const body = await req.json();
    if (body.num !== undefined) num = Number(body.num);
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

  const upstream = await fetch("https://apis.tianapi.com/nongye/index", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: apiKey, num: String(num) }).toString(),
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
async function fetchAgricultureInfo(num: number = 10) {
  const { data, error } = await supabase.functions.invoke("tianapi-agriculture", {
    body: { num },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.result;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function fetchAgricultureInfo(num: number = 10) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tianapi-agriculture`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ num }),
    }
  );

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
| `key` | `string` | 是 | 天行数据 API 密钥（由 Edge Function 从环境变量注入，勿暴露到前端） |
| `num` | `integer` | 否 | 返回数据条数，默认 10 |

### 返回字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | `number` | 状态码，200 表示成功 |
| `msg` | `string` | 状态描述 |
| `result` | `array` | 农业信息数据列表（字段结构以接口实际返回为准） |

## 注意事项

- **密钥安全**: `TIANAPI_KEY` 仅可在 Edge Function 服务端通过 `Deno.env.get("TIANAPI_KEY")` 读取，严禁暴露到前端。
- **错误处理**: 务必处理 429（配额超限）和 402（余额不足）两类错误。
- **计费**: 请参考天行数据官网计费标准，避免不必要的高频重复调用。
- **result 字段**: 接口文档未列出 `result` 数组内部字段，建议在开发前先打印原始响应以确认数据结构。
