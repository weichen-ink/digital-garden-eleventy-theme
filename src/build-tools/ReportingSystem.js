/**
 * 🎨 完整的构建报告系统
 * 
 * 恢复原有的丰富报告功能，包括：
 * - 主题信息横幅
 * - 静态资源构建详情
 * - HTML页面统计
 * - 性能分析和评分
 * - 警告分类和展示
 * - 重复资源检测
 */

/**
 * 构建输出配置
 */
const buildConfig = {
  // 🎨 模板布局配置 - 统一宽度标准
  templates: {
    globalWidth: 67,
    banner: { width: 67, padding: 2 },
    summary: { width: 67, showDetails: true, maxWarnings: 5, maxErrors: 3 }
  },

  // 🌈 颜色主题配置
  colors: {
    primary: '\x1b[34m',     // 蓝色 - 主要信息
    success: '\x1b[32m',     // 绿色 - 成功状态
    warning: '\x1b[33m',     // 黄色 - 警告信息
    error: '\x1b[31m',       // 红色 - 错误信息
    info: '\x1b[36m',        // 青色 - 调试信息
    dim: '\x1b[2m',          // 暗色 - 次要信息
    bright: '\x1b[1m',       // 高亮 - 强调信息
    reset: '\x1b[0m'         // 重置颜色
  }
};

/**
 * 基础组件类 - 所有报告组件的父类
 */
class BaseComponent {
  constructor(config = {}) {
    this.config = { ...buildConfig, ...config };
    this.colors = this.config.colors;
    this.lineWidth = 70;
  }

  createSeparator(title = '') {
    if (title) {
      return `[[ ${title} ]]`;
    }
    return '';
  }

  formatLine(content) {
    return `  ${content}`;
  }
}

/**
 * 🏷️ 横幅组件 - 显示主题信息
 */
class BannerComponent extends BaseComponent {
  constructor(themeInfo, config = {}) {
    super(config);
    this.themeInfo = themeInfo;
  }

  render() {
    if (!this.themeInfo) return '';

    const descriptionText = this.themeInfo.description || 
      (this.themeInfo.techStack ? `使用 ${this.themeInfo.techStack} 强力驱动` : '使用现代技术栈强力驱动');

    return `${this.colors.info}
${this.createSeparator('🌿 Digital Garden Theme')}
${this.formatLine(`📦 版本: ${this.themeInfo.version || 'N/A'}                  🎨 设计: ${this.themeInfo.designer || 'N/A'}`)}
${this.formatLine(`🌐 官网: ${this.themeInfo.website || 'N/A'}`)}
${this.formatLine(descriptionText)}${this.colors.reset}`;
  }
}

/**
 * 📊 摘要组件 - 显示静态资源构建统计和详情
 */
class SummaryComponent extends BaseComponent {
  constructor(stats, buildInfo, processedAssets, config = {}) {
    super(config);
    this.stats = stats;
    this.buildInfo = buildInfo;
    this.processedAssets = processedAssets || [];
  }

