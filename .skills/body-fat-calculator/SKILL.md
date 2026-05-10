---
name: body-fat-calculator
description: 根据身高、体重、年龄计算体脂率。Use when users want to calculate or estimate body fat percentage.
license: MIT
metadata:
  id: skill_body_fat_calculator
  display_name: 体脂率计算
  trigger:
    - 体脂率
    - 身体成分
    - 健康评估
  key_type: user_managed
  scope_platform: tianapi
  version: 1.0.0
---

## 能力概述

调用天行数据体脂率计算接口，根据用户身高、体重、年龄三项基本信息，计算并返回体脂率数据，帮助用户了解身体健康状况。

- **Endpoint**: POST https://apis.tianapi.com/bfrsum/index
- **Content-Type**: application/x-www-form-urlencoded

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| key | string | 是 | 天行数据 API 密钥（TIANAPI_KEY） |
| height | integer | 是 | 身高（厘米） |
| weight | integer | 是 | 体重（公斤） |
| age | integer | 是 | 年龄（岁） |

### 返回字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | `number` | 状态码，200 表示成功 |
| `msg` | `string` | 状态描述 |
| `result` | `object` | 体脂率结果数据 |
| `result.bfr` | `number` | 体脂率（%） |

### 请求示例

```bash
curl -X POST \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "key=YOUR_KEY&height=172&weight=58&age=30" \
  "https://apis.tianapi.com/bfrsum/index"
```

---

## 生成期用法（Agent 直接调用）

```typescript
const API_KEY = "<TIANAPI_KEY>"; // user_managed：替换为实际的天行数据 API 密钥

async function calculateBodyFatRate(
  height: number, // 身高（厘米）
  weight: number, // 体重（公斤）
  age: number     // 年龄（岁）
): Promise<{ bfr: number }> {
  const response = await fetch("https://apis.tianapi.com/bfrsum/index", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      key: API_KEY,
      height: String(height),
      weight: String(weight),
      age: String(age),
    }).toString(),
  });

  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.result;
}

// 示例：172cm、58kg、30岁用户的体脂率
const result = await calculateBodyFatRate(172, 58, 30);
console.log(`体脂率：${result.bfr}%`);
```

---

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/body-fat-calculator.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let height: number, weight: number, age: number;
  try {
    const body = await req.json();
    height = body.height;
    weight = body.weight;
    age = body.age;
    if (!height || !weight || !age) throw new Error("Missing required parameters");
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

  const upstream = await fetch("https://apis.tianapi.com/bfrsum/index", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      key: apiKey,
      height: String(height),
      weight: String(weight),
      age: String(age),
    }).toString(),
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
async function fetchBodyFatRate(height: number, weight: number, age: number) {
  const { data, error } = await supabase.functions.invoke("body-fat-calculator", {
    body: { height, weight, age },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.result;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function fetchBodyFatRate(height: number, weight: number, age: number) {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/body-fat-calculator`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ height, weight, age }),
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

---

## 注意事项

- **密钥安全**: `TIANAPI_KEY` 仅可在服务端（Edge Function）读取，严禁在前端代码中硬编码或暴露。
- **错误处理**: 务必处理 429（配额超限）和 402（余额不足）两种上游错误。
- **参数要求**: `height`、`weight`、`age` 均需为合理范围内的正整数，传入非法值将导致接口返回错误。
- **数据声明**: 本接口返回结果为估算值，仅供健康参考，不作为医疗诊断依据。
