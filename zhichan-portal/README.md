# 知产桥人工咨询平台

统一门户 + 三端登录（用户端 / 咨询专员端 / 平台管理端）。

## 目录结构

```text
frontend/   Vue 3 + TypeScript + Vite + Vue Router + Pinia
backend/    Node.js + Express + Prisma (PostgreSQL) + JWT + Socket.io（预留）
```

## 快速开始

> 上线部署（Docker / HTTPS / 真实支付与短信配置）见 [DEPLOY.md](./DEPLOY.md)。

### 1. 后端

```bash
cd backend
pnpm install
# 复制 .env.example 为 .env，并按本机情况修改 DATABASE_URL
pnpm prisma:migrate      # 生成 users 表
pnpm prisma:seed         # 写入初始账号
pnpm dev                 # 启动 http://localhost:3000
```

需要本机已启动 PostgreSQL 并创建数据库 `zhichan_bridge`。

### 2. 前端

```bash
cd frontend
pnpm install
pnpm dev                 # 启动 http://localhost:5173（/api 已代理到 3000）
```

## 初始账号

| 端 | 账号 | 密码 |
| --- | --- | --- |
| 用户端 | `demo@zhichanqiao.com` | `123456`（任意手机号或邮箱可在用户端注册并设置密码） |
| 咨询专员端 | `ZX20260001` ~ `ZX20260010` | 密码见《咨询值班人员目录-密码》（如 `ZX20260001 / 20260001`，不在名单内无法登录） |
| 平台管理端 | `ADMIN1` ~ `ADMIN5` | `admin01` ~ `admin05`（以《管理员名单-密码表》为准，不在名单内无法登录） |

## API 概览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 登录，返回 JWT + 用户角色信息 |
| POST | `/api/auth/register` | 用户端邮箱注册 |
| POST | `/api/auth/forgot-password` | 发送密码重置验证码（短信/邮件） |
| POST | `/api/auth/reset-password` | 校验验证码并重置密码 |
| GET | `/api/auth/me` | 当前登录用户信息 |
| PUT | `/api/auth/password` | 修改密码（首次登录改密走此接口） |
| GET | `/api/user/profile` | 用户端接口占位（需 USER 角色） |
| GET | `/api/expert/cases` | 专员端接口占位（需 EXPERT 角色） |
| GET | `/api/admin/dashboard` | 管理端接口占位（需 ADMIN 角色） |
| GET | `/api/health` | 健康检查 |

### 用户端核心业务接口（需 USER 角色）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/user/cases` | 创建案件（侵权平台、描述、联系方式），状态 PENDING_REVIEW |
| GET | `/api/user/cases` | 我的案件列表 |
| GET | `/api/user/cases/:caseId` | 案件详情 |
| POST | `/api/user/cases/:caseId/evidence` | 上传证据（jpg/png/pdf/docx，≤10MB） |
| POST | `/api/user/cases/:caseId/orders` | 创建支付订单（固定 20 元） |
| POST | `/api/user/cases/:caseId/pay/mock` | 模拟微信/支付宝支付回调，支付后自动匹配专员 |
| POST/GET | `/api/pay/epay/notify` | 易支付异步通知回调（MD5 验签 + 金额复核） |
| POST/GET | `/api/pay/zpay/notify` | zpay 异步通知回调（MD5 验签 + 金额复核） |
| POST | `/api/user/cases/:caseId/match` | 手动触发匹配 |
| GET | `/api/user/cases/:caseId/match` | 轮询匹配状态 |
| GET | `/api/user/cases/:caseId/room` | 获取聊天房间与历史消息 |
| POST | `/api/user/cases/:caseId/room/image` | 上传聊天图片 |

### 管理端审核接口（需 ADMIN 角色）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/admin/cases` | 案件列表（`?status=PENDING_REVIEW` 待审核） |
| GET | `/api/admin/cases/:caseId` | 案件详情（材料/聊天/评分/工单） |
| POST | `/api/admin/cases/:caseId/review` | 审核案件（`approved` + 驳回理由 `rejectReason`） |
| GET/POST | `/api/admin/experts` | 专员列表 / 新增专员（初始密码，首次登录改密） |
| PUT/DELETE | `/api/admin/experts/:expertId` | 启用停用 / 软删除专员 |
| GET | `/api/admin/shifts?date=` | 排班列表 |
| POST | `/api/admin/shifts` | 设置某专员某日某时段（上午/下午/晚上）值班 |
| GET | `/api/admin/records` | 已结束案例搜索（案件ID/专员/日期范围） |
| GET | `/api/admin/records/:caseId` | 完整聊天记录（只读）+ 评分 + 工单 |
| POST | `/api/admin/records/:caseId/supervision` | 主动监督评级（优秀/合格/待改进）→ 内部工单 |
| GET | `/api/admin/work-orders` | 工单列表 |
| PUT | `/api/admin/work-orders/:id/status` | 工单流转：待处理 → 处理中 → 已关闭 |
| GET | `/api/admin/dashboard` | 看板：专员平均分、投诉次数、案例状态分布 |

