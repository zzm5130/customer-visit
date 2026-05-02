import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardList, Sparkles, Download, ChevronRight, Loader2,
  Presentation, RefreshCw, CheckCircle2, Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import type { PptContent, CustomerBackground } from '@/types/types';

// 行业选项
const INDUSTRY_OPTIONS = [
  '制造业', '金融/银行', '医疗/医药', '教育/培训', '零售/电商',
  '互联网/科技', '房地产/建设', '能源/化工', '交通/物流', '政府/公共服务', '其他',
];

// 公司规模选项
const SIZE_OPTIONS = ['初创企业(1-50人)', '中小企业(50-500人)', '大型企业(500-5000人)', '集团企业(5000人以上)'];

type Step = 'form' | 'background' | 'ppt';

const VisitPreparePage: React.FC = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('form');

  const [formData, setFormData] = useState({
    customerName: '',
    industry: '',
    companySize: '',
    contact: '',
    background: '',
    purpose: '',
  });

  const [loadingBackground, setLoadingBackground] = useState(false);
  const [loadingPpt, setLoadingPpt] = useState(false);
  const [backgroundData, setBackgroundData] = useState<CustomerBackground | null>(null);
  const [pptData, setPptData] = useState<PptContent | null>(null);
  const [savedVisitId, setSavedVisitId] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // 生成客户背景调研
  const handleGenerateBackground = async () => {
    if (!formData.customerName.trim()) {
      toast.error('请填写客户名称');
      return;
    }
    setLoadingBackground(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-text', {
        body: { type: 'background', data: formData },
      });
      if (error) {
        const msg = await error?.context?.text();
        throw new Error(msg || error.message);
      }
      if (data?.success && data.data) {
        setBackgroundData(data.data as CustomerBackground);
        setStep('background');
        toast.success('背景调研完成');
      } else {
        throw new Error('背景调研生成失败');
      }
    } catch (err: unknown) {
      toast.error(`背景调研失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoadingBackground(false);
    }
  };

  // 生成PPT
  const handleGeneratePpt = async () => {
    setLoadingPpt(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-text', {
        body: { type: 'ppt', data: formData },
      });
      if (error) {
        const msg = await error?.context?.text();
        throw new Error(msg || error.message);
      }
      if (data?.success && data.data) {
        setPptData(data.data as PptContent);
        setStep('ppt');
        toast.success('PPT生成完成');

        // 保存到数据库
        const visitPayload = {
          user_id: profile!.id,
          customer_name: formData.customerName,
          customer_industry: formData.industry || null,
          customer_contact: formData.contact || null,
          customer_size: formData.companySize || null,
          customer_background: formData.background || null,
          visit_purpose: formData.purpose || null,
          ppt_content: data.data,
          status: 'preparing' as const,
        };

        if (savedVisitId) {
          await supabase.from('visits').update(visitPayload).eq('id', savedVisitId);
        } else {
          const { data: visitData } = await supabase
            .from('visits')
            .insert(visitPayload)
            .select('id')
            .maybeSingle();
          if (visitData?.id) setSavedVisitId(visitData.id);
        }
      } else {
        throw new Error('PPT生成失败');
      }
    } catch (err: unknown) {
      toast.error(`PPT生成失败：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setLoadingPpt(false);
    }
  };

  // 下载PPT（HTML格式）
  const handleDownloadPpt = () => {
    if (!pptData) return;
    const html = generatePptHtml(pptData);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${formData.customerName}-拜访PPT.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('PPT下载成功');
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 标题 */}
        <div className="flex items-center gap-2">
          <ClipboardList size={20} className="text-primary" />
          <h1 className="text-lg font-semibold">拜访前准备</h1>
        </div>

        {/* 步骤指示器 */}
        <div className="flex items-center gap-2 text-sm">
          {['form', 'background', 'ppt'].map((s, idx) => (
            <React.Fragment key={s}>
              {idx > 0 && <ChevronRight size={14} className="text-muted-foreground shrink-0" />}
              <span className={step === s || (idx === 0 && step !== 'form') || (idx === 1 && step === 'ppt')
                ? 'text-primary font-medium'
                : 'text-muted-foreground'}>
                {s === 'form' ? '①填写客户信息' : s === 'background' ? '②背景调研' : '③生成PPT'}
              </span>
            </React.Fragment>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* 左侧：客户信息表单 */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="border border-border shadow-none">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Info size={14} className="text-primary" />
                  客户基本信息
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-normal">客户名称 <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="公司名称"
                    value={formData.customerName}
                    onChange={e => handleChange('customerName', e.target.value)}
                    className="px-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-normal">所属行业</Label>
                  <Select value={formData.industry} onValueChange={v => handleChange('industry', v)}>
                    <SelectTrigger className="px-3">
                      <SelectValue placeholder="选择行业" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRY_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-normal">公司规模</Label>
                  <Select value={formData.companySize} onValueChange={v => handleChange('companySize', v)}>
                    <SelectTrigger className="px-3">
                      <SelectValue placeholder="选择规模" />
                    </SelectTrigger>
                    <SelectContent>
                      {SIZE_OPTIONS.map(opt => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-normal">联系方式</Label>
                  <Input
                    placeholder="电话/邮箱"
                    value={formData.contact}
                    onChange={e => handleChange('contact', e.target.value)}
                    className="px-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-normal">拜访目的</Label>
                  <Input
                    placeholder="例：产品演示、合同续签"
                    value={formData.purpose}
                    onChange={e => handleChange('purpose', e.target.value)}
                    className="px-3"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-normal">已知背景信息</Label>
                  <Textarea
                    placeholder="已掌握的客户信息（可选）"
                    value={formData.background}
                    onChange={e => handleChange('background', e.target.value)}
                    className="px-3 min-h-[80px] resize-none"
                    rows={3}
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <Button
                    className="w-full"
                    onClick={handleGenerateBackground}
                    disabled={loadingBackground || !formData.customerName.trim()}
                  >
                    {loadingBackground
                      ? <><Loader2 size={14} className="mr-2 animate-spin" />分析中...</>
                      : <><Sparkles size={14} className="mr-2" />AI背景调研</>}
                  </Button>
                  {step !== 'form' && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleGeneratePpt}
                      disabled={loadingPpt}
                    >
                      {loadingPpt
                        ? <><Loader2 size={14} className="mr-2 animate-spin" />生成中...</>
                        : <><Presentation size={14} className="mr-2" />生成PPT</>}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：结果展示 */}
          <div className="lg:col-span-3 space-y-4">
            {/* 背景调研结果 */}
            {(step === 'background' || step === 'ppt') && (
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-chart-2" />
                    背景调研报告
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={handleGenerateBackground} disabled={loadingBackground}
                    className="text-xs text-muted-foreground hover:text-foreground h-7 px-2">
                    <RefreshCw size={12} className="mr-1" />重新生成
                  </Button>
                </CardHeader>
                {loadingBackground ? (
                  <CardContent className="px-5 pb-5 space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full bg-muted" />)}
                  </CardContent>
                ) : backgroundData && (
                  <CardContent className="px-5 pb-5 space-y-4 text-sm">
                    <BackgroundSection title="公司简介" content={backgroundData.companyProfile} />
                    <Separator />
                    <BackgroundSection title="行业分析" content={backgroundData.industryAnalysis} />
                    <Separator />
                    <BackgroundSection title="市场定位" content={backgroundData.marketPosition} />
                    <Separator />
                    <TagsSection title="潜在需求" items={backgroundData.potentialNeeds} color="bg-primary/10 text-primary" />
                    <Separator />
                    <TagsSection title="拜访策略" items={backgroundData.visitStrategy} color="bg-chart-2/10 text-chart-2" />
                    <Separator />
                    <TagsSection title="话题建议" items={backgroundData.talkingPoints} color="bg-chart-3/10 text-chart-3" />
                    {backgroundData.riskPoints?.length > 0 && (
                      <>
                        <Separator />
                        <TagsSection title="注意事项" items={backgroundData.riskPoints} color="bg-destructive/10 text-destructive" />
                      </>
                    )}
                  </CardContent>
                )}
              </Card>
            )}

            {/* PPT预览 */}
            {step === 'ppt' && (
              <Card className="border border-border shadow-none">
                <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Presentation size={14} className="text-primary" />
                    PPT内容预览
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={handleGeneratePpt} disabled={loadingPpt}
                      className="text-xs text-muted-foreground hover:text-foreground h-7 px-2">
                      <RefreshCw size={12} className="mr-1" />重新生成
                    </Button>
                    <Button size="sm" onClick={handleDownloadPpt} className="h-7 px-3 text-xs">
                      <Download size={12} className="mr-1" />下载PPT
                    </Button>
                  </div>
                </CardHeader>
                {loadingPpt ? (
                  <CardContent className="px-5 pb-5 space-y-3">
                    {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 w-full bg-muted" />)}
                  </CardContent>
                ) : pptData && (
                  <CardContent className="px-5 pb-5 space-y-3">
                    {/* 封面 */}
                    <div className="bg-primary rounded p-5 text-primary-foreground text-center">
                      <div className="text-base font-semibold text-balance">{pptData.title}</div>
                      <div className="text-sm mt-1 opacity-80">{pptData.subtitle}</div>
                    </div>
                    {/* 幻灯片 */}
                    {pptData.slides?.map((slide, idx) => (
                      <div key={idx} className="border border-border rounded p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">
                            第{idx + 1}页
                          </span>
                          <span className="text-sm font-medium text-foreground text-balance">{slide.title}</span>
                        </div>
                        <ul className="space-y-1">
                          {slide.content?.map((point, pIdx) => (
                            <li key={pIdx} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <span className="text-primary mt-0.5 shrink-0">•</span>
                              <span className="text-pretty">{point}</span>
                            </li>
                          ))}
                        </ul>
                        {slide.notes && (
                          <div className="mt-2 text-xs text-muted-foreground/60 italic border-t border-border pt-2">
                            备注: {slide.notes}
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="pt-2">
                      <Button className="w-full" onClick={() => navigate('/visits/record')}>
                        前往录音记录 <ChevronRight size={14} className="ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* 空状态提示 */}
            {step === 'form' && (
              <div className="flex flex-col items-center justify-center text-center h-64 rounded border border-dashed border-border">
                <Sparkles size={32} className="text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">填写客户信息后，点击「AI背景调研」</p>
                <p className="text-xs text-muted-foreground/60 mt-1">AI将自动分析客户背景并生成专业PPT</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

// 辅助组件
function BackgroundSection({ title, content }: { title: string; content: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">{title}</div>
      <p className="text-sm text-foreground text-pretty leading-relaxed">{content}</p>
    </div>
  );
}

function TagsSection({ title, items, color }: { title: string; items: string[]; color: string }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-2">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items?.map((item, idx) => (
          <span key={idx} className={`text-xs px-2 py-0.5 rounded ${color}`}>{item}</span>
        ))}
      </div>
    </div>
  );
}

// 生成PPT HTML文件
function generatePptHtml(ppt: PptContent): string {
  const slidesHtml = ppt.slides?.map((slide, idx) => `
    <div class="slide">
      <div class="slide-number">${idx + 1} / ${ppt.slides.length}</div>
      <h2>${slide.title}</h2>
      <ul>${slide.content?.map(p => `<li>${p}</li>`).join('')}</ul>
      ${slide.notes ? `<div class="notes">备注: ${slide.notes}</div>` : ''}
    </div>
  `).join('') || '';

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>${ppt.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f7fa; padding: 20px; }
    h1 { text-align: center; color: #1d4ed8; margin-bottom: 8px; }
    .subtitle { text-align: center; color: #6b7280; margin-bottom: 32px; }
    .slide { background: white; border: 1px solid #e5e7eb; border-radius: 4px; padding: 32px; margin-bottom: 16px; position: relative; }
    .slide-number { position: absolute; top: 12px; right: 16px; font-size: 12px; color: #9ca3af; }
    .slide h2 { color: #1d4ed8; font-size: 18px; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
    .slide ul { padding-left: 20px; }
    .slide li { color: #374151; margin-bottom: 8px; line-height: 1.6; }
    .notes { margin-top: 16px; font-size: 12px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 12px; font-style: italic; }
  </style>
</head>
<body>
  <h1>${ppt.title}</h1>
  <div class="subtitle">${ppt.subtitle}</div>
  ${slidesHtml}
</body>
</html>`;
}

export default VisitPreparePage;
