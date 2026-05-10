---
name: poet-query
description: Query poet biography, dynasty, tags and achievements by name. Use for literary research, education, or cultural apps.
license: MIT
metadata:
  id: skill_poet_query
  display_name: 诗人查询
  trigger:
    - 诗人
    - 查询
    - 生平
  key_type: user_managed
  scope_platform: universal
  version: 1.0.0
---

# 诗人查询

根据诗人姓名查询其详细生平信息，支持分页获取多个同名诗人的资料。适用于文学研究、教育应用、文化传播等场景。

## 能力概述

- **接口地址**: `GET/POST https://cn.apihz.cn/api/zici/poet.php`
- **认证方式**: 开发者 ID + KEY 作为请求参数（user_managed）
- **核心能力**: 通过诗人姓名查询头像、称号、朝代、标签、生平介绍、轶事典故、家庭成员、后世纪念、主要成就等多维度信息
- **分页支持**: 每页最多 3 条，最大 50 页

### 返回示例

```json
{
  "code": 200,
  "page": 1,
  "data": [
    {
      "name": "李白",
      "image": "https://res.apihz.cn/hanzi//uploads/20230817/e64f31b56ae1d4acdb03ac4ae0de5cc9.jpg",
      "tag": "诗仙",
      "tags": "小学,描写秋天,边塞诗",
      "designation": "大李杜,酒中八仙",
      "dynasty": "唐代",
      "content": "诗人介绍...",
      "ysdg": "轶事典故...",
      "jtcy": "家庭成员...",
      "hsjn": "后世纪念...",
      "zycj": "主要成就...",
      "rwsp": "人物生平..."
    }
  ]
}
```

## 生成期用法（Agent 直接调用）

密钥从环境变量读取：`POET_API_ID`（开发者 ID）和 `POET_API_KEY`（开发者 KEY）。

```typescript
const API_ID = Deno.env.get("POET_API_ID")!;
const API_KEY = Deno.env.get("POET_API_KEY")!;

interface PoetInfo {
  name: string;
  image: string;
  tag: string;
  tags: string;
  designation: string;
  dynasty: string;
  content: string;
  ysdg: string;
  jtcy: string;
  hsjn: string;
  zycj: string;
  rwsp: string;
}

async function queryPoet(name: string, page = 1): Promise<PoetInfo[]> {
  const params = new URLSearchParams({
    id: API_ID,
    key: API_KEY,
    name,
    page: String(page),
  });

  const response = await fetch(`https://cn.apihz.cn/api/zici/poet.php?${params}`);
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API 错误 ${json.code}：${json.msg}`);

  return json.data;
}

// 示例
const poets = await queryPoet("李白");
console.log(poets[0].dynasty, poets[0].tag);
```

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/poet-query.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let name: string;
  let page = 1;
  try {
    const body = await req.json();
    name = body.name;
    if (!name) throw new Error("Missing name");
    if (body.page) page = Number(body.page);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiId = Deno.env.get("POET_API_ID");
  const apiKey = Deno.env.get("POET_API_KEY");
  if (!apiId || !apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const params = new URLSearchParams({ id: apiId, key: apiKey, name, page: String(page) });
  const upstream = await fetch(`https://cn.apihz.cn/api/zici/poet.php?${params}`);

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
async function fetchPoet(name: string, page = 1) {
  const { data, error } = await supabase.functions.invoke("poet-query", {
    body: { name, page },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function fetchPoet(name: string, page = 1) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/poet-query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, page }),
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
  return json.data;
}
```

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `name` | string | 是 | 诗人姓名，长度 1-50 |
| `page` | integer | 否 | 查询页码，每页最多 3 条，最大 50 页，默认第 1 页 |

### 返回字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 成功，400 错误 |
| `msg?` | string | 错误信息（仅失败时返回）|
| `page` | number | 当前页码 |
| `data` | array | 诗人数据列表 |
| `data[].name` | string | 诗人姓名 |
| `data[].image` | string | 诗人头像 URL |
| `data[].tag` | string | 诗人称号（如"诗仙"）|
| `data[].tags` | string | 诗人标签，逗号分隔 |
| `data[].designation` | string | 诗人所属组合（如"大李杜"）|
| `data[].dynasty` | string | 所属朝代 |
| `data[].content` | string | 诗人介绍（可能含 HTML）|
| `data[].ysdg` | string | 轶事典故（可能含 HTML）|
| `data[].jtcy` | string | 家庭成员信息 |
| `data[].hsjn` | string | 后世纪念（可能含 HTML）|
| `data[].zycj` | string | 主要成就（可能含 HTML）|
| `data[].rwsp` | string | 人物生平（可能含 HTML）|

## 注意事项

- **密钥安全**: `POET_API_ID` 和 `POET_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端
- **错误处理**: 务必处理 `code !== 200` 的业务错误（如秘钥错误返回 400）
- **编码**: 请求编码为 UTF-8；参数内容较大时建议使用 POST 方式
- **HTML 内容**: `content`、`ysdg`、`hsjn`、`zycj`、`rwsp` 字段可能包含 HTML 标签，展示前需进行过滤或安全渲染
- **分页**: 同名诗人可能有多条记录，可通过 `page` 参数翻页获取更多结果（最大 50 页）
