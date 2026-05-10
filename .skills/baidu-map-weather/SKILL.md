---
name: baidu-map-weather
description: 通过地区ID查询百度地图天气数据（实时+预报）。Use when asking for China weather by district.
license: MIT
metadata:
  id: skill_baidu_map_weather
  display_name: 百度地图天气查询
  trigger: [天气查询, 地区天气, 百度地图]
  key_type: user_managed
  scope_platform: all
  version: "1.0.0"
---

# 百度地图天气查询

## 能力概述

通过百度地图天气 API 查询指定地区的实时天气及多日预报。

- **Endpoint**: `GET https://api.map.baidu.com/weather/v1/`
- **认证方式**: 查询参数 `ak`（用户自有密钥 `BAIDU_MAP_AK`）

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| district_id | string | 是 | 地区ID，如 `222405` |
| data_type | string | 是 | 数据类型，`all` 返回全量天气数据 |
| ak | string | 是 | 百度地图API访问密钥 |

### 返回字段

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | `number` | 状态码，0 表示成功 |
| `result.location` | `object` | 地区位置信息（国家、省、市、区名） |
| `result.now` | `object` | 实时天气（温度、体感温度、湿度、风力、天气文字） |
| `result.forecasts` | `array` | 多日天气预报（日期、最高/低温、白天/夜间天气） |

### 响应示例

```json
{
  "status": 0,
  "result": {
    "location": { "country": "中国", "province": "吉林", "city": "延边", "name": "和龙" },
    "now": { "temp": 18, "feels_like": 16, "rh": 72, "wind_class": "2级", "text": "多云" },
    "forecasts": [
      { "date": "2024-06-01", "week": "星期六", "high": 22, "low": 12, "text_day": "晴", "text_night": "多云" }
    ]
  }
}
```

---

## 生成期用法（Agent 直接调用）

```typescript
const BAIDU_MAP_AK = Deno.env.get("BAIDU_MAP_AK")!; // 百度地图开放平台控制台获取的用户密钥

async function queryWeather(districtId: string, dataType = "all") {
  const url = new URL("https://api.map.baidu.com/weather/v1/");
  url.searchParams.set("district_id", districtId);
  url.searchParams.set("data_type", dataType);
  url.searchParams.set("ak", BAIDU_MAP_AK);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

  const json = await response.json();
  if (json.status !== 0) throw new Error(`API error ${json.status}: ${json.message}`);

  return json.result;
}

// 示例：查询 district_id=222405 的天气
const result = await queryWeather("222405");
console.log("实时天气:", result.now);
console.log("预报:", result.forecasts);
```

---

## 生成后用法（应用内通过 Edge Function 调用）

### Edge Function（`edge-functions/baidu-map-weather.ts`）

```typescript
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req: Request): Promise<Response> => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let districtId: string;
  let dataType: string;
  try {
    const body = await req.json();
    districtId = body.district_id;
    dataType = body.data_type ?? "all";
    if (!districtId) throw new Error("Missing district_id");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const ak = Deno.env.get("BAIDU_MAP_AK");
  if (!ak) {
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const upstreamUrl = new URL("https://api.map.baidu.com/weather/v1/");
  upstreamUrl.searchParams.set("district_id", districtId);
  upstreamUrl.searchParams.set("data_type", dataType);
  upstreamUrl.searchParams.set("ak", ak);

  const upstream = await fetch(upstreamUrl.toString());

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
async function fetchWeather(districtId: string, dataType = "all") {
  const { data, error } = await supabase.functions.invoke("baidu-map-weather", {
    body: { district_id: districtId, data_type: dataType },
  });
  if (error) throw error;
  if (data.status !== 0) throw new Error(`API 错误 ${data.status}`);
  return data.result;
}
```

**备用方式（无法使用 supabase client 时）：**

```typescript
async function fetchWeather(districtId: string, dataType = "all") {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/baidu-map-weather`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ district_id: districtId, data_type: dataType }),
  });

  if (res.status === 429) {
    const err = await res.json();
    throw new Error(`请求限流：${err.message ?? res.statusText}`);
  }
  if (res.status === 402) {
    const err = await res.json();
    throw new Error(`余额不足：${err.message ?? res.statusText}`);
  }
  if (!res.ok) throw new Error(`请求失败：${res.status}`);

  const json = await res.json();
  if (json.status !== 0) throw new Error(`API 错误 ${json.status}`);

  return json.result;
}
```

---

## 参数说明

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| district_id | string | 是 | 百度地图行政区划编码，如 `222405`（和龙市）|
| data_type | string | 是 | 固定传 `all`，返回实时天气 + 预报全量数据 |

### 返回字段说明

| 字段路径 | 类型 | 说明 |
|----------|------|------|
| `status` | `number` | 0 = 成功，非 0 见百度地图错误码文档 |
| `result.location.name` | `string` | 地区名称 |
| `result.now.temp` | `number` | 实时温度（℃） |
| `result.now.feels_like` | `number` | 体感温度（℃） |
| `result.now.rh` | `number` | 相对湿度（%） |
| `result.now.wind_class` | `string` | 风力等级，如 `3级` |
| `result.now.text` | `string` | 天气状况文字，如 `晴`、`多云` |
| `result.forecasts[].date` | `string` | 预报日期（YYYY-MM-DD） |
| `result.forecasts[].high` | `number` | 当日最高温度（℃） |
| `result.forecasts[].low` | `number` | 当日最低温度（℃） |
| `result.forecasts[].text_day` | `string` | 白天天气状况 |
| `result.forecasts[].text_night` | `string` | 夜间天气状况 |

---

## 注意事项

- **密钥安全**: `BAIDU_MAP_AK` 仅可在 Edge Function 服务端读取，严禁暴露到前端。在百度地图开放平台控制台 → 应用管理 → 创建应用后获取。
- **错误处理**: 务必检查 `status !== 0` 的业务错误，以及 `429`（请求限流）情况。
- **地区ID**: `district_id` 为百度地图行政区划编码，需提前通过行政区划查询接口获取。
- **数据刷新频率**: 天气数据非实时推送，存在一定延迟，避免高频轮询以节省配额。
