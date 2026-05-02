import React, { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, Users, Calendar, TrendingUp, CheckCircle2,
  RefreshCw, ArrowRight, User, Clock,
} from 'lucide-react';
import { supabase } from '@/db/supabase';
import type { VisitListItem, Profile } from '@/types/types';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface UserStats {
  profile: Profile;
  totalVisits: number;
  completedVisits: number;
  thisMonthVisits: number;
}

const AdminStatsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: format(startOfMonth(subMonths(new Date(), 2)), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });

  const [overallStats, setOverallStats] = useState({
    totalVisits: 0,
    completedVisits: 0,
    totalUsers: 0,
    totalCustomers: 0,
  });
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [recentVisits, setRecentVisits] = useState<VisitListItem[]>([]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const startDate = new Date(dateRange.start).toISOString();
      const endDate = new Date(dateRange.end + 'T23:59:59').toISOString();

      // 全部拜访数据（日期范围内）
      const { data: allVisits } = await supabase
        .from('visits')
        .select('id, user_id, customer_name, status, visit_time, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      // 所有用户
      const { data: allUsers } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (allVisits && allUsers) {
        const uniqueCustomers = new Set(allVisits.map(v => v.customer_name));

        setOverallStats({
          totalVisits: allVisits.length,
          completedVisits: allVisits.filter(v => v.status === 'completed').length,
          totalUsers: allUsers.length,
          totalCustomers: uniqueCustomers.size,
        });

        // 按用户统计
        const stats: UserStats[] = allUsers
          .filter(u => u.role === 'user' || u.role === 'admin')
          .map(user => {
            const userVisits = allVisits.filter(v => v.user_id === user.id);
            const now = new Date();
            const thisMonthStart = startOfMonth(now);
            return {
              profile: user as Profile,
              totalVisits: userVisits.length,
              completedVisits: userVisits.filter(v => v.status === 'completed').length,
              thisMonthVisits: userVisits.filter(v => new Date(v.created_at) >= thisMonthStart).length,
            };
          })
          .filter(s => s.totalVisits > 0)
          .sort((a, b) => b.totalVisits - a.totalVisits);

        setUserStats(stats);
      }

      // 最近10条拜访记录
      const { data: recent } = await supabase
        .from('visits')
        .select('id, user_id, customer_name, customer_industry, visit_time, status, keywords, transcript, structured_report, created_at, profiles!visits_user_id_fkey(username, full_name)')
        .order('created_at', { ascending: false })
        .limit(10);
      if (recent) setRecentVisits(recent as unknown as VisitListItem[]);

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const STATUS_CONFIG = {
    preparing: { label: '准备中', className: 'text-warning bg-warning/10' },
    recording: { label: '已录音', className: 'text-primary bg-primary/10' },
    processing: { label: '处理中', className: 'text-info bg-info/10' },
    completed: { label: '已完成', className: 'text-chart-2 bg-chart-2/10' },
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-primary" />
            <h1 className="text-lg font-semibold">拜访数据统计</h1>
          </div>

          {/* 日期范围筛选 */}
          <div className="flex items-center gap-2 text-sm">
            <Input
              type="date"
              value={dateRange.start}
              onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="h-8 px-2 text-xs w-36"
            />
            <span className="text-muted-foreground">至</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="h-8 px-2 text-xs w-36"
            />
            <Button size="sm" className="h-8" onClick={fetchStats} disabled={loading}>
              {loading ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </Button>
          </div>
        </div>

        {/* 全局统计 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: <BarChart3 size={18} className="text-primary" />, label: '拜访总次数', value: overallStats.totalVisits },
            { icon: <CheckCircle2 size={18} className="text-chart-2" />, label: '已完成报告', value: overallStats.completedVisits },
            { icon: <Users size={18} className="text-chart-3" />, label: '活跃用户数', value: overallStats.totalUsers },
            { icon: <TrendingUp size={18} className="text-chart-4" />, label: '累计客户数', value: overallStats.totalCustomers },
          ].map((item, idx) => (
            <Card key={idx} className="border border-border shadow-none h-full">
              <CardContent className="p-4 flex flex-col h-full">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 各用户拜访统计 */}
          <Card className="border border-border shadow-none h-full flex flex-col">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User size={14} className="text-primary" />各销售拜访统计
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 flex-1">
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full bg-muted" />)}
                </div>
              ) : userStats.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  所选时间段内暂无数据
                </div>
              ) : (
                <div className="space-y-3">
                  {userStats.map((stat, idx) => {
                    const completionRate = stat.totalVisits > 0
                      ? Math.round(stat.completedVisits / stat.totalVisits * 100)
                      : 0;
                    return (
                      <div key={stat.profile.id} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-5 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">
                              {stat.profile.full_name || stat.profile.username}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground">{completionRate}%完成</span>
                              <span className="text-sm font-semibold text-primary">{stat.totalVisits}次</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${completionRate}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 最近拜访记录 */}
          <Card className="border border-border shadow-none h-full flex flex-col">
            <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock size={14} className="text-primary" />最近拜访记录
              </CardTitle>
              <Link to="/visits/reports" className="text-xs text-primary hover:underline flex items-center gap-1">
                查看全部 <ArrowRight size={11} />
              </Link>
            </CardHeader>
            <CardContent className="px-0 pb-0 flex-1">
              {loading ? (
                <div className="px-5 space-y-3">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full bg-muted" />)}
                </div>
              ) : recentVisits.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground px-5">暂无记录</div>
              ) : (
                <div className="divide-y divide-border">
                  {recentVisits.map(visit => {
                    const statusConf = STATUS_CONFIG[visit.status] || STATUS_CONFIG.preparing;
                    return (
                      <Link
                        key={visit.id}
                        to={`/visits/reports/${visit.id}`}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium truncate">{visit.customer_name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <User size={10} />
                            <span>{visit.profiles?.full_name || visit.profiles?.username}</span>
                            <Calendar size={10} />
                            <span>
                              {format(new Date(visit.visit_time || visit.created_at), 'M/d', { locale: zhCN })}
                            </span>
                          </div>
                        </div>
                        <span className={cn('text-xs px-1.5 py-0.5 rounded shrink-0', statusConf.className)}>
                          {statusConf.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default AdminStatsPage;
