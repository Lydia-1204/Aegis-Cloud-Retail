# GitHub Actions 自动部署设置

本项目已配置 `.github/workflows/deploy.yml`。推送到 `main` 或手动运行 workflow 时，GitHub Actions 会构建前端、打包项目、上传到服务器，并在服务器执行 Docker Compose 部署。

## 1. 创建部署 SSH Key

在你的 Mac 本机执行：

```bash
ssh-keygen -t ed25519 -C "aegis-github-actions" -f ~/.ssh/aegis_github_actions -N ""
cat ~/.ssh/aegis_github_actions.pub | ssh root@47.99.126.89 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys'
```

## 2. 配置 GitHub Secrets

进入 GitHub 仓库：

```text
Settings -> Secrets and variables -> Actions -> New repository secret
```

添加这些 secrets：

```text
SERVER_HOST=47.99.126.89
SERVER_USER=root
SERVER_PORT=22
SERVER_APP_DIR=/opt/aegis
SERVER_ORIGIN=http://47.99.126.89
SERVER_SSH_KEY=<~/.ssh/aegis_github_actions 的完整私钥内容>
```

查看私钥内容：

```bash
cat ~/.ssh/aegis_github_actions
```

私钥需要包含开头和结尾两行：

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

## 3. 触发部署

推送到 `main` 会自动部署：

```bash
git push origin main
```

也可以在 GitHub 页面手动触发：

```text
Actions -> Deploy Aegis -> Run workflow
```

## 4. DeepSeek Key

自动部署会保留服务器已有的 `/opt/aegis/.env`。如果要启用真实 AI 对话，在服务器上改一次即可：

```bash
ssh root@47.99.126.89
cd /opt/aegis
nano .env
```

把 `DEEPSEEK_API_KEY=` 改成真实值后重启：

```bash
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml up -d --build
```
