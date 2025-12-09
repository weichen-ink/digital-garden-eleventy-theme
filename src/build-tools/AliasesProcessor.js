/**
 * Aliases处理器
 * 负责处理页面别名（aliases），将页面内容复制到别名路径
 * 
 * 方案说明：
 * - 不使用重定向，直接在 alias 路径生成完整页面内容
 * - 在 <head> 中添加 canonical 标签指向主 URL（SEO 友好）
 * - 统计代码能正常工作，用户直接看到内容
 */
const fs = require('fs');
const path = require('path');

class AliasesProcessor {
  constructor(outputDir, warningCollector) {
    this.outputDir = outputDir;
    this.warningCollector = warningCollector;
    this.stats = {
      totalAliases: 0,
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
    const allPages = collections.all || [];

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

    // 收集所有页面的aliases，同时保存页面引用以便复制内容
    const aliasMap = new Map(); // alias -> { targetUrl, page }

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
            `别名 "${validatedAlias}" 被多个页面使用：\n  - ${aliasMap.get(normalizedAlias).targetUrl}\n  - ${targetUrl}\n  将跳过此别名。`
          );
          this.stats.conflicts++;
          return;
        }

        aliasMap.set(normalizedAlias, { targetUrl, page });
      });
    });

    // 复制页面内容到别名路径
    await this.copyPagesToAliases(aliasMap);

    return this.stats;
  }

  /**
   * 验证alias格式
   */
  validateAlias(alias, targetUrl, inputPath) {
    if (typeof alias !== 'string') {
      this.addWarning(
        'Alias格式错误',
        `文件 ${inputPath} 的alias必须是字符串，跳过: ${JSON.stringify(alias)}`
      );
      this.stats.skipped++;
      return null;
    }

    alias = alias.trim();
    if (alias === '') {
      this.stats.skipped++;
      return null;
    }

    if (!alias.startsWith('/')) {
      alias = '/' + alias;
    }

    if (!alias.endsWith('/') && !path.extname(alias)) {
      alias = alias + '/';
    }

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
   */
  normalizeUrl(url) {
    let normalized = url.trim().replace(/\/+$/, '');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    return normalized.toLowerCase();
  }

  /**
   * 复制页面内容到所有别名路径
   */
  async copyPagesToAliases(aliasMap) {
    const promises = [];

    for (const [alias, { targetUrl, page }] of aliasMap.entries()) {
      promises.push(this.copyPageToAlias(alias, targetUrl, page));
    }

    await Promise.all(promises);
  }

  /**
   * 复制单个页面内容到别名路径
   */
  async copyPageToAlias(alias, targetUrl, page) {
    try {
      // 读取原始页面内容
      const sourcePath = this.getOutputPath(targetUrl);

      if (!fs.existsSync(sourcePath)) {
        this.addWarning(
          '源文件不存在',
          `无法找到 "${targetUrl}" 的输出文件: ${sourcePath}`
        );
        this.stats.errors++;
        return;
      }

      let htmlContent = fs.readFileSync(sourcePath, 'utf8');

      // 确保页面包含 canonical 标签指向主 URL
      // 如果已有 canonical，替换它；如果没有，添加一个
      const canonicalTag = `<link rel="canonical" href="${this.escapeHtml(targetUrl)}">`;

      if (htmlContent.includes('<link rel="canonical"')) {
        // 替换现有的 canonical 标签
        htmlContent = htmlContent.replace(
          /<link rel="canonical"[^>]*>/,
          canonicalTag
        );
      } else if (htmlContent.includes('</head>')) {
        // 在 </head> 前添加 canonical 标签
        htmlContent = htmlContent.replace(
          '</head>',
          `  ${canonicalTag}\n</head>`
        );
      }

      // 确定别名文件路径
      const aliasPath = this.getOutputPath(alias);

      // 创建目录
      const dirPath = path.dirname(aliasPath);
      fs.mkdirSync(dirPath, { recursive: true });

      // 写入文件
      fs.writeFileSync(aliasPath, htmlContent, 'utf8');
      this.stats.totalAliases++;

    } catch (error) {
      this.addWarning(
        'Alias文件写入失败',
        `无法复制页面到别名 "${alias}": ${error.message}`
      );
      this.stats.errors++;
    }
  }

  /**
   * 根据 URL 获取输出文件路径
   */
  getOutputPath(url) {
    if (url.endsWith('.html')) {
      return path.join(this.outputDir, url);
    } else {
      const normalizedUrl = url.endsWith('/') ? url : url + '/';
      return path.join(this.outputDir, normalizedUrl, 'index.html');
    }
  }

  /**
   * HTML转义（防XSS）
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
