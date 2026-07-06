# 此刻 (Moment) — API 文档

> 基于 `routes/` 真实代码生成，最后更新：2026-07-05

## 通用说明

- **Base URL**: `https://cikemoment.cn`（生产）/ `http://localhost:3000`（开发）
- **Content-Type**: `application/json`
- **鉴权方式**: Header `x-auth-token: tok_xxxxxxxxxxxx`
- **限流**: 60次/分钟/IP（429 超限）

## 认证 API

### 发送短信验证码

```
POST /api/sms/send
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | 是 | 11位手机号 |

**限流**: 同一手机号每分钟1次，同一IP每20秒1次。

**成功响应** (200):
```json
{ "message": "验证码已发送（开发模式：查看服务器日志）" }
```

**错误响应**:
| 状态码 | error | 说明 |
|--------|-------|------|
| 400 | `手机号格式不对` | phone 不是11位数字 |
| 429 | `验证码请求过于频繁，请稍后再试` | 手机号冷却中 |
| 429 | `请求过于频繁，请稍后再试` | IP冷却中 |

---

### 登录/注册

```
POST /api/login
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| phone | string | 是 | 11位手机号 |
| code | string | 是 | 6位验证码 |

**开发模式**: 若 `NODE_ENV != production` 且 `MOMENT_DEV_LOGIN=1`，任意6位数字可登录（`000000` 除外）。生产环境强制禁用。

**成功响应** (200):
```json
{
  "token": "tok_a1b2c3d4e5f6",
  "tokenCreatedAt": 1720000000000,
  "userId": 1,
  "nickname": "",
  "avatar": "",
  "preferences": { "daily_pick_enabled": true }
}
```

**错误响应**:
| 状态码 | error | 说明 |
|--------|-------|------|
| 400 | `手机号格式不对` | |
| 400 | `请输入验证码` | |
| 400 | `请先获取验证码` | |
| 400 | `验证码已过期，请重新获取` | |
| 400 | `验证码错误` | |

---

## 内容 API

### 上传照片

```
POST /api/moments
```
🔒 需要登录

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| dataUrl | string | 是 | base64图片数据（`data:image/jpeg;base64,...`） |
| thought | string | 否 | 文字感想（最多20字） |

**成功响应** (200):
```json
{
  "id": 42,
  "imageUrl": "/api/image/uploads/abc123.jpg"
}
```

**错误响应**:
| 状态码 | error | 说明 |
|--------|-------|------|
| 400 | `缺少照片` | |
| 400 | `图片数据无效或过大，请重试` | 非图片/超20MB/损坏 |
| 401 | `请先登录` | |

---

### 个人画廊

```
GET /api/gallery
```
🔒 需要登录

**成功响应** (200):
```json
{
  "moments": [
    {
      "id": 42,
      "dataUrl": "/api/image/uploads/abc123.jpg",
      "thumbnailUrl": "/api/image/uploads/thumb_abc123.jpg",
      "thought": "今天的落日",
      "created_at": "2026-07-05T10:30:00.000Z",
      "status": "approved",
      "rejectedMessage": "",
      "like_count": 3
    }
  ],
  "total": 15
}
```

**说明**: 最多返回100条，不包含 `hidden` 状态的moment。`status` 可能的值为 `approved`/`pending`/`rejected`。

---

### 探索广场

```
GET /api/explore
```

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| page | number | 1 | 页码 |
| limit | number | 15 | 每页数量（最大50） |
| sort | string | recent | 排序方式 |

**成功响应** (200):
```json
{
  "moments": [
    {
      "id": 42,
      "imageUrl": "/api/image/uploads/abc123.jpg",
      "thumbnailUrl": "/api/image/uploads/thumb_abc123.jpg",
      "thought": "今天的落日",
      "created_at": "2026-07-05T10:30:00.000Z",
      "like_count": 3,
      "author_phone_masked": "138****0123"
    }
  ],
  "hasMore": true,
  "total": 256
}
```

**说明**: 仅返回 `status='approved'` 且 `photo_public != false` 的公开moment。

---

### 随机陌生人

```
GET /api/stranger
```

**成功响应** (200):
```json
{
  "imageUrl": "/api/image/uploads/abc123.jpg",
  "thought": "今天的落日",
  "created_at": "2026-07-05T10:30:00.000Z",
  "like_count": 3
}
```

**无数据时**:
```json
{ "moment": null }
```

---

### 点赞

```
POST /api/like
```
🔒 需要登录

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| momentId | number | 是 | 照片ID |

**成功响应** (200):
```json
{ "liked": true, "count": 4 }
```

**重复点赞** (200):
```json
{ "liked": true, "count": 4 }
```

---

### 获取点赞状态

```
GET /api/like?momentId=42
```
🔒 需要登录

**成功响应** (200):
```json
{ "liked": true, "count": 4 }
```

---

### 举报

