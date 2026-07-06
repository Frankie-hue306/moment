# 此刻 (Moment) — 开发指南

> 面向接手本项目的开发者或 AI。阅读本文档后即可快速理解架构并开始开发。

---

## 1. 项目架构

### 整体分层

```
┌──────────────────────────────────────┐
│              浏览器 (PWA)             │
│  public/index.html  +  js/*.js       │
│  localStorage  /  IndexedDB (via SW) │
└──────────────┬───────────────────────┘
               │ HTTP (x-auth-token header)
┌──────────────▼───────────────────────┐
│        Nginx (生产环境)               │
│  SSL终止 / 反向代理 / 静态资源缓存     │
└──────────────┬───────────────────────┘
               │ proxy_pass :3000
┌──────────────▼───────────────────────┐
│          Express 5 (server.js)       │
│  CORS → morgan → json → static      │
│  → rateLimit → routes → 404 → 500   │
└──────────────┬───────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌──────┐ ┌──────────┐
│ SQLite │ │ 磁盘  │ │ In-Memory│
│moment.db│ │uploads│ │SMS_CODES │
└────────┘ └──────┘ └──────────┘
```

### 后端模块依赖

```
server.js  (组装入口)
  ├── cors, morgan, express.json, static
  ├── middleware/rateLimit.js      ── 无依赖
  ├── routes/auth.js               ── db.js (db, SMS_CODES, genSMSCode, uid, imgUrl)
  ├── routes/moments.js            ── db.js + middleware/auth.js
  ├── routes/user.js               ── db.js + middleware/auth.js
  ├── routes/admin.js              ── db.js + middleware/auth.js
  └── routes/images.js             ── db.js (db, UPLOADS_DIR)
```

### 前端模块依赖

```
加载顺序（index.html 中的 <script> 顺序）:

starry-world.js    (独立，无依赖)
  ↓
app.js             (定义 D, API, AUTH, imgUrl, save, processPendingQueue)
  ↓
auth.js            (依赖: AUTH, API, imgUrl; 提供: isLoggedIn, api, showLogin, doLogin)
  ↓
settings.js        (依赖: app + auth + starry-world; 提供: showToast, updateSideMenuUser, dark mode)
  ↓
capture.js         (依赖: app + auth + settings + starry-world; 提供: pick, saveMoment)
  ↓
gallery.js         (依赖: app + auth; 提供: updateHomeUI, refreshGallery)
  ↓
explore.js         (依赖: app + auth + settings + gallery; 提供: waterfall, filmstrip)
  ↓
collage.js         (依赖: app + gallery; 提供: collage, timeFragment)
  ↓
init.js            (依赖: 以上所有; 最后加载，触发初始化)
```

所有模块通过**全局函数声明**通信。由于 `function foo() {}` 声明在各自 script 标签内被提升，跨文件调用均通过事件处理器或异步回调触发，模块加载时不存在同步跨文件调用。

---

## 2. 数据流

### 整体数据流向

```
用户操作 → 前端JS → api() → fetch API → Express route → db.js → SQLite
                  ↓                                  ↓
             localStorage                      文件系统 (uploads/)
              (离线缓存)                        (照片文件)
```

### 前端状态管理

**全局状态** (`app.js`):
```javascript
var D = { m: [], c: 0, i: -1 };  // 照片数组、总数、当前索引
var API = 'https://cikemoment.cn';  // API 地址
var AUTH = { token: '', tokenCreatedAt: 0, userId: 0 };  // 登录状态
```

- `D` 在每次操作后通过 `save()` 持久化到 `localStorage(mv21)`
- `AUTH` 在登录后通过 `saveAuth()` 持久化到 `localStorage(mv_auth)`
- 离线照片标记 `_pending: true`，恢复网络后由 `processPendingQueue()` 自动上传

### API 请求封装

```javascript
// auth.js
function api(path, opts) {
  // 1. 拼接完整 URL
  // 2. 自动添加 x-auth-token header
  // 3. 发送请求
  // 4. 401 时检查响应体是否为服务端发出的已知消息，
  //    是则触发 handleAuthExpired()（清空token + 弹出登录）
  // 5. 200 时返回解析后的 JSON
}
```

