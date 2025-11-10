#!/bin/bash

# 设置 UTF-8 编码环境，确保正确显示中文文件名
export LANG=zh_CN.UTF-8
export LC_ALL=zh_CN.UTF-8

# 错误时立即退出
set -e

# ============================================================
# Obsidian 同步脚本 - Linux 版本
# ============================================================
# 使用方法：chmod +x sync-linux.sh && ./sync-linux.sh
#
# 依赖项：
#   - rsync (需安装: sudo apt install rsync 或 sudo yum install rsync)
#   - git (需预先安装)
# ============================================================

# ==================== 配置区域 ====================
# 请修改以下路径为你自己的路径

# Obsidian 笔记文件夹路径（要同步的源文件夹完整路径）
OBSIDIAN_PATH="/home/weichen/Documents/obsidian/better-life/_Garden"

# Git 仓库目标文件夹路径（同步到哪里的完整路径）
TARGET_PATH="/home/weichen/Documents/github/weichen.ink/content"

# ==================== 配置区域结束 ====================

# ==================== 辅助函数 ====================

# 错误处理函数
error_exit() {
    echo "❌ 错误: $1"
    echo
    read -p "按 Enter 键退出..."
    exit 1
}

# 成功退出函数
success_exit() {
    echo "$1"
    echo
    read -p "按 Enter 键退出..."
    exit 0
}

# 用户确认函数
confirm_prompt() {
    local message="$1"
    local default="${2:-Y}"

    if [[ "$default" == "Y" ]]; then
        read -p "$message (Y/n): " response
    else
        read -p "$message (y/N): " response
    fi

    if [[ "$default" == "Y" ]]; then
        [[ ! "$response" =~ ^[Nn]$ ]]
    else
        [[ "$response" =~ ^[Yy]$ ]]
    fi
}

# ==================== 主程序 ====================

# 清屏并显示标题
clear
echo "======================================================================"
echo "🐧 Obsidian 同步工具 (Linux)"
echo "======================================================================"
echo

# 检查配置
if [[ "$OBSIDIAN_PATH" == *"你的用户名"* ]] || [[ "$TARGET_PATH" == *"你的用户名"* ]]; then
    echo "❌ 错误：请先配置脚本中的路径！"
    echo
    echo "请编辑此文件，修改以下配置："
    echo "  - OBSIDIAN_PATH（Obsidian 笔记文件夹完整路径）"
    echo "  - TARGET_PATH（Git 仓库目标文件夹完整路径）"
    echo
    error_exit "配置未完成"
fi

# 显示当前配置
echo "📝 当前配置："
echo "────────────────────────────────────────────────────────────────────"
echo "源文件夹: $OBSIDIAN_PATH"
echo "目标文件夹: $TARGET_PATH"
echo "────────────────────────────────────────────────────────────────────"
echo

# 检查源路径是否存在
[[ -d "$OBSIDIAN_PATH" ]] || error_exit "源文件夹不存在: $OBSIDIAN_PATH"

# 检查rsync是否可用
command -v rsync >/dev/null 2>&1 || error_exit "未找到 rsync 命令，请安装: sudo apt install rsync"

# 检查git是否可用
command -v git >/dev/null 2>&1 || error_exit "未找到 git 命令，请安装: sudo apt install git"

# 查找 Git 仓库根目录
TARGET_REPO=$(dirname "$TARGET_PATH")
while [[ "$TARGET_REPO" != "/" && ! -d "$TARGET_REPO/.git" ]]; do
    TARGET_REPO=$(dirname "$TARGET_REPO")
done

[[ -d "$TARGET_REPO/.git" ]] || error_exit "目标路径不在 Git 仓库中: $TARGET_PATH"

# 检查Git仓库状态
cd "$TARGET_REPO" || error_exit "无法进入 Git 仓库: $TARGET_REPO"

# 配置 Git 显示中文文件名（仅针对当前仓库）
git config --local core.quotepath false 2>/dev/null || true

# 检查当前分支
CURRENT_BRANCH=$(git branch --show-current)
echo "当前 Git 分支: $CURRENT_BRANCH"
echo

# 确认同步
confirm_prompt "准备开始同步，确认继续？" || success_exit "✅ 已取消操作"

echo
echo "🔄 开始同步文件..."
echo

# 创建目标文件夹
mkdir -p "$TARGET_PATH"

# 执行同步（使用简洁模式避免乱码显示）
rsync -a --delete \
    --stats \
    --human-readable \
    --exclude='.obsidian/' \
    --exclude='.DS_Store' \
    --exclude='*.tmp' \
    --exclude='.git/' \
    --exclude='.gitignore' \
    "$OBSIDIAN_PATH/" "$TARGET_PATH/" || error_exit "文件同步失败"

echo
echo "✅ 文件同步完成"
echo

# Git 操作
echo "📦 检查 Git 更改..."

# 检查是否有更改（包括未跟踪的文件）
if [[ -z $(git status --porcelain) ]]; then
    success_exit "ℹ️  没有检测到更改，同步完成"
fi

echo
echo "📝 检测到以下更改："
echo
git status --short
echo

# 显示变更统计
CHANGED_FILES=$(git status --porcelain | wc -l | tr -d ' ')
echo "共 $CHANGED_FILES 个文件发生变化"
echo

# 提交并推送更改
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
COMMIT_MSG="📝 [Linux] 同步笔记: $TIMESTAMP

- 同步自: $OBSIDIAN_PATH
- 变更文件数: $CHANGED_FILES"

echo "💾 准备提交并推送到远程仓库 (分支: $CURRENT_BRANCH)..."
echo

if ! confirm_prompt "确认提交并推送这些更改？"; then
    success_exit "✅ 已取消，文件已同步到本地"
fi

# 检查远程仓库
git remote -v | grep -q "origin" || error_exit "未找到远程仓库 origin"

# 提交
git add -A || error_exit "Git add 失败"
git commit -m "$COMMIT_MSG" || error_exit "Git 提交失败"

echo "✅ 提交成功"
echo

# 推送
echo "🚀 正在推送到远程仓库..."
if git push; then
    echo
    success_exit "🎉 全部完成！"
else
    error_exit "推送失败，请检查网络和 Git 配置"
fi
