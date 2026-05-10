---
name: firecrawl
description: "Firecrawl web scraping: scrape, crawl, extract, search. Use when fetching URLs or crawling sites for LLM-ready content."
license: MIT
metadata:
  id: skill_firecrawl
  display_name: Firecrawl 网页抓取
  trigger: [scrape, crawl, firecrawl]
  key_type: user_managed
  scope_platform: all
  version: 1.0.0
---

# Firecrawl 网页抓取

将网站转换为 LLM 就绪数据的 API 工具，支持单页抓取、网站爬取、结构化数据提取和网页搜索。

## 能力概述

| 功能 | Endpoint | 说明 |
|------|----------|------|
| 单页抓取 | `POST https://api.firecrawl.dev/v1/scrape` | 抓取单个 URL，返回 markdown / HTML / 截图 |
| 网站爬取（提交） | `POST https://api.firecrawl.dev/v1/crawl` | 异步提交爬取任务，自动发现所有子页面 |
| 网站爬取（查询） | `GET https://api.firecrawl.dev/v2/crawl/{id}` | 轮询爬取任务状态与结果 |
| 网页搜索 | `POST https://api.firecrawl.dev/v1/search` | 搜索网页，返回 URL / 标题 / 描述 |

**认证方式**：所有请求 Header 中添加 `Authorization: Bearer <FIRECRAWL_API_KEY>`。

**响应示例（单页抓取）**：
```json
{
  "success": true,
  "data": {
    "markdown": "Launch Week I is here!...",
    "html": "<!DOCTYPE html>...",
    "metadata": {
      "title": "Home - Firecrawl",
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
  "Content-Type": "application/json",
  "Authorization": `Bearer ${API_KEY}`,
};

// 单页抓取
async function scrapePage(url: string, formats = ["markdown"]) {
  const res = await fetch(`${BASE}/v1/scrape`, {
    method: "POST",
    headers,
    body: JSON.stringify({ url, formats }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(JSON.stringify(json));
  return json.data; // { markdown?, html?, metadata }
}

// 网站爬取（异步，提交后轮询）
async function crawlSite(url: string, limit = 100, formats = ["markdown"]) {
  const submitRes = await fetch(`${BASE}/v1/crawl`, {
    method: "POST",
    headers,
    body: JSON.stringify({ url, limit, scrapeOptions: { formats } }),
  });
  if (!submitRes.ok) throw new Error(`Submit HTTP ${submitRes.status}`);
  const { id } = await submitRes.json();

  const POLL_INTERVAL_MS = 5000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const pollRes = await fetch(`${BASE}/v2/crawl/${id}`, { headers });
    const result = await pollRes.json();
    if (result.status === "completed") return result.data; // 页面数组
    if (result.status === "failed") throw new Error(`Crawl failed: ${id}`);
    // status === "scraping" → 继续等待
  }
  throw new Error(`Crawl timed out: ${id}`);
}

// 网页搜索
async function searchWeb(query: string, limit = 5) {
  const res = await fetch(`${BASE}/v1/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, limit }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(JSON.stringify(json));
  return json.data; // { web: [...], images: [...], news: [...] }
}
```

---

## 生成后用法（应用内通过 Edge Function 调用）

Edge Function 在服务端注入 API Key，浏览器端永远不接触原始密钥。

**Edge Function（`edge-functions/firecrawl-scrape.ts`）：**

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let url: string;
  let formats: string[] = ["markdown"];
  try {
    const body = await req.json();
    url = body.url;
    if (!url) throw new Error("Missing url");
    if (body.formats) formats = body.formats;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) return new Response(JSON.stringify({ error: "Server configuration error" }), {
    status: 500, headers: { "Content-Type": "application/json" },
  });

  const upstream = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ url, formats }),
  });

  if (upstream.status === 429 || upstream.status === 402) {
    return new Response(await upstream.text(), {
      status: upstream.status, headers: { "Content-Type": "application/json" },
    });
  }
  if (!upstream.ok) return new Response(
    JSON.stringify({ error: `Upstream error: ${upstream.status}` }),
    { status: 502, headers: { "Content-Type": "application/json" } }
  );

  return new Response(await upstream.text(), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
```

**前端调用（推荐，supabase client 可用时）：**

```typescript
async function scrapePage(url: string, formats = ["markdown"]) {
  const { data, error } = await supabase.functions.invoke("firecrawl-scrape", {
    body: { url, formats },
  });
  if (error) throw error;
  if (!data.success) throw new Error(`API 错误：${JSON.stringify(data)}`);
  return data.data;
}
```

**备用方式（无 supabase client）：**

```typescript
async function scrapePage(url: string, formats = ["markdown"]) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/firecrawl-scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats }),
  });
  if (res.status === 429) throw new Error(`配额已用尽：${(await res.json()).message}`);
  if (res.status === 402) throw new Error(`余额不足：${(await res.json()).message}`);
  if (!res.ok) throw new Error(`请求失败：${res.status}`);
  const json = await res.json();
  if (!json.success) throw new Error(`API 错误：${JSON.stringify(json)}`);
  return json.data;
}
```

---

## 参数说明

### 单页抓取（/v1/scrape）请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `url` | `string` | ✓ | 目标 URL |
| `formats` | `string[]` | 否 | 输出格式：`markdown`、`html`、`json`、`screenshot` |
| `actions` | `Action[]` | 否 | 抓取前的页面交互序列（见下方说明） |

### 网站爬取（/v1/crawl）请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `url` | `string` | ✓ | 爬取入口 URL |
| `limit` | `number` | 否 | 最大页面数，默认不限 |
| `scrapeOptions.formats` | `string[]` | 否 | 每页输出格式 |

### 返回字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `success` | `boolean` | 是否成功 |
| `data.markdown` | `string?` | Markdown 格式内容 |
| `data.html` | `string?` | 原始 HTML |
| `data.metadata.title` | `string?` | 页面标题 |
| `data.metadata.description` | `string?` | 页面描述 |
| `data.metadata.sourceURL` | `string` | 实际抓取 URL |
| `data.metadata.statusCode` | `number` | HTTP 状态码 |

---

## 页面交互操作（Actions）

抓取动态内容或需要登录的页面时，在 `actions` 字段中指定操作序列：

```json
"actions": [
  { "type": "write",      "text": "user@example.com" },
  { "type": "press",      "key": "Tab" },
  { "type": "write",      "text": "password" },
  { "type": "click",      "selector": "button[type=\"submit\"]" },
  { "type": "wait",       "milliseconds": 1500 },
  { "type": "screenshot", "fullPage": true }
]
```

支持类型：`wait`、`click`、`write`、`press`、`screenshot`。

---

## 注意事项

- **密钥安全**：`FIRECRAWL_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端。
- **爬取是异步的**：`/v1/crawl` 提交后需轮询 `/v2/crawl/{id}`，建议间隔 5 秒，设置 10 分钟超时。
- **错误处理**：务必处理 429（配额超限）和 402（余额不足），这两类错误体需原样透传给前端。
- **按需选择格式**：只请求实际需要的格式（如只需 markdown 则不要加 html），减少响应体积和计费。
- **计费**：按页面抓取数量计费，`creditsUsed` 字段返回本次消耗积分，避免不必要的重复爬取。
