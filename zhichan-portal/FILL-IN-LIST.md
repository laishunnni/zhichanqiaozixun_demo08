# 上线前需要你补充的内容清单（含精确位置）

> 安全提醒：密钥类内容（AccessKey Secret、私钥、SMTP 授权码、APIv3 密钥）**只填在 `backend/.env`**，不要发给别人、不要发给 AI。AI 只需要看这份清单里标“非敏感”的部分。

## A. 必须填写：backend/.env（主配置，行号对应当前文件）

把 `backend/.env.example` 复制为 `backend/.env` 后逐项填写：

| 行号 | 变量 | 填什么 | 从哪里获取 |
| --- | --- | --- | --- |
| 2 | `DATABASE_URL` | PostgreSQL 连接串 | 你的数据库（本机或云 RDS）；若用 docker-compose，用户/库名要与之一致 |
| 3 | `JWT_SECRET` | 随机长字符串（≥32位） | 自己生成 |
| 5 | `FRONTEND_ORIGIN` | 前端访问地址 | 上线后是 `https://你的域名` |
| 8-9 | `SMS_ACCESS_KEY_ID / SMS_ACCESS_KEY_SECRET` | 阿里云 AccessKey | 阿里云 RAM 控制台 |
| 10 | `SMS_SIGN_NAME` | 短信签名名称 | 阿里云短信控制台（需审核通过） |
| 13 | `RESET_CODE_MODE` | `mock`（开发/演示，接口直接返回验证码）或 `real`（真实发送） | 上线必须改为 `real` |
| 14 | `SMS_RESET_TEMPLATE_CODE` | 密码重置短信模板 CODE | 阿里云短信（模板变量必须是 `code`） |
| 15-18 | `WECHAT_APP_ID / SECRET / REDIRECT_URI / LOGIN_TYPE` | 微信登录（**当前前端已去掉入口，可留空**） | 微信开放平台/公众号，可选 |
| 21 | `PAYMENT_PROVIDER` | `mock` / `alipay` / `wechat` / `epay` / `zpay` | 按需切换 |
| 22-26 | `ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY / ALIPAY_NOTIFY_URL / ALIPAY_GATEWAY` | 支付宝应用配置 | 支付宝开放平台（开通手机网站支付）；NOTIFY_URL 填 `https://你的域名/api/pay/alipay/notify` |
| 27-33 | `WECHAT_PAY_*` | 微信支付商户配置 | 微信支付商户平台；NOTIFY_URL 填 `https://你的域名/api/pay/wechat/notify` |
| 46-50 | `EPAY_API_URL / EPAY_PID / EPAY_KEY / EPAY_NOTIFY_URL / EPAY_RETURN_URL` | 易支付站点地址、商户号、商户密钥 | 你的易支付商户后台；NOTIFY_URL 填 `https://你的域名/api/pay/epay/notify`（公网 HTTPS） |
| 56-59 | `ZPAY_API_URL / ZPAY_PID / ZPAY_KEY / ZPAY_NOTIFY_URL` | zpay 网关地址、商户号、商户密钥 | zpay 商户后台；NOTIFY_URL 填 `https://你的域名/api/pay/zpay/notify`（公网 HTTPS），并在 zpay 后台配置同一异步通知地址 |
| 36 | `SMS_NOTIFY_TEMPLATE_CODE` | 匹配通知短信模板 CODE | 阿里云短信（模板变量必须是 `content`） |
| 37-42 | `SMTP_HOST / PORT / USER / PASS / FROM / SECURE` | 邮件通知 | 你的邮箱 SMTP（QQ/163/企业邮箱） |

## B. 必须修改：docker-compose.yml

| 行号 | 内容 | 改成什么 |
| --- | --- | --- |
| 6 | `POSTGRES_PASSWORD: change-me` | 换成你自己的强密码 |

同时把 `backend/.env` 第 2 行 `DATABASE_URL` 的用户名/密码/库名改成与上面一致（如 `postgresql://zhichan:你的密码@db:5432/zhichan_bridge`）。

## C. 可选代码补充（用 AI 时把“提示词”整段发给它）

