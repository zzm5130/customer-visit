Description长度：118字符，符合要求。以下是生成的 SKILL.md 内容：

---

```markdown
---
name: firecrawl-2
description: "Convert URLs to LLM-ready markdown via Firecrawl. Use when scraping pages, crawling sites, or extracting data for AI."
license: MIT
metadata:
  id: skill_firecrawl
  display_name: Firecrawl 网页抓取
  trigger:
    - scrape
    - crawl
    - web
  key_type: user_managed
  scope_platform: general
  version: 1.0.0
---

# Firecrawl 网页抓取

将任意网页或整站转换为 LLM 就绪的干净 Markdown，专为 AI 数据采集场景设计。支持单页抓取、全站爬取、网页搜索、结构化数据提取和页面交互操作。

## 能力概述

| 功能 | 端点 | 说明 |
|------|------|------|
| 单页抓取 | `POST https://api.firecrawl.dev/v2/scrape` | 抓取指定 URL，返回 markdown/HTML/截图等 |
| 全站爬取（提交）| `POST https://api.firecrawl.dev/v2/crawl` | 提交异步爬取任务，自动发现所有子页面 |
| 全站爬取（查询）| `GET https://api.firecrawl.dev/v2/crawl/{id}` | 轮询任务状态与已完成数据 |
| 网页搜索 | `POST https://api.firecrawl.dev/v2/search` | 搜索网页并返回结构化结果 |

**认证：** `Authorization: Bearer ${FIRECRAWL_API_KEY}`

**响应成功标志：** `response.success === true`

### 单页抓取响应示例

```json
{
  "success": true,
  "data": {
    "markdown": "Launch Week I is here!...",
    "html": "<!DOCTYPE html>...",
    "metadata": {
      "title": "Home - Firecrawl",
      "description": "Firecrawl crawls and converts any website into clean markdown.",
      "sourceURL": "https://firecrawl.dev",
      "statusCode": 200
    }
  }
}
```

---

## 生成期用法（Agent 直接调用）

```typescript
const API_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;
const BASE = "https://api.firecrawl.dev";
const headers = {
  "Authorization": `Bearer ${API_KEY}`,
  "Content-Type": "application/json",
};

// ── 单页抓取 ──────────────────────────────────────────────────────────────────
async function scrapePage(
  url: string,
  formats: string[] = ["markdown"]
): Promise<{ markdown?: string; html?: string; json?: unknown; metadata: Record<string, unknown> }> {
  const res = await fetch(`${BASE}/v2/scrape`, {
    method: "POST",
    headers,
    body: JSON.stringify({ url, formats }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(`Scrape failed: ${JSON.stringify(json)}`);
  return json.data;
}

// ── 结构化数据提取（prompt 方式，无需预定义 schema）────────────────────────────
async function extractStructured(url: string, prompt: string): Promise<unknown> {
  const data = await scrapePage(url, [{ type: "json", prompt } as unknown as string]);
  return (data as Record<string, unknown>).json;
}

// ── 全站爬取（异步，需轮询）──────────────────────────────────────────────────
async function crawlWebsite(
  url: string,
  limit = 10
): Promise<Array<{ markdown: string; metadata: Record<string, unknown> }>> {
  // 1. 提交任务
  const submitRes = await fetch(`${BASE}/v2/crawl`, {
    method: "POST",
    headers,
    body: JSON.stringify({ url, limit }),
  });
  if (!submitRes.ok) throw new Error(`Submit failed: HTTP ${submitRes.status}`);
  const { id: crawlId } = await submitRes.json();

  // 2. 轮询直到完成（建议间隔 5–10 秒，超时 10 分钟）
  const POLL_INTERVAL_MS = 7000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const statusRes = await fetch(`${BASE}/v2/crawl/${crawlId}`, { headers });
    const status = await statusRes.json();
    if (status.status === "completed") return status.data;
    if (status.status === "failed") throw new Error(`Crawl ${crawlId} failed`);
    // "scraping" | "pending" → 继续轮询
  }
  throw new Error(`Crawl ${crawlId} timed out after 10 minutes`);
}

// ── 网页搜索 ──────────────────────────────────────────────────────────────────
async function searchWeb(
  query: string,
  limit = 5
): Promise<{ web: Array<{ url: string; title: string; description: string }> }> {
  const res = await fetch(`${BASE}/v2/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(`Search failed: ${JSON.stringify(json)}`);
  return json.data;
}
```

### 页面交互操作（抓取登录后内容等）

在抓取前通过 `actions` 执行点击、输入、等待、截图等操作：

```typescript
const doc = await fetch(`${BASE}/v2/scrape`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    url: "https://example.com/login",
    formats: ["markdown"],
    actions: [
      { type: "write", text: "user@example.com" },
      { type: "press", key: "Tab" },
      { type: "write", text: "password" },
      { type: "click", selector: 'button[type="submit"]' },
      { type: "wait", milliseconds: 1500 },
      { type: "screenshot", fullPage: true },
    ],
  }),
}).then((r) => r.json());
// doc.data.markdown — 登录后的页面内容
// doc.data.actions.screenshots — 截图 URL 数组
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

  // --- 解析请求 ---
  let url: string;
  let formats: unknown;
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

  // --- 注入密钥（绝不暴露给前端）---
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // --- 调用 Firecrawl ---
  const upstream = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url, formats }),
  });

  // 透传配额/余额错误
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

