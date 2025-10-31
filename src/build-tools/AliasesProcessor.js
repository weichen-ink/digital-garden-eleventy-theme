/**
 * Aliases处理器
 * 负责处理页面别名（aliases），生成重定向HTML文件
 */
const fs = require('fs');
const path = require('path');

class AliasesProcessor {
  constructor(outputDir, warningCollector) {
    this.outputDir = outputDir;
    this.warningCollector = warningCollector;
    this.stats = {
      totalRedirects: 0,
      processedPages: 0,
      conflicts: 0,
      skipped: 0,
      errors: 0
    };
  }

  /**
   * 主处理函数：处理所有页面的aliases
   * @param {Object} collections - Eleventy collections对象
   * @returns {Object} 处理统计信息
   */
  async processAliases(collections) {
    // 从collections中获取所有页面（collections包含frontmatter数据）
    const allPages = collections.all || [];

    // 临时调试：打印有aliases的页面
    const withAliases = allPages.filter(p => p.data?.aliases);
    if (withAliases.length > 0) {
      console.log(`[AliasesProcessor] 找到 ${withAliases.length} 个页面配置了 aliases`);
    }

    // 收集所有现有的URL
    const existingUrls = new Set();
    allPages.forEach(page => {
      if (page.url) {
        existingUrls.add(this.normalizeUrl(page.url));
      }
    });

    // 收集所有页面的aliases
    const aliasMap = new Map(); // alias -> targetUrl

    allPages.forEach(page => {
      const aliases = page.data?.aliases;
      if (!aliases || !Array.isArray(aliases) || aliases.length === 0) {
        return;
      }

      const targetUrl = page.url;
      if (!targetUrl) {
        return;
      }

      this.stats.processedPages++;

      // 验证并收集aliases
      aliases.forEach(alias => {
        const validatedAlias = this.validateAlias(alias, targetUrl, page.inputPath);
        if (!validatedAlias) {
          return;
        }

        const normalizedAlias = this.normalizeUrl(validatedAlias);

        // 检查是否与现有URL冲突
        if (existingUrls.has(normalizedAlias)) {
          this.addWarning(
            'Alias与URL冲突',
            `别名 "${validatedAlias}" (指向 ${targetUrl}) 与现有页面URL冲突，将跳过。`
          );
          this.stats.conflicts++;
          return;
        }

        // 检查是否已被其他页面使用
        if (aliasMap.has(normalizedAlias)) {
          this.addWarning(
            'Alias冲突',
            `别名 "${validatedAlias}" 被多个页面使用：\n  - ${aliasMap.get(normalizedAlias)}\n  - ${targetUrl}\n  将跳过此别名。`
          );
          this.stats.conflicts++;
          return;
        }

        aliasMap.set(normalizedAlias, targetUrl);
      });
    });

    // 生成重定向文件
    await this.generateRedirectFiles(aliasMap);

    // 返回统计信息，由报告系统统一显示
    return this.stats;
  }

  /**
   * 验证alias格式
   * @param {string} alias - 要验证的别名
   * @param {string} targetUrl - 目标URL
   * @param {string} inputPath - 源文件路径
   * @returns {string|null} 验证后的alias或null
   */
  validateAlias(alias, targetUrl, inputPath) {
    // 检查类型
    if (typeof alias !== 'string') {
      this.addWarning(
        'Alias格式错误',
        `文件 ${inputPath} 的alias必须是字符串，跳过: ${JSON.stringify(alias)}`
      );
      this.stats.skipped++;
      return null;
    }

    // 去除首尾空格
    alias = alias.trim();

    // 检查是否为空
    if (alias === '') {
      this.stats.skipped++;
      return null;
    }

    // 确保以 / 开头
    if (!alias.startsWith('/')) {
      alias = '/' + alias;
    }

    // 确保以 / 结尾（除非是文件扩展名）
    if (!alias.endsWith('/') && !path.extname(alias)) {
      alias = alias + '/';
    }

    // 检查是否与目标URL相同（冗余）
    if (this.normalizeUrl(alias) === this.normalizeUrl(targetUrl)) {
      this.addWarning(
        'Alias冗余',
        `文件 ${inputPath} 的alias "${alias}" 与页面URL相同，建议移除。`
      );
      this.stats.skipped++;
      return null;
    }

    return alias;
  }