  render() {
    if (!this.stats) return '';

    const duration = Date.now() - this.buildInfo.startTime;
    const durationSec = (duration / 1000).toFixed(1);
    const totalSizeMB = (this.stats.totalSize / 1024 / 1024).toFixed(2);
    
    const assetTypes = Object.entries(this.stats.assetTypes)
      .map(([ext, count]) => `${ext}: ${count}个`)
      .join(', ');

    let output = `${this.colors.success}
${this.createSeparator('🎉 静态资源构建报告')}
${this.formatLine(`⏱️  构建耗时: ${durationSec}s           📦 资源总数: ${this.stats.totalAssets}个`)}
${this.formatLine(`💾 文件大小: ${totalSizeMB}MB          🗂️  资源类型: ${assetTypes}`)}
${this.formatLine(`🚀 缓存状态: ${this.stats.cacheEnabled ? '已启用' : '已禁用'}       ✅ 优化状态: 全部完成`)}`;

    // 在serve模式下添加特殊提示
    if (global.buildContext?.isServeMode) {
      output += `\n${this.formatLine('🌐 开发模式: 服务器正在运行中')}`;
    }

    // 添加资源整合详情
    if (this.processedAssets && this.processedAssets.length > 0) {
      output += '\n';
      
      const cssAssets = this.processedAssets.filter(asset => asset.fileName.endsWith('.css'));
      const jsAssets = this.processedAssets.filter(asset => asset.fileName.endsWith('.js'));
      
      if (cssAssets.length > 0) {
        output += `\n${this.formatLine('CSS资源整合:')}`;
        cssAssets.forEach(asset => {
          const sizeKB = (asset.size / 1024).toFixed(1);
          const processor = asset.processor || 'Unknown';
          output += `\n${this.formatLine(`  • ${asset.fileName} ${sizeKB}KB [${processor.toLowerCase()}]`)}`;
          
          if (asset.sources && asset.sources.length > 0) {
            output += `\n${this.formatLine(`    整合来源: ${asset.sources.join(', ')}`)}`;
          }
        });
      }
      
      if (jsAssets.length > 0) {
        if (cssAssets.length > 0) output += '\n';
        output += `\n${this.formatLine('JS资源整合:')}`;
        jsAssets.forEach(asset => {
          const sizeKB = (asset.size / 1024).toFixed(1);
          const processor = asset.processor || 'Unknown';
          output += `\n${this.formatLine(`  • ${asset.fileName} ${sizeKB}KB [${processor.toLowerCase()}]`)}`;
          
          if (asset.sources && asset.sources.length > 0) {
            output += `\n${this.formatLine(`    整合来源: ${asset.sources.join(', ')}`)}`;
          }
        });
      }
    }

    return output;
  }
}

/**
 * 📄 HTML页面统计组件
 */
class HtmlStatsComponent extends BaseComponent {
  constructor(htmlStats, aliasStats = null, config = {}) {
    super(config);
    this.htmlStats = htmlStats;
    this.aliasStats = aliasStats;
  }

  render() {
    if (!this.htmlStats) return '';

    const htmlSizeMB = (this.htmlStats.totalSize / 1024 / 1024).toFixed(2);
    const sourceTypesText = Object.entries(this.htmlStats.sourceTypes)
      .map(([ext, count]) => `${ext}: ${count}个`)
      .join(', ');

    const pageTypesText = Object.entries(this.htmlStats.pageTypes)
      .map(([type, count]) => `${type}: ${count}个`)
      .join(', ');

    // HTML压缩状态
    const compressionStatus = this.htmlStats.minified ? '已压缩' : '未压缩';
    const compressionIcon = this.htmlStats.minified ? '🗜️' : '📄';

    let output = `
${this.createSeparator('📄 HTML页面构建统计')}
${this.formatLine(`📋 总页面数: ${this.htmlStats.totalPages}个            💾 HTML大小: ${htmlSizeMB}MB`)}
${this.formatLine(`${compressionIcon} HTML压缩: ${compressionStatus}            📂 源文件类型: ${sourceTypesText}`)}`;

    if (pageTypesText) {
      output += `\n${this.formatLine(`🏷️  页面分类: ${pageTypesText}`)}`;
    }

    // 添加 Aliases 统计（如果有）
    if (this.aliasStats && this.aliasStats.totalRedirects > 0) {
      const aliasText = `生成 ${this.aliasStats.totalRedirects} 个重定向`;
      const warningText = this.aliasStats.conflicts > 0 ? `, ${this.aliasStats.conflicts} 个冲突` : '';
      output += `\n${this.formatLine(`🔗 页面别名: ${aliasText}${warningText}`)}`;
    }

    return output;
  }
}

/**
 * ⚠️ 警告组件 - 显示警告和错误信息
 */
class WarningsComponent extends BaseComponent {
  constructor(warnings, errors, config = {}) {
    super(config);
    this.warnings = warnings || [];
    this.errors = errors || [];
  }

  /**
   * 从警告/错误对象中提取消息文本
   * @param {Object|string} warningOrError - 警告或错误对象
   * @returns {string} 消息文本
   */
  getWarningMessage(warningOrError) {
    const msg = warningOrError.message || warningOrError;
    return typeof msg === 'string' ? msg : JSON.stringify(msg);
  }