**前端调用（推荐，supabase client 可用时）：**

```typescript
async function scrapeUrl(url: string, formats = ["markdown"]) {
  const { data, error } = await supabase.functions.invoke("firecrawl-scrape", {
    body: { url, formats },
  });
  if (error) throw error;
  if (!data.success) throw new Error(`Scrape error: ${data.error}`);
  return data.data; // { markdown, html, metadata, ... }
}
```

**前端调用（备用，无 supabase client 时）：**

```typescript
async function scrapeUrl(url: string, formats = ["markdown"]) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/firecrawl-scrape`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats }),
    }
  );
  if (res.status === 429) throw new Error("配额已用尽");
  if (res.status === 402) throw new Error("余额不足");
  if (!res.ok) throw new Error(`请求失败：${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(`API 错误：${json.error}`);
  return json.data;
}
```

---

## 参数说明

### 单页抓取（POST /v2/scrape）

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `url` | `string` | ✅ | 目标页面 URL |
| `formats` | `string[]` | 否 | 输出格式：`markdown`、`html`、`screenshot`、`json`（默认 `["markdown"]`）|
| `actions` | `Action[]` | 否 | 抓取前的页面交互序列（点击、输入、等待、截图）|
| `onlyMainContent` | `boolean` | 否 | 仅提取主体内容，过滤导航栏/页脚等噪音 |
| `waitFor` | `number` | 否 | 抓取前等待毫秒数（适用于懒加载页面）|

### 全站爬取（POST /v2/crawl）

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `url` | `string` | ✅ | 起始 URL |
| `limit` | `number` | 否 | 最大爬取页面数 |
| `maxDepth` | `number` | 否 | 最大爬取深度 |
| `includePaths` | `string[]` | 否 | 仅爬取匹配的路径模式（如 `["/docs/*"]`）|
| `excludePaths` | `string[]` | 否 | 排除匹配的路径模式 |

### 网页搜索（POST /v2/search）

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `query` | `string` | ✅ | 搜索关键词 |
| `limit` | `number` | 否 | 返回结果数（默认 5）|
| `lang` | `string` | 否 | 语言代码，如 `zh`、`en` |

### 返回字段（单页抓取）

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `success` | `boolean` | 是否成功 |
| `data.markdown` | `string?` | Markdown 格式正文 |
| `data.html` | `string?` | 原始 HTML |
| `data.json` | `object?` | 结构化提取结果（使用 json format 时）|
| `data.metadata.title` | `string` | 页面标题 |
| `data.metadata.description` | `string?` | 页面描述 |
| `data.metadata.sourceURL` | `string` | 实际抓取的 URL |
| `data.metadata.statusCode` | `number` | HTTP 状态码 |

---

## 注意事项

- **密钥安全**：`FIRECRAWL_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端代码或客户端请求中。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足），这两类错误需告知用户而非静默失败。
- **爬取为异步任务**：`POST /v2/crawl` 仅返回任务 ID，必须轮询 `GET /v2/crawl/{id}` 直到 `status === "completed"`；建议间隔 5–10 秒，并设置 10 分钟超时上限。
- **计费**：Firecrawl 按页面抓取量计费，全站爬取时务必合理设置 `limit`，避免因无限爬取产生大量费用。
- **动态内容**：JavaScript 渲染的页面使用 `waitFor` 参数等待内容加载；需登录的页面使用 `actions` 完成交互后再抓取。
- **频率限制**：免费套餐有 API 调用频率限制，生产环境建议使用付费套餐以获得更高并发和配额。
