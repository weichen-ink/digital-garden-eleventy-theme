@echo off
chcp 65001 > nul

REM ============================================================
REM Obsidian 同步脚本 - Windows 版本
REM ============================================================
REM 双击此文件即可运行
REM 需要安装 Git for Windows
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

REM 确认同步
echo 准备开始同步...
set /p confirm="确认继续？(Y/n): "
if /i "%confirm%"=="n" (
    echo 已取消
    pause
    exit /b 0
)

echo.
echo 🔄 开始同步...
echo.

REM 创建目标文件夹
if not exist "%TARGET_PATH%" mkdir "%TARGET_PATH%"

REM 执行同步（使用 Git Bash）
"%BASH_EXE%" -c "rsync -av --delete --exclude='.obsidian/' --exclude='.DS_Store' --exclude='*.tmp' --exclude='.git/' '%OBSIDIAN_PATH:\=/%/' '%TARGET_PATH:\=/%/'"

if %errorlevel% neq 0 (
    echo.
    echo ❌ 同步失败
    pause
    exit /b 1
)

echo.
echo ✅ 文件同步完成
echo.

REM 查找 Git 仓库根目录
set "TARGET_REPO=%TARGET_PATH%"
:find_git
if exist "%TARGET_REPO%\.git\" goto :found_git
for %%I in ("%TARGET_REPO%") do set "TARGET_REPO=%%~dpI"
set "TARGET_REPO=%TARGET_REPO:~0,-1%"
if "%TARGET_REPO:~-1%"==":" goto :not_found
goto :find_git

:not_found
echo ❌ 错误：目标路径不在 Git 仓库中
pause
exit /b 1

:found_git
echo 📦 检查 Git 更改...
cd /d "%TARGET_REPO%"

REM 检查是否有更改（包括未跟踪的文件）
git status --porcelain > nul 2>&1
if errorlevel 1 (
    echo ❌ Git 状态检查失败
    pause
    exit /b 1
)

for /f %%i in ('git status --porcelain') do set HAS_CHANGES=1

if not defined HAS_CHANGES (
    echo ℹ️  没有检测到更改
    echo.
    echo ✅ 同步完成
    pause
    exit /b 0
)

echo.
echo 📝 检测到以下更改：
git status --short
echo.

REM 提交更改
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set "DATE=%%a-%%b-%%c"
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set "TIME=%%a:%%b:00"
set "COMMIT_MSG=📝 [Win] 同步笔记: %DATE% %TIME%"

echo 💾 添加并提交更改...
git add .
git commit -m "%COMMIT_MSG%"

if %errorlevel% neq 0 (
    echo.
    echo ❌ Git 提交失败
    pause
    exit /b 1
)

echo ✅ 提交成功
echo.

REM 推送到远程
echo 🚀 推送到 GitHub...
set /p push_confirm="确认推送？(Y/n): "
if /i "%push_confirm%"=="n" (
    echo 已跳过推送
    echo.
    echo ✅ 同步完成（未推送）
    pause
    exit /b 0
)

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
