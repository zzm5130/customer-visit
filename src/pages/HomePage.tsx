import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ClipboardList,
  Mic,
  FileSearch,
  TrendingUp,
  Users,
  Calendar,
  ArrowRight,
  CheckCircle2,
  Clock,
  BarChart3,
} from 'lucide-react';
import { supabase } from '@/db/supabase';
import type { VisitListItem, VisitStats } from '@/types/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  preparing: { label: '准备中', color: 'text-warning' },
  recording: { label: '记录中', color: 'text-primary' },
  processing: { label: '处理中', color: 'text-info' },
  completed: { label: '已完成', color: 'text-success' },
};

const featureCards = [
  {
    path: '/visits/prepare',
    icon: <ClipboardList size={28} className="text-primary" />,
    title: '拜访前准备',
    desc: '搜集客户背景资料，AI生成专业PPT',
    action: '开始准备',
    bg: 'bg-primary/5',
  },
  {
    path: '/visits/record',
    icon: <Mic size={28} className="text-destructive" />,
    title: '拜访中记录',
    desc: '录音采集拜访内容，智能转写文字',
    action: '开始录音',
    bg: 'bg-destructive/5',
  },
  {
    path: '/visits/reports',
    icon: <FileSearch size={28} className="text-chart-2" />,
    title: '拜访后查询',
    desc: 'AI整理形成结构化报告，快速检索',
    action: '查看报告',
    bg: 'bg-chart-2/5',
  },
];

const HomePage: React.FC = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [recentVisits, setRecentVisits] = useState<VisitListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 获取统计数据
        let statsQuery = supabase.from('visits').select('id, customer_name, status, visit_time, created_at');
        if (profile?.role !== 'admin') {
          statsQuery = statsQuery.eq('user_id', profile?.id || '');
        }
        const { data: allVisits } = await statsQuery;

        if (allVisits) {
          const now = new Date();
          const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const uniqueCustomers = new Set(allVisits.map(v => v.customer_name));

          setStats({
            totalVisits: allVisits.length,
            completedVisits: allVisits.filter(v => v.status === 'completed').length,
            thisMonthVisits: allVisits.filter(v => new Date(v.created_at) >= thisMonthStart).length,
            totalCustomers: uniqueCustomers.size,
          });
        }

        // 获取最近拜访记录
        let recentQuery = supabase
          .from('visits')
          .select('id, user_id, customer_name, customer_industry, visit_time, status, keywords, transcript, structured_report, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        if (profile?.role !== 'admin') {
          recentQuery = recentQuery.eq('user_id', profile?.id || '');
        }
        const { data: visits } = await recentQuery;
        if (visits) setRecentVisits(visits as VisitListItem[]);
      } finally {
        setLoading(false);
      }
    };

    if (profile) fetchData();
  }, [profile]);

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* 欢迎头部 */}
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            你好，{profile?.full_name || profile?.username} 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {format(new Date(), 'yyyy年M月d日 EEEE', { locale: zhCN })}
          </p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <BarChart3 size={18} className="text-primary" />, label: '总拜访次数', value: stats?.totalVisits ?? 0 },
            { icon: <CheckCircle2 size={18} className="text-chart-2" />, label: '已完成报告', value: stats?.completedVisits ?? 0 },
            { icon: <Calendar size={18} className="text-chart-3" />, label: '本月拜访', value: stats?.thisMonthVisits ?? 0 },
            { icon: <Users size={18} className="text-chart-4" />, label: '累计客户数', value: stats?.totalCustomers ?? 0 },
          ].map((item, idx) => (
            <Card key={idx} className="border border-border shadow-none h-full">
              <CardContent className="p-4 flex flex-col justify-between h-full">
                <div className="flex items-center gap-2 mb-2">
                  {item.icon}
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
                {loading ? (
                  <Skeleton className="h-7 w-12 bg-muted" />
                ) : (
                  <div className="text-2xl font-semibold text-foreground">{item.value}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 功能入口 */}
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wide">核心功能</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {featureCards.map(card => (
              <Card key={card.path} className="border border-border shadow-none h-full hover:border-primary/30 transition-colors">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className={cn('w-12 h-12 rounded flex items-center justify-center mb-4', card.bg)}>
                    {card.icon}
                  </div>
                  <h3 className="font-semibold text-foreground mb-1 text-balance">{card.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 flex-1 text-pretty">{card.desc}</p>
                  <Link to={card.path}>
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      {card.action}
                      <ArrowRight size={14} />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 最近拜访记录 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">最近拜访</h2>
            <Link to="/visits/reports" className="text-xs text-primary hover:underline flex items-center gap-1">
              查看全部 <ArrowRight size={12} />
            </Link>
          </div>
          <Card className="border border-border shadow-none">
            {loading ? (
              <CardContent className="p-4 space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full bg-muted" />)}
              </CardContent>
            ) : recentVisits.length === 0 ? (
              <CardContent className="p-8 text-center">
                <TrendingUp size={32} className="mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">暂无拜访记录，开始第一次拜访吧</p>
                <Link to="/visits/prepare">
                  <Button size="sm" className="mt-3">新建拜访</Button>
                </Link>
              </CardContent>
            ) : (
              <div className="divide-y divide-border">
                {recentVisits.map(visit => {
                  const statusInfo = STATUS_LABEL[visit.status] || STATUS_LABEL.preparing;
                  return (
                    <Link
                      key={visit.id}
                      to={`/visits/reports/${visit.id}`}
                      className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-sm text-foreground truncate">{visit.customer_name}</span>
                          {visit.customer_industry && (
                            <Badge variant="secondary" className="text-xs shrink-0">{visit.customer_industry}</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock size={11} className="text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {visit.visit_time
                              ? format(new Date(visit.visit_time), 'M月d日 HH:mm', { locale: zhCN })
                              : format(new Date(visit.created_at), 'M月d日 HH:mm', { locale: zhCN })}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn('text-xs font-medium', statusInfo.color)}>{statusInfo.label}</span>
                        <ArrowRight size={14} className="text-muted-foreground" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default HomePage;