### 用户评分（被动监督）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/user/cases/:caseId/rating` | 用户 1-5 星评分 + 反馈；评分 ≤3 星自动生成投诉工单 |

### 咨询专员端接口（需 EXPERT 角色）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/expert/tasks` | 待办案件（PAID / READY_TO_CHAT） |
| GET | `/api/expert/tasks/:caseId` | 案件详情（原始材料、用户信息） |
| GET | `/api/expert/tasks/:caseId/room` | 聊天房间与历史消息 |
| POST | `/api/expert/tasks/:caseId/room/image` | 上传聊天图片 |
| POST | `/api/expert/tasks/:caseId/confirm-read` | 确认阅读完毕，案件 → READY_TO_CHAT |
| POST | `/api/expert/tasks/:caseId/solution` | 生成解决方案 PDF（pdf-lib 模板）并发送给用户 |
| POST | `/api/expert/tasks/:caseId/end` | 结束服务，案件 → COMPLETED |

### WebSocket（Socket.io，需 JWT）

| 事件 | 方向 | 说明 |
| --- | --- | --- |
| `join_room` | 客户端 → 服务端 | 加入聊天房间（校验成员身份） |
| `send_message` | 客户端 → 服务端 | 发送文字/图片消息（持久化） |
| `receive_message` | 服务端 → 客户端 | 广播新消息 |
| `confirm_read` | 专员 → 服务端 | 确认已阅读材料 |
| `generate_solution` | 专员 → 服务端 | 生成解决方案 PDF |
| `end_service` | 专员 → 服务端 | 结束服务 |
| `expert_ready` | 服务端 → 用户端 | 专员已就绪，可开始聊天 |
| `solution_ready` | 服务端 → 双方 | 解决方案已生成 |
| `service_ended` | 服务端 → 双方 | 服务已结束 |
| `case_reviewed` | 服务端 → 广播 | 案件审核结果（用户端轮询兜底） |

### 工单流转

`PENDING`（待处理）→ `PROCESSING`（处理中）→ `CLOSED`（已关闭）。主动监督评级与用户低分投诉都会生成工单并私信对应专员（专员端“我的工单”）。

### 全局视觉统一（第 5 步）

- 全局 CSS 变量见 `frontend/src/assets/theme.css`：三端主色 `--color-user #1e40af` / `--color-expert #2563eb` / `--color-admin #3b82f6`、全局背景 `--bg-global #E8F4FD`、圆角/阴影/字体统一管理；
- 导航与品牌：管理端侧边栏固定“商标图标 + 知产桥”；各角色首页、底栏统一版权/联系方式/财务公开链接（`AppFooter.vue`）；
- 水印：门户页保留半透明 Logo 水印（透明度 10%），登录页/业务页使用全局浅蓝背景；
- 响应式：管理端侧边栏在移动端转为顶部横向导航，业务页栅格自动降级为单列；
- 解决方案 PDF：含 Logo、案件编号、侵权分析、法律依据、建议步骤、风险提示，留出可编辑区域。

### 案件状态流转

`PENDING_REVIEW`（材料审核中）→ `APPROVED`（审核通过，进入支付）→ `PAID`（已支付并分配专员，等待专员确认阅读）→ `READY_TO_CHAT`（专员确认阅读完毕，双方实时沟通）→ `COMPLETED`（专员结束服务）；匹配不到专员时为 `MATCHING`（排队等待），审核不通过为 `REJECTED`。

> PDF 解决方案：基于 pdf-lib 生成 A4 PDF，内含知产桥 Logo、案件编号、用户/专员信息、侵权分析等；法律依据与处理建议留空待编辑。中文字体优先读取 `backend/assets/fonts/` 下的 TTF/OTF/TTC，未找到时自动回退系统字体或 ASCII 输出。

> 注意：早期占位接口 `/api/user/profile`、`/api/admin/dashboard` 已被业务接口替换；`/api/expert/cases` 仍为专员端占位，后续补充案件处理接口。

## 前端路由与守卫

- `/` 门户首页，所有访客可访问
- `/user/login`、`/expert/login`、`/admin/login` 三个登录页
- `/user/home`、`/expert/home`、`/admin/home` 三个端首页占位
- `/expert/change-password` 首次登录强制改密页
- 未登录访问 `/user/*`、`/expert/*`、`/admin/*` 跳回对应登录页；角色不符跳回本角色首页

## 环境变量（backend/.env）

```text
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/zhichan_bridge?schema=public"
JWT_SECRET="生产环境请改为随机长字符串"
JWT_EXPIRES_IN="7d"
FRONTEND_ORIGIN="http://localhost:5173"
```

## 用户端登录与微信登录配置（可选）

用户端登录方式：**首次注册设置密码（账号为手机号或邮箱），之后使用账号 + 密码登录**，不再使用验证码登录。短信仅用于匹配成功通知（见下方“匹配成功通知”）。

### 忘记密码 / 重置密码

