# 此刻 (Moment) — 架构文档

> 基于真实代码生成。所有 Mermaid 图表可在 GitHub/GitLab 及多数 Markdown 渲染器中直接渲染。

---

## 整体架构

```mermaid
graph TB
    subgraph Client["客户端 (PWA)"]
        HTML["index.html<br/>PWA 入口"]
        SW["sw.js<br/>Service Worker"]
        JS["js/*.js<br/>9个前端模块"]
        LS["localStorage<br/>mv21 / mv_auth"]
    end

    subgraph Proxy["反向代理 (生产)"]
        NGINX["Nginx<br/>SSL 终止 / 静态缓存"]
    end

    subgraph Server["服务端 (Node.js + Express 5)"]
        ENTRY["server.js<br/>组装入口"]
        CORS["CORS<br/>白名单"]
        RL["rateLimit<br/>60次/分钟"]
        AUTH_MW["auth middleware<br/>Token 鉴权"]
    end

    subgraph Routes["路由层"]
        R_AUTH["auth.js<br/>SMS / 登录"]
        R_MOM["moments.js<br/>上传 / 画廊 / 探索"]
        R_USR["user.js<br/>偏好 / 头像 / 注销"]
        R_ADM["admin.js<br/>清空 / 审核"]
        R_IMG["images.js<br/>图片 ACL"]
    end

    subgraph Data["数据层"]
        DB["db.js<br/>SQLite + Schema"]
        SQLITE["moment.db<br/>SQLite WAL"]
        DISK["uploads/<br/>照片文件"]
        BKP["backups/<br/>每日备份"]
    end

    Client -->|HTTPS| Proxy
    Proxy -->|proxy_pass :3000| Server
    ENTRY --> CORS
    CORS --> RL
    RL --> Routes
    R_AUTH --> DB
    R_MOM --> DB
    R_USR --> DB
    R_ADM --> DB
    R_IMG --> DB
    R_MOM --> AUTH_MW
    R_USR --> AUTH_MW
    R_ADM --> AUTH_MW
    DB --> SQLITE
    DB --> DISK
    DB --> BKP
```

---

## 前后端调用关系

```mermaid
sequenceDiagram
    actor U as 用户
    participant F as 前端 (index.html + js/*.js)
    participant LS as localStorage
    participant S as Express (server.js)
    participant MW as 中间件
    participant R as 路由
    participant DB as SQLite
    participant FS as 文件系统

    Note over U,FS: === 登录流程 ===
    U->>F: 输入手机号
    F->>S: POST /api/sms/send {phone}
    S->>MW: rateLimit 检查
    S->>R: auth.js
    R->>R: 生成验证码 (in-memory)
    R-->>F: {message: "已发送"}
    U->>F: 输入验证码
    F->>S: POST /api/login {phone, code}
    S->>R: auth.js
    R->>DB: SELECT/INSERT users
    R-->>F: {token, userId, nickname}
    F->>LS: 保存 AUTH

    Note over U,FS: === 发布 Moment ===
    U->>F: 拍照 + 输入感想
    F->>F: resizeImage (2048px)
    F->>S: POST /api/moments {dataUrl, thought}
    S->>MW: auth (检查 x-auth-token)
    S->>R: moments.js
    R->>R: saveImage()
    R->>FS: 写入原图
    R->>FS: sharp 异步生成缩略图
    R->>DB: INSERT moments
    R->>DB: UPDATE users (连续打卡)
    R-->>F: {id, imageUrl}
    F->>LS: 更新 D (本地记录)

    Note over U,FS: === 浏览探索 ===
    U->>F: 切换到探索 Tab
    F->>S: GET /api/explore?page=1&limit=15
    S->>R: moments.js
    R->>DB: SELECT (approved + public)
    R-->>F: {moments, hasMore, total}
    F->>F: renderWaterfallCards
```

---

## 模块依赖图

### 后端

