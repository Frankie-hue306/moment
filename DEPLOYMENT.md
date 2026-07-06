# 此刻 (Moment) — 部署文档

> 基于项目真实配置生成，最后更新：2026-07-05

## 环境要求

| 组件 | 最低版本 | 说明 |
|------|----------|------|
| Node.js | >= 16 | 生产使用 v24 |
| npm | >= 8 | |
| SQLite | 内置（better-sqlite3） | 无需额外安装 |
| sharp | 0.33+ | 可选，无 sharp 时缩略图功能自动禁用 |
| Nginx | 1.18+ | 反向代理 + SSL 终止 |
| PM2 | 5+ | 进程管理 |
| Let's Encrypt | certbot | SSL 证书（或手动安装） |

---

## 1. Linux 服务器初始化

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y   # Ubuntu/Debian
# 或
sudo yum update -y                       # CentOS/RHEL

# 安装 Node.js（推荐使用 nvm 或 NodeSource）
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 验证
node -v   # >= 16
npm -v    # >= 8
```

---

## 2. 安装项目

```bash
# 创建应用目录
sudo mkdir -p /opt/moment
sudo chown $USER:$USER /opt/moment

# 复制项目文件
cp -r ~/Desktop/server.js ~/Desktop/db.js ~/Desktop/package.json ~/Desktop/package-lock.json /opt/moment/
cp -r ~/Desktop/middleware ~/Desktop/routes ~/Desktop/public /opt/moment/
cp ~/Desktop/migrate.js /opt/moment/

# 安装生产依赖
cd /opt/moment
npm install --production
```

---

## 3. 数据目录

```bash
# 创建数据目录结构
mkdir -p /opt/moment/data/uploads
mkdir -p /opt/moment/data/backups