```
POST /api/report
```
🔒 需要登录

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| momentId | number | 是 | 照片ID |
| reason | string | 否 | 举报原因（默认"其他"） |

**成功响应** (200):
```json
{ "message": "举报成功" }
```

**自动隐藏**: 同一moment被举报3次后，状态自动变为 `hidden`。

---

### 删除照片

```
DELETE /api/moment/:id
```
🔒 需要登录

**成功响应** (200):
```json
{ "message": "已删除" }
```

**错误响应**:
| 状态码 | error | 说明 |
|--------|-------|------|
| 404 | `不存在` | moment不存在或不属于当前用户 |

---

## 用户 API

### 个人统计

```
GET /api/stats
```
🔒 需要登录

**成功响应** (200):
```json
{ "streak": 15, "total": 42, "badges": [] }
```

---

### 用户偏好

```
POST /api/user/preferences
```
🔒 需要登录

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| daily_pick_enabled | boolean | 否 | 每日精选推送 |
| photo_public | boolean | 否 | 照片默认公开 |

```
GET /api/user/preferences
```
🔒 需要登录

**成功响应** (200):
```json
{ "preferences": { "daily_pick_enabled": true, "photo_public": false } }
```

---

### 修改昵称

```
POST /api/user/nickname
```
🔒 需要登录

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| nickname | string | 是 | 昵称（最多20字） |

**成功响应** (200):
```json
{ "nickname": "张三" }
```

---

### 上传头像

```
POST /api/user/avatar
```
🔒 需要登录

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| avatar | string | 是 | base64图片数据 |

**成功响应** (200):
```json
{ "avatar": "/api/image/uploads/def456.jpg" }
```

---

### 注销账号

```
POST /api/account/delete
```
🔒 需要登录

**成功响应** (200):
```json
{ "message": "账号已注销" }
```

**说明**: 管理员（user ID 1）不可注销。注销将级联删除所有照片、点赞、举报记录，并清理磁盘上的图片文件。

---

## 管理 API

### 清空所有内容

```
POST /api/admin/clear
```
🔒 需要登录 + user ID 1 + 确认令牌

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| confirm_token | string | 是 | 确认令牌（环境变量 `MOMENT_ADMIN_CLEAR_TOKEN`，默认 `CONFIRM_CLEAR_ALL_DATA`） |

**成功响应** (200):
```json
{ "message": "已清空所有内容数据" }
```

---

### 审核列表

```
GET /api/admin/moments?page=1&limit=20
```
🔒 需要登录 + user ID 1

**成功响应** (200):
```json
{
  "moments": [
    {
      "id": 42,
      "imageUrl": "/api/image/uploads/abc123.jpg",
      "thought": "测试内容",
      "status": "approved",
      "created_at": "2026-07-05T10:30:00.000Z",
      "author": "用户1",
      "reportCount": 2
    }
  ],
  "hasMore": false,
  "total": 5
}
```

**说明**: 返回被举报的 `approved` 状态moment + 所有 `pending` 状态moment，按举报数降序排列。

---

### 审核通过

```
POST /api/admin/moments/:id/approve
```
🔒 需要登录 + user ID 1

**成功响应** (200):
```json
{ "message": "已通过审核" }
```

**操作**: 将状态设为 `approved`，清空所有举报记录。

---

### 审核驳回

```
POST /api/admin/moments/:id/reject
```
🔒 需要登录 + user ID 1

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| reason | string | 否 | 驳回原因（默认"内容不符合社区规范"，最多200字） |

**成功响应** (200):
```json
{ "message": "已驳回" }
```

**操作**: 将状态设为 `rejected` 并记录驳回原因，清空举报记录。

---

## 图片 API

### 通过文件名获取图片

```
GET /api/image/uploads/:name
```

**说明**: 支持原始图片和缩略图（`thumb_xxx.jpg`）。公开moment的图片无需登录；私密moment的图片需提供 `x-auth-token` 且为所有者。

**安全**: 路径穿越防护（`path.basename()` 校验 + 显式字符检查）。

**缓存**: `Cache-Control: public, max-age=86400`（24小时）。

### 通过ID获取图片（兼容旧版）

```
GET /api/image/:id
```

同上，ACL逻辑一致。

---

## 系统 API

### 健康检查

```
GET /health
```

**响应** (200):
```json
{ "ok": true }
```

---

## 错误码总览

| 状态码 | 含义 | 常见原因 |
|--------|------|----------|
| 200 | 成功 | |
| 400 | 请求参数错误 | 缺少必填字段、格式不正确 |
| 401 | 未登录或Token过期 | `x-auth-token` 缺失/无效/过期（90天） |
| 403 | 无权限 | 非管理员访问管理接口 |
| 404 | 资源不存在 | 接口路径错误、moment已删除 |
| 429 | 请求过于频繁 | 触发全局限流或SMS限流 |
| 500 | 服务器内部错误 | |
