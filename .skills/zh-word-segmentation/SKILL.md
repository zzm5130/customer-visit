---
name: zh-word-segmentation
description: Tokenize Chinese text and extract keywords/names/places via 天行数据 NLP. Use when analyzing or segmenting Chinese content.
license: MIT
metadata:
  id: skill_zh_word_segmentation
  display_name: 中文智能分词
  trigger: [分词, NLP, 文本分析]
  key_type: user_managed
  scope_platform: general
  version: "1.0.0"
---

## 能力概述

天行数据自然语言处理分词接口，对中文文本进行智能分词，识别人名（nr）、地名（ns）、机构名（nt）等命名实体，输出带词性标注的分词列表。

- **Endpoint**: POST https://apis.tianapi.com/nlpwords/index
- **认证方式**: API Key（通过请求体 `key` 字段传递）
- **Content-Type**: `application/x-www-form-urlencoded`

**响应示例**（输入：`今天小天和kitty去上海外滩和南京东路玩`）：

```json
{
  "code": 200,
  "msg": "success",
  "result": {
    "list": [
      {"word": "今天", "type": "t"},
      {"word": "小天", "type": "nr"},
      {"word": "kitty", "type": "eng"},
      {"word": "上海外滩", "type": "ns"},
      {"word": "南京东路", "type": "ns"}
    ]
  }
}
```

常见词性说明：`n`（名词）、`nr`（人名）、`ns`（地名）、`nt`（机构名）、`v`（动词）、`t`（时间词）、`eng`（英文）。

## 生成期用法（Agent 直接调用）

密钥从环境变量 `TIANAPI_KEY` 读取（user_managed，用户自行在环境中配置）。

```typescript
const TIANAPI_KEY = Deno.env.get("TIANAPI_KEY")!;

async function segmentChineseText(content: string): Promise<Array<{ word: string; type: string }>> {
  const response = await fetch("https://apis.tianapi.com/nlpwords/index", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ key: TIANAPI_KEY, content }).toString(),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.result.list;
}

// 示例
const words = await segmentChineseText("今天小天和kitty去上海外滩和南京东路玩");
console.log(words);
// [{ word: "今天", type: "t" }, { word: "小天", type: "nr" }, ...]
```

## 生成后用法（应用内通过 Edge Function 调用）

**Edge Function** (`edge-functions/zh-word-segmentation.ts`):

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let content: string;
  try {
    const body = await req.json();
    content = body.content;
    if (!content) throw new Error("Missing content");
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

  const upstream = await fetch("https://apis.tianapi.com/nlpwords/index", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ key: apiKey, content }).toString(),
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

**前端调用**（推荐，supabase client 可用时）：

```typescript
async function segmentText(content: string) {
  const { data, error } = await supabase.functions.invoke("zh-word-segmentation", {
    body: { content },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.result.list as Array<{ word: string; type: string }>;
}
```

**前端调用**（备用，无 supabase client 时）：

```typescript
async function segmentText(content: string) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zh-word-segmentation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
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
  return json.result.list as Array<{ word: string; type: string }>;
}
```

## 参数说明

**请求参数**

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `key` | string | 是 | 天行数据 API 密钥（服务端注入，勿暴露到前端） |
| `content` | string | 是 | 待分词的中文文本内容 |

**返回字段说明**

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `msg` | string | 状态描述 |
| `result.list` | array | 分词结果列表 |
| `result.list[].word` | string | 分词词语 |
| `result.list[].type` | string | 词性标注（`nr` 人名、`ns` 地名、`n` 名词、`v` 动词等） |

## 注意事项

- **密钥安全**: `TIANAPI_KEY` 仅可在 Edge Function 服务端读取，严禁通过前端直接调用天行接口或将密钥写入客户端代码。
- **错误处理**: 务必处理 API 非 200 响应码，如 101（认证失败）、102（参数缺失）等。
- **文本长度**: 建议单次分词文本不超过 500 字，超长文本请拆分后分批调用。
- **计费**: 按调用次数计费，避免对同一文本重复请求；请在天行数据后台查看当前配额与余额。
