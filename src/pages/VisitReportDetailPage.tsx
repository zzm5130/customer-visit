import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, Sparkles, Loader2, FileText, BarChart3, Mic,
  TrendingUp, AlertCircle, CheckCircle2, Users, Target, Lightbulb,
  MapPin, Calendar, User, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import type { Visit, StructuredReport } from '@/types/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const INTENT_CONFIG = {
  高: { className: 'text-chart-2 bg-chart-2/10', icon: <TrendingUp size={12} /> },
  中: { className: 'text-warning bg-warning/10', icon: <Target size={12} /> },
  低: { className: 'text-muted-foreground bg-muted', icon: <AlertCircle size={12} /> },
};

const VisitReportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingTranscript, setProcessingTranscript] = useState(false);
  const [processingReport, setProcessingReport] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchVisit(id);
  }, [id]);

  const fetchVisit = async (visitId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('visits')
        .select('*, profiles!visits_user_id_fkey(username, full_name)')
        .eq('id', visitId)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setVisit(data as Visit);

        // 获取录音文件签名URL
        if (data.recording_url) {
          const { data: signedData } = await supabase.storage
            .from('recordings')
            .createSignedUrl(data.recording_url, 3600);
          if (signedData?.signedUrl) setAudioUrl(signedData.signedUrl);
        }
      }
    } catch {
      toast.error('加载拜访记录失败');
    } finally {
      setLoading(false);
    }
  };

  // AI转写录音
  const handleTranscribe = async () => {
    if (!visit?.recording_url || !id) {
      toast.error('没有可转写的录音文件');
      return;
    }
    setProcessingTranscript(true);
    try {
      const { data, error } = await supabase.functions.invoke('transcribe-audio', {
        body: { visitId: id, recordingPath: visit.recording_url },
      });
      if (error) {
        const msg = await error?.context?.text();
        throw new Error(msg || error.message);
      }
      if (data?.success) {
        toast.success('转写完成');
        await fetchVisit(id);
      } else {
        throw new Error('转写失败');
      }
    } catch (err: unknown) {
      toast.error(`转写失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setProcessingTranscript(false);
    }
  };

  // AI生成报告
  const handleGenerateReport = async () => {
    if (!visit?.transcript || !id) {
      toast.error('请先转写录音生成文字稿');
      return;
    }
    setProcessingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-text', {
        body: {
          type: 'report',
          data: {
            customerName: visit.customer_name,
            visitTime: visit.visit_time,
            visitLocation: visit.visit_location,
            transcript: visit.transcript,
          },
        },
      });
      if (error) {
        const msg = await error?.context?.text();
        throw new Error(msg || error.message);
      }
      if (data?.success && data.data) {
        const report = data.data as StructuredReport;
        // 更新数据库
        await supabase.from('visits').update({
          structured_report: report,
          keywords: report.keywords || [],
          status: 'completed',
        }).eq('id', id);
        toast.success('报告生成完成');
        await fetchVisit(id);
      } else {
        throw new Error('报告生成失败');
      }
    } catch (err: unknown) {
      toast.error(`报告生成失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setProcessingReport(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="space-y-4 max-w-5xl mx-auto">
          <Skeleton className="h-8 w-48 bg-muted" />
          <Skeleton className="h-40 w-full bg-muted" />
          <Skeleton className="h-80 w-full bg-muted" />
        </div>
      </MainLayout>
    );
  }

  if (!visit) {
    return (
      <MainLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">找不到拜访记录</p>
          <Link to="/visits/reports">
            <Button variant="outline" className="mt-4">返回列表</Button>
          </Link>
        </div>
      </MainLayout>
    );
  }

  const report = visit.structured_report;
  const intentConf = report?.intentLevel ? INTENT_CONFIG[report.intentLevel] : null;

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* 顶部导航 */}
        <div className="flex items-center gap-3">
          <Link to="/visits/reports">
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground px-2 h-8">
              <ArrowLeft size={14} className="mr-1" />返回
            </Button>
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium text-foreground truncate">{visit.customer_name}</span>
        </div>

        {/* 基本信息卡片 */}
        <Card className="border border-border shadow-none">
          <CardContent className="p-5">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h1 className="text-xl font-semibold text-foreground text-balance">{visit.customer_name}</h1>
                  {visit.customer_industry && (
                    <Badge variant="secondary">{visit.customer_industry}</Badge>
                  )}
                  <span className={cn(
                    'text-xs px-2 py-0.5 rounded font-medium',
                    visit.status === 'completed' ? 'text-chart-2 bg-chart-2/10'
                      : visit.status === 'recording' ? 'text-primary bg-primary/10'
                        : visit.status === 'processing' ? 'text-info bg-info/10'
                          : 'text-warning bg-warning/10'
                  )}>
                    {visit.status === 'completed' ? '已完成' : visit.status === 'recording' ? '已录音'
                      : visit.status === 'processing' ? '处理中' : '准备中'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                  {visit.visit_time && (
                    <span className="flex items-center gap-1">
                      <Calendar size={13} />
                      {format(new Date(visit.visit_time), 'yyyy年M月d日 HH:mm', { locale: zhCN })}
                    </span>
                  )}
                  {visit.visit_location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={13} />
                      {visit.visit_location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <User size={13} />
                    {visit.profiles?.full_name || visit.profiles?.username}
                  </span>
                </div>

                {visit.visit_purpose && (
                  <p className="text-sm text-muted-foreground mt-2">
                    <span className="text-foreground font-medium">目的：</span>{visit.visit_purpose}
                  </p>
                )}

                {visit.keywords && visit.keywords.length > 0 && (
                  <div className="flex gap-1.5 mt-3 flex-wrap">
                    {visit.keywords.map((kw, i) => (
                      <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">{kw}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* 操作按钮 */}
              <div className="flex flex-col gap-2 shrink-0">
                {visit.recording_url && !visit.transcript && (
                  <Button size="sm" onClick={handleTranscribe} disabled={processingTranscript} className="h-9">
                    {processingTranscript
                      ? <><Loader2 size={13} className="mr-2 animate-spin" />转写中...</>
                      : <><FileText size={13} className="mr-2" />AI转写录音</>}
                  </Button>
                )}
                {visit.transcript && !visit.structured_report && (
                  <Button size="sm" onClick={handleGenerateReport} disabled={processingReport} className="h-9">
                    {processingReport
                      ? <><Loader2 size={13} className="mr-2 animate-spin" />生成中...</>
                      : <><Sparkles size={13} className="mr-2" />AI生成报告</>}
                  </Button>
                )}
                {visit.structured_report && (
                  <Button size="sm" variant="outline" onClick={handleGenerateReport} disabled={processingReport} className="h-9">
                    {processingReport
                      ? <><Loader2 size={13} className="mr-2 animate-spin" />更新中...</>
                      : <><RefreshCw size={13} className="mr-2" />重新生成报告</>}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 主内容区（标签页） */}
        <Tabs defaultValue={report ? 'report' : visit.transcript ? 'transcript' : 'info'} className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full md:w-auto md:inline-grid">
            <TabsTrigger value="report" className="text-xs gap-1.5">
              <BarChart3 size={13} />结构化报告
            </TabsTrigger>
            <TabsTrigger value="transcript" className="text-xs gap-1.5">
              <FileText size={13} />文字稿
            </TabsTrigger>
            <TabsTrigger value="recording" className="text-xs gap-1.5">
              <Mic size={13} />原始录音
            </TabsTrigger>
          </TabsList>

          {/* 结构化报告 */}
          <TabsContent value="report">
            {processingReport ? (
              <Card className="border border-border shadow-none">
                <CardContent className="p-8 text-center">
                  <Loader2 size={32} className="animate-spin text-primary mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">AI正在分析拜访内容，生成结构化报告...</p>
                </CardContent>
              </Card>
            ) : report ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 拜访总结 */}
                <Card className="border border-border shadow-none md:col-span-2">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-chart-2" />拜访总结
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <p className="text-sm text-foreground leading-relaxed text-pretty">{report.summary}</p>
                  </CardContent>
                </Card>

                {/* 意向度 */}
                <Card className="border border-border shadow-none">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Target size={14} className="text-chart-3" />客户意向
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn('flex items-center gap-1 px-2.5 py-1 rounded text-sm font-medium', intentConf?.className)}>
                        {intentConf?.icon}{report.intentLevel}意向
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground text-pretty">{report.intentAnalysis}</p>
                  </CardContent>
                </Card>

                {/* 竞争对手 */}
                <Card className="border border-border shadow-none">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users size={14} className="text-chart-4" />竞争对手
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    {report.competitors?.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {report.competitors.map((c, i) => (
                          <Badge key={i} variant="secondary">{c}</Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">未提及竞争对手</p>
                    )}
                  </CardContent>
                </Card>

                {/* 客户需求 */}
                <Card className="border border-border shadow-none">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Lightbulb size={14} className="text-chart-3" />客户需求
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <ul className="space-y-1.5">
                      {report.customerNeeds?.map((need, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-chart-3 mt-0.5 shrink-0">•</span>
                          <span className="text-pretty">{need}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* 痛点 */}
                <Card className="border border-border shadow-none">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <AlertCircle size={14} className="text-destructive" />客户痛点
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <ul className="space-y-1.5">
                      {report.painPoints?.map((point, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-destructive mt-0.5 shrink-0">•</span>
                          <span className="text-pretty">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* 下一步行动 */}
                <Card className="border border-border shadow-none md:col-span-2">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp size={14} className="text-primary" />下一步行动建议
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <div className="space-y-2">
                      {report.nextActions?.map((action, i) => (
                        <div key={i} className="flex items-start gap-3 p-2.5 bg-muted/40 rounded">
                          <span className="text-xs bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center shrink-0 font-medium mt-0.5">
                            {i + 1}
                          </span>
                          <span className="text-sm text-pretty">{action}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border border-border shadow-none">
                <CardContent className="py-16 text-center">
                  <BarChart3 size={36} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {visit.transcript ? '点击「AI生成报告」生成结构化分析' : '请先转写录音内容'}
                  </p>
                  {visit.transcript && (
                    <Button size="sm" className="mt-3" onClick={handleGenerateReport} disabled={processingReport}>
                      <Sparkles size={13} className="mr-2" />生成报告
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 文字稿 */}
          <TabsContent value="transcript">
            {processingTranscript ? (
              <Card className="border border-border shadow-none">
                <CardContent className="p-8 text-center">
                  <Loader2 size={32} className="animate-spin text-primary mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">AI正在转写录音，请稍候...</p>
                </CardContent>
              </Card>
            ) : visit.transcript ? (
              <div className="space-y-4">
                {/* 分段文字稿 */}
                {visit.transcript_utterances && visit.transcript_utterances.length > 0 ? (
                  <Card className="border border-border shadow-none">
                    <CardHeader className="pb-2 pt-4 px-5">
                      <CardTitle className="text-sm font-medium">分句文字稿</CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5 space-y-2">
                      {visit.transcript_utterances.map((utt, i) => (
                        <div key={i} className="flex gap-3 text-sm">
                          <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5 w-16 shrink-0">
                            {formatTime(utt.start_time)}
                          </span>
                          <span className="text-foreground text-pretty leading-relaxed">{utt.text}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}

                {/* 完整文字稿 */}
                <Card className="border border-border shadow-none">
                  <CardHeader className="pb-2 pt-4 px-5">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      <span>完整文字稿</span>
                      {visit.recording_url && (
                        <Button variant="ghost" size="sm" onClick={handleTranscribe} disabled={processingTranscript}
                          className="text-xs text-muted-foreground hover:text-foreground h-7 px-2">
                          <RefreshCw size={12} className="mr-1" />重新转写
                        </Button>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <p className="text-sm text-foreground leading-loose whitespace-pre-wrap text-pretty">
                      {visit.transcript}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border border-border shadow-none">
                <CardContent className="py-16 text-center">
                  <FileText size={36} className="mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {visit.recording_url ? '点击「AI转写录音」获取文字稿' : '没有可转写的录音文件'}
                  </p>
                  {visit.recording_url && (
                    <Button size="sm" className="mt-3" onClick={handleTranscribe} disabled={processingTranscript}>
                      <FileText size={13} className="mr-2" />AI转写录音
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 录音文件 */}
          <TabsContent value="recording">
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Mic size={14} className="text-destructive" />原始录音
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {audioUrl ? (
                  <div className="space-y-3">
                    <audio controls src={audioUrl} className="w-full" />
                    {visit.recording_name && (
                      <p className="text-xs text-muted-foreground">
                        文件：{visit.recording_name}
                        {visit.recording_duration && ` · 时长：${formatTime(visit.recording_duration * 1000)}`}
                      </p>
                    )}
                    <Separator />
                    <p className="text-xs text-muted-foreground">
                      链接有效期1小时，过期后请刷新页面
                    </p>
                  </div>
                ) : visit.recording_url ? (
                  <div className="text-center py-8">
                    <Loader2 size={24} className="animate-spin text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">加载录音...</p>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Mic size={36} className="mx-auto text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">暂无录音文件</p>
                    <Link to="/visits/record">
                      <Button size="sm" variant="outline" className="mt-3">前往录音</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

// 格式化时间（毫秒 → mm:ss）
function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default VisitReportDetailPage;
