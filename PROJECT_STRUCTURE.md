# 此刻 (Moment) — 项目结构文档

> 基于真实代码自动生成，最后更新：2026-07-05

## 完整目录树

```
Desktop/                          # 项目根目录
├── .gitignore                    # Git忽略规则
├── CLAUDE.md                     # Claude Code 开发规则
├── AGENTS.md                     # AI Agent 配置
├── package.json                  # Node.js 项目配置与依赖
├── package-lock.json             # 依赖版本锁定
├── install-ssl.sh                # SSL证书部署脚本（需环境变量）
├── migrate.js                    # JSON → SQLite 数据迁移工具
│
├── server.js                     # ★ 服务器入口（93行）
├── db.js                         # ★ 数据库层（214行）
│
├── middleware/                    # Express 中间件
│   ├── auth.js                   #   Token 鉴权中间件
│   └── rateLimit.js              #   IP 限流中间件（60次/分钟）
│
├── routes/                       # API 路由（按业务域拆分）
│   ├── auth.js                   #   认证：SMS发送 + 登录
│   ├── moments.js                #   内容：上传/画廊/探索/点赞/举报/删除
│   ├── user.js                   #   用户：统计/偏好/昵称/头像/注销
│   ├── admin.js                  #   管理：清空数据 + 审核后台API
│   └── images.js                 #   图片：ACL访问控制 + 缩略图支持
│
├── data/                         # 运行时数据（不提交Git）
│   ├── moment.db                 #   SQLite 数据库文件
│   ├── moment.db-shm             #   WAL 共享内存
│   ├── moment.db-wal             #   WAL 日志文件
│   ├── uploads/                  #   用户上传的原始图片
│   │   ├── <random>.jpg          #     原始照片
│   │   └── thumb_<random>.jpg   #     缩略图（400px宽）
│   └── backups/                  #   每日自动备份
│       └── moment-YYYY-MM-DD.db  #     数据库备份（保留7天）
│
├── public/                       # 前端静态文件
│   ├── index.html                #   主应用入口（PWA，573行）
│   ├── admin.html                #   审核后台页面（60行）
│   ├── manifest.json             #   PWA 清单（iOS/Android安装）
│   ├── sw.js                     #   Service Worker（离线缓存）
│   ├── starry-world.js           #   星空世界动画引擎
│   │
│   └── js/                       #   前端模块（按功能拆分）
│       ├── app.js                #     全局状态 / 导航 / updateAllUI / 离线队列
│       ├── auth.js               #     登录认证 / SMS / API封装
│       ├── settings.js           #     设置面板 / 侧边菜单 / 深色模式 / 举报 / 模式切换
│       ├── capture.js            #     拍照 / 60秒倒计时 / 发布 / 3D景深
│       ├── gallery.js            #     首页状态 / 每日名言 / 连续打卡 / 日记画廊
│       ├── explore.js            #     探索世界 / 瀑布流 / 沉浸胶片 / DOM回收
│       ├── collage.js            #     月度拼贴画 / 时光碎片（5种模板）
│       ├── init.js               #     初始化入口 / 触觉反馈 / 自定义对话框 / 图片缓存
│       └── admin.js              #     审核后台逻辑
│
└── node_modules/                 # 依赖包（不提交Git）
```

## 核心文件职责说明

### 后端

| 文件 | 行数 | 职责 |
|------|------|------|
| `server.js` | 93 | Express 组装入口：CORS配置、中间件注册、路由挂载、404/500处理、端口监听 |
| `db.js` | 214 | 数据库核心：SQLite初始化、Schema建表（4张表+5索引）、图片存储（含sharp缩略图生成）、SMS验证码管理、WAL checkpoint（被动+每日）、自动备份（保留7天） |
| `middleware/auth.js` | 18 | Token鉴权：检查 `x-auth-token` 头，验证token有效性，90天过期自动清空 |
| `middleware/rateLimit.js` | 39 | IP限流：基于 `req.ip` 的60次/分钟窗口限流，每10分钟全量清理过期记录 |

### 路由层

