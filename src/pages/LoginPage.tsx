import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Briefcase, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const LoginPage: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string })?.from || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('请填写用户名和密码');
      return;
    }
    setLoading(true);
    const { error } = await signIn(username.trim(), password);
    setLoading(false);
    if (error) {
      toast.error(error);
    } else {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded bg-primary flex items-center justify-center mb-3">
            <Briefcase size={24} className="text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">客户拜访管理系统</h1>
          <p className="text-sm text-muted-foreground mt-1">销售团队智能拜访助手</p>
        </div>

        <Card className="border border-border shadow-none">
          <form onSubmit={handleSubmit}>
            <CardContent className="pt-6 pb-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm font-normal">用户名</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="请输入用户名"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  autoComplete="username"
                  disabled={loading}
                  className="px-3"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-normal">密码</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="请输入密码"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    disabled={loading}
                    className="px-3 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex-col gap-3 pt-0 pb-6 px-6">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 size={16} className="mr-2 animate-spin" />}
                登录
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                还没有账号？
                <Link to="/register" className="text-primary hover:underline ml-1">
                  立即注册
                </Link>
              </p>
              <p className="text-xs text-muted-foreground/70 text-center leading-relaxed">
                登录即表示您同意我们的
                <span className="underline cursor-pointer">用户协议</span>
                和
                <span className="underline cursor-pointer">隐私政策</span>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default LoginPage;
