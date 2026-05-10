---
name: firecrawl-1
description: 网页抓取与内容提取，将任意 URL/网站转为 LLM 可读 Markdown。凡涉及网页抓取、数据采集、全站爬取、网络搜索或结构化内容提取，均应使用本 Skill。
license: MIT
metadata:
  id: skill_firecrawl
  display_name: Firecrawl 网页抓取
  trigger: scrape, crawl, extract
  key_type: user_managed
  scope_platform: all
  version: 1.0.0
---

# Firecrawl 网页抓取与数据提取

Firecrawl 将任意网页或整站内容转换为 LLM 就绪的 Markdown，支持结构化 JSON 提取、批量采集、智能搜索和 AI 代理等高级特性。

## 能力概述

| 能力 | 接口 | 同步/异步 | 适用场景 |
|------|------|-----------|----------|
| 单页抓取 | `POST /v2/scrape` | 同步 | 抓取单个 URL，可结合 JSON Schema 提取结构化数据 |
| 全站爬取 | `POST /v2/crawl` | **异步** | 递归抓取网站所有子页面 |
| 批量抓取 | `POST /v2/batch/scrape` | **异步** | 并发抓取多个已知 URL |
| 网站地图 | `POST /v2/map` | 同步 | 快速列出网站全部 URL |
| 网络搜索 | `POST /v2/search` | 同步 | 搜索网络并返回完整页面内容 |
| AI 代理 | `POST /v2/agent` | **异步** | 自然语言描述需求，AI 自动完成数据采集 |

**Base URL**：`https://api.firecrawl.dev/v2`  
**认证**：所有接口均需 `Authorization: Bearer <FIRECRAWL_API_KEY>`

## 接口选择指南

- 单个 URL → `/v2/scrape`（同步，立即返回）
- 多个已知 URL → `/v2/batch/scrape`（异步，提交后轮询）
- 爬取整站 → `/v2/crawl`（异步，提交后轮询）
- 先发现 URL 再按需抓取 → `/v2/map` + `/v2/scrape`
- 不知道具体 URL → `/v2/search`
- 复杂采集任务 → `/v2/agent`（描述需求，AI 自动规划）

> 各接口的完整参数和代码示例请阅读对应 references 文件：
> - `references/scrape-api.md` — 单页抓取
> - `references/crawl-api.md` — 全站爬取
> - `references/batch-api.md` — 批量抓取
> - `references/map-api.md` — 网站地图
> - `references/search-api.md` — 网络搜索
> - `references/agent-api.md` — AI 代理

## 异步轮询模式

`/v2/crawl`、`/v2/batch/scrape`、`/v2/agent` 均为异步接口：提交后获得任务 ID，再轮询查询状态直至 `completed`。

```typescript
async function pollUntilDone(
  taskId: string,
  queryFn: (id: string) => Promise<{ status: string; [key: string]: any }>
) {
  const POLL_INTERVAL_MS = 5000;
  const TIMEOUT_MS = 10 * 60 * 1000;
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const result = await queryFn(taskId);
    if (result.status === "completed") return result;
    if (result.status === "failed") throw new Error(`Task failed: ${JSON.stringify(result)}`);
    // scraping / pending → 继续轮询
  }
  throw new Error(`Task ${taskId} timed out after 10 minutes`);
}
```

## 生成期用法（Agent 直接调用）

密钥从环境变量读取，绝不硬编码：

```typescript
const API_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;
const BASE_URL = "https://api.firecrawl.dev/v2";

async function firecrawlPost(path: string, body: object): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (!json.success) throw new Error(`API error: ${JSON.stringify(json)}`);
  return json;
}

async function firecrawlGet(path: string): Promise<any> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Authorization": `Bearer ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  return res.json();
}
```

各接口的具体调用示例见对应 references 文件。

## 生成后用法（应用内通过 Edge Function 调用）

客户端通过 Supabase Edge Function 调用，避免将 `FIRECRAWL_API_KEY` 暴露到浏览器端。各接口的完整 Edge Function 实现见对应 references 文件中的「生成后用法」章节。

**前端调用示例（以单页抓取为例）：**

```typescript
// 推荐方式（supabase client 可用时）
async function scrapeUrl(url: string) {
  const { data, error } = await supabase.functions.invoke("firecrawl-scrape", {
    body: { url },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误：${data.msg}`);
  return data.data;
}

// 备用方式
async function scrapeUrl(url: string) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/firecrawl-scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (res.status === 429) throw new Error(`配额已用尽：${(await res.json()).message}`);
  if (res.status === 402) throw new Error(`余额不足：${(await res.json()).message}`);
  if (!res.ok) throw new Error(`请求失败：${res.status}`);
  return (await res.json()).data;
}
```

## 通用抓取参数（scrapeOptions）

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `formats` | array | `["markdown"]` | 输出格式：`markdown`、`html`、`rawHtml`、`links`、`screenshot`、`json`、`summary`、`images`、`branding` |
| `onlyMainContent` | boolean | `true` | 仅返回主体内容，过滤导航/页脚等 |
| `maxAge` | integer | `172800000` | 缓存有效期（毫秒），默认 2 天；启用可提速 5 倍 |
| `waitFor` | integer | `0` | 页面加载后额外等待时间（毫秒） |
| `proxy` | string | `"auto"` | `basic`（快）/ `stealth`（5 积分，反爬）/ `auto` |
| `actions` | array | — | 抓取前执行的页面操作（`click`、`scroll`、`write`、`executeJavascript` 等） |
| `headers` | object | — | 自定义请求头（Cookie、User-Agent 等） |
| `mobile` | boolean | `false` | 模拟移动设备 |

## 常用返回字段

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `success` | boolean | 请求是否成功 |
| `data.markdown` | string | Markdown 格式页面内容 |
| `data.html` | string? | HTML 内容（需在 `formats` 中指定） |
| `data.summary` | string? | 页面摘要（需指定 `summary` 格式） |
| `data.links` | string[]? | 页面链接列表（需指定 `links` 格式） |
| `data.screenshot` | string? | 截图 URL（24 小时后过期） |
| `data.metadata.title` | string | 页面标题 |
| `data.metadata.sourceURL` | string | 来源 URL |
| `data.metadata.statusCode` | integer | HTTP 状态码 |

## 注意事项

- **密钥安全**：`FIRECRAWL_API_KEY` 仅可在服务端 Edge Function 中读取，严禁传递到前端或写入代码。
- **错误处理**：务必处理 `429`（配额超限）和 `402`（余额不足），两类错误需向用户明确提示。
- **计费提示**：
  - 单页抓取通常消耗 1 积分
  - `stealth` 代理每次最多消耗 5 积分
  - PDF 解析默认开启，按页计费（1 积分/页）
  - 合理使用 `maxAge` 利用缓存，减少不必要的重复抓取
- **异步超时**：爬取/批量/代理任务轮询上限建议设为 10 分钟，超时后应向用户反馈而非静默失败。
- **速率限制**：遇到 `429` 时等待后再重试，不要立即循环重请求。