| 文件 | 行数 | 管理的API |
|------|------|-----------|
| `routes/auth.js` | 94 | `POST /api/sms/send`、`POST /api/login`（含SMS频率限制：手机号60秒冷却 + IP 20秒冷却） |
| `routes/moments.js` | 200 | `POST /api/moments`、`GET /api/gallery`、`GET /api/explore`、`GET /api/stranger`、`POST/GET /api/like`、`POST /api/report`、`DELETE /api/moment/:id` |
| `routes/user.js` | 72 | `GET /api/stats`、`POST/GET /api/user/preferences`、`POST /api/user/nickname`、`POST /api/user/avatar`、`POST /api/account/delete` |
| `routes/admin.js` | 112 | `POST /api/admin/clear`、`GET /api/admin/moments`、`POST /api/admin/moments/:id/approve`、`POST /api/admin/moments/:id/reject` |
| `routes/images.js` | 90 | `GET /api/image/uploads/:name`（含路径穿越防护和ACL）、`GET /api/image/:id`（兼容旧版） |

### 前端模块

| 文件 | 行数 | 职责 |
|------|------|------|
| `app.js` | 91 | 全局状态管理（`D`/`API`/`AUTH`）、导航系统（`navTo`）、`updateAllUI`、`save`、离线队列处理器（`processPendingQueue`） |
| `auth.js` | 90 | 引导页 + 登录界面逻辑、SMS发送、验证码登录、API请求封装、Token过期处理 |
| `settings.js` | 438 | 侧边菜单、设置面板、深色/浅色模式切换、星空背景、举报系统、模式切换（瀑布流/沉浸） |
| `capture.js` | 144 | 拍照触发、60秒倒计时（含环形进度条）、图片裁剪去黑边、离线检测、发布流程、3D景深效果 |
| `gallery.js` | 191 | 每日古文诗词、今日状态管理、连续打卡计算、个人日记画廊（按日期分组） |
| `explore.js` | 266 | 瀑布流（无限滚动+下拉刷新+DOM回收50张上限）、沉浸胶片（3行滚动+暂停+30秒自动刷新）、陌生人详情、点赞 |
| `collage.js` | 427 | 月度拼贴画生成（Canvas）、时光碎片5种模板（网格/拍立得/杂志/日历/胶片）、Canvas保存与分享 |
| `init.js` | 99 | 应用启动初始化、`online`事件监听、触觉反馈（振动+音频合成）、自定义对话框、图片LRU缓存、系统深色模式监听 |
| `admin.js` | 132 | 审核后台：管理员登录、待审核内容列表、通过/驳回操作、分页导航 |

## 数据库表结构

### users — 用户表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| phone | TEXT UNIQUE | 手机号（11位） |
| token | TEXT | 登录令牌（tok_ + 12位hex） |
| token_created_at | INTEGER | Token创建时间戳 |
| nickname | TEXT | 昵称（最多20字） |
| avatar | TEXT | 头像图片路径 |
| consecutive_days | INTEGER | 连续打卡天数 |
| last_upload_date | TEXT | 最后上传日期 |
| preferences | TEXT | JSON格式偏好（daily_pick_enabled, photo_public） |
| created_at | TEXT | 注册时间 |

### moments — 照片表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| user_id | INTEGER FK | 所属用户 |
| image_path | TEXT | 图片文件路径（/uploads/xxx.jpg） |
| data_url | TEXT | 遗留的base64数据 |
| thought | TEXT | 文字感想（最多20字） |
| status | TEXT | 状态：approved/pending/rejected/hidden |
| rejected_message | TEXT | 驳回原因 |
| like_count | INTEGER | 点赞数 |
| created_at | TEXT | 创建时间 |

### likes — 点赞表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| user_id | INTEGER FK | 点赞用户 |
| moment_id | INTEGER FK | 被点赞照片 |
| created_at | TEXT | 点赞时间 |
| UNIQUE(user_id, moment_id) | — | 每人每张只能点赞一次 |

### reports — 举报表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| moment_id | INTEGER FK | 被举报照片 |
| user_id | INTEGER FK | 举报用户 |
| reason | TEXT | 举报原因 |
| created_at | TEXT | 举报时间 |
| UNIQUE(moment_id, user_id) | — | 每人每张只能举报一次 |

### 索引
- `idx_moments_user_id` — 加速用户画廊查询
- `idx_moments_status` — 加速探索广场过滤
- `idx_moments_created_at` — 加速时间排序
- `idx_likes_moment_id` — 加速点赞查询
- `idx_reports_moment_id` — 加速举报查询

## 前端模块加载顺序

```
starry-world.js → app.js → auth.js → settings.js → capture.js → gallery.js → explore.js → collage.js → init.js
```

每个模块通过全局函数声明通信，加载时无跨模块同步依赖（所有跨模块调用均在异步回调/事件处理器中）。