### C1. 扫码支付（无需额外代码）

支付宝当面付（`alipay.trade.precreate`）与微信 Native 扫码（`transactions_native`）都不需要 openid。前端已实现二维码弹窗与每 3 秒轮询支付结果，到账后自动跳转匹配页，无需再补充代码。

### C1.1 易支付（已集成，上线前只需核对两点）

- 代码位置：`backend/src/services/epay.service.ts`（下单 + 验签）、`backend/src/services/payment.service.ts`（epay 分支）、`backend/src/controllers/pay.controller.ts`（`epayNotify` 回调）。
- 已在 `.env` 配置 `PAYMENT_PROVIDER=epay` 与 `EPAY_API_URL / EPAY_PID / EPAY_KEY / EPAY_NOTIFY_URL`（回调必须是公网 HTTPS）。
- 若你的易支付站点与“彩虹易支付”签名规则不同（个别站点把 `sign_type` 也参与签名），把该站点后台的“签名说明/示例”发给 AI，只需调整 `buildEpaySign` 一个函数。

### C1.2 zpay（已集成，直接按附件协议接通）

- 代码位置：`backend/src/services/zpay.service.ts`（下单 + 验签，与官方 Node demo 签名规则一致：参数升序拼接后直接拼密钥做 MD5）、`backend/src/controllers/pay.controller.ts`（`zpayNotify` 回调）。
- 启用：`backend/.env` 填 `PAYMENT_PROVIDER=zpay` 与 `ZPAY_API_URL / ZPAY_PID / ZPAY_KEY / ZPAY_NOTIFY_URL`；zpay 后台的“异步通知地址”填 `https://你的域名/api/pay/zpay/notify`。
- 微信通道 type 为 `wxpay`、支付宝为 `alipay`；你已开通微信支付，页面点“微信支付”即可扫码完成流程。

### C2. 恢复微信登录入口（可选）

位置：`backend/src/services/wechat.service.ts` 第 8-25 行（登录逻辑仍在，前端按钮之前被移除）。
需要时让 AI 在 `frontend/src/views/UserLogin.vue` 重新加回“微信登录”按钮并跳转 `/api/auth/wechat/url`。

### C3. 核对 wechatpay-node-v3 构造参数

位置：`backend/src/services/payment.service.ts` 第 82 行注释处。
提示词：
> 请按我们 package.json 中安装的 wechatpay-node-v3 版本的实际 API，核对 payment.service.ts 里 `new WxPay({...})` 的参数和 `transactions_jsapi` 返回值是否正确（重点是 prepay_id 与签名参数生成）。

## D. 模板变量一致性（容易踩坑）

- 匹配通知短信：模板变量必须是 `content`（代码位置 `backend/src/services/notify.service.ts` 第 61 行）。
- 密码重置短信：模板变量必须是 `code`（代码位置 `backend/src/services/passwordReset.service.ts`）。

申请模板时变量名必须与上面一致，否则短信会发送失败。

## D2. 密码重置流程说明（已实现）

- 用户端登录页“忘记密码？”→ `/user/forgot-password`：输入手机号或邮箱 → 获取验证码（60 秒倒计时）→ 输入新密码并确认 → 重置成功回登录页。
- `RESET_CODE_MODE=mock` 时接口直接返回验证码并自动填入（仅限开发/演示）；`real` 时通过短信（手机账号，需 `SMS_RESET_TEMPLATE_CODE`）或邮件（邮箱账号，需 SMTP）发送。
- 已登录的三种角色都可在首页/后台通过“修改密码”用当前密码设置新密码（用户端 `/user/change-password`、专员端 `/expert/change-password`、管理端 `/admin/change-password`）。
- 数据库新增了 `password_reset_codes` 表：本地先执行 `npx prisma migrate dev --name add_password_reset_code`，生产环境用 `npx prisma migrate deploy`。

## E. 上线后联调顺序

见 [DEPLOY.md](./DEPLOY.md)（健康检查 → 短信 → 真实支付 → 匹配通知 → 专员端全链路）。
