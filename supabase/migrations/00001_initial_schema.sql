
-- 用户角色枚举
CREATE TYPE public.user_role AS ENUM ('user', 'admin');

-- 拜访状态枚举
CREATE TYPE public.visit_status AS ENUM ('preparing', 'recording', 'processing', 'completed');

-- profiles 表
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  email text,
  full_name text,
  role public.user_role NOT NULL DEFAULT 'user',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- visits 拜访记录表
CREATE TABLE public.visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  customer_industry text,
  customer_contact text,
  customer_size text,
  customer_background text,
  visit_time timestamptz,
  visit_location text,
  visit_purpose text,
  status public.visit_status NOT NULL DEFAULT 'preparing',
  ppt_content jsonb,
  transcript text,
  transcript_utterances jsonb,
  structured_report jsonb,
  keywords text[],
  recording_url text,
  recording_name text,
  recording_duration integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 公开 profiles 视图
CREATE VIEW public.public_profiles AS
  SELECT id, username, role FROM public.profiles;

-- 自动更新 updated_at 触发器函数
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER visits_updated_at
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 新用户注册同步到 profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'user'::public.user_role
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS 启用
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;

-- 辅助函数：检查用户角色
CREATE OR REPLACE FUNCTION public.has_role(uid uuid, role_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = uid AND p.role = role_name::public.user_role
  );
$$;

-- profiles RLS策略
CREATE POLICY "管理员拥有profiles全权限" ON public.profiles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "用户查看自己的profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "用户更新自己的profile（禁止修改role）" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- visits RLS策略
CREATE POLICY "管理员查看所有拜访记录" ON public.visits
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "用户查看自己的拜访记录" ON public.visits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "用户创建自己的拜访记录" ON public.visits
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户更新自己的拜访记录" ON public.visits
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "用户删除自己的拜访记录" ON public.visits
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.visits;

-- 录音文件存储桶
INSERT INTO storage.buckets (id, name, public) VALUES ('recordings', 'recordings', false);

-- 录音文件存储策略
CREATE POLICY "用户可上传自己的录音" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "用户可查看自己的录音" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'recordings' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "管理员可查看所有录音" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'recordings' AND public.has_role(auth.uid(), 'admin'));