- 用户端登录页点击“忘记密码？”→ 输入手机号或邮箱 → 获取验证码（60 秒倒计时）→ 设置新密码并确认 → 重置成功回登录页。
- 验证码有效期 10 分钟；`RESET_CODE_MODE=mock` 时接口直接返回验证码便于本地测试，上线改为 `real` 后通过短信（手机账号，模板变量 `code`）或邮件（邮箱账号，SMTP）发送。
- 三种角色登录后均可通过“修改密码”入口（用户端 `/user/change-password`、专员端 `/expert/change-password`、管理端 `/admin/change-password`）用当前密码设置新密码。

### 微信登录

1. 微信开放平台创建“网站应用”（扫码登录）并完成认证，获取 AppID/AppSecret；或在公众号后台开通网页授权（`WECHAT_LOGIN_TYPE=mp`）；
2. 在微信后台配置授权回调域名，与 `WECHAT_REDIRECT_URI` 一致；服务器需公网 HTTPS 可访问；
3. 在 `backend/.env` 填写：

```text
WECHAT_APP_ID=""
WECHAT_APP_SECRET=""
WECHAT_REDIRECT_URI="https://你的域名/api/auth/wechat/callback"
WECHAT_LOGIN_TYPE="qrcode"
```

4. 流程：用户端“微信登录” → `GET /api/auth/wechat/url` 获取授权链接 → 用户扫码/授权 → 微信回调 `GET /api/auth/wechat/callback` → 用 code 换取 openid → 按 openid 查找或创建 USER → 签发 JWT → 302 回前端 `/wechat/callback?token=...` → 前端落盘 token 并进入用户端首页。

> 微信/短信都依赖外部服务，本地联调时未配置会返回明确错误提示，不会静默失败。

## 真实支付与匹配通知配置

### 支付（支付宝当面付 / 微信 Native / 易支付聚合扫码）

`backend/.env` 中 `PAYMENT_PROVIDER` 控制模式：

- `mock`（默认）：前端走模拟支付，支付成功后本地置为已支付并触发匹配；
- `alipay`：当面付扫码（`alipay.trade.precreate`），返回二维码内容，前端弹窗展示并轮询支付结果；支付宝异步回调 `POST /api/pay/alipay/notify` 验签后自动置单、置案件为已支付并触发匹配；
- `wechat`：Native 扫码支付（`transactions_native`），返回 `code_url` 二维码，前端弹窗展示并轮询；回调 `POST /api/pay/wechat/notify`（AES-256-GCM 解密 resource；生产建议再校验 `Wechatpay-Signature`）。
- `epay`：易支付（第三方聚合支付）API 下单，返回二维码内容，前端弹窗展示并轮询；通道不支持本地二维码时自动跳转收银台。回调 `POST/GET /api/pay/epay/notify`（MD5 验签 + 金额复核）后自动置单并触发匹配。配置项为 `EPAY_API_URL / EPAY_PID / EPAY_KEY / EPAY_NOTIFY_URL`，其中 `EPAY_NOTIFY_URL` 必须为公网 HTTPS 地址；若你的易支付站点签名规则不同，只需调整 `backend/src/services/epay.service.ts` 中的 `buildEpaySign`。
- `zpay`：zpay（第三方聚合支付）`mapi.php` 下单，返回二维码内容，前端弹窗展示并轮询；通道不支持本地二维码时自动跳转收银台。回调 `POST/GET /api/pay/zpay/notify`（MD5 验签 + 金额复核）后自动置单并触发匹配。配置项为 `ZPAY_API_URL / ZPAY_PID / ZPAY_KEY / ZPAY_NOTIFY_URL`；签名规则见 `backend/src/services/zpay.service.ts` 的 `buildZpaySign`（与 zpay 官方 Node demo 一致）。

支付流程：用户点选微信/支付宝 → 页面弹出二维码 → 手机扫码支付 → 前端每 3 秒轮询案件状态，到账后自动跳转匹配/沟通页。

需要填写：`ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY / ALIPAY_NOTIFY_URL`，或 `WECHAT_PAY_APP_ID / WECHAT_PAY_MCH_ID / WECHAT_PAY_SERIAL_NO / WECHAT_PAY_PRIVATE_KEY / WECHAT_PAY_PUBLIC_KEY / WECHAT_PAY_API_V3_KEY / WECHAT_PAY_NOTIFY_URL`。

### 匹配成功通知（短信 / 邮件）

匹配成功（`tryAssignExpert`）后自动按案件联系方式发送：

- 短信：阿里云短信，模板变量 `content`，配置 `SMS_NOTIFY_TEMPLATE_CODE`；
- 邮件：SMTP，配置 `SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM / SMTP_SECURE`；
- 发送记录写入 `notification_logs` 表；通道未配置时静默跳过。

### 短信（仅匹配成功通知）

短信只用于“专员已就绪”通知，由服务端在匹配成功后调用，不参与登录。配置 `SMS_NOTIFY_TEMPLATE_CODE` 与 `SMS_ACCESS_KEY_ID/SECRET/SIGN_NAME` 即可。
