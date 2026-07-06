#!/bin/bash
# ============================================================
# SSL证书安装脚本 - 此刻 (cikemoment.cn)
# ============================================================
# 使用方法：
#   export MOMENT_SSL_CERT_BASE64="<证书链的base64编码>"
#   export MOMENT_SSL_KEY_BASE64="<私钥的base64编码>"
#   bash install-ssl.sh
# ============================================================

set -e

# 检查必需的环境变量
if [ -z "$MOMENT_SSL_CERT_BASE64" ]; then
  echo "[ERROR] 环境变量 MOMENT_SSL_CERT_BASE64 未设置"
  echo "        请先导出证书链的base64编码："
  echo "        export MOMENT_SSL_CERT_BASE64=\$(cat /path/to/bundle.crt | base64)"
  exit 1
fi

if [ -z "$MOMENT_SSL_KEY_BASE64" ]; then
  echo "[ERROR] 环境变量 MOMENT_SSL_KEY_BASE64 未设置"
  echo "        请先导出私钥的base64编码："
  echo "        export MOMENT_SSL_KEY_BASE64=\$(cat /path/to/private.key | base64)"
  exit 1
fi

echo "[INFO] 创建 SSL 证书目录..."
sudo mkdir -p /etc/nginx/ssl

echo "[INFO] 写入证书链..."
echo "$MOMENT_SSL_CERT_BASE64" | base64 -d | sudo tee /etc/nginx/ssl/cikemoment.cn_bundle.crt > /dev/null

echo "[INFO] 写入私钥..."
echo "$MOMENT_SSL_KEY_BASE64" | base64 -d | sudo tee /etc/nginx/ssl/cikemoment.cn.key > /dev/null

# 设置私钥权限为仅 root 可读
sudo chmod 600 /etc/nginx/ssl/cikemoment.cn.key

echo "[OK] SSL证书安装完成"

# 验证证书和私钥是否匹配
CERT_MD5=$(sudo openssl x509 -noout -modulus -in /etc/nginx/ssl/cikemoment.cn_bundle.crt | openssl md5 2>/dev/null || echo "")
KEY_MD5=$(sudo openssl rsa -noout -modulus -in /etc/nginx/ssl/cikemoment.cn.key | openssl md5 2>/dev/null || echo "")

if [ -n "$CERT_MD5" ] && [ -n "$KEY_MD5" ] && [ "$CERT_MD5" = "$KEY_MD5" ]; then
  echo "[OK] 证书与私钥匹配验证通过"
else
  echo "[WARN] 无法验证证书与私钥是否匹配，请手动检查"
fi

echo "[INFO] 请重新加载 Nginx: sudo nginx -s reload"
