# Obsidian 同步工具

将 Obsidian 笔记同步到 Git 仓库的简单脚本。

## 📂 文件说明

- **sync-mac.command** - macOS 版本（双击运行）
- **sync-win.bat** - Windows 版本（双击运行）
- **sync-linux.sh** - Linux 版本（命令行运行）

## 🚀 使用方法

### 🍎 macOS

1. 右键编辑 `sync-mac.command`，修改以下配置：
   ```bash
   OBSIDIAN_PATH="/Users/你的用户名/Documents/Obsidian仓库名/Garden"
   TARGET_PATH="/Users/你的用户名/Documents/github/digital-garden-eleventy-theme/content"
   ```

2. 双击 `sync-mac.command` 运行
   - 首次运行可能需要在"系统偏好设置" > "安全性与隐私"中允许

### 💻 Windows

1. 右键编辑 `sync-win.bat`，修改以下配置：
   ```batch
   set "OBSIDIAN_PATH=C:\Users\你的用户名\Documents\Obsidian仓库名\Garden"
   set "TARGET_PATH=C:\Users\你的用户名\Documents\github\digital-garden-eleventy-theme\content"
   ```

2. 双击 `sync-win.bat` 运行
   - 需要先安装 [Git for Windows](https://git-scm.com/download/win)

### 🐧 Linux

1. 编辑 `sync-linux.sh`，修改以下配置：
   ```bash
   OBSIDIAN_PATH="/home/你的用户名/Documents/Obsidian仓库名/Garden"
   TARGET_PATH="/home/你的用户名/Documents/github/digital-garden-eleventy-theme/content"
   ```

2. 在终端运行：
   ```bash
   chmod +x sync-linux.sh
   ./sync-linux.sh
   ```

## ⚙️ 配置说明

只需要配置两个路径：

1. **OBSIDIAN_PATH** - Obsidian 笔记文件夹的完整路径
   - 例如：`/Users/weichen/Documents/MyVault/Garden`
   - 这是你要同步的源文件夹

2. **TARGET_PATH** - Git 仓库目标文件夹的完整路径
   - 例如：`/Users/weichen/Projects/my-blog/content`
   - 这是同步到的目标文件夹

## 🔄 同步流程

1. **文件同步** - 使用 rsync 增量同步文件
2. **Git 提交** - 自动检测更改并提交
3. **推送确认** - 询问是否推送到 GitHub

## 📝 排除文件

脚本会自动排除以下文件：
- `.obsidian/` - Obsidian 配置
- `.DS_Store` - macOS 系统文件
- `*.tmp` - 临时文件
- `.git/` - Git 配置

## ⚠️ 注意事项

- 首次使用前请备份数据
- 确保 Git 仓库已正确配置
- Windows 需要安装 Git for Windows
- Linux/macOS 需要安装 rsync（通常已预装）
