#!/bin/bash

# ============================================================
# Obsidian 同步脚本 - Linux 版本
# ============================================================
# 使用方法：chmod +x sync-linux.sh && ./sync-linux.sh
# ============================================================

# ==================== 配置区域 ====================
# 请修改以下路径为你自己的路径

# Obsidian 笔记文件夹路径（要同步的源文件夹完整路径）
OBSIDIAN_PATH="/home/weichen/Documents/obsidian/better-life/_Garden"

# Git 仓库目标文件夹路径（同步到哪里的完整路径）
TARGET_PATH="/home/weichen/Documents/github/weichen.ink/content"

# ==================== 配置区域结束 ====================

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
    read -p "按 Enter 键退出..."
    exit 1
fi

# 显示当前配置
echo "📝 当前配置："
echo "────────────────────────────────────────────────────────────────────"
echo "源文件夹: $OBSIDIAN_PATH"
echo "目标文件夹: $TARGET_PATH"
echo "────────────────────────────────────────────────────────────────────"
echo

# 检查路径是否存在
if [[ ! -d "$OBSIDIAN_PATH" ]]; then
    echo "❌ 错误：源文件夹不存在: $OBSIDIAN_PATH"
    read -p "按 Enter 键退出..."
    exit 1
fi

# 检查目标路径的 Git 仓库
TARGET_REPO=$(dirname "$TARGET_PATH")
while [[ "$TARGET_REPO" != "/" && ! -d "$TARGET_REPO/.git" ]]; do
    TARGET_REPO=$(dirname "$TARGET_REPO")
done

if [[ ! -d "$TARGET_REPO/.git" ]]; then
    echo "❌ 错误：目标路径不在 Git 仓库中: $TARGET_PATH"
    read -p "按 Enter 键退出..."
    exit 1
fi

# 确认同步
echo "准备开始同步..."
read -p "确认继续？(Y/n): " confirm
if [[ "$confirm" =~ ^[Nn]$ ]]; then
    echo "已取消"
    exit 0
fi

echo
echo "🔄 开始同步..."
echo

# 创建目标文件夹
mkdir -p "$TARGET_PATH"

# 执行同步
rsync -av --delete \
    --exclude='.obsidian/' \
    --exclude='.DS_Store' \
    --exclude='*.tmp' \
    --exclude='.git/' \
    "$OBSIDIAN_PATH/" "$TARGET_PATH/"

if [[ $? -ne 0 ]]; then
    echo
    echo "❌ 同步失败"
    read -p "按 Enter 键退出..."
    exit 1
fi

echo
echo "✅ 文件同步完成"
echo

# Git 操作
echo "📦 检查 Git 更改..."
cd "$TARGET_REPO" || exit 1

# 检查是否有更改（包括未跟踪的文件）
if [[ -z $(git status --porcelain) ]]; then
    echo "ℹ️  没有检测到更改"
    echo
    echo "✅ 同步完成"
    exit 0
fi

echo
echo "📝 检测到以下更改："
git status --short
echo

# 提交更改
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
COMMIT_MSG="📝 [Linux] 同步笔记: $TIMESTAMP"

echo "💾 添加并提交更改..."
git add .
git commit -m "$COMMIT_MSG"

if [[ $? -ne 0 ]]; then
    echo
    echo "❌ Git 提交失败"
    read -p "按 Enter 键退出..."
    exit 1
fi

echo "✅ 提交成功"
echo

# 推送到远程
echo "🚀 推送到 GitHub..."
read -p "确认推送？(Y/n): " push_confirm
if [[ "$push_confirm" =~ ^[Nn]$ ]]; then
    echo "已跳过推送"
    echo
    echo "✅ 同步完成（未推送）"
    exit 0
fi

git push

if [[ $? -eq 0 ]]; then
    echo
    echo "🎉 全部完成！"
else
    echo
    echo "❌ 推送失败，请检查网络和 Git 配置"
fi