---

## 3. 登录流程

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  输入手机号 │ ──→ │  获取验证码 │ ──→ │  输入验证码 │ ──→ │  登录成功  │
│  (11位)   │     │ POST /sms │     │  (6位)    │     │ POST /login│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                       │                                  │
                       ▼                                  ▼
              genSMSCode(ph)                   db: INSERT/UPDATE users
              生成6位随机数                    返回 {token, userId, nickname...}
              存入 SMS_CODES (5分钟有效)
              开发模式打印到控制台
                                                    │
                                                    ▼
                                            localStorage: mv_auth
                                            AUTH = {token, userId...}
                                            updateSideMenuUser()
                                            updateAllUI()
```

**关键代码路径**:
- 前端: `auth.js → sendSMS()` → `doLogin()`
- 后端: `routes/auth.js → POST /api/sms/send` → `POST /api/login`
- SMS限流: 同一手机号60秒冷却，同一IP 20秒冷却
- 开发模式: `NODE_ENV != 'production' && MOMENT_DEV_LOGIN='1'` 时任意6位数字可登录

---

## 4. 图片上传流程

```
┌─────────────┐
│ 点击"拍下此刻" │
│ mainAction() │
└──────┬──────┘
       ▼
  pick() — 触发 file input (capture="environment")
  启动 60s 倒计时
       │
       ▼
  用户拍照/选择照片
       │
       ▼
  gotPhoto(e)
  ├── FileReader 读取文件
  ├── resizeImage() — 缩放到 2048px 宽、去黑边、JPEG Q85
  └── 显示预览界面
       │
       ▼
  用户输入感想 + 点击发布
       │
       ▼
  saveMoment()
  ├── 检查 navigator.onLine
  │   ├── 在线 → POST /api/moments { dataUrl, thought }
  │   └── 离线 → localStorage (_pending: true) + 等待 online 事件
  └── afterCaptureBack() → 回到首页
       │
       ▼
─────── 服务端 ───────
  POST /api/moments
  ├── auth 中间件检查 token
  ├── saveImage(dataUrl)
  │   ├── 解析 base64
  │   ├── 验证魔法字节 (JPEG: FF D8 / PNG: 89 50 4E 47)
  │   ├── 检查大小 (≤ 20MB)
  │   ├── 生成随机文件名 (12位hex)
  │   ├── 写入磁盘
  │   └── 异步: sharp 生成缩略图 (400px, JPEG Q70)
  ├── 更新连续打卡天数 (comparison with yesterday)
  ├── INSERT INTO moments
  └── 返回 { id, imageUrl }
```

**关键点**:
- 缩略图是异步生成的，不影响上传响应速度
- sharp 未安装时缩略图功能自动降级，不影响上传
- `imageUrl` 返回的是服务端路径（如 `/api/image/uploads/xxx.jpg`），前端用 `imgUrl()` 拼接完整 URL

---

## 5. Moment 发布流程

### 在线发布

```
saveMoment()
├── 检查是否登录 (isLoggedIn)
│   ├── 已登录 → 走服务端 API (POST /api/moments)
│   └── 未登录 → 仅存 localStorage
├── navigator.onLine 检查
│   ├── 在线 → 立即上传
│   └── 离线 → _pending: true → 等待 processPendingQueue()
└── 成功后:
    ├── D.c++ (计数+1)
    ├── D.m.unshift(新moment)
    ├── save() → localStorage
    └── updateAllUI()
```

### 离线队列恢复

```
processPendingQueue() 触发时机:
├── init.js: 启动时（如果已登录+在线）
├── init.js: window 'online' 事件
└── 逻辑:
    ├── 扫描 D.m 中所有 _pending: true 的条目
    ├── 逐条调用 POST /api/moments
    ├── 成功: 清除 _pending，更新 id 和 imageUrl
    ├── 失败: 保留 _pending
    └── 完成后: updateAllUI() + showToast()
