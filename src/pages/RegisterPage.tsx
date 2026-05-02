import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Briefcase, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const RegisterPage: React.FC = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    username: '',
    fullName: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.username || !formData.fullName || !formData.password || !formData.confirmPassword) {
      toast.error('请填写所有必填项');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }
    if (formData.password.length < 6) {
      toast.error('密码长度至少6位');
      return;
    }
    if (!agreed) {
      toast.error('请阅读并同意用户协议和隐私政策');
      return;
    }
    setLoading(true);
    const { error } = await signUp(formData.username.trim(), formData.password, formData.fullName.trim());
    setLoading(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success('注册成功，请登录');
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded bg-primary flex items-center justify-center mb-3">
            <Briefcase size={24} className="text-primary-foreground" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">创建账号</h1>
          <p className="text-sm text-muted-foreground mt-1">加入客户拜访管理系统</p>
        </div>

        <Card className="border border-border shadow-none">
          <form onSubmit={handleSubmit}>
            <CardContent className="pt-6 pb-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-sm font-normal">
                  用户名 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="字母、数字或下划线"
                  value={formData.username}
                  onChange={e => handleChange('username', e.target.value)}
                  disabled={loading}
                  className="px-3"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-sm font-normal">
                  姓名 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="您的真实姓名"
                  value={formData.fullName}
                  onChange={e => handleChange('fullName', e.target.value)}
                  disabled={loading}
                  className="px-3"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-normal">
                  密码 <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="至少6位"
                    value={formData.password}
                    onChange={e => handleChange('password', e.target.value)}
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

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword" className="text-sm font-normal">
                  确认密码 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="再次输入密码"
                  value={formData.confirmPassword}
                  onChange={e => handleChange('confirmPassword', e.target.value)}
                  disabled={loading}
                  className="px-3"
                />
              </div>

              {/* 用户协议 */}
              <div className="flex items-start gap-2 min-h-12">
                <input
                  type="checkbox"
                  id="agreement"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary cursor-pointer"
                />
                <label htmlFor="agreement" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                  我已阅读并同意
                  <span className="text-primary underline cursor-pointer mx-0.5">用户协议</span>
                  和
                  <span className="text-primary underline cursor-pointer mx-0.5">隐私政策</span>
                </label>
              </div>
            </CardContent>

            <CardFooter className="flex-col gap-3 pt-0 pb-6 px-6">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 size={16} className="mr-2 animate-spin" />}
                注册
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                已有账号？
                <Link to="/login" className="text-primary hover:underline ml-1">
                  立即登录
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;
