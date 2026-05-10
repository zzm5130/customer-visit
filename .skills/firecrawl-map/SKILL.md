---
name: firecrawl-map
description: Maps all URLs from a website using Firecrawl. Use when exploring site structure, building sitemaps, or crawling pages.
license: MIT
metadata:
  id: skill_firecrawl_map
  display_name: Firecrawl 网站地图抓取
  trigger: [map, sitemap, crawl]
  key_type: user_managed
  scope_platform: [claude-code, claude-ai]
  version: "1.0.0"
---

# Firecrawl 网站地图抓取

## 能力概述

使用 Firecrawl API 抓取指定网站的所有可访问 URL，构建完整的网站地图或页面清单。

- **Endpoint**: `POST https://api.firecrawl.dev/v1/map`
- **适用场景**: 网站结构分析、SEO 审计、竞争情报收集、爬取前置 URL 发现

**响应示例:**

```json
{
  "success": true,
  "links": [
    "https://firecrawl.dev",
    "https://firecrawl.dev/docs",
    "https://firecrawl.dev/pricing"
  ]
}
```

## 生成期用法（Agent 直接调用）

```typescript
const apiKey = Deno.env.get("FIRECRAWL_API_KEY")!;

async function mapWebsite(url: string): Promise<{ success: boolean; links: string[] }> {
  const response = await fetch("https://api.firecrawl.dev/v1/map", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (!json.success) throw new Error(`API error: ${JSON.stringify(json)}`);

  return json;
}
```

## 生成后用法（应用内通过 Edge Function 调用）

```typescript
// edge-functions/firecrawl-map.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let url: string;
  try {
    const body = await req.json();
    url = body.url;
    if (!url) throw new Error("Missing url");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstream = await fetch("https://api.firecrawl.dev/v1/map", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url }),
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

**前端调用（推荐方式）：**

```typescript
async function mapWebsite(url: string) {
  const { data, error } = await supabase.functions.invoke("firecrawl-map", {
    body: { url },
  });
  if (error) throw error;
  if (!data.success) throw new Error(`API 错误：${JSON.stringify(data)}`);
  return data.links as string[];
}
```

**前端调用（备用方式）：**

```typescript
async function mapWebsite(url: string) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/firecrawl-map`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
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
  if (!json.success) throw new Error(`API 错误：${JSON.stringify(json)}`);

  return json.links as string[];
}
```

## 参数说明

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `url` | `string` | 是 | 需要抓取 URL 地图的目标网站地址 |

**返回字段说明**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `success` | `boolean` | 请求是否成功 |
| `links` | `string[]` | 抓取到的所有 URL 列表 |

## 注意事项

- **密钥安全**: `FIRECRAWL_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**: 务必处理 429（请求频率超限）和 402（余额不足）。
- **使用成本**: 每次 Map 请求消耗 Firecrawl 配额，避免对同一网站重复调用；详见 Firecrawl 定价页面。
- **大型网站**: 页面数量极多的网站可能耗时较长，注意客户端超时设置。
