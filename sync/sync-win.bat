@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

REM ============================================================
REM Obsidian 同步脚本 - Windows 版本
REM ============================================================
REM 双击此文件即可运行
REM
REM 依赖项：
REM   - Git for Windows (包含 bash 和 rsync)
REM   下载地址: https://git-scm.com/download/win
REM ============================================================

REM ==================== 配置区域 ====================
REM 请修改以下路径为你自己的路径

REM Obsidian 笔记文件夹路径（要同步的源文件夹完整路径）
set "OBSIDIAN_PATH=C:\Users\weichen\Documents\obsidian\better-life\_Garden"

REM Git 仓库目标文件夹路径（同步到哪里的完整路径）
set "TARGET_PATH=C:\Users\weichen\Documents\github\weichen.ink\content"

REM ==================== 配置区域结束 ====================

cls
echo ======================================================================
echo 💻 Obsidian 同步工具 (Windows)
echo ======================================================================
echo.

REM 检查配置
echo %OBSIDIAN_PATH% | findstr "你的用户名" >nul
if %errorlevel% equ 0 (
    echo ❌ 错误：请先配置脚本中的路径！
    echo.
    echo 请编辑此文件，修改以下配置：
    echo   - OBSIDIAN_PATH（Obsidian 笔记文件夹完整路径）
    echo   - TARGET_PATH（Git 仓库目标文件夹完整路径）
    echo.
    pause
    exit /b 1
)

REM 显示当前配置
echo 📝 当前配置：
echo ────────────────────────────────────────────────────────────────────
echo 源文件夹: %OBSIDIAN_PATH%
echo 目标文件夹: %TARGET_PATH%
echo ────────────────────────────────────────────────────────────────────
echo.

REM 检查源文件夹
if not exist "%OBSIDIAN_PATH%" (
    echo ❌ 错误：源文件夹不存在: %OBSIDIAN_PATH%
    echo.
    pause
    exit /b 1
)

REM 查找 Git Bash
set "BASH_EXE="
where bash.exe >nul 2>nul
if %errorlevel% equ 0 (
    set "BASH_EXE=bash.exe"
) else (
    if exist "C:\Program Files\Git\bin\bash.exe" (
        set "BASH_EXE=C:\Program Files\Git\bin\bash.exe"
    ) else if exist "C:\Program Files (x86)\Git\bin\bash.exe" (
        set "BASH_EXE=C:\Program Files (x86)\Git\bin\bash.exe"
    ) else if exist "%LOCALAPPDATA%\Programs\Git\bin\bash.exe" (
        set "BASH_EXE=%LOCALAPPDATA%\Programs\Git\bin\bash.exe"
    )
)

if "%BASH_EXE%"=="" (
    echo ❌ 错误：找不到 Git Bash
    echo.
    echo 请安装 Git for Windows: https://git-scm.com/download/win
    echo.
    pause
    exit /b 1
)

REM 检查git命令
where git.exe >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ 错误：找不到 git 命令
    echo.
    echo 请确保 Git 已正确安装并添加到 PATH
    echo.
    pause
    exit /b 1
)

REM 查找 Git 仓库根目录
set "TARGET_REPO=%TARGET_PATH%"
:find_git
if exist "%TARGET_REPO%\.git\" goto :found_git
for %%I in ("%TARGET_REPO%") do set "TARGET_REPO=%%~dpI"
set "TARGET_REPO=%TARGET_REPO:~0,-1%"
if "%TARGET_REPO:~-1%"==":" goto :not_found
goto :find_git

:not_found
echo ❌ 错误：目标路径不在 Git 仓库中: %TARGET_PATH%
echo.
pause
exit /b 1

:found_git
cd /d "%TARGET_REPO%"

REM 配置 Git 显示中文文件名（仅针对当前仓库）
git config --local core.quotepath false 2>nul

