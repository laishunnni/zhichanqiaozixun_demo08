# 知产桥人工咨询平台 · 统一门户首页

Vue 3 + TypeScript + Vite + Vue Router + Pinia 实现的前端工程，包含统一门户首页（路径 `/`）与三端登录。

## 技术栈

- Vue 3 + TypeScript + Vite
- Vue Router（含登录态与角色路由守卫）
- Pinia（认证状态管理）
- Socket.io-client（预留实时通信）

## 登录流程

| 端 | 登录方式 | 登录后跳转 |
| --- | --- | --- |
| 用户端 | 首次注册设置密码（手机号/邮箱），之后账号 + 密码登录 | `/user/home` |
| 咨询专员端 | 专员编号 + 密码（初始 `123456`） | 首次登录 → `/expert/change-password`，否则 `/expert/home` |
| 平台管理端 | `PT_ADMIN` + `admin123` | `/admin/home` |

接口地址默认走 Vite 代理 `/api` → `http://localhost:3000`，后端见 `../backend`。

## 路由配置

| 路径 | 页面 | 说明 |
| --- | --- | --- |
| `/` | 统一门户首页 | 三个入口卡片，点击卡片或“进入登录”按钮跳转 |
| `/user/login` | 用户端登录 | 登录 / 首次注册（账号 + 设置/确认密码） |
| `/expert/login` | 咨询专员端登录 | 编号 + 密码，初始密码 123456 |
| `/admin/login` | 平台管理端登录 | PT_ADMIN + admin123 |
| `/user/home` | 用户端首页占位 | 需登录 + USER 角色 |
| `/user/submit` | 材料提交页 | 侵权平台多选 + 描述 + 证据上传（jpg/png/pdf/docx ≤10MB）+ 联系方式 |
| `/user/pay/:caseId` | 支付页 | 固定 20 元，微信/支付宝模拟支付，审核通过后自动跳转 |
| `/user/chat/:caseId` | 匹配等待与聊天页 | 排队匹配 + WebSocket 实时聊天（文字/图片） |
| `/expert/home` | 专员端首页占位 | 需登录 + EXPERT 角色 |
| `/expert/tasks` | 待办案件列表 | 已分配案件（PAID/READY_TO_CHAT） |
| `/expert/task/:caseId` | 案件详情 | 原始材料 + 用户信息，底部“确认阅读完毕” |
| `/expert/chat/:caseId` | 案件沟通 | 聊天 + 原始材料侧拉面板 + 生成方案 + 结束服务 |
| `/expert/change-password` | 首次登录强制改密 | 需登录 + EXPERT 角色 |
| `/admin/home` | 管理端首页占位 | 需登录 + ADMIN 角色 |
| `/admin/audit` | 材料审核 | 待审核案件列表 + 详情 + 通过/驳回 |
| `/admin/schedule` | 排班与专员管理 | 专员增删改 + 上午/下午/晚上值班设置 |
| `/admin/records` | 监控记录 | 已结束案例搜索 + 只读聊天记录/评分 |
| `/admin/quality` | 质量监管 | 主动监督评级 + 工单流转 |
| `/admin/dashboard` | 数据看板 | ECharts 平均分/投诉/案例分布 |

未匹配路由会重定向回 `/`。

## 本地运行

```bash
pnpm install
pnpm dev
```

生产构建与预览：

```bash
pnpm build
pnpm preview
```

## 目录结构

```text
src/
  assets/main.css           # 全局基础样式
  api/http.ts               # fetch 封装（自动携带 JWT）
  api/auth.ts               # 认证相关接口
  stores/auth.ts            # Pinia 认证状态
  components/BrandLogo.vue  # 品牌 Logo（商标图标占位）
  components/AuthCard.vue   # 登录卡片容器
  router/index.ts           # 路由配置
  views/PortalHome.vue      # 统一门户首页
  views/UserLogin.vue       # 用户端登录
  views/ExpertLogin.vue     # 咨询专员端登录
  views/AdminLogin.vue      # 平台管理端登录
  views/ChangePassword.vue  # 首次登录强制改密
  views/UserHome.vue        # 用户端首页占位
  views/ExpertHome.vue      # 专员端首页占位
  views/AdminHome.vue       # 管理端首页占位
```
