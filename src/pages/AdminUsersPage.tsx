import React, { useEffect, useState, useCallback } from 'react';
import { MainLayout } from '@/components/layouts/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Users, Search, ShieldCheck, Shield, UserX, UserCheck, ChevronLeft, ChevronRight, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import type { Profile } from '@/types/types';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 15;

const AdminUsersPage: React.FC = () => {
  const { profile: currentUser } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (debouncedSearch.trim()) {
        query = query.or(`username.ilike.%${debouncedSearch}%,full_name.ilike.%${debouncedSearch}%`);
      }

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      const { data, count, error } = await query;
      if (error) throw error;
      setUsers((data || []) as Profile[]);
      setTotalCount(count || 0);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (userId: string, newRole: 'user' | 'admin') => {
    if (userId === currentUser?.id) {
      toast.error('不能修改自己的角色');
      return;
    }
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      toast.success(`角色已更新为${newRole === 'admin' ? '管理员' : '普通用户'}`);
    } catch {
      toast.error('角色更新失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    if (userId === currentUser?.id) {
      toast.error('不能禁用自己的账号');
      return;
    }
    setActionLoading(userId);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !currentActive })
        .eq('id', userId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentActive } : u));
      toast.success(!currentActive ? '账号已启用' : '账号已禁用');
    } catch {
      toast.error('操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <MainLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={20} className="text-primary" />
            <h1 className="text-lg font-semibold">用户管理</h1>
            <span className="text-sm text-muted-foreground">({totalCount}人)</span>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchUsers}
            className="text-muted-foreground hover:text-foreground h-8 px-2">
            <RefreshCw size={14} />
          </Button>
        </div>

        {/* 搜索 */}
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索用户名或姓名..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-3"
          />
        </div>

        {/* 用户列表 */}
        <Card className="border border-border shadow-none">
          {loading ? (
            <CardContent className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full bg-muted" />
              ))}
            </CardContent>
          ) : users.length === 0 ? (
            <CardContent className="py-16 text-center">
              <Users size={36} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">未找到用户</p>
            </CardContent>
          ) : (
            <>
              {/* 表头 */}
              <div className="hidden md:grid grid-cols-[1fr_80px_80px_100px_120px] gap-4 px-4 py-2.5 bg-muted/30 text-xs font-medium text-muted-foreground border-b border-border">
                <span>用户</span>
                <span>角色</span>
                <span>状态</span>
                <span>注册时间</span>
                <span>操作</span>
              </div>

              <div className="divide-y divide-border">
                {users.map(user => (
                  <div key={user.id}
                    className={cn(
                      'flex flex-col md:grid md:grid-cols-[1fr_80px_80px_100px_120px] gap-2 md:gap-4 px-4 py-3.5 items-start md:items-center',
                      !user.is_active && 'opacity-60'
                    )}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{user.full_name || user.username}</span>
                        {user.id === currentUser?.id && (
                          <Badge variant="secondary" className="text-xs">我</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">@{user.username}</span>
                    </div>

                    <div>
                      <Select
                        value={user.role}
                        onValueChange={v => handleRoleChange(user.id, v as 'user' | 'admin')}
                        disabled={!!actionLoading || user.id === currentUser?.id}
                      >
                        <SelectTrigger className="h-7 text-xs px-2 w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">普通用户</SelectItem>
                          <SelectItem value="admin">管理员</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded font-medium',
                        user.is_active ? 'text-chart-2 bg-chart-2/10' : 'text-muted-foreground bg-muted'
                      )}>
                        {user.is_active ? '正常' : '已禁用'}
                      </span>
                    </div>

                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(user.created_at), 'M月d日', { locale: zhCN })}
                    </div>

                    <div>
                      {user.id !== currentUser?.id && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={!!actionLoading}
                              className={cn(
                                'h-7 px-2 text-xs',
                                user.is_active
                                  ? 'text-destructive hover:text-destructive hover:bg-destructive/10'
                                  : 'text-chart-2 hover:text-chart-2 hover:bg-chart-2/10'
                              )}
                            >
                              {user.is_active
                                ? <><UserX size={12} className="mr-1" />禁用</>
                                : <><UserCheck size={12} className="mr-1" />启用</>}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {user.is_active ? '确认禁用账号' : '确认启用账号'}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {user.is_active
                                  ? `禁用后，用户 ${user.full_name || user.username} 将无法登录系统。`
                                  : `启用后，用户 ${user.full_name || user.username} 可以正常登录系统。`}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>取消</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleToggleActive(user.id, user.is_active)}
                                className={user.is_active ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
                              >
                                确认{user.is_active ? '禁用' : '启用'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">第 {page + 1} / {totalPages} 页</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page === 0} className="h-8">
                <ChevronLeft size={14} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1} className="h-8">
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default AdminUsersPage;