# 目录说明
# /opt/moment/data/moment.db         — SQLite 数据库（自动创建）
# /opt/moment/data/moment.db-shm     — WAL 共享内存（自动创建）
# /opt/moment/data/moment.db-wal     — WAL 日志（自动创建）
# /opt/moment/data/uploads/           — 用户上传的照片和缩略图
# /opt/moment/data/backups/           — 每日自动备份（保留7天）
```

---

## 4. 环境变量

创建 `/opt/moment/.env`（或通过 PM2 ecosystem 文件设置）:

```bash
NODE_ENV=production
PORT=3000
MOMENT_DATA_DIR=/opt/moment/data
MOMENT_PUBLIC_DIR=/opt/moment/public
MOMENT_CORS_ORIGIN=https://your-domain.com
MOMENT_ADMIN_CLEAR_TOKEN=<生成一个随机令牌>
```

生产环境**不需要**（也不应该）设置 `MOMENT_DEV_LOGIN`。

生成随机令牌:
```bash
openssl rand -hex 32
```

---

## 5. PM2 启动

### 安装 PM2

```bash
sudo npm install -g pm2
```

### 创建 ecosystem 配置

创建 `/opt/moment/ecosystem.config.js`:

```js
module.exports = {
  apps: [{
    name: 'moment',
    script: 'server.js',
    cwd: '/opt/moment',
    env: {
      NODE_ENV: 'production',
      PORT: '3000',
      MOMENT_DATA_DIR: '/opt/moment/data',
      MOMENT_CORS_ORIGIN: 'https://your-domain.com',
      MOMENT_ADMIN_CLEAR_TOKEN: '<your-random-token>'
    },
    instances: 1,            // SQLite 只能单实例
    exec_mode: 'fork',       // 必须 fork，不能 cluster
    max_memory_restart: '500M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
```

### 启动

```bash
cd /opt/moment
pm2 start ecosystem.config.js

# 开机自启
pm2 save
pm2 startup

# 常用命令
pm2 status              # 查看状态
pm2 logs moment         # 实时日志
pm2 logs moment --lines 100  # 最近100行
pm2 restart moment      # 重启
pm2 stop moment         # 停止
pm2 delete moment       # 删除
```

---

## 6. Nginx 配置

### 安装 Nginx

```bash
sudo apt install -y nginx
```

### 配置文件

创建 `/etc/nginx/sites-available/moment`:

```nginx
# HTTP → HTTPS 重定向
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS 主配置
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书
    ssl_certificate     /etc/nginx/ssl/your-domain_bundle.crt;
    ssl_certificate_key /etc/nginx/ssl/your-domain.key;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # 反向代理到 Node.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 图片上传大小限制
    client_max_body_size 25m;

    # 静态资源缓存（可选：Nginx 直接代理静态文件）
    # location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg)$ {
    #     expires 30d;
    #     add_header Cache-Control "public, immutable";
    # }
}
```

### 启用站点

```bash
sudo ln -s /etc/nginx/sites-available/moment /etc/nginx/sites-enabled/
sudo nginx -t           # 测试配置
sudo systemctl reload nginx
```

---

## 7. HTTPS / SSL 配置

### 方式一：Let's Encrypt（推荐）

```bash
# 安装 certbot
sudo apt install -y certbot python3-certbot-nginx

# 自动获取并配置证书
sudo certbot --nginx -d your-domain.com

# 自动续期（安装时已自动配置定时任务）
sudo certbot renew --dry-run   # 测试续期
```

### 方式二：手动安装证书

```bash
# 1. 准备证书文件
#    - 证书链: bundle.crt
#    - 私钥:   private.key

# 2. 设置环境变量
export MOMENT_SSL_CERT_BASE64=$(cat bundle.crt | base64 | tr -d '\n')
export MOMENT_SSL_KEY_BASE64=$(cat private.key | base64 | tr -d '\n')

# 3. 运行安装脚本
bash install-ssl.sh

# 4. 重新加载 Nginx
sudo nginx -s reload
```

> ⚠️ 安装脚本中不含任何硬编码的证书内容，必须通过环境变量注入。

---

## 8. 数据备份与恢复

### 自动备份

系统每天凌晨 4:00 自动执行：
1. TRUNCATE checkpoint（合并 WAL 到主文件）
2. 复制 `moment.db` 到 `data/backups/moment-YYYY-MM-DD.db`
3. 清理超过 7 天的旧备份

### 手动备份

```bash
# 方法1: 直接复制（需先 checkpoint）
sqlite3 /opt/moment/data/moment.db "PRAGMA wal_checkpoint(TRUNCATE);"
cp /opt/moment/data/moment.db /backup/moment-$(date +%Y-%m-%d).db

# 方法2: 使用 sqlite3 .backup 命令
sqlite3 /opt/moment/data/moment.db ".backup /backup/moment-$(date +%Y-%m-%d).db"
```

### 恢复数据

```bash
# 1. 停止服务
pm2 stop moment

# 2. 备份当前数据库（以防万一）
cp /opt/moment/data/moment.db /opt/moment/data/moment.db.broken

# 3. 恢复备份
cp /opt/moment/data/backups/moment-2026-07-04.db /opt/moment/data/moment.db

# 4. 清理 WAL 文件
rm -f /opt/moment/data/moment.db-wal /opt/moment/data/moment.db-shm

# 5. 启动服务
pm2 start moment
```

---

## 9. 数据迁移（JSON → SQLite）

如果之前使用 `db.json` 文件存储数据：

```bash
# 1. 确保 db.json 在 MOMENT_DATA_DIR 下
ls /opt/moment/data/db.json

# 2. 运行迁移
MOMENT_DATA_DIR=/opt/moment/data node migrate.js

# 3. 迁移完成后原 db.json 被重命名为 db.json.backup.<timestamp>
```

---

## 10. 更新部署流程

```bash
# 1. 拉取最新代码
cd /opt/moment
# 复制新的 server.js, db.js, routes/, middleware/, public/

# 2. 安装新依赖（如有）
npm install --production

# 3. 重启服务（零停机）
pm2 reload moment

# 4. 查看日志确认正常
pm2 logs moment --lines 10
```

---

## 11. 日志

### 应用日志

PM2 管理:
```bash
pm2 logs moment           # 实时日志
pm2 logs moment --lines 50  # 最近 50 行
```

日志内容包括:
- HTTP 请求（method, URL, status, 响应时间, IP）
- SMS 验证码（仅开发模式）
- 图片上传错误
- 缩略图生成错误
- 数据库备份状态
- 安全检查告警

### 访问日志

Nginx 日志位置:
```bash
# 访问日志
tail -f /var/log/nginx/access.log

# 错误日志
tail -f /var/log/nginx/error.log
```

---

## 12. 故障排查

### 服务无法启动

```bash
# 检查端口占用
sudo lsof -i :3000

# 检查 Node 进程
ps aux | grep node

# 查看 PM2 日志
pm2 logs moment --err

# 手动启动测试
cd /opt/moment
NODE_ENV=production node server.js
```

### 数据库锁定

```bash
# SQLite WAL 模式通常自动处理并发
# 如遇到 database is locked:
# 1. 检查是否有多个进程
ps aux | grep "server.js"

# 2. 手动 checkpoint
sqlite3 /opt/moment/data/moment.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 3. 重启服务
pm2 restart moment
```

### 图片上传失败

```bash
# 检查磁盘空间
df -h /opt/moment/data/uploads

# 检查目录权限
ls -la /opt/moment/data/uploads

# 确保目录可写
chmod 755 /opt/moment/data/uploads
```

### 缩略图不生成

```bash
# 确认 sharp 已安装
node -e "require('sharp')"

# 如未安装
npm install sharp
```

### SSL 证书过期

```bash
# certbot 自动续期
sudo certbot renew

# 手动续期
sudo certbot --nginx -d your-domain.com
```

### 内存占用过高

```bash
# 查看 PM2 进程内存
pm2 monit

# 如果超过 500MB，PM2 会自动重启（ecosystem.config.js 中配置了 max_memory_restart）

# 检查数据库文件大小
ls -lh /opt/moment/data/moment.db*

# 手动压缩 WAL
sqlite3 /opt/moment/data/moment.db "PRAGMA wal_checkpoint(TRUNCATE);"
```
