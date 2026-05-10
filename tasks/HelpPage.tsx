import React from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { HelpCircle, ClipboardList, Mic, FileSearch, Sparkles, BookOpen } from 'lucide-react';

const HelpPage: React.FC = () => {
  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle size={24} className="text-primary" />
          <h1 className="text-2xl font-bold">使用帮助</h1>
        </div>
        <p className="text-muted-foreground">欢迎使用客拜管理系统。本手册将指导您如何高效地准备、记录和分析客户拜访。</p>

        <Card className="border border-border shadow-none">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen size={18} className="text-primary" />
              快速入门
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={16} />
                    第一步：拜访前准备
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>1. 进入「拜访前准备」页面。</p>
                  <p>2. 输入客户名称、行业、规模等基本信息。</p>
                  <p>3. 点击「生成背景调研」，AI将自动搜索并整理客户的公司简介、市场地位及潜在需求。</p>
                  <p>4. 点击「生成PPT」，系统将根据调研结果为您准备一份专业的拜访演示大纲，您可以直接预览或下载。</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Mic size={16} />
                    第二步：拜访中记录
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>1. 拜访开始前，进入「拜访中记录」页面。</p>
                  <p>2. 点击「开始录音」记录交谈内容。如需暂停，可点击「暂停」。</p>
                  <p>3. 拜访结束后，点击「停止录音」并保存。</p>
                  <p>4. 如果您已有录音文件，也可以直接在页面下方「上传录音文件」处进行上传（支持 wav/mp3/m4a 格式）。</p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <FileSearch size={16} />
                    第三步：查看与分析报告
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>1. 进入「拜访报告」页面，查看所有历史记录。</p>
                  <p>2. 点击进入详情页，系统将展示：</p>
                  <ul className="list-disc list-inside pl-4 space-y-1">
                    <li><strong>AI报告：</strong> 自动提取客户意向等级、痛点分析、后续行动建议。</li>
                    <li><strong>文字稿：</strong> 查看拜访过程中的语音转文字内容。</li>
                    <li><strong>原始录音：</strong> 随时回听关键沟通片段。</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4">
                <AccordionTrigger className="text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} />
                    AI 赋能说明
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground space-y-2">
                  <p>本系统集成了先进的语言大模型，能够：</p>
                  <ul className="list-disc list-inside pl-4 space-y-1">
                    <li>自动识别行业特征并匹配最佳拜访策略。</li>
                    <li>精准抓取对话中的客户痛点和反馈。</li>
                    <li>生成高可用的下一步行动计划，避免遗漏关键线索。</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-none bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm font-medium">常见问题</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-4">
            <div>
              <p className="font-medium text-foreground">Q: 录音文件上传失败怎么办？</p>
              <p className="text-muted-foreground mt-1">请检查网络连接是否正常，且单个文件大小建议不超过 50MB。如仍有问题，请尝试刷新页面重新上传。</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Q: AI 生成的内容可以修改吗？</p>
              <p className="text-muted-foreground mt-1">目前您可以根据 AI 的建议在「拜访详情」中手动补充笔记（Notes），系统会持续优化生成内容的准确度。</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Q: 忘记密码了如何重置？</p>
              <p className="text-muted-foreground mt-1">请联系系统管理员（Admin）在用户管理页面为您重置密码。</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default HelpPage;
