---
name: earthquake-report
description: Real-time earthquake query: magnitude, depth, location. Use when users ask about recent earthquakes or seismic events.
license: MIT
metadata:
  id: skill_earthquake_report
  display_name: 地震速报
  trigger: [earthquake, 地震, seismic]
  key_type: user_managed
  scope_platform: all
  version: 1.0.0
---

# 地震速报

查询全球最近地震事件列表，返回震级、震源深度、发生时间、坐标等权威数据。

## 能力概述

- **Endpoint**: `GET https://cn.apihz.cn/api/tianqi/dizhensu.php`
- **数据范围**: 国内外地震事件，按发生时间倒序排列
- **更新频率**: 实时同步权威震情数据

### 响应示例

```json
{
  "code": 200,
  "data": [
    {
      "title": "西藏那曲发生4.2级地震",
      "time": "2024-03-15 08:23:11",
      "dizhi": "西藏那曲",
      "leve": "4.2",
      "shendu": "10",
      "weidu": "31.5", "weidu2": "北纬",
      "jingdu": "92.3", "jingdu2": "东经",
      "timejg2": "3小时前"
    }
  ]
}
```

## 生成期用法（Agent 直接调用）

```typescript
const API_ID = "10005541"; // 接口ID，固定值
const API_KEY = "<your-earthquake-api-key>"; // 替换为 EARTHQUAKE_API_KEY 的值

interface EarthquakeEvent {
  msg: string;
  title: string;
  fabutime: string;
  time: string;
  dizhi: string;
  weidu: string;
  weidu2: string;
  jingdu: string;
  jingdu2: string;
  leve: string;
  shendu: string;
  hctime: string;
  timejg: string;
  timejg2: string;
}

async function getEarthquakeReports(): Promise<EarthquakeEvent[]> {
  const url = new URL("https://cn.apihz.cn/api/tianqi/dizhensu.php");
  url.searchParams.set("id", API_ID);
  url.searchParams.set("key", API_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.code !== 200) throw new Error(`API error ${json.code}`);

  return json.data;
}

// 示例：打印最近3条地震信息
const events = await getEarthquakeReports();
events.slice(0, 3).forEach(e => {
  console.log(`${e.time} | ${e.dizhi} | ${e.leve}级 | 深度${e.shendu}km`);
});
```

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function

```typescript
// edge-functions/earthquake-report.ts
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = Deno.env.get("EARTHQUAKE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL("https://cn.apihz.cn/api/tianqi/dizhensu.php");
  url.searchParams.set("id", "10005541");
  url.searchParams.set("key", apiKey);

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

### 前端调用

**推荐方式（supabase client 可用时）：**

```typescript
async function fetchEarthquakeReports() {
  const { data, error } = await supabase.functions.invoke("earthquake-report", {
    body: {},
  });
  if (error) throw error;
  if (data.code !== 200) throw new Error(`API 错误 ${data.code}`);
  return data.data as EarthquakeEvent[];
}
```

**备用方式：**

```typescript
async function fetchEarthquakeReports() {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/earthquake-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
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
  if (json.code !== 200) throw new Error(`API 错误 ${json.code}`);
  return json.data as EarthquakeEvent[];
}
```

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | `string` | 是 | 接口ID标识，固定值 `10005541` |
| `key` | `string` | 是 | API 访问密钥（即 `EARTHQUAKE_API_KEY`） |

### 返回字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `code` | `number` | 状态码，200 表示成功 |
| `data` | `array` | 地震事件列表，按时间倒序排列 |
| `data[].title` | `string` | 地震事件标题 |
| `data[].time` | `string` | 地震发生时间 |
| `data[].fabutime` | `string` | 信息发布时间 |
| `data[].dizhi` | `string` | 地震发生地点 |
| `data[].leve` | `string` | 震级（里氏） |
| `data[].shendu` | `string` | 震源深度（千米） |
| `data[].weidu` | `string` | 纬度数值 |
| `data[].weidu2` | `string` | 纬度方向（北纬/南纬） |
| `data[].jingdu` | `string` | 经度数值 |
| `data[].jingdu2` | `string` | 经度方向（东经/西经） |
| `data[].timejg` | `string` | 距今时间间隔（秒） |
| `data[].timejg2` | `string` | 距今时间间隔（可读格式，如"3小时前"） |
| `data[].msg` | `string` | 地震详细描述信息 |

## 注意事项

- **密钥安全**: `EARTHQUAKE_API_KEY` 仅可在 Edge Function 服务端读取，严禁暴露到前端或写入客户端代码。
- **错误处理**: 务必处理 429（配额超限）和 402（余额不足）响应码。
- **接口ID**: `id=10005541` 为固定接口标识，无需修改。
- **数据排序**: 返回数据按地震发生时间倒序排列，`data[0]` 为最新事件。
- **坐标使用**: 震中坐标由 `weidu`（纬度值）+ `weidu2`（方向）和 `jingdu`（经度值）+ `jingdu2`（方向）组合表示，使用时需拼接完整字符串，如"北纬31.5度"。
