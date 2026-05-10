---
name: horoscope-fortune
description: 查询十二星座今日/本周/本月/本年运势，含综合、健康、爱情、财运、工作分析。Use when user asks about zodiac horoscope or 星座运势.
license: MIT
metadata:
  id: skill_horoscope_fortune
  display_name: 星座运势查询
  trigger: [星座, 运势, horoscope]
  key_type: no_key
  scope_platform: all
  version: 1.0.0
---

# 星座运势查询

## 能力概述

- **Endpoint**: `GET https://v2.xxapi.cn/api/horoscope`
- 免费接口，无需鉴权，支持查询十二星座在今日、本周、本月、本年的运势信息
- 返回综合、健康、爱情、财运、工作五维运势评分与详细描述，以及幸运颜色、幸运数字、幸运星座、宜忌建议

### 星座参数对照

| 中文 | type 值 |
|------|---------|
| 白羊座 | aries |
| 金牛座 | taurus |
| 双子座 | gemini |
| 巨蟹座 | cancer |
| 狮子座 | leo |
| 处女座 | virgo |
| 天秤座 | libra |
| 天蝎座 | scorpio |
| 射手座 | sagittarius |
| 摩羯座 | capricorn |
| 水瓶座 | aquarius |
| 双鱼座 | pisces |

### 返回示例

```json
{
  "code": 200,
  "msg": "数据请求成功",
  "data": {
    "title": "白羊座",
    "type": "今日运势",
    "time": "9月3日",
    "shortcomment": "结果好坏取决你",
    "fortune": { "all": 4, "health": 4, "love": 2, "money": 4, "work": 4 },
    "fortunetext": {
      "all": "综合运势详细描述",
      "health": "健康运势详细描述",
      "love": "爱情运势详细描述",
      "money": "财运详细描述",
      "work": "工作运势详细描述"
    },
    "index": { "all": "65%", "health": "69%", "love": "40%", "money": "61%", "work": "72%" },
    "luckycolor": "橘",
    "luckynumber": "5",
    "luckyconstellation": "金牛座",
    "todo": { "yi": "宜阅读一本书", "ji": "忌购物超预算" }
  }
}
```

---

## 生成期用法（Agent 直接调用）

无需任何密钥，直接 GET 请求即可。

```typescript
async function getHoroscope(type: string, time: string) {
  const url = new URL("https://v2.xxapi.cn/api/horoscope");
  url.searchParams.set("type", type);
  url.searchParams.set("time", time);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}: ${json.msg}`);

  return json.data;
}

// 示例：查询白羊座今日运势
const data = await getHoroscope("aries", "today");
console.log(`${data.title} ${data.type}：${data.shortcomment}`);
console.log(`综合 ${data.index.all} | 爱情 ${data.index.love} | 幸运色 ${data.luckycolor}`);
```

---

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/horoscope-fortune.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let type: string;
  let time: string;
  try {
    const body = await req.json();
    type = body.type;
    time = body.time;
    if (!type || !time) throw new Error("Missing type or time");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL("https://v2.xxapi.cn/api/horoscope");
  url.searchParams.set("type", type);
  url.searchParams.set("time", time);

  const upstream = await fetch(url.toString());

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

### Frontend → Edge Function

**推荐方式（supabase client 可用时）：**

```typescript
async function fetchHoroscope(type: string, time: string) {
  const { data, error } = await supabase.functions.invoke("horoscope-fortune", {
    body: { type, time },
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}：${data.msg}`);
  return data.data;
}
```

**备用方式：**

```typescript
async function fetchHoroscope(type: string, time: string) {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/horoscope-fortune`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, time }),
  });
  if (!res.ok) throw new Error(`请求失败：${res.status}`);
  const json = await res.json();
  if (json.code !== 200) throw new Error(`API 错误 ${json.code}：${json.msg}`);
  return json.data;
}
```

---

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `type` | string | 是 | 星座英文名（小写），见上方对照表 |
| `time` | string | 是 | 时间范围：`today`今日 / `week`本周 / `month`本月 / `year`本年 |

### 返回字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | number | 状态码，200 表示成功 |
| `data.title` | string | 星座中文名，如"白羊座" |
| `data.type` | string | 运势类型，如"今日运势" |
| `data.time` | string | 查询日期，如"9月3日" |
| `data.shortcomment` | string | 运势一句话总结 |
| `data.fortune.all` | number | 综合运势评分（1-5） |
| `data.fortune.health` | number | 健康运势评分（1-5） |
| `data.fortune.love` | number | 爱情运势评分（1-5） |
| `data.fortune.money` | number | 财运评分（1-5） |
| `data.fortune.work` | number | 工作运势评分（1-5） |
| `data.fortunetext.all` | string | 综合运势详细描述 |
| `data.fortunetext.health` | string | 健康运势详细描述 |
| `data.fortunetext.love` | string | 爱情运势详细描述 |
| `data.fortunetext.money` | string | 财运详细描述 |
| `data.fortunetext.work` | string | 工作运势详细描述 |
| `data.index.all` | string | 综合运势百分比，如"65%" |
| `data.luckycolor` | string | 幸运颜色 |
| `data.luckynumber` | string | 幸运数字 |
| `data.luckyconstellation` | string | 幸运星座 |
| `data.todo.yi` | string | 今日宜 |
| `data.todo.ji` | string | 今日忌 |

---

## 注意事项

- **免费接口，无需鉴权**，直接调用无任何费用，但请避免高频无效请求。
- **错误处理**：务必处理 429（请求频率超限）。
- 接口为第三方免费服务，数据准确性和可用性不作保证，生产环境建议增加降级处理。
