# 此刻 (Moment) — 敏感文件管理

> 所有密钥、证书、签名文件已从项目目录移出。
> 最后更新：2026-07-05

---

## 敏感文件清单

| 文件 | 用途 | 是否被代码引用 | 新位置 |
|------|------|---------------|--------|
| `AuthKey_42KU5BWP3V.p8` | Apple Developer AuthKey | ❌ 无 | `~/.moment-secrets/apple/` |
| `android-keystore-base64.txt` | Android 签名密钥（base64） | ❌ 无 | `~/.moment-secrets/android/` |
| `android-keystore-password.txt` | Android 密钥密码 | ❌ 无 | `~/.moment-secrets/android/` |
| `cikemoment-ssl/` | SSL证书+私钥（4文件） | ❌ 无（已改用环境变量） | `~/.moment-secrets/ssl/` |
| `fileauth.txt` | 未知认证文件 | ❌ 无 | `~/.moment-secrets/` |
| `dist.csr` | 证书签名请求 | ❌ 无 | `~/.moment-secrets/` |
| `身份证-翻转.png` | 身份证照片（隐私） | ❌ 无 | `~/.moment-secrets/` |

---

## 安全存储目录

```
~/.moment-secrets/
├── apple/
│   └── AuthKey_42KU5BWP3V.p8     # Apple AuthKey
├── android/
│   ├── android-keystore-base64.txt # Android 签名密钥
│   └── android-keystore-password.txt # Android 密钥密码
├── ssl/
│   └── cikemoment-ssl/
│       └── cikemoment.cn_nginx/
│           ├── cikemoment.cn.key       # SSL 私钥
│           ├── cikemoment.cn_bundle.crt # SSL 证书链
│           ├── cikemoment.cn_bundle.pem # SSL 证书链 (PEM)
│           └── cikemoment.cn.csr       # 证书签名请求
├── fileauth.txt                 # 未知认证文件
├── dist.csr                     # 证书签名请求
└── 身份证-翻转.png              # 身份证照片
```

---

## 开发环境配置

### SSL 证书（已通过 install-ssl.sh 处理）

项目不再需要 SSL 文件存于项目目录。部署时通过环境变量注入：

```bash
export MOMENT_SSL_CERT_BASE64=$(cat ~/.moment-secrets/ssl/cikemoment-ssl/cikemoment.cn_nginx/cikemoment.cn_bundle.crt | base64)
export MOMENT_SSL_KEY_BASE64=$(cat ~/.moment-secrets/ssl/cikemoment-ssl/cikemoment.cn_nginx/cikemoment.cn.key | base64)
bash install-ssl.sh
```

### Apple AuthKey

仅用于 App Store 发布流程（Xcode / fastlane），与项目源码无关。

```bash
# fastlane 配置示例
# 将路径指向安全目录
export APPLE_AUTH_KEY_PATH="$HOME/.moment-secrets/apple/AuthKey_42KU5BWP3V.p8"
```

### Android 签名

仅用于 APK/AAB 签名，运行时不使用。

```bash
# 构建时引用安全目录中的密钥
export ANDROID_KEYSTORE_BASE64=$(cat ~/.moment-secrets/android/android-keystore-base64.txt)
export ANDROID_KEYSTORE_PASSWORD=$(cat ~/.moment-secrets/android/android-keystore-password.txt)
```

---

## 生产环境配置

生产服务器上的安全目录结构应与开发环境一致：

```bash
/opt/moment-secrets/
├── ssl/
│   ├── bundle.crt
│   └── private.key
├── apple/
│   └── AuthKey_42KU5BWP3V.p8
└── android/
    ├── keystore-base64.txt
    └── keystore-password.txt
```

将 `install-ssl.sh` 中的环境变量引用改为：

```bash
export MOMENT_SSL_CERT_BASE64=$(cat /opt/moment-secrets/ssl/bundle.crt | base64)
export MOMENT_SSL_KEY_BASE64=$(cat /opt/moment-secrets/ssl/private.key | base64)
```

---

## Git 保护

以下模式已加入 `.gitignore`，防止任何敏感文件被提交：

```gitignore
# 私钥 / 证书 / 签名
*.p8
*.p12
*.key
*.csr
*.crt
*.pem
*-keystore-*
*keystore*

# 身份证 / 隐私图片
身份证*
```

---

## 绝对不能提交到 GitHub 的文件

| 文件类型 | 风险 | 后果 |
|----------|------|------|
| SSL 私钥 (`*.key`) | HTTS 中间人攻击 | 所有用户流量可被解密 |
| Apple AuthKey (`*.p8`) | Apple 开发者账号被盗用 | App 可被篡改、证书被吊销 |
| Android keystore | APK 可被恶意签名 | 应用可被替换为恶意版本 |
| 身份证照片 | 个人身份泄露 | 身份盗用风险 |
| `.env` 文件 | 环境变量泄露 | 数据库密码、API密钥暴露 |
| CSR 文件 | 信息泄露 | 域名、组织信息暴露 |

---

## 恢复文件（如需要）

```bash
# 列出所有安全文件
ls -laR ~/.moment-secrets/

# 恢复到项目目录（不推荐，仅在紧急情况下）
cp ~/.moment-secrets/apple/AuthKey_42KU5BWP3V.p8 ./
```
