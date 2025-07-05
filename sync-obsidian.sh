#!/bin/bash

# =============================================================================
# Obsidian 到 Git 仓库多设备同步脚本
# =============================================================================
# 
# 功能：
# 1. 支持多设备配置管理 (thinkpad, pc, mac 等)
# 2. 将 Obsidian 仓库中的指定文件夹同步到目标 Git 仓库
# 3. 自动提交更改并推送到 GitHub
# 4. 支持配置多个同步任务
# 5. 提供详细的日志输出
#
# 使用方法：
# 1. 在下方配置区域添加你的设备配置
# 2. 运行: chmod +x sync-obsidian.sh
# 3. 运行: ./sync-obsidian.sh [设备名称]
# 4. 或运行: ./sync-obsidian.sh (会提示选择设备)
#
# 示例：
# ./sync-obsidian.sh thinkpad
# ./sync-obsidian.sh pc
# ./sync-obsidian.sh
#
# =============================================================================

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# =============================================================================
# 多设备配置区域 - 请根据你的实际情况修改以下配置
# =============================================================================

# 设备配置函数
# 在这里添加你的设备配置，每个设备一个函数

# ThinkPad 配置
configure_thinkpad() {
    DEVICE_NAME="ThinkPad"
    OBSIDIAN_REPO="/home/weichen/Desktop/xcz-ob/"
    TARGET_REPO="/home/weichen/Desktop/Github/garden.weichen.ink/"
    
    # 同步文件夹配置
    SYNC_FOLDERS=(
        "Garden:content"
    )
    
    # Git 配置
    GIT_BRANCH="main"
    COMMIT_PREFIX="📝 [ThinkPad] 同步笔记: "
}

# PC 台式机配置
configure_pc() {
    DEVICE_NAME="PC Desktop"
    OBSIDIAN_REPO="/d/Documents/Obsidian"
    TARGET_REPO="/d/Projects/my-digital-garden"
    
    # 同步文件夹配置
    SYNC_FOLDERS=(
        "发布笔记:content"
        "图片资源:static/images"
        "读书笔记:content/books"
    )
    
    # Git 配置
    GIT_BRANCH="main"
    COMMIT_PREFIX="💻 [PC] 同步笔记: "
}

# MacBook 配置
configure_macbook() {
    DEVICE_NAME="MacBook"
    OBSIDIAN_REPO="/Users/username/Documents/Obsidian"
    TARGET_REPO="/Users/username/Projects/my-digital-garden"
    
    # 同步文件夹配置
    SYNC_FOLDERS=(
        "发布笔记:content"
        "图片资源:static/images"
        "工作笔记:content/work"
    )
    
    # Git 配置
    GIT_BRANCH="main"
    COMMIT_PREFIX="🍎 [Mac] 同步笔记: "
}

# 办公室电脑配置
configure_office() {
    DEVICE_NAME="Office Computer"
    OBSIDIAN_REPO="/c/Users/username/Documents/Obsidian"
    TARGET_REPO="/c/Projects/my-digital-garden"
    
    # 同步文件夹配置
    SYNC_FOLDERS=(
        "工作笔记:content/work"
        "项目文档:content/projects"
    )
    
    # Git 配置
    GIT_BRANCH="main"
    COMMIT_PREFIX="🏢 [Office] 同步笔记: "
}

# =============================================================================
# 自动获取可用设备列表
# =============================================================================

# 自动发现配置函数并生成设备列表
get_available_devices() {
    local devices=()
    
    # 查找所有 configure_* 函数
    for func in $(declare -F | grep "configure_" | awk '{print $3}'); do
        local device_id="${func#configure_}"  # 去掉 configure_ 前缀
        
        # 调用函数获取设备名称
        local device_name
        eval "$func" 2>/dev/null
        device_name="$DEVICE_NAME"
        
        devices+=("$device_id:$func:$device_name")
    done
    
    printf '%s\n' "${devices[@]}"
}

# =============================================================================
# 通用配置 - 适用于所有设备
# =============================================================================

# 排除文件/文件夹 (支持 rsync 的 --exclude 语法)
EXCLUDE_PATTERNS=(
    ".obsidian/"
    "*.tmp"
    ".DS_Store"
    "Thumbs.db"
    "*.swp"
    "*.swo"
    "*~"
    "*.bak"
    ".git/"
)

# =============================================================================
# 设备管理函数
# =============================================================================

# 显示可用设备列表
show_available_devices() {
    echo "可用的设备配置："
    echo "=================="
    
    local index=1
    local available_devices
    mapfile -t available_devices < <(get_available_devices)
    
    for device_info in "${available_devices[@]}"; do
        IFS=':' read -r device_id configure_func description <<< "$device_info"
        echo "$index) $device_id - $description"
        ((index++))
    done
    echo
}