```

---

## 6. Gallery 工作流程

```
refreshGallery()
├── 如果已登录:
│   ├── GET /api/gallery (返回服务端moments, limit 100, 不含hidden)
│   ├── 合并服务端数据到本地 D.m:
│   │   ├── 按 id 或 imageUrl 匹配
│   │   ├── 更新 status / rejectedMessage / id
│   │   └── 清除 _localId 标记
│   └── renderGallery()
├── 如果未登录:
│   └── 直接 renderGallery()
│
renderGallery()
├── 按日期分组 D.m (toLocaleDateString('zh-CN'))
├── 对每个分组:
│   ├── 显示日期标签 ("今天" / "昨天" / 具体日期)
│   ├── 显示每张照片的缩略图 + 感想
│   ├── 状态标签: 审核中(pending) / 已被移除(rejected) / 等待上传(_pending)
│   └── 点击 → view(i) 进入详情
└── view(i): 展示大图、感想、日期，支持3D景深、删除
```

---

## 7. Explore 工作流程

### 两种模式

| 模式 | 实现 | 切换方式 |
|------|------|----------|
| 沉浸 (Immersive) | 3行横向滚动的胶片 `filmRow1/2/3` | 左滑切换 |
| 瀑布流 (Waterfall) | CSS column-count=2 无限滚动 | 右滑切换 |

### 瀑布流数据流

```
refreshWaterfall(true) — 重置并加载第一页
  ↓
loadWaterfallPage()
  ├── GET /api/explore?page=N&limit=15
  ├── wfMoments.push(...新数据)
  ├── renderWaterfallCards(新数据, true) — 创建DOM卡片
  │   └── 每张卡片使用 thumbnailUrl（缺则用 imageUrl）
  ├── recycleCards() — 超过50张时移除最旧的DOM
  │   └── 用 #wf-spacer 占位保持滚动高度
  └── 滚动到底部触发自动加载下一页（scrollHeight-300px阈值）
```

### 沉浸胶片数据流

```
refreshStrangers()
  ↓
loadFilmPool() — 每30秒自动刷新
  ├── GET /api/explore?limit=50
  ├── 与现有 filmPool 合并 (poolMap 去重)
  ├── filmPool 裁剪到100条
  ├── renderFilmRows(): 打乱 → 分3行 → buildRow() 构建HTML
  └── 每行包含重复的副本用于无缝循环 (photos.concat(photos))
```

### 陌生人详情

```
showStrangerDetail(moment) — 公共函数（瀑布流+胶片共用）
├── 显示原图 (moment.imageUrl)
├── 构建点赞/举报按钮UI
├── 查询 like count (GET /api/like?momentId=xxx)
└── 显示在 #captured 覆盖层
```

---

## 8. 数据库存储说明

### 4张表

```
users ────┐
  id PK    │ 1:N
  phone    │
  token    │    moments ────┐
  ...      │      id PK     │ 1:N
           ├──── user_id FK─┘
           │      image_path
           │      thought
           │      status ─── 'approved' | 'pending' | 'rejected' | 'hidden'
           │      like_count
           │      ...
           │
           │    likes ──────┐
           ├──── user_id FK │
           │    moment_id FK┘
           │    UNIQUE(user_id, moment_id)
           │
           │    reports ────┐
           ├──── user_id FK │
           │    moment_id FK┘
           └─── UNIQUE(moment_id, user_id)
```

### WAL 模式

- `journal_mode = WAL`: 读写并发更好
- 被动 checkpoint 每5分钟
- TRUNCATE checkpoint 每日凌晨4:00
- checkpoint 后紧接数据库备份

### 图片存储

```
data/uploads/
  abc123.jpg          ← 原始图 (最大 2048px，≤ 20MB)
  thumb_abc123.jpg    ← 缩略图 (400px，JPEG Q70)
```

- 文件名: 12位hex随机字符串 (`crypto.randomBytes(6)` → 12 hex chars)
- 原始格式: 保留上传时的格式（JPEG或PNG）
- 缩略图格式: 始终 JPEG

---

## 9. Token 机制

### 生成

```javascript
// routes/auth.js (登录时)
const token = 'tok_' + uid();  // uid() = crypto.randomBytes(6).toString('hex')
// 结果: "tok_a1b2c3d4e5f6" (18字符)
```

### 存储

- 服务端: `users.token` 字段
- 客户端: `localStorage(mv_auth)` → `{ token, tokenCreatedAt, userId }`

### 验证

```javascript
// middleware/auth.js
const tok = req.headers['x-auth-token'];
const user = db.prepare('SELECT * FROM users WHERE token = ?').get(tok);
if (!user) return 401 ('请先登录');
if (Date.now() - user.token_created_at > 90 * 24 * 60 * 60 * 1000) {
  // 过期 → 清空token → 401 ('登录已过期，请重新登录')
}
req.user = user;
next();
```

### 生命周期

- 每次登录生成新 token（旧token被覆盖）
- 90天有效期
- 服务端过期时自动清空 `users.token`
- 客户端过期时 `handleAuthExpired()` 清空 `localStorage` 中的 AUTH + 弹出登录界面

---

## 10. 权限设计

### 用户角色

| 角色 | 判断条件 | 权限 |
|------|----------|------|
| 未登录 | `!AUTH.token` | 只能浏览探索广场，不能点赞/举报/发布 |
| 普通用户 | `AUTH.token && userId != 1` | 拍照发布、画廊管理、点赞举报、偏好设置、注销 |
| 管理员 | `userId === 1` | 所有普通用户权限 + 数据清空 + 审核后台 |

### 图片 ACL

| 条件 | 权限 |
|------|------|
| `status === 'approved' && photo_public !== false` | 任何人可查看 |
| `status !== 'approved'` 或 `photo_public === false` | 仅所有者可查看（需 x-auth-token） |
| thumbnail 文件 (`thumb_xxx.jpg`) | ACL 查询映射到原始图片路径 |

### 管理员保护

- 管理员账号 (user ID 1) **不可注销** (`routes/user.js:57`)
- 清空数据需要环境变量 `MOMENT_ADMIN_CLEAR_TOKEN` 确认
- 审核接口校验 `r.user.id !== 1` → 403

---

## 11. 如何新增一个 API

### 步骤

**1. 确定归属** — 选择或创建路由文件:

| API 类型 | 文件 |
|----------|------|
| 认证相关 | `routes/auth.js` |
| 内容相关 | `routes/moments.js` |
| 用户相关 | `routes/user.js` |
| 管理相关 | `routes/admin.js` |
| 图片相关 | `routes/images.js` |

**2. 编写路由** — 使用 Express Router 模式:

```javascript
// routes/xxx.js

// 需要鉴权:
const auth = require('../middleware/auth');
router.get('/api/xxx', auth, (r, s) => {
  // r.user 即为当前登录用户
  const result = db.prepare('SELECT ...').all(r.user.id);
  s.json({ data: result });
});

// 不需要鉴权:
router.get('/api/public-xxx', (r, s) => {
  const result = db.prepare('SELECT ...').all();
  s.json({ data: result });
});

module.exports = router;
```

**3. 注册路由** — 在 `server.js` 中添加一行:

```javascript
app.use(require('./routes/xxx'));  // 新增
```

**4. 前端调用** — 使用 `api()` 封装:

```javascript
// 需要登录的接口（自动带 x-auth-token）
api('/api/xxx', { method: 'POST', body: { key: 'value' } })
  .then(data => { /* 处理 */ })
  .catch(err => { /* 处理 */ });

// 不需要登录的接口
fetch(API + '/api/public-xxx')
  .then(r => r.json())
  .then(data => { /* 处理 */ });