  /**
   * 标准化URL（用于比较）
   * @param {string} url
   * @returns {string}
   */
  normalizeUrl(url) {
    // 移除末尾的 /，统一格式
    let normalized = url.trim().replace(/\/+$/, '');
    // 确保以 / 开头
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    // 转为小写进行比较（URL大小写不敏感）
    return normalized.toLowerCase();
  }


  /**
   * 生成所有重定向文件
   * @param {Map} aliasMap - alias -> targetUrl映射
   */
  async generateRedirectFiles(aliasMap) {
    const promises = [];

    for (const [alias, targetUrl] of aliasMap.entries()) {
      promises.push(this.writeRedirectFile(alias, targetUrl));
    }

    await Promise.all(promises);
  }

  /**
   * 写入单个重定向文件
   * @param {string} alias - 别名URL
   * @param {string} targetUrl - 目标URL
   */
  async writeRedirectFile(alias, targetUrl) {
    try {
      // 生成重定向HTML
      const redirectHtml = this.generateRedirectHtml(targetUrl, alias);

      // 确定文件路径
      let filePath;
      if (alias.endsWith('.html')) {
        filePath = path.join(this.outputDir, alias);
      } else {
        // 确保alias以/结尾，生成index.html
        const normalizedAlias = alias.endsWith('/') ? alias : alias + '/';
        filePath = path.join(this.outputDir, normalizedAlias, 'index.html');
      }

      // 创建目录（recursive选项会自动处理目录已存在的情况）
      const dirPath = path.dirname(filePath);
      fs.mkdirSync(dirPath, { recursive: true });

      // 写入文件
      fs.writeFileSync(filePath, redirectHtml, 'utf8');
      this.stats.totalRedirects++;

    } catch (error) {
      this.addWarning(
        'Alias文件写入失败',
        `无法为别名 "${alias}" 生成重定向文件: ${error.message}`
      );
      this.stats.errors++;
    }
  }

  /**
   * 生成重定向HTML内容
   * @param {string} targetUrl - 目标URL
   * @param {string} alias - 别名URL（用于日志）
   * @returns {string} HTML内容
   */
  generateRedirectHtml(targetUrl, alias) {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>重定向中...</title>
  <link rel="canonical" href="${this.escapeHtml(targetUrl)}">
  <meta http-equiv="refresh" content="0; url=${this.escapeHtml(targetUrl)}">
  <meta name="robots" content="noindex, nofollow">
  <script>
    // 使用 replace 而不是 assign，避免在浏览器历史中留下记录
    window.location.replace("${this.escapeHtml(targetUrl)}");
  </script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background-color: #f5f5f5;
    }
    .redirect-container {
      text-align: center;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .redirect-container a {
      color: #0066cc;
      text-decoration: none;
    }
    .redirect-container a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="redirect-container">
    <p>正在跳转到 <a href="${this.escapeHtml(targetUrl)}">${this.escapeHtml(targetUrl)}</a></p>
    <noscript>
      <p><strong>请点击上方链接手动跳转</strong></p>
    </noscript>
  </div>
</body>
</html>`;
  }

  /**
   * HTML转义（防XSS）
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    const htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    };
    return str.replace(/[&<>"']/g, char => htmlEscapes[char]);
  }

  /**
   * 添加警告信息
   * @param {string} type - 警告类型
   * @param {string} message - 警告消息
   */
  addWarning(type, message) {
    if (this.warningCollector && typeof this.warningCollector.addWarning === 'function') {
      this.warningCollector.addWarning('AliasesProcessor', `[${type}] ${message}`);
    } else {
      console.warn(`⚠️  [AliasesProcessor] [${type}] ${message}`);
    }
  }
}

module.exports = AliasesProcessor;