# 选择设备
select_device() {
    local available_devices
    mapfile -t available_devices < <(get_available_devices)
    
    # 输出到错误流，避免被命令替换捕获
    show_available_devices >&2
    
    echo -n "请选择设备编号或输入设备ID: " >&2
    read -r choice
    
    # 检查是否是数字选择
    if [[ "$choice" =~ ^[0-9]+$ ]]; then
        if [[ $choice -ge 1 && $choice -le ${#available_devices[@]} ]]; then
            local device_info="${available_devices[$((choice-1))]}"
            IFS=':' read -r device_id configure_func description <<< "$device_info"
            echo "$device_id"
        else
            log_error "无效的选择: $choice"
            return 1
        fi
    else
        # 直接输入设备ID
        echo "$choice"
    fi
}

# 加载设备配置
load_device_config() {
    local target_device="$1"
    
    local available_devices
    mapfile -t available_devices < <(get_available_devices)
    
    for device_info in "${available_devices[@]}"; do
        IFS=':' read -r device_id configure_func description <<< "$device_info"
        
        if [[ "$device_id" == "$target_device" ]]; then
            log_info "加载设备配置: $description"
            
            # 检查配置函数是否存在
            if declare -f "$configure_func" > /dev/null; then
                # 调用配置函数
                "$configure_func"
                log_success "设备配置加载成功: $DEVICE_NAME"
                return 0
            else
                log_error "配置函数不存在: $configure_func"
                return 1
            fi
        fi
    done
    
    log_error "未找到设备配置: $target_device"
    return 1
}

# 显示当前配置
show_current_config() {
    echo
    echo "======================================================================"
    echo -e "${CYAN}当前设备配置${NC}"
    echo "======================================================================"
    echo "设备名称: $DEVICE_NAME"
    echo "Obsidian 仓库: $OBSIDIAN_REPO"
    echo "目标仓库: $TARGET_REPO"
    echo "Git 分支: $GIT_BRANCH"
    echo "提交前缀: $COMMIT_PREFIX"
    echo
    echo "同步文件夹："
    for folder_mapping in "${SYNC_FOLDERS[@]}"; do
        IFS=':' read -r source_folder target_folder <<< "$folder_mapping"
        echo "  $source_folder -> $target_folder"
    done
    echo "======================================================================"
    echo
}

# =============================================================================
# 同步相关函数
# =============================================================================

# 检查路径是否存在
check_path() {
    local path="$1"
    local desc="$2"
    
    if [[ ! -d "$path" ]]; then
        log_error "$desc 不存在: $path"
        return 1
    fi
    return 0
}

# 检查是否为 Git 仓库
check_git_repo() {
    local repo_path="$1"
    local desc="$2"
    
    if [[ ! -d "$repo_path/.git" ]]; then
        log_error "$desc 不是有效的 Git 仓库: $repo_path"
        return 1
    fi
    return 0
}

# 构建 rsync 排除参数
build_exclude_args() {
    local exclude_args=""
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
        exclude_args="$exclude_args --exclude='$pattern'"
    done
    echo "$exclude_args"
}

# 同步单个文件夹
sync_folder() {
    local source_folder="$1"
    local target_folder="$2"
    
    local source_path="$OBSIDIAN_REPO/$source_folder/"
    local target_path="$TARGET_REPO/$target_folder/"
    
    log_step "同步文件夹: $source_folder -> $target_folder"
    
    # 检查源文件夹是否存在
    if [[ ! -d "$source_path" ]]; then
        log_error "源文件夹不存在，同步失败: $source_path"
        log_error "请检查 Obsidian 仓库路径和文件夹配置"
        return 1
    fi
    
    # 创建目标文件夹（如果不存在）
    mkdir -p "$target_path"
    
    # 构建 rsync 命令
    local exclude_args
    exclude_args=$(build_exclude_args)
    
    # 执行同步 (使用 rsync 进行增量同步)
    log_info "正在同步文件..."
    
    # 使用 eval 来正确处理包含空格的排除模式
    eval "rsync -av --delete $exclude_args \"$source_path\" \"$target_path\""
    
    if [[ $? -eq 0 ]]; then
        log_success "文件夹同步完成: $source_folder"
        return 0
    else
        log_error "文件夹同步失败: $source_folder"
        return 1
    fi
}

# 检查 Git 状态并提交
commit_changes() {
    log_step "检查 Git 状态"
    
    cd "$TARGET_REPO" || {
        log_error "无法进入目标仓库目录"
        return 1
    }
    
    # 检查是否有更改
    if git diff --quiet && git diff --staged --quiet; then
        log_info "没有检测到文件更改"
        return 0
    fi
    
    # 显示更改的文件
    log_info "检测到以下文件更改:"
    git status --porcelain
    
    # 添加所有更改
    log_info "添加文件到 Git 暂存区..."
    git add .
    
    # 生成提交信息
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local commit_message="${COMMIT_PREFIX}${timestamp}"
    
    # 提交更改
    log_info "提交更改..."
    git commit -m "$commit_message"
    
    if [[ $? -eq 0 ]]; then
        log_success "Git 提交成功"
        return 0
    else
        log_error "Git 提交失败"
        return 1
    fi
}

# 推送到远程仓库
push_to_remote() {
    log_step "推送到远程 GitHub 仓库"
    
    cd "$TARGET_REPO" || {
        log_error "无法进入目标仓库目录"
        return 1
    }
    
    # 显示即将推送的提交信息
    log_info "即将推送的提交："
    git log --oneline -5
    echo
    
    # 询问用户确认
    echo -n "确认推送到远程仓库？(y/N): "
    read -r confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "用户取消推送操作"
        return 0
    fi
    
    # 推送到远程
    log_info "正在推送到 $GIT_BRANCH 分支..."
    git push origin "$GIT_BRANCH"
    
    if [[ $? -eq 0 ]]; then
        log_success "推送成功"
        return 0
    else
        log_error "推送失败"
        return 1
    fi
}

# 显示同步摘要
show_summary() {
    local start_time="$1"
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    echo
    echo "======================================================================"
    echo -e "${CYAN}同步完成摘要${NC}"
    echo "======================================================================"
    echo "设备: $DEVICE_NAME"
    echo "开始时间: $(date -d @$start_time '+%Y-%m-%d %H:%M:%S')"
    echo "结束时间: $(date -d @$end_time '+%Y-%m-%d %H:%M:%S')"
    echo "总耗时: ${duration} 秒"
    echo "同步的文件夹数量: ${#SYNC_FOLDERS[@]}"
    echo "源仓库: $OBSIDIAN_REPO"
    echo "目标仓库: $TARGET_REPO"
    echo "======================================================================"
}

# 显示帮助信息
show_help() {
    echo "Obsidian 到 Git 仓库多设备同步脚本"
    echo
    echo "用法:"
    echo "  $0 [设备名称]"
    echo "  $0 -h|--help"
    echo "  $0 -l|--list"
    echo
    echo "选项:"
    echo "  -h, --help     显示此帮助信息"
    echo "  -l, --list     列出所有可用设备"
    echo
    echo "示例:"
    echo "  $0              # 交互式选择设备"
    echo "  $0 thinkpad     # 使用 ThinkPad 配置"
    echo "  $0 pc           # 使用 PC 配置"
    echo "  $0 macbook      # 使用 MacBook 配置"
    echo
}

# =============================================================================
# 主函数
# =============================================================================

main() {
    local start_time
    start_time=$(date +%s)
    local target_device="$1"
    
    echo "======================================================================"
    echo -e "${CYAN}Obsidian 到 Git 仓库多设备同步脚本${NC}"
    echo "======================================================================"
    echo "开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo
    
    # 如果没有指定设备，则进行交互式选择
    if [[ -z "$target_device" ]]; then
        log_info "未指定设备，进入交互式选择模式"
        target_device=$(select_device)
        if [[ $? -ne 0 || -z "$target_device" ]]; then
            log_error "设备选择失败"
            exit 1
        fi
    fi
    
    # 加载设备配置
    if ! load_device_config "$target_device"; then
        log_error "加载设备配置失败"
        exit 1
    fi
    
    # 显示当前配置
    show_current_config
    
    # 询问用户确认
    echo -n "确认使用以上配置进行同步？(y/N): "
    read -r confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        log_info "用户取消操作"
        exit 0
    fi
    
    # 1. 检查配置
    log_step "检查配置"
    
    if [[ ${#SYNC_FOLDERS[@]} -eq 0 ]]; then
        log_error "没有配置同步文件夹"
        exit 1
    fi
    
    # 2. 检查路径
    log_step "验证路径"
    
    check_path "$OBSIDIAN_REPO" "Obsidian 仓库" || exit 1
    check_path "$TARGET_REPO" "目标仓库" || exit 1
    check_git_repo "$TARGET_REPO" "目标仓库" || exit 1
    
    log_success "路径验证通过"
    
    # 3. 执行同步
    local sync_success=true
    
    for folder_mapping in "${SYNC_FOLDERS[@]}"; do
        IFS=':' read -r source_folder target_folder <<< "$folder_mapping"
        
        if ! sync_folder "$source_folder" "$target_folder"; then
            sync_success=false
        fi
    done
    
    if [[ "$sync_success" != true ]]; then
        log_error "部分文件夹同步失败"
        exit 1
    fi
    
    log_success "所有文件夹同步完成"
    
    # 4. Git 操作
    if ! commit_changes; then
        log_error "Git 提交失败"
        exit 1
    fi
    
    if ! push_to_remote; then
        log_error "推送失败"
        exit 1
    fi
    
    # 5. 显示摘要
    show_summary "$start_time"
    
    log_success "同步流程全部完成！"
}

# =============================================================================
# 脚本入口
# =============================================================================

# 处理命令行参数
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    -l|--list)
        show_available_devices
        exit 0
        ;;
esac

# 检查是否有必要的命令
for cmd in rsync git; do
    if ! command -v "$cmd" &> /dev/null; then
        log_error "缺少必要命令: $cmd"
        exit 1
    fi
done

# 运行主函数
main "$@"