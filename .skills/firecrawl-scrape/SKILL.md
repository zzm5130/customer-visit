---
name: firecrawl-scrape
description: Scrape web pages into Markdown/HTML/JSON via Firecrawl. Use when extracting content from URLs, JS-rendered pages, PDFs, or protected sites.
license: MIT
metadata:
  id: skill_firecrawl_scrape
  display_name: Firecrawl 网页抓取
  trigger: [scrape, crawl, extract]
  key_type: user_managed
  scope_platform: all
  version: 1.0.0
---

# Firecrawl 网页抓取

## 能力概述

将任意网页转换为 LLM 可用格式（Markdown、HTML、JSON、截图），覆盖 96% 网页，包括 JS 渲染页面和受保护页面，响应 < 1 秒。

**Endpoint:** `POST https://api.firecrawl.dev/v2/scrape`

适用场景：AI 聊天机器人知识库构建、竞争情报抓取、深度研究、潜在客户信息提取。

### 请求参数

| 参数名    | 类型     | 必填 | 说明                                                   |
|---------|--------|------|------------------------------------------------------|
| url     | string | 是   | 目标网页 URL                                             |
| formats | array  | 否   | 输出格式，可选：`markdown`、`html`、`json`、`screenshot` |

### 返回字段说明

| 字段路径       | 类型     | 说明                            |
|------------|--------|-------------------------------|
| url        | string | 实际抓取的 URL                     |
| markdown   | string | Markdown 格式内容（需在 formats 中指定） |
| html       | string | HTML 原始内容（需在 formats 中指定）     |
| json       | object | 结构化 JSON 内容（需在 formats 中指定）   |
| screenshot | string | 页面截图 URL（需在 formats 中指定）      |

**响应示例：**
```json
{
  "url": "https://example.com",
  "markdown": "# Page Title\n\nContent...",
  "html": "<html>...</html>"
}
```

---

## 生成期用法（Agent 直接调用）

密钥从环境变量读取：`FIRECRAWL_API_KEY`。

```typescript
const apiKey = Deno.env.get("FIRECRAWL_API_KEY")!;

async function firecrawlScrape(
  url: string,
  formats: Array<"markdown" | "html" | "json" | "screenshot"> = ["markdown"]
): Promise<{ url: string; markdown?: string; html?: string; json?: object; screenshot?: string }> {
  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url, formats }),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (!json.success) throw new Error(`API error: ${JSON.stringify(json)}`);

  return json.data;
}
```

**调用示例：**
```typescript
const result = await firecrawlScrape("https://example.com", ["markdown", "html"]);
console.log(result.markdown);
```

---

## 生成后用法（应用内通过 Edge Function 调用）

```typescript
// edge-functions/firecrawl-scrape.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let url: string;
  let formats: string[];
  try {
    const body = await req.json();
    url = body.url;
    formats = body.formats ?? ["markdown"];
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

  const upstream = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url, formats }),
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

**前端调用（supabase client）：**

```typescript
async function scrapeUrl(url: string, formats = ["markdown"]) {
  const { data, error } = await supabase.functions.invoke("firecrawl-scrape", {
    body: { url, formats },
  });
  if (error) throw error;
  if (!data.success) throw new Error(`API 错误：${JSON.stringify(data)}`);
  return data.data;
}
```

**前端调用（备用方式）：**

```typescript
async function scrapeUrl(url: string, formats = ["markdown"]) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/firecrawl-scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats }),
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
  return json.data;
}
```

---

## 注意事项

- **密钥安全**：`FIRECRAWL_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足）两类错误。
- **格式选择**：`formats` 默认仅返回 `markdown`；若需截图或结构化 JSON，请显式指定，避免不必要的计费。
- **计费**：按请求次数计费，避免对同一 URL 重复抓取；建议在业务层做缓存。
- **JS 渲染**：Firecrawl 自动处理 JS 渲染和反爬机制，无需额外配置。
- **文档解析**：URL 指向 PDF/DOCX 时，Firecrawl 可直接解析并返回文本内容。
