import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Search, FileSearch, ArrowRight, Calendar, User,
  SlidersHorizontal, ChevronLeft, ChevronRight, RefreshCw, Trash2,
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import type { VisitListItem } from '@/types/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  preparing: { label: '准备中', className: 'text-warning bg-warning/10' },
  recording: { label: '已录音', className: 'text-primary bg-primary/10' },
  processing: { label: '处理中', className: 'text-info bg-info/10' },
  completed: { label: '已完成', className: 'text-chart-2 bg-chart-2/10' },
};

const PAGE_SIZE = 10;

const VisitReportsPage: React.FC = () => {
  const { profile } = useAuth();
  const [visits, setVisits] = useState<VisitListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchKeyword);
      setPage(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  const fetchVisits = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      let query = supabase
        .from('visits')
        .select('id, user_id, customer_name, customer_industry, visit_time, status, keywords, transcript, structured_report, created_at, profiles!visits_user_id_fkey(username, full_name)', { count: 'exact' });

      if (profile.role !== 'admin') {
        query = query.eq('user_id', profile.id);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (debouncedSearch.trim()) {
        query = query.or(
          `customer_name.ilike.%${debouncedSearch}%,keywords.cs.{${debouncedSearch}}`
        );
      }

      query = query.order('visit_time', { ascending: sortOrder === 'asc', nullsFirst: false });
      // 对visit_time为null的记录按created_at排序
      query = query.order('created_at', { ascending: sortOrder === 'asc' });
      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data, count, error } = await query;

      if (error) throw error;
      setVisits((data || []) as unknown as VisitListItem[]);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, [profile, debouncedSearch, statusFilter, sortOrder, page]);

  useEffect(() => {
    fetchVisits();
  }, [fetchVisits]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleDeleteVisit = async (visitId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-api', {
        body: { action: 'delete-visit', visitId }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success('拜访记录已删除');
      fetchVisits();
    } catch (err: any) {
      console.error('Delete visit error:', err);
      toast.error(err.message || '删除失败');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-5">
        {/* 标题 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSearch size={20} className="text-primary" />
            <h1 className="text-lg font-semibold">拜访报告</h1>
            <span className="text-sm text-muted-foreground">({totalCount}条)</span>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchVisits}
            className="text-muted-foreground hover:text-foreground h-8 px-2">
            <RefreshCw size={14} />
          </Button>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索客户名称或关键词..."
              value={searchKeyword}
              onChange={e => setSearchKeyword(e.target.value)}
              className="pl-9 pr-3"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(0); }}>
              <SelectTrigger className="w-28 px-3">
                <SlidersHorizontal size={12} className="mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="preparing">准备中</SelectItem>
                <SelectItem value="recording">已录音</SelectItem>
                <SelectItem value="processing">处理中</SelectItem>
                <SelectItem value="completed">已完成</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={v => { setSortOrder(v as 'desc' | 'asc'); setPage(0); }}>
              <SelectTrigger className="w-28 px-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">最新优先</SelectItem>
                <SelectItem value="asc">最早优先</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 报告列表 */}
        <Card className="border border-border shadow-none">
          {loading ? (
            <CardContent className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full bg-muted" />
              ))}
            </CardContent>
          ) : visits.length === 0 ? (
            <CardContent className="py-16 text-center">
              <FileSearch size={36} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">
                {debouncedSearch || statusFilter !== 'all' ? '未找到符合条件的拜访记录' : '暂无拜访记录'}
              </p>
              {!debouncedSearch && statusFilter === 'all' && (
                <Link to="/visits/record">
                  <Button size="sm" className="mt-3">开始第一次拜访</Button>
                </Link>
              )}
            </CardContent>
          ) : (
            <div className="divide-y divide-border">
              {/* 列表头 */}
              <div className={cn(
                "hidden md:grid gap-4 px-4 py-2.5 bg-muted/30",
                profile?.role === 'admin' ? "grid-cols-[1fr_120px_90px_90px_32px_32px]" : "grid-cols-[1fr_120px_90px_90px_32px]"
              )}>
                <span className="text-xs font-medium text-muted-foreground">客户信息</span>
                <span className="text-xs font-medium text-muted-foreground">拜访时间</span>
                <span className="text-xs font-medium text-muted-foreground">状态</span>
                <span className="text-xs font-medium text-muted-foreground">操作员</span>
                <span />
                {profile?.role === 'admin' && <span />}
              </div>

              {visits.map(visit => {
                const statusConf = STATUS_CONFIG[visit.status] || STATUS_CONFIG.preparing;
                const visitDate = visit.visit_time
                  ? format(new Date(visit.visit_time), 'M月d日 HH:mm', { locale: zhCN })
                  : format(new Date(visit.created_at), 'M月d日', { locale: zhCN }) + ' (创建)';

                return (
                  <div key={visit.id} className="relative group">
                    <Link
                      to={`/visits/reports/${visit.id}`}
                      className={cn(
                        "flex flex-col md:grid gap-2 md:gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors items-start md:items-center",
                        profile?.role === 'admin' ? "md:grid-cols-[1fr_120px_90px_90px_32px_32px]" : "md:grid-cols-[1fr_120px_90px_90px_32px]"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground">{visit.customer_name}</span>
                          {visit.customer_industry && (
                            <Badge variant="secondary" className="text-xs">{visit.customer_industry}</Badge>
                          )}
                        </div>
                        {visit.keywords && visit.keywords.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {visit.keywords.slice(0, 3).map((kw, i) => (
                              <span key={i} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {kw}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                        <Calendar size={11} />
                        {visitDate}
                      </div>

                      <div>
                        <span className={cn('text-xs px-2 py-0.5 rounded font-medium', statusConf.className)}>
                          {statusConf.label}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User size={11} />
                        <span className="truncate max-w-[72px]">
                          {visit.profiles?.full_name || visit.profiles?.username || '-'}
                        </span>
                      </div>

                      <ArrowRight size={14} className="text-muted-foreground shrink-0 hidden md:block" />
                    </Link>

                    {profile?.role === 'admin' && (
                      <div className="absolute right-2 md:right-4 top-2 md:top-1/2 md:-translate-y-1/2 z-10">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={(e) => e.preventDefault()}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle>确认删除记录？</AlertDialogTitle>
                              <AlertDialogDescription>
                                此操作将永久删除与该客户 {visit.customer_name} 的拜访记录、录音文件及AI生成的报告，且无法恢复。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={(e) => e.stopPropagation()}>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteVisit(visit.id);
                                }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                确认删除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              第 {page + 1} / {totalPages} 页，共 {totalCount} 条
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p - 1)}
                disabled={page === 0}
                className="h-8"
              >
                <ChevronLeft size={14} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="h-8"
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default VisitReportsPage;
