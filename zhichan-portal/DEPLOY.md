# 部署上线指南

## 需要准备的材料（全部由你申请并填在 `backend/.env`，不要外传密钥）

| 模块 | 平台 | 需要申请/配置 |
| --- | --- | --- |
| 短信 | 阿里云短信 | AccessKey ID/Secret、签名、通知模板 CODE（变量 `content`，仅用于匹配成功通知） |
| 支付宝 | 支付宝开放平台 | APP_ID、应用私钥、支付宝公钥、开通手机网站支付；回调 `https://域名/api/pay/alipay/notify` |
| 微信支付 | 微信支付商户平台 | 商户号、APIv3 密钥、商户私钥+证书序列号、平台证书、AppID；回调 `https://域名/api/pay/wechat/notify`（Native 扫码支付，无需 openid） |
| 邮件 | 任意邮箱 | SMTP host/端口/账号/授权码 |
| 环境 | 云主机 | 公网 IP、HTTPS 域名、PostgreSQL |

## 构建与启动（Docker）

```bash
# 1. 复制并填写配置
cp backend/.env.example backend/.env
# 编辑 backend/.env：数据库连接、JWT、短信/支付/邮件参数

# 2. 修改 docker-compose.yml 中数据库密码

# 3. 构建并启动（前端 80 端口 + 后端 3000 + PostgreSQL）
docker compose up -d --build

# 4. 初始化数据库
docker compose exec backend npx prisma migrate dev
docker compose exec backend npx tsx prisma/seed.ts
```

## HTTPS 与反向代理（Nginx）

前置：把域名 A 记录解析到服务器公网 IP，并放行 80/443。

```bash
# 安装并申请证书（示例以 Ubuntu + certbot 为例）
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d 你的域名
```

在 nginx 站点配置中把 `/api/`、`/uploads/`、`/socket.io/` 反代到 `http://127.0.0.1:3000`，前端静态文件指向构建产物或直接转发到 docker 前端服务：

```nginx
server {
  listen 443 ssl;
  server_name 你的域名;
  # ssl_certificate / ssl_certificate_key 由 certbot 自动生成

  location / {
    proxy_pass http://127.0.0.1:80;
    proxy_set_header Host $host;
  }
  location /api/ {
    proxy_pass http://127.0.0.1:3000;
  }
  location /uploads/ {
    proxy_pass http://127.0.0.1:3000;
  }
  location /socket.io/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }
}
```

## 上线后联调顺序

1. `GET /api/health` 返回 ok，首页可访问；
2. 登录：用户端首次注册设置密码，随后使用账号 + 密码登录（短信仅用于匹配成功通知）；
3. 支付：`PAYMENT_PROVIDER=alipay` 或 `wechat`，完成一笔真实小额支付，确认回调置单、案件进入等待匹配；
4. 通知：匹配成功后手机/邮箱收到“专员已就绪”通知（`notification_logs` 表可查发送记录）；
5. 专员端登录 → 待办 → 确认阅读 → 沟通 → 结束服务，走通全链路。

## 常见问题

- 支付回调收不到：检查回调地址是否公网可访问、是否 HTTPS、微信/支付宝后台回调域名是否已配置；
- 短信发送失败：核对 AccessKey 权限、签名与模板审核状态；
- 扫码后无法支付：确认商家号已开通 Native/当面付产品、回调地址公网 HTTPS 可达、金额与订单一致；
- 数据库迁移：`prisma migrate dev` 需在容器内执行；生产也可改用 `prisma migrate deploy`。
