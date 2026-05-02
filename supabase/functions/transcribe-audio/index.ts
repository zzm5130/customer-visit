import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// 解析WAV文件获取PCM数据
function parseWavFile(buffer: ArrayBuffer): { pcmData: Uint8Array; sampleRate: number; channels: number; bitsPerSample: number } | null {
  const view = new DataView(buffer);

  // 检查WAV magic number
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== "RIFF") return null;

  // 解析格式块
  let offset = 12; // 跳过RIFF头
  let audioFormat = 0;
  let numChannels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset < buffer.byteLength - 8) {
    const chunkId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const chunkSize = view.getUint32(offset + 4, true);

    if (chunkId === "fmt ") {
      audioFormat = view.getUint16(offset + 8, true);
      numChannels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bitsPerSample = view.getUint16(offset + 22, true);
    } else if (chunkId === "data") {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }

    offset += 8 + chunkSize;
    if (chunkSize % 2 !== 0) offset++; // 奇数字节对齐
  }

  if (dataOffset === 0) return null;

  return {
    pcmData: new Uint8Array(buffer, dataOffset, dataSize),
    sampleRate,
    channels: numChannels,
    bitsPerSample,
  };
}

// 将PCM数据重采样到16kHz单声道16bit
function resamplePCM(
  input: Uint8Array,
  inputSampleRate: number,
  inputChannels: number,
  inputBitsPerSample: number
): Uint8Array {
  const targetSampleRate = 16000;
  const targetBitsPerSample = 16;

  // 转换为16bit samples
  let samples: Int16Array;
  if (inputBitsPerSample === 16) {
    samples = new Int16Array(input.buffer, input.byteOffset, input.byteLength / 2);
  } else if (inputBitsPerSample === 8) {
    samples = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      samples[i] = (input[i] - 128) * 256;
    }
  } else {
    return input; // 不支持其他格式
  }

  // 混音到单声道
  let monoSamples: Int16Array;
  if (inputChannels > 1) {
    monoSamples = new Int16Array(Math.floor(samples.length / inputChannels));
    for (let i = 0; i < monoSamples.length; i++) {
      let sum = 0;
      for (let c = 0; c < inputChannels; c++) {
        sum += samples[i * inputChannels + c];
      }
      monoSamples[i] = Math.round(sum / inputChannels);
    }
  } else {
    monoSamples = samples;
  }

  // 重采样到16kHz
  if (inputSampleRate === targetSampleRate) {
    return new Uint8Array(monoSamples.buffer);
  }

  const ratio = inputSampleRate / targetSampleRate;
  const outputLength = Math.floor(monoSamples.length / ratio);
  const outputSamples = new Int16Array(outputLength);

  for (let i = 0; i < outputLength; i++) {
    const srcIdx = i * ratio;
    const idx0 = Math.floor(srcIdx);
    const idx1 = Math.min(idx0 + 1, monoSamples.length - 1);
    const frac = srcIdx - idx0;
    outputSamples[i] = Math.round(monoSamples[idx0] * (1 - frac) + monoSamples[idx1] * frac);
  }

  return new Uint8Array(outputSamples.buffer);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { visitId, recordingPath } = await req.json();

    if (!visitId || !recordingPath) {
      return new Response(JSON.stringify({ error: "缺少必要参数" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("INTEGRATIONS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API密钥未配置" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 初始化Supabase客户端（使用service role读取Storage）
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 从Storage下载录音文件
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("recordings")
      .download(recordingPath);

    if (downloadError || !fileData) {
      return new Response(JSON.stringify({ error: `录音文件下载失败: ${downloadError?.message}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await fileData.arrayBuffer();

    // 解析WAV并获取PCM数据
    const wavInfo = parseWavFile(audioBuffer);
    let pcmData: Uint8Array;

    if (wavInfo) {
      pcmData = resamplePCM(wavInfo.pcmData, wavInfo.sampleRate, wavInfo.channels, wavInfo.bitsPerSample);
    } else {
      // 如果不是WAV，尝试直接使用（可能是raw PCM）
      pcmData = new Uint8Array(audioBuffer);
    }

    // 建立WebSocket连接进行语音识别
    const wsUrl = `wss://app-bcuf7wultloh-api-5YrZ3bwg7rzY-gateway.appmiaoda.com/api/v3/sauc/bigmodel_async?gateway_token=${apiKey}`;

    const transcript = await new Promise<{ text: string; utterances: Array<{text: string; start_time: number; end_time: number}> }>((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      let finalText = "";
      const utterances: Array<{text: string; start_time: number; end_time: number}> = [];
      let isFirstMessage = true;
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error("语音识别超时"));
      }, 120000); // 120秒超时

      ws.onopen = () => {
        // 发送初始配置（不带音频数据）
        const initMsg = {
          user: { uid: visitId },
          audio: {
            format: "pcm",
            codec: "raw",
            rate: 16000,
            bits: 16,
            channel: 1,
          },
          request: {
            model_name: "bigmodel",
            enable_punc: true,
            enable_itn: true,
            enable_ddc: true,
            show_utterances: true,
            enable_nonstream: true,
          },
        };
        ws.send(JSON.stringify(initMsg));

        // 分块发送音频数据（每帧640字节 = 20ms @ 16kHz 16bit mono）
        const chunkSize = 6400; // 每次发送6400字节
        let offset = 0;

        const sendChunk = () => {
          if (offset < pcmData.length) {
            const chunk = pcmData.slice(offset, offset + chunkSize);
            ws.send(chunk.buffer);
            offset += chunkSize;
            setTimeout(sendChunk, 20); // 20ms间隔
          } else {
            // 发送结束标志（空的JSON消息）
            ws.send(JSON.stringify({ end: true }));
          }
        };

        // 延迟100ms后开始发送音频
        setTimeout(sendChunk, 100);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.result) {
            const text = data.result.text || "";
            if (text) {
              finalText = text; // 取最终结果
            }

            if (data.result.utterances) {
              for (const utt of data.result.utterances) {
                if (utt.definite) {
                  utterances.push({
                    text: utt.text,
                    start_time: utt.start_time,
                    end_time: utt.end_time,
                  });
                }
              }
            }
          }

          // 检查是否完成
          if (data.audio_info?.duration !== undefined && data.result?.text) {
            clearTimeout(timeout);
            ws.close();
            resolve({ text: finalText, utterances });
          }
        } catch {
          // 忽略解析错误
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        console.error("WebSocket错误:", error);
        reject(new Error("语音识别连接失败"));
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        if (finalText) {
          resolve({ text: finalText, utterances });
        } else {
          reject(new Error("语音识别未获得结果"));
        }
      };
    });

    // 更新visits表中的文字稿
    const { error: updateError } = await supabase
      .from("visits")
      .update({
        transcript: transcript.text,
        transcript_utterances: transcript.utterances,
        status: "processing",
      })
      .eq("id", visitId);

    if (updateError) {
      console.error("更新文字稿失败:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transcript: transcript.text,
        utterances: transcript.utterances,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("转写Edge Function错误:", error);
    return new Response(JSON.stringify({ error: `转写失败: ${error.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
