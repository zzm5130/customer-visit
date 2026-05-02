import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, data } = await req.json();

    const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API密钥未配置" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let systemPrompt = "";
    let userPrompt = "";

    if (type === "ppt") {
      // 生成PPT内容
      systemPrompt = `你是一个专业的销售助手，擅长根据客户资料生成结构化的拜访用PPT内容。
请根据提供的客户信息，生成一份完整的PPT大纲，以JSON格式返回。
JSON结构如下：
{
  "title": "PPT标题",
  "subtitle": "副标题",
  "slides": [
    {
      "title": "幻灯片标题",
      "content": ["要点1", "要点2", "要点3"],
      "notes": "演讲备注"
    }
  ]
}
必须包含以下幻灯片：
1. 封面（公司介绍）
2. 客户背景介绍
3. 行业分析
4. 客户痛点分析
5. 我们的解决方案
6. 成功案例
7. 合作建议与下一步行动
请确保内容专业、具体、有说服力。只返回JSON，不要有其他文字。`;

      userPrompt = `客户信息：
客户名称：${data.customerName}
行业：${data.industry || "未知"}
公司规模：${data.companySize || "未知"}
联系方式：${data.contact || "未知"}
客户背景补充：${data.background || "无"}
拜访目的：${data.purpose || "业务合作"}`;

    } else if (type === "report") {
      // 生成结构化报告
      systemPrompt = `你是一个专业的销售分析助手。请分析以下拜访录音文字稿，提取关键信息并生成结构化报告。
以JSON格式返回，结构如下：
{
  "summary": "拜访总结（2-3句话）",
  "customerNeeds": ["需求1", "需求2"],
  "painPoints": ["痛点1", "痛点2"],
  "intentLevel": "高/中/低",
  "intentAnalysis": "意向分析说明",
  "competitors": ["竞争对手1"],
  "keyPoints": ["关键信息1", "关键信息2"],
  "nextActions": ["下一步行动1", "下一步行动2"],
  "keywords": ["关键词1", "关键词2", "关键词3"]
}
只返回JSON，不要有其他文字。`;

      userPrompt = `客户名称：${data.customerName}
拜访时间：${data.visitTime || "未知"}
拜访地点：${data.visitLocation || "未知"}

拜访文字稿：
${data.transcript}`;

    } else if (type === "background") {
      // 生成客户背景调研
      systemPrompt = `你是一个专业的市场调研助手。请根据客户基本信息，生成一份客户背景调研报告。
以JSON格式返回，结构如下：
{
  "companyProfile": "公司简介（2-3句话）",
  "industryAnalysis": "行业分析（2-3句话）",
  "marketPosition": "市场定位",
  "potentialNeeds": ["潜在需求1", "潜在需求2"],
  "visitStrategy": ["拜访策略1", "拜访策略2"],
  "talkingPoints": ["话题建议1", "话题建议2"],
  "riskPoints": ["注意事项1"]
}
只返回JSON，不要有其他文字。`;

      userPrompt = `客户名称：${data.customerName}
行业：${data.industry || "未知"}
公司规模：${data.companySize || "未知"}
已知背景信息：${data.background || "无"}`;
    } else {
      return new Response(JSON.stringify({ error: "不支持的类型" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 调用文心大模型
    const response = await fetch(
      "https://app-bcuf7wultloh-api-zYkZz8qovQ1L-gateway.appmiaoda.com/v2/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gateway-Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          enable_thinking: false,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API调用失败:", errorText);
      return new Response(JSON.stringify({ error: `AI服务调用失败: ${response.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 处理流式响应
    const reader = response.body?.getReader();
    if (!reader) {
      return new Response(JSON.stringify({ error: "响应流读取失败" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fullContent = "";
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    }

    // 尝试提取JSON内容
    let parsedContent = null;
    try {
      // 清理可能的markdown代码块
      const cleaned = fullContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsedContent = JSON.parse(cleaned);
    } catch {
      // 如果不是JSON，返回原始内容
      parsedContent = { rawContent: fullContent };
    }

    return new Response(JSON.stringify({ success: true, data: parsedContent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Edge Function错误:", error);
    return new Response(JSON.stringify({ error: `服务器错误: ${error.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