```mermaid
graph TD
    server["server.js<br/>(组装入口)"] --> rateLimit["middleware/rateLimit.js"]
    server --> authMw["middleware/auth.js"]
    server --> rAuth["routes/auth.js"]
    server --> rMoments["routes/moments.js"]
    server --> rUser["routes/user.js"]
    server --> rAdmin["routes/admin.js"]
    server --> rImages["routes/images.js"]

    rAuth --> db["db.js"]
    rMoments --> db
    rMoments --> authMw
    rUser --> db
    rUser --> authMw
    rAdmin --> db
    rAdmin --> authMw
    rImages --> db
```

### 前端

```mermaid
graph TD
    starry["starry-world.js"] --> app["app.js"]
    app --> auth["auth.js"]
    auth --> settings["settings.js"]
    settings --> capture["capture.js"]
    capture --> gallery["gallery.js"]
    gallery --> explore["explore.js"]
    explore --> collage["collage.js"]
    collage --> init["init.js"]

    style starry fill:#f9f,stroke:#333
    style app fill:#bbf,stroke:#333
    style auth fill:#bbf,stroke:#333
    style settings fill:#bfb,stroke:#333
    style capture fill:#bfb,stroke:#333
    style gallery fill:#bfb,stroke:#333
    style explore fill:#fbb,stroke:#333
    style collage fill:#fbb,stroke:#333
    style init fill:#ffb,stroke:#333
```

**加载顺序**（箭头方向）：starry-world → app → auth → settings → capture → gallery → explore → collage → init

- 🔵 蓝色：核心状态和认证
- 🟢 绿色：核心功能（拍照/画廊/设置）
- 🔴 红色：复杂功能（探索/拼贴）
- 🟡 黄色：初始化入口
- 🟣 紫色：独立组件

---

## 页面跳转关系

```mermaid
stateDiagram-v2
    [*] --> Onboarding: 首次访问
    Onboarding --> Login: 点击开始
    Login --> Home: 登录成功 / 跳过

    Home --> Gallery: 底部导航"日记"
    Home --> Explore: 底部导航"探索"
    Home --> Capture: 点击"拍下此刻"

    Gallery --> Detail: 点击某张照片
    Gallery --> Collage: 菜单→月度碎片
    Gallery --> TimeFragment: 菜单→时光碎片

    Explore --> StrangerDetail: 点击照片（瀑布流/胶片）
    Explore --> Immersive: 左滑
    Explore --> Waterfall: 右滑

    Detail --> Home: 返回
    StrangerDetail --> Explore: 返回

    state Home {
        [*] --> Idle
        Idle --> Countdown: 点击拍照
        Countdown --> Preview: 选择照片
        Preview --> Idle: 发布成功
        Countdown --> Idle: 超时自动取消
    }

    state SideMenu {
        Settings
        StarryWorld
        DarkMode
        Logout
        DeleteAccount
    }
```

---

## 数据流图

### 发布 Moment 数据流

```mermaid
flowchart LR
    A[用户拍照] --> B[resizeImage<br/>2048px + 去黑边 + JPEG Q85]
    B --> C{在线?}
    C -->|是| D[POST /api/moments<br/>base64 + thought]
    C -->|否| E[localStorage<br/>_pending: true]
    E --> F[online 事件触发<br/>processPendingQueue]
    F --> D
    D --> G[saveImage<br/>魔法字节校验 + 写磁盘]
    G --> H[sharp 异步<br/>生成400px缩略图]
    G --> I[INSERT moments]
    I --> J[UPDATE users<br/>连续打卡天数]
    J --> K[返回 id + imageUrl]
    K --> L[D.m.unshift<br/>更新本地状态]
    L --> M[save() → localStorage]
    M --> N[updateAllUI]
```

### 探索广场数据流

