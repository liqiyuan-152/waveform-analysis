# Demo 产物部署

GitHub 稳定版在所有质量门禁通过后发布 `waveform-demo-X.Y.Z.tar.gz`，包含同一次构建的
`dist-demo/`、子路径 `/waveform-analysis/` 和记录完整提交 SHA 的 `version.txt`。
npm 包与 Demo 归档分别发布，服务器不再运行 Git clone、pnpm 或 Rust。

## 腾讯云运行方式

- Dokploy 项目继续使用 `waveform-analysis-mzd2gb`、现有静态运行镜像和本机端口 18089。
- 将该项目的来源改为 **raw Compose**，内容为 `docker-compose.artifact.yml`，关闭源码自动部署。
- 容器以只读方式挂载 `/srv/waveform-demo`，服务根目录为 `/www`；Nginx 将公开的
  `/waveform-analysis/` 代理到 `http://127.0.0.1:18089/current/`。每次请求重新解析 `current`，
  避免 BusyBox httpd 启动时进入链接目标目录后一直服务旧版。
- `waveform-demo-sync.timer` 每两分钟检查 GitHub 最新稳定版。没有 Demo 归档时保持原版。
- SHA256 来自 HTTPS GitHub API 的资产 digest，传给 `gh-download --sha256`；校验或下载失败
  不影响当前版本。解压禁止目录穿越、链接和特殊文件，切换后检查版本和 HTML，失败回滚。
- 发布工作流等待线上提交 SHA 匹配，不再推送 production 分支或触发源码克隆 webhook。
  Dokploy 仍负责静态容器的管理和重建，定时器负责内容更新。

服务器需预先安装 `/usr/local/bin/gh-download`、Python 3.9+，能访问 GitHub API 及其下载加速源。
初次迁移时先把当前容器 `/www` 备份到 `/srv/waveform-demo/releases/bootstrap`，令 `current`
指向它，再切换 Compose。保存原 Compose、Dokploy 来源配置和现有镜像用于迁移回滚。
迁移时将现有镜像标记为 `local/waveform-analysis-static:runtime-v1`，固定静态运行环境，
不复用可变的构建镜像标签。该镜像必须保留，后续可独立维护运行镜像。

安装检查器（以 root 执行）：

```sh
install -d -m 755 /usr/local/lib/waveform-demo /srv/waveform-demo
install -m 644 demo_release.py /usr/local/lib/waveform-demo/demo_release.py
install -m 644 waveform-demo-sync.service waveform-demo-sync.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now waveform-demo-sync.timer
systemctl start waveform-demo-sync.service
journalctl -u waveform-demo-sync.service -n 30 --no-pager
```

手动部署指定已验证稳定版：

```sh
python3 /usr/local/lib/waveform-demo/demo_release.py sync --tag v0.3.0
curl --fail http://127.0.0.1:18089/current/version.txt
curl --fail https://lqycustomsite.online/waveform-analysis/version.txt
```

人工回滚时先 `systemctl stop waveform-demo-sync.timer`，避免自动恢复最新版本，再执行指定版本
部署，或在 `/srv/waveform-demo` 中将 `current.next` 链接到保留的旧 `releases/<目录>` 后
`mv -Tf current.next current`。确认正常后再决定是否恢复定时器。历史目录不会自动删除。

本地验证与归档：

```sh
python3 -m unittest discover -s deploy -p 'test_*.py'
DEMO_BASE_PATH=/waveform-analysis/ pnpm build
python3 deploy/demo_release.py pack --tag vX.Y.Z --sha "$(git rev-parse HEAD)"
```

已有标签的工作流不会随分支代码更新。需要补发 Demo 资产时，必须使用该标签的精确源码重新
构建，并确认原 Release 的质量门禁已通过；只添加 Demo 文件，不替换 npm 包或移动标签。
