import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import type { AuthRole } from '@/api/auth'

type RoleGuardMeta = AuthRole

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    public?: boolean
    requiresAuth?: boolean
    role?: RoleGuardMeta
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'portal',
    component: () => import('@/views/PortalHome.vue'),
    meta: { title: '统一门户', public: true },
  },
  {
    path: '/user/login',
    name: 'user-login',
    component: () => import('@/views/UserLogin.vue'),
    meta: { title: '用户端登录', public: true },
  },
  {
    path: '/user/forgot-password',
    name: 'user-forgot-password',
    component: () => import('@/views/UserForgotPassword.vue'),
    meta: { title: '重置密码', public: true },
  },
  {
    path: '/wechat/callback',
    name: 'wechat-callback',
    component: () => import('@/views/WechatCallback.vue'),
    meta: { title: '微信登录', public: true },
  },
  {
    path: '/expert/login',
    name: 'expert-login',
    component: () => import('@/views/ExpertLogin.vue'),
    meta: { title: '咨询专员端登录', public: true },
  },
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('@/views/AdminLogin.vue'),
    meta: { title: '平台管理端登录', public: true },
  },
  {
    path: '/user/home',
    name: 'user-home',
    component: () => import('@/views/UserHome.vue'),
    meta: { title: '用户端', requiresAuth: true, role: 'USER' },
  },
  {
    path: '/user/change-password',
    name: 'user-change-password',
    component: () => import('@/views/ChangePassword.vue'),
    props: {
      title: '修改密码',
      subtitle: '输入当前密码后设置新密码',
      color: '#1e40af',
      soft: 'rgba(30, 64, 175, 0.08)',
      shadow: 'rgba(30, 64, 175, 0.18)',
      redirectTo: '/user/login',
    },
    meta: { title: '修改密码', requiresAuth: true, role: 'USER' },
  },
  {
    path: '/admin/change-password',
    name: 'admin-change-password',
    component: () => import('@/views/ChangePassword.vue'),
    props: {
      title: '修改密码',
      subtitle: '输入当前密码后设置新密码',
      color: '#3b82f6',
      soft: 'rgba(59, 130, 246, 0.08)',
      shadow: 'rgba(59, 130, 246, 0.18)',
      redirectTo: '/admin/login',
    },
    meta: { title: '修改密码', requiresAuth: true, role: 'ADMIN' },
  },
  {
    path: '/user/submit',
    name: 'user-submit',
    component: () => import('@/views/UserSubmit.vue'),
    meta: { title: '提交材料', requiresAuth: true, role: 'USER' },
  },
  {
    path: '/user/pay/:caseId',
    name: 'user-pay',
    component: () => import('@/views/UserPay.vue'),
    meta: { title: '支付', requiresAuth: true, role: 'USER' },
  },
  {
    path: '/user/chat/:caseId',
    name: 'user-chat',
    component: () => import('@/views/UserChat.vue'),
    meta: { title: '匹配与沟通', requiresAuth: true, role: 'USER' },
  },
  {
    path: '/expert/home',
    name: 'expert-home',
    component: () => import('@/views/ExpertHome.vue'),
    meta: { title: '咨询专员端', requiresAuth: true, role: 'EXPERT' },
  },
  {
    path: '/expert/change-password',
    name: 'expert-change-password',
    component: () => import('@/views/ChangePassword.vue'),
    meta: { title: '修改初始密码', requiresAuth: true, role: 'EXPERT' },
  },
  {
    path: '/expert/tasks',
    name: 'expert-tasks',
    component: () => import('@/views/ExpertTasks.vue'),
    meta: { title: '待办案件', requiresAuth: true, role: 'EXPERT' },
  },
  {
    path: '/expert/task/:caseId',
    name: 'expert-task-detail',
    component: () => import('@/views/ExpertTaskDetail.vue'),
    meta: { title: '案件详情', requiresAuth: true, role: 'EXPERT' },
  },
  {
    path: '/expert/chat/:caseId',
    name: 'expert-chat',
    component: () => import('@/views/ExpertChat.vue'),
    meta: { title: '案件沟通', requiresAuth: true, role: 'EXPERT' },
  },
  {
    path: '/admin',
    component: () => import('@/layouts/AdminLayout.vue'),
    meta: { requiresAuth: true, role: 'ADMIN' },
    children: [
      { path: '', redirect: '/admin/audit' },
      {
        path: 'audit',
        name: 'admin-audit',
        component: () => import('@/views/AdminAudit.vue'),
        meta: { title: '材料审核' },
      },
      {
        path: 'schedule',
        name: 'admin-schedule',
        component: () => import('@/views/AdminSchedule.vue'),
        meta: { title: '排班管理' },
      },
      {
        path: 'records',
        name: 'admin-records',
        component: () => import('@/views/AdminRecords.vue'),
        meta: { title: '监控记录' },
      },
      {
        path: 'quality',
        name: 'admin-quality',
        component: () => import('@/views/AdminQuality.vue'),
        meta: { title: '质量监管' },
      },
      {
        path: 'dashboard',
        name: 'admin-dashboard',
        component: () => import('@/views/AdminDashboard.vue'),
        meta: { title: '数据看板' },
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

const loginPathByRole: Record<AuthRole, string> = {
  USER: '/user/login',
  EXPERT: '/expert/login',
  ADMIN: '/admin/login',
}

const homePathByRole: Record<AuthRole, string> = {
  USER: '/user/home',
  EXPERT: '/expert/home',
  ADMIN: '/admin/audit',
}

const loginPaths = Object.values(loginPathByRole)

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  // 公共页面：门户首页始终可访问；已登录用户访问自己的登录页时直接进入对应端首页
  if (to.meta.public) {
    if (auth.isAuthenticated && auth.user && loginPaths.includes(to.path)) {
      return homePathByRole[auth.user.role] ?? '/'
    }
    return true
  }

  // 未登录访问受保护页面 → 跳转对应登录页
  if (!auth.isAuthenticated || !auth.user) {
    const role = to.meta.role ?? 'USER'
    return loginPathByRole[role] ?? '/user/login'
  }

  // 已登录但角色不符 → 跳到自己角色的首页
  if (to.meta.role && to.meta.role !== auth.user.role) {
    return homePathByRole[auth.user.role] ?? '/'
  }

  // 专员首次登录（初始密码 123456）→ 强制进入修改密码页
  if (
    auth.user.mustChangePassword &&
    auth.user.role === 'EXPERT' &&
    to.name !== 'expert-change-password'
  ) {
    return { name: 'expert-change-password' }
  }

  return true
})

router.afterEach((to) => {
  const title = to.meta.title
  document.title = typeof title === 'string' ? `${title} · 知产桥` : '知产桥'
})

export default router
