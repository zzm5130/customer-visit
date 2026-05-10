import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard,
  ClipboardList,
  Mic,
  FileSearch,
  Users,
  BarChart3,
  Menu,
  LogOut,
  ChevronRight,
  Briefcase,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { name: '工作台', path: '/', icon: <LayoutDashboard size={18} /> },
  { name: '拜访前准备', path: '/visits/prepare', icon: <ClipboardList size={18} /> },
  { name: '拜访中记录', path: '/visits/record', icon: <Mic size={18} /> },
  { name: '拜访报告', path: '/visits/reports', icon: <FileSearch size={18} /> },
  { name: '使用帮助', path: '/help', icon: <HelpCircle size={18} /> },
  { name: '用户管理', path: '/admin/users', icon: <Users size={18} />, adminOnly: true },
  { name: '数据统计', path: '/admin/stats', icon: <BarChart3 size={18} />, adminOnly: true },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const { profile } = useAuth();

  const visibleItems = navItems.filter(item => !item.adminOnly || profile?.role === 'admin');

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-sidebar-border">
        <div className="w-8 h-8 rounded bg-sidebar-primary flex items-center justify-center">
          <Briefcase size={16} className="text-sidebar-primary-foreground" />
        </div>
        <div>
          <div className="text-sm font-semibold text-sidebar-primary-foreground">客拜管理系统</div>
          <div className="text-xs text-sidebar-foreground/60">销售助手</div>
        </div>
      </div>

      {/* 导航项 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <div className="px-2 pb-2 pt-1 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
          常用功能
        </div>
        {visibleItems.filter(i => !i.adminOnly).map(item => (
          <Link
            key={item.path}
            to={item.path}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors duration-150',
              location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path))
                ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            {item.icon}
            <span>{item.name}</span>
          </Link>
        ))}

        {profile?.role === 'admin' && (
          <>
            <div className="px-2 pb-2 pt-4 text-xs font-medium text-sidebar-foreground/50 uppercase tracking-wider">
              管理后台
            </div>
            {visibleItems.filter(i => i.adminOnly).map(item => (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded text-sm transition-colors duration-150',
                  location.pathname === item.path
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
              >
                {item.icon}
                <span>{item.name}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* 用户信息 */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
              {profile?.full_name?.charAt(0) || profile?.username?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground truncate">
              {profile?.full_name || profile?.username}
            </div>
            <div className="text-xs text-sidebar-foreground/50">
              {profile?.role === 'admin' ? '管理员' : '普通用户'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success('已退出登录');
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* 桌面侧边栏 */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* 主内容区 */}
      <div className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
        {/* 顶部栏 */}
        <header className="sticky top-0 z-40 flex items-center justify-between h-14 px-4 bg-card border-b border-border">
          <div className="flex items-center gap-3">
            {/* 移动端汉堡菜单 */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden text-foreground hover:bg-accent">
                  <Menu size={20} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-56 bg-sidebar">
                <SidebarContent onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <div className="flex items-center gap-1 text-xs text-muted-foreground lg:hidden">
              <Briefcase size={14} className="text-primary" />
              <span className="font-medium text-foreground">客拜管理系统</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2 text-sm text-foreground hover:bg-accent">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                      {profile?.full_name?.charAt(0) || profile?.username?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:block max-w-[120px] truncate">
                    {profile?.full_name || profile?.username}
                  </span>
                  <ChevronRight size={14} className="opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <div className="px-3 py-2">
                  <div className="text-sm font-medium truncate">{profile?.full_name || profile?.username}</div>
                  <div className="text-xs text-muted-foreground">{profile?.role === 'admin' ? '管理员' : '普通用户'}</div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut size={14} className="mr-2" />
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