  render() {
    if (this.warnings.length === 0 && this.errors.length === 0) return '';

    let output = '';

    // 警告信息
    if (this.warnings.length > 0) {
      output += `
${this.createSeparator(`⚠️  警告信息 (${this.warnings.length})`)}`;

      // 添加重名文件说明
      const hasDuplicateWarnings = this.warnings.some(warning => {
        const msgText = this.getWarningMessage(warning);
        return msgText.includes('重名附件') || msgText.includes('重名笔记');
      });

      if (hasDuplicateWarnings) {
        output += `\n${this.formatLine('检测到重名文件，系统将使用标记 ✓ 的文件，建议重命名其他文件以避免冲突。')}`;
        output += '\n'; // 空行分隔
      }

      // 去重并格式化警告
      const uniqueWarnings = this.deduplicateWarnings(this.warnings);

      uniqueWarnings.forEach((warning, index) => {
        const msgText = this.getWarningMessage(warning);

        // 检查重名文件警告，进行特殊格式化
        if (msgText.includes('重名附件') || msgText.includes('重名笔记')) {
          output += this.formatDuplicateWarning(msgText);
          // 在每个重名警告后添加空行（除了最后一个）
          if (index < uniqueWarnings.length - 1) {
            output += '\n';
          }
        } else {
          output += `\n${this.formatLine(`• ${msgText}`)}`;
        }
      });
    }

    // 错误信息
    if (this.errors.length > 0) {
      if (this.warnings.length > 0) output += '\n';
      output += `
${this.createSeparator(`❌ 错误信息 (${this.errors.length})`)}`;

      this.errors.forEach(error => {
        const msgText = this.getWarningMessage(error);
        output += `\n${this.formatLine(`• ${msgText}`)}`;
      });
    }

    return output;
  }

  deduplicateWarnings(warnings) {
    const seen = new Set();
    return warnings.filter(warning => {
      const msgText = this.getWarningMessage(warning);
      if (seen.has(msgText)) return false;
      seen.add(msgText);
      return true;
    });
  }

  formatDuplicateWarning(msgText) {
    // 解析重名文件警告的复杂格式
    const attachmentMatch = msgText.match(/重名附件 "([^"]+)": (.+?), 使用第一个文件/);
    const noteMatch = msgText.match(/重名笔记 "([^"]+)": (.+?), 使用第一个文件/);
    
    let result = '';
    
    if (attachmentMatch) {
      const [, fileName, pathList] = attachmentMatch;
      result += `\n${this.formatLine(`📎 重名附件 "${fileName}":`)}`;
      
      const paths = pathList.split(', ');
      paths.forEach((path, index) => {
        const marker = index === 0 ? '(✓)' : '   ';
        result += `\n${this.formatLine(`    ${marker} ${path.trim()}`)}`;
      });
    } else if (noteMatch) {
      const [, noteTitle, noteList] = noteMatch;
      result += `\n${this.formatLine(`📝 重名笔记 "${noteTitle}":`)}`;
      
      const notes = noteList.split(', ');
      notes.forEach((note, index) => {
        const marker = index === 0 ? '(✓)' : '   ';
        result += `\n${this.formatLine(`    ${marker} ${note.trim()}`)}`;
      });
    } else {
      result += `\n${this.formatLine(`• ${msgText}`)}`;
    }
    
    return result;
  }
}


/**
 * 🌐 服务器信息组件 - 显示开发服务器信息
 */
class ServerInfoComponent extends BaseComponent {
  constructor(isServeMode = false, config = {}) {
    super(config);
    this.isServeMode = isServeMode;
  }