```mermaid
flowchart TB
    subgraph Waterfall["瀑布流模式"]
        W1[GET /api/explore?page=N] --> W2[renderWaterfallCards]
        W2 --> W3{卡片数 > 50?}
        W3 -->|是| W4[recycleCards<br/>移除最旧DOM<br/>更新 #wf-spacer]
        W3 -->|否| W5[继续追加]
        W4 --> W5
        W5 --> W6[滚动监听<br/>距底部300px → 加载下一页]
        W6 --> W1
    end

    subgraph Filmstrip["沉浸胶片模式"]
        F1[GET /api/explore?limit=50<br/>每30秒刷新] --> F2[poolMap 合并去重]
        F2 --> F3[filmPool.sort + slice100]
        F3 --> F4[shuffle → 分3组]
        F4 --> F5[buildRow × 3<br/>photos.concat 双倍循环]
    end

    W2 & F5 --> S[点击照片]
    S --> showStrangerDetail["showStrangerDetail()<br/>公共函数"]
    showStrangerDetail --> L[GET /api/like<br/>查询点赞数]
    showStrangerDetail --> V[显示原图 + 点赞/举报按钮]
```

### 登录认证数据流

```mermaid
flowchart TB
    A[输入手机号] --> B[POST /api/sms/send]
    B --> C{速率检查}
    C -->|手机号60s内| D[429 请稍后]
    C -->|IP 20s内| E[429 请稍后]
    C -->|通过| F[genSMSCode<br/>in-memory 5分钟有效]
    F --> G[控制台输出验证码]
    G --> H[用户输入验证码]
    H --> I[POST /api/login]
    I --> J{验证}
    J -->|过期| K[400 已过期]
    J -->|错误| L[400 验证码错误]
    J -->|正确| M{用户存在?}
    M -->|否| N[INSERT users<br/>默认偏好: daily_pick_enabled=true]
    M -->|是| O[UPDATE token]
    N --> P[返回 token + userId]
    O --> P
    P --> Q[localStorage mv_auth]
    Q --> R[updateAllUI]
```

---

## 组件交互矩阵

| 组件 | app.js | auth.js | settings.js | capture.js | gallery.js | explore.js | collage.js | init.js |
|------|--------|---------|-------------|------------|------------|------------|------------|---------|
| **app.js** | — | 被调 | 被调 | 被调 | 被调 | 被调 | 被调 | 被调 |
| **auth.js** | 调用 | — | 调用 | 调用 | 调用 | 调用 | — | 调用 |
| **settings.js** | 调用 | 调用 | — | 调用 | 调用 | 调用 | — | 调用 |
| **capture.js** | 调用 | 调用 | 调用 | — | 调用 | 调用 | — | — |
| **gallery.js** | 调用 | 调用 | 调用 | 被调 | — | 被调 | 被调 | 被调 |
| **explore.js** | 调用 | 调用 | 调用 | 调用 | 调用 | — | — | — |
| **collage.js** | 调用 | — | 调用 | — | 调用 | — | — | — |
| **init.js** | 调用 | 调用 | 调用 | — | 调用 | — | — | — |

"调用" = 行模块调用列模块的函数，"被调" = 列模块调用行模块的函数

---

## 技术决策记录

| 决策 | 原因 |
|------|------|
| SQLite 而非 MySQL/PostgreSQL | 零运维、单文件备份、够用的并发（单进程） |
| WAL 模式 | 读写并发性能更好 |
| better-sqlite3 (同步) | 比异步驱动简单，单进程场景无阻塞问题 |
| Vanilla JS 零构建 | 减少构建链复杂度，适合小型团队 |
| 全局函数通信而非 ES Module | 保持零构建，多 script 标签直接加载 |
| sharp (可选依赖) | 缩略图性能好，未安装时优雅降级 |
| in-memory 限流 + SMS code | 简单够用，重启丢失可接受 |
| Token 90天过期 | 平衡安全性和用户体验 |
| PWA 而非 App Store | 绕过审核、即时更新、跨平台 |