REM 检查当前分支
for /f "tokens=*" %%a in ('git branch --show-current') do set "CURRENT_BRANCH=%%a"
echo 当前 Git 分支: %CURRENT_BRANCH%
echo.

REM 确认同步
set /p confirm="准备开始同步，确认继续？(Y/n): "
if /i "%confirm%"=="n" (
    echo ✅ 已取消操作
    echo.
    pause
    exit /b 0
)

echo.
echo 🔄 开始同步文件...
echo.

REM 创建目标文件夹
if not exist "%TARGET_PATH%" mkdir "%TARGET_PATH%"

REM 执行同步（使用 Git Bash，简洁模式避免乱码显示）
"%BASH_EXE%" -c "rsync -a --delete --stats --human-readable --exclude='.obsidian/' --exclude='.DS_Store' --exclude='*.tmp' --exclude='.git/' --exclude='.gitignore' '%OBSIDIAN_PATH:\=/%/' '%TARGET_PATH:\=/%/'"

if %errorlevel% neq 0 (
    echo.
    echo ❌ 文件同步失败
    echo.
    pause
    exit /b 1
)

echo.
echo ✅ 文件同步完成
echo.

REM 检查 Git 更改
echo 📦 检查 Git 更改...

REM 检查是否有更改
git status --porcelain > nul 2>&1
if errorlevel 1 (
    echo ❌ Git 状态检查失败
    echo.
    pause
    exit /b 1
)

set "HAS_CHANGES="
for /f %%i in ('git status --porcelain') do set HAS_CHANGES=1

if not defined HAS_CHANGES (
    echo ℹ️  没有检测到更改，同步完成
    echo.
    pause
    exit /b 0
)

echo.
echo 📝 检测到以下更改：
echo.
git status --short
echo.

REM 统计变更文件数
set "CHANGED_FILES=0"
for /f %%i in ('git status --porcelain ^| find /c /v ""') do set "CHANGED_FILES=%%i"
echo 共 %CHANGED_FILES% 个文件发生变化
echo.

REM 提交并推送更改
echo 💾 准备提交并推送到远程仓库 (分支: %CURRENT_BRANCH%)...
echo.
set /p commit_confirm="确认提交并推送这些更改？(Y/n): "
if /i "%commit_confirm%"=="n" (
    echo ✅ 已取消，文件已同步到本地
    echo.
    pause
    exit /b 0
)

REM 检查远程仓库
git remote -v | findstr "origin" >nul
if %errorlevel% neq 0 (
    echo ❌ 未找到远程仓库 origin
    echo.
    pause
    exit /b 1
)

REM 生成时间戳
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do (
    set "DATE=%%a-%%b-%%c"
)
for /f "tokens=1-2 delims=: " %%a in ('time /t') do (
    set "TIME=%%a:%%b:00"
)

REM 使用临时文件来处理多行commit message
set "TEMP_MSG_FILE=%TEMP%\commit_msg_%RANDOM%.txt"
(
    echo 📝 [Win] 同步笔记: %DATE% %TIME%
    echo.
    echo - 同步自: %OBSIDIAN_PATH%
    echo - 变更文件数: %CHANGED_FILES%
) > "%TEMP_MSG_FILE%"

REM 提交
git add -A
if %errorlevel% neq 0 (
    del "%TEMP_MSG_FILE%"
    echo.
    echo ❌ Git add 失败
    echo.
    pause
    exit /b 1
)

git commit -F "%TEMP_MSG_FILE%"
set "COMMIT_RESULT=%errorlevel%"
del "%TEMP_MSG_FILE%"

if %COMMIT_RESULT% neq 0 (
    echo.
    echo ❌ Git 提交失败
    echo.
    pause
    exit /b 1
)

echo ✅ 提交成功
echo.

REM 推送
echo 🚀 正在推送到远程仓库...
git push

if %errorlevel% equ 0 (
    echo.
    echo 🎉 全部完成！
) else (
    echo.
    echo ❌ 推送失败，请检查网络和 Git 配置
)

echo.
pause
