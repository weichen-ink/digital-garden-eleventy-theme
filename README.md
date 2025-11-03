# Digital Garden Eleventy Theme 🌿

🌐 **[在线演示](https://digital-garden-eleventy-theme.vercel.app/)** 

一个现代、优雅的 Eleventy 数字花园主题，专为知识管理和思维连接而设计。让你的笔记像花园一样自然生长！

这是一个功能完整的数字花园解决方案，无论你是写作爱好者、知识工作者，还是想要构建个人博客的用户，都能在这里找到合适的功能。

## ✨ 主题亮点

### 🧠 智能笔记系统
- **双链笔记**：使用 `[[笔记名]]` 语法轻松连接想法，就像 Obsidian 一样
- **反向链接**：自动显示哪些笔记链接到了当前页面
- **大小写不敏感**：`[[GitHub]]` 和 `[[github]]` 都能正确链接

### 🎨 美观的界面设计
- **Obsidian Callout**：支持笔记、提示、警告等 6 种精美信息框
- **卡片视图**：将列表转换为优雅的网格布局，展示书单、项目等
- **响应式设计**：完美适配手机、平板、电脑等各种设备
- **代码高亮**：支持多种编程语言的语法高亮显示

### 🔍 便捷的内容管理
- **全站搜索**：快速找到任何笔记和内容
- **自动分类**：根据标签和分类自动生成页面
- **文件夹管理**：支持任意深度的文件夹结构
- **图片处理**：智能处理图片大小和位置

## 🚀 5分钟上手指南

### 第1步：准备环境
确保你的电脑已安装：
- Node.js 18+ （[下载地址](https://nodejs.org/)）
- 任意代码编辑器（推荐 VS Code）

### 第2步：获取主题
```bash
# 下载主题文件
git clone https://github.com/weichen-ink/digital-garden-eleventy-theme.git
cd digital-garden-eleventy-theme

# 安装依赖
npm install
```

### 第3步：个性化配置
```bash
# 复制配置模板
cp garden.config.js.example garden.config.js
```

编辑 `garden.config.js` 文件，修改为你的信息：
```javascript
module.exports = {
  site: {
    title: "我的数字花园",           // 网站标题
    description: "知识的花园",       // 网站描述
    author: "你的名字",             // 作者姓名
    url: "https://yourdomain.com"   // 网站地址
  }
};
```

### 第4步：开始写作
在 `content/` 文件夹里创建你的第一篇笔记：

```markdown
---
title: 我的第一篇笔记
tags: [想法, 学习]
---

这是我的数字花园！

我可以通过 [[其他笔记]] 来链接到其他内容。
```

### 第5步：预览效果
```bash
# 启动本地服务器
npm run serve
```

打开 `http://localhost:8080` 就能看到你的数字花园了！

## 📖 核心功能

### 🔗 双链笔记
使用 Obsidian 风格的链接语法：
```markdown
[[笔记标题]]                    # 基本双链语法
[[笔记标题|自定义显示文本]]       # 自定义链接显示文本
[[笔记标题#锚点]]               # 链接到笔记中的特定标题
![[图片.jpg]]                   # 嵌入图片
![[图片.jpg|200]]               # 嵌入图片并设置宽度
```

### 🃏 卡片视图
在文件头部添加 `cssclasses: list-cards` 即可将列表转换为精美卡片：

```markdown
---
title: 我的书单
cssclasses: list-cards
---

- ![书籍封面.jpg](book1.jpg)
  - 《深度工作》
  - 作者：卡尔·纽波特
  - 评分：⭐⭐⭐⭐⭐
```

### 🏷️ 分类和标签
```markdown
---
title: 学习笔记
category: 知识管理
tags: [笔记方法, 双链笔记, 效率工具]
---
```

系统会自动为每个分类和标签生成对应的页面。

### 🔗 页面别名 (Aliases)
让一个页面通过多个URL访问，适用于URL重构、多语言路径等场景：
```markdown
---
title: 配置指南
permalink: /configuration/
aliases:
  - /config/          # 短链接
  - /旧配置/          # 旧URL
  - /settings/        # 别名URL
---
```

每个别名会生成一个轻量级重定向HTML，自动跳转到主URL，SEO友好。


## 🎨 自定义样式

在 `src/assets/css/custom/` 目录下创建 `.css` 文件来自定义样式：

```css
/* 自定义主题色 */
:root {
  --color-primary: #ff6b6b;
  --color-secondary: #4ecdc4;
}

/* 自定义链接样式 */
.internal-link {
  color: var(--color-primary);
  background-color: rgba(255, 107, 107, 0.1);
  border-radius: 3px;
  padding: 1px 3px;
}
```

## 📚 完整文档

想要深入了解所有功能？请查看详细文档：

### 📖 基础指南
- **[快速开始](content/theme-doc/快速开始.md)** - 从零开始搭建你的数字花园
- **[主题配置](content/theme-doc/主题配置.md)** - 个性化配置你的网站设置
- **[写作指南](content/theme-doc/写作指南.md)** - 掌握 Markdown 写作技巧和最佳实践

### 🔧 核心功能
- **[双链笔记](content/theme-doc/双链笔记.md)** - 深入了解双链语法和反向链接
- **[常见问题](content/theme-doc/常见问题.md)** - 解答使用过程中的常见疑问
- **[主题升级指南](content/theme-doc/主题升级指南.md)** - 如何升级到新版本

## 💡 使用建议

1. **从简单开始**：先创建几篇基础笔记，熟悉双链语法
2. **逐步完善**：慢慢添加标签、分类，构建知识网络
3. **定期整理**：利用反向链接功能发现知识之间的联系
4. **个性化定制**：根据需要调整样式和配置

## 🤝 需要帮助？

- 📚 查看详细文档：访问项目中的教程链接
- 🐛 遇到问题：[提交 Issue](https://github.com/weichen-ink/digital-garden-eleventy-theme/issues)
- 💬 交流讨论：[社区论坛](https://github.com/weichen-ink/digital-garden-eleventy-theme/discussions)

## 📊 技术栈

- **Eleventy 3.0** - 静态站点生成器
- **Nunjucks** - 模板引擎
- **纯 CSS** - 无框架依赖
- **Vanilla JavaScript** - 搜索和交互功能

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

---

**让想法自由连接，让知识自然生长** 🌱