  render() {
    if (!this.isServeMode) return '';

    const serverUrl = global.buildContext?.serverUrl ||
                     process.env.ELEVENTY_SERVER_URL ||
                     'http://localhost:8080';

    const actualPort = global.buildContext?.actualServerPort;
    const actualHost = global.buildContext?.actualServerHost;
    const customPort = process.env.ELEVENTY_PORT;
    const customHost = process.env.ELEVENTY_HOST;

    let output = `
${this.createSeparator('🌐 开发服务器信息')}`;

    // 如果已经获取到实际地址，显示实际地址
    if (actualPort && actualHost) {
      output += `\n${this.formatLine(`🔗 服务器地址: ${serverUrl}`)}`;
      // 如果实际端口与配置不同，显示提示
      const configuredPort = parseInt(customPort || '8080', 10);
      if (actualPort !== configuredPort) {
        output += `\n${this.formatLine(`   (端口 ${configuredPort} 被占用，已自动使用 ${actualPort})`)}`;
      }
    } else {
      // 还未获取到实际地址，显示预期地址
      output += `\n${this.formatLine(`🔗 预期地址: ${serverUrl}`)}`;
      if (customPort || customHost) {
        const configs = [];
        if (customHost) configs.push(`主机: ${customHost}`);
        if (customPort) configs.push(`端口: ${customPort}`);
        output += `\n${this.formatLine(`⚙️  配置: ${configs.join(', ')}`)}`;
      }
    }

    return output;
  }
}

/**
 * 🎯 状态组件 - 显示最终状态
 */
class StatusComponent extends BaseComponent {
  constructor(isServeMode = false, config = {}) {
    super(config);
    this.isServeMode = isServeMode;
  }

  render() {
    const statusText = this.isServeMode
      ? '🌟 开发服务器已启动，正在监听文件变化...'
      : '🌟 静态资源构建完成，网站已准备就绪！';
    
    return `${this.formatLine(statusText)}`;
  }
}

/**
 * 🔄 重复资源检测组件
 */
class DuplicateResourceComponent extends BaseComponent {
  constructor(duplicateResources = [], config = {}) {
    super(config);
    this.duplicateResources = duplicateResources;
  }

  render() {
    if (!this.duplicateResources.length) return '';

    let output = `
${this.createSeparator(`🔄 重复资源检测 (${this.duplicateResources.length})`)}`;

    this.duplicateResources.forEach(duplicate => {
      output += `\n${this.formatLine(`📁 ${duplicate.name} (${duplicate.files.length}个副本):`)}`;
      duplicate.files.forEach((file, index) => {
        const marker = index === 0 ? '(✓)' : '   ';
        const sizeKB = (file.size / 1024).toFixed(1);
        output += `\n${this.formatLine(`    ${marker} ${file.path} (${sizeKB}KB)`)}`;
      });
      output += `\n${this.formatLine('    → 建议删除重复文件节省空间')}`;
    });

    return output;
  }
}

/**
 * 🎨 主报告模板类 - 组合所有组件
 */
class ReportTemplate {
  constructor(config = {}) {
    this.config = { ...buildConfig, ...config };
  }

  static banner(themeInfo, config = {}) {
    return new BannerComponent(themeInfo, config).render();
  }

  static summary(stats, buildInfo, processedAssets, config = {}) {
    return new SummaryComponent(stats, buildInfo, processedAssets, config).render();
  }

  static htmlStats(htmlStats, aliasStats = null, config = {}) {
    return new HtmlStatsComponent(htmlStats, aliasStats, config).render();
  }

  static warnings(warnings, errors, config = {}) {
    return new WarningsComponent(warnings, errors, config).render();
  }

  static serverInfo(isServeMode = false, config = {}) {
    return new ServerInfoComponent(isServeMode, config).render();
  }


  static status(isServeMode = false, config = {}) {
    return new StatusComponent(isServeMode, config).render();
  }

  static duplicateResources(duplicateResources, config = {}) {
    return new DuplicateResourceComponent(duplicateResources, config).render();
  }