```

**5. 更新 API.md 文档**

---

## 12. 如何新增一个页面

### 步骤

**1. 创建 HTML 文件** — 如 `public/new-page.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>新页面</title>
<style>
  /* 复用 CSS 变量体系 */
  :root { --bg: #1c1c1e; --card: #2c2c2e; --text: #f5f5f7; --muted: #98989d; --accent: #D4A373; }
  /* ... */
</style>
</head>
<body>
  <!-- 页面内容 -->
  <script src="js/new-page.js"></script>
</body>
</html>
```

**2. 创建 JS 文件** — 如 `public/js/new-page.js`:

```javascript
var API = (localStorage.getItem('mv_api') || '').replace(/\/+$/, '')
  || (location.protocol === 'https:' ? 'https://cikemoment.cn' : 'http://124.156.163.213:3000');

// 如需登录状态:
var saved = localStorage.getItem('mv_auth');
var TOKEN = '';
if (saved) {
  try { var a = JSON.parse(saved); TOKEN = a.token || ''; } catch(e) {}
}

// 页面逻辑...
```

**3. 如果是主应用内的新页面**（Tab）:

在 `app.js` 中添加:
```javascript
var tabOrder = ['photos', 'home', 'strangers', 'newtab'];  // 添加
// 在 navTo() 中处理新 tab 的显示/隐藏逻辑
```

在 `public/index.html` 中添加对应的 `<div id="tab-newtab">` 区域。

---

## 13. 如何新增数据库字段

### 步骤

**1. 修改 Schema** — `db.js` 第39-91行的 CREATE TABLE 语句:

```sql
ALTER TABLE moments ADD COLUMN location TEXT DEFAULT '';
```

> ⚠️ SQLite 的 ALTER TABLE 仅支持 ADD COLUMN。不能修改或删除已有列。

**2. 添加兼容逻辑** — 对于已有数据，新字段默认为 NULL 或 DEFAULT 值:

```javascript
// db.js 初始化时执行迁移
db.exec(`ALTER TABLE moments ADD COLUMN location TEXT DEFAULT ''`);
```

可以用 `CREATE TABLE IF NOT EXISTS` 特性写一个迁移函数:
```javascript
// 检查列是否存在
const hasLocation = db.prepare("PRAGMA table_info(moments)").all()
  .some(col => col.name === 'location');
if (!hasLocation) {
  db.exec(`ALTER TABLE moments ADD COLUMN location TEXT DEFAULT ''`);
}
```

**3. 更新相关路由** — 在对应的 API 响应中包含新字段:

```javascript
// routes/moments.js
s.json({
  moments: moments.map(m => ({
    // ... existing fields
    location: m.location || '',     // 新增
  }))
});
```

**4. 更新文档** — `PROJECT_STRUCTURE.md` 中的表结构说明

---

## 14. 如何发布新版本

### 标准发布流程

```bash
# 1. 确保所有修改已测试
#    手动验证: 登录 → 拍照 → 画廊 → 探索 → 设置

# 2. 更新版本号
#    index.html <title> 中的版本号
#    settings.js showAbout() 中的版本号

# 3. 提交（如使用 Git）
git add -A
git commit -m "v299: <change summary>"

# 4. 部署到服务器
# 方法A: 直接复制修改的文件
scp server.js routes/new-route.js user@server:/opt/moment/
scp -r public/js/new-module.js user@server:/opt/moment/public/js/
ssh user@server "pm2 reload moment"

# 方法B: 完整同步所有文件
rsync -avz --exclude node_modules --exclude data \
  ./ user@server:/opt/moment/
ssh user@server "cd /opt/moment && npm install --production && pm2 reload moment"

# 5. 验证生产环境
curl https://cikemoment.cn/health
# → {"ok":true}
```

### 回滚

```bash
# 恢复数据库备份（如有 schema 变更）
ssh user@server
pm2 stop moment
cp /opt/moment/data/backups/moment-YYYY-MM-DD.db /opt/moment/data/moment.db
pm2 start moment

# 恢复代码（如有 Git）
cd /opt/moment && git checkout <previous-commit>
pm2 reload moment
```

---

## 附录: 常用调试技巧

### 后端调试

```bash
# 查看实时请求日志
tail -f ~/.pm2/logs/moment-out.log

# 手动测试API
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800138000","code":"123456"}'

# 查看数据库内容
sqlite3 data/moment.db "SELECT COUNT(*) FROM moments;"
sqlite3 data/moment.db "SELECT id, thought, status FROM moments ORDER BY id DESC LIMIT 5;"
```

### 前端调试

```javascript
// 浏览器控制台

// 查看本地状态
JSON.parse(localStorage.getItem('mv21'))
JSON.parse(localStorage.getItem('mv_auth'))

// 手动触发离线队列
processPendingQueue()

// 切换 API 地址（开发时）
localStorage.setItem('mv_api', 'http://localhost:3000')
location.reload()

// 清除所有数据（重置）
localStorage.clear()
location.reload()
```
