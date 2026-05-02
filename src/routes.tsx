import type { ReactNode } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import VisitPreparePage from './pages/VisitPreparePage';
import VisitRecordPage from './pages/VisitRecordPage';
import VisitReportsPage from './pages/VisitReportsPage';
import VisitReportDetailPage from './pages/VisitReportDetailPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminStatsPage from './pages/AdminStatsPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: '登录', path: '/login', element: <LoginPage />, public: true },
  { name: '注册', path: '/register', element: <RegisterPage />, public: true },
  { name: '首页', path: '/', element: <HomePage /> },
  { name: '拜访前准备', path: '/visits/prepare', element: <VisitPreparePage /> },
  { name: '拜访中记录', path: '/visits/record', element: <VisitRecordPage /> },
  { name: '拜访报告', path: '/visits/reports', element: <VisitReportsPage /> },
  { name: '报告详情', path: '/visits/reports/:id', element: <VisitReportDetailPage /> },
  { name: '用户管理', path: '/admin/users', element: <AdminUsersPage /> },
  { name: '数据统计', path: '/admin/stats', element: <AdminStatsPage /> },
];