  /**
   * 生成完整的构建报告
   */
  static fullReport(data, config = {}) {
    const { 
      themeInfo, 
      stats, 
      buildInfo, 
      processedAssets, 
      warnings, 
      errors, 
      isServeMode, 
      performanceAnalysis,
      duplicateResources 
    } = data;
    
    let output = '';
    
    // 主题横幅（优先显示）
    const bannerContent = this.banner(themeInfo, config);
    if (bannerContent) {
      output += bannerContent;
    }
    
    // 静态资源构建摘要
    const summaryContent = this.summary(stats, buildInfo, processedAssets, config);
    if (summaryContent) {
      output += '\n\n' + summaryContent;
    }

    // HTML页面统计（包含Aliases）
    if (buildInfo?.htmlStats) {
      const htmlStatsContent = this.htmlStats(
        buildInfo.htmlStats,
        buildInfo.aliasStats,  // 传入aliasStats一起显示
        config
      );
      if (htmlStatsContent) {
        output += '\n\n' + htmlStatsContent;
      }
    }

    // 重复资源检测
    if (duplicateResources && duplicateResources.length > 0) {
      const duplicateContent = this.duplicateResources(duplicateResources, config);
      if (duplicateContent) {
        output += '\n\n' + duplicateContent;
      }
    }

    // 警告和错误
    const warningsContent = this.warnings(warnings, errors, config);
    if (warningsContent) {
      output += '\n\n' + warningsContent;
    }

    // 服务器信息（仅在开发模式下）
    const serverInfoContent = this.serverInfo(isServeMode, config);
    if (serverInfoContent) {
      output += '\n\n' + serverInfoContent;
    }

    // 最终状态
    const statusContent = this.status(isServeMode, config);
    if (statusContent) {
      output += (serverInfoContent ? '\n' : '\n\n') + statusContent;
    }

    return output + (config.colors?.reset || '');
  }
}

/**
 * 🎯 增强的警告收集器 - 完整功能版本
 */
class EnhancedWarningCollector {
  constructor() {
    this.warnings = [];
    this.errors = [];
    this.duplicates = [];
    this.performance = [];
    this.startTime = Date.now();
  }

  addWarning(source, message) {
    this.warnings.push({ 
      source, 
      message, 
      timestamp: new Date(),
      category: this.categorizeWarning(source, message)
    });
    
    // 警告信息统一在最终报告中显示，不在此处输出
    // if (process.env.NODE_ENV !== 'production') {
    //   console.warn(`\x1b[33m⚠️  [${source}] ${message}\x1b[0m`);
    // }
  }

  addError(source, message) {
    this.errors.push({ 
      source, 
      message, 
      timestamp: new Date(),
      category: this.categorizeWarning(source, message)
    });
    console.error(`\x1b[31m❌ [${source}] ${message}\x1b[0m`);
  }

  addDuplicateResource(name, files) {
    this.duplicates.push({ name, files });
  }

  categorizeWarning(source, message) {
    if (source === 'WikilinkPlugin') return 'wikilink';
    if (message.includes('性能') || message.includes('performance')) return 'performance';
    if (message.includes('资源') || message.includes('asset')) return 'asset-processing';
    if (message.includes('模板') || message.includes('template')) return 'template';
    if (message.includes('配置') || message.includes('config')) return 'configuration';
    return 'unknown';
  }

  generateBuildStats(buildContext = {}) {
    // 生成构建统计信息
    const buildDuration = Date.now() - this.startTime;

    return {
      totalAssets: buildContext.totalAssets || 0,
      totalSize: buildContext.totalSize || 0,
      cacheEnabled: true,
      assetTypes: buildContext.assetTypes || { css: 1, js: 1 },
      buildDuration
    };
  }

  showFinalReport(buildContext = {}, themeInfo = {}) {
    const stats = this.generateBuildStats(buildContext);
    const buildInfo = {
      startTime: this.startTime,
      htmlStats: buildContext.htmlStats,
      aliasStats: buildContext.aliasStats
    };
    const processedAssets = buildContext.processedAssets || [];
    const isServeMode = buildContext.isServeMode || false;

    const reportData = {
      themeInfo,
      stats,
      buildInfo,
      processedAssets,
      warnings: this.warnings,
      errors: this.errors,
      isServeMode,
      duplicateResources: this.duplicates
    };

    const report = ReportTemplate.fullReport(reportData, buildConfig);
    console.log('\n' + '='.repeat(70));
    console.log(report);
    console.log('='.repeat(70) + '\n');
  }

  clear() {
    this.warnings = [];
    this.errors = [];
    this.duplicates = [];
    this.performance = [];
    this.startTime = Date.now();
  }
}

module.exports = {
  ReportTemplate,
  EnhancedWarningCollector,
  BannerComponent,
  SummaryComponent,
  HtmlStatsComponent,
  WarningsComponent,
  ServerInfoComponent,
  StatusComponent,
  DuplicateResourceComponent
};