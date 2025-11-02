const slugify = require("slugify");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const markdownItTaskLists = require("markdown-it-task-lists");
const markdownItObsidianCallouts = require("markdown-it-obsidian-callouts");
// 移除旧的语法高亮插件，改用Shiki
// const syntaxHighlight = require("@11ty/eleventy-plugin-syntaxhighlight");
const eleventyShikiPlugin = require("./src/eleventy-plugins/EleventyShikiPlugin.js");
const wikilinkPlugin = require("./src/eleventy-plugins/WikilinkPlugin.js");
const fs = require("fs");
const path = require("path");
const { minify: htmlMinify } = require("html-minifier-terser");

// 配置文件加载逻辑：优先读取 garden.config.js，不存在则使用 garden.config.js.example
let gardenConfig;
try {
  gardenConfig = require("./garden.config.js");
} catch (e) {
  if (e.code === 'MODULE_NOT_FOUND') {
    gardenConfig = require("./garden.config.js.example");
    console.log("📝 [Config] Using garden.config.js.example as fallback");
  } else {
    throw e;
  }
}

// 目录配置 - 统一管理
// 📋 重要：区分两个不同的"输入"概念
// 
// 1. Eleventy Input 目录 (见 return 配置中的 dir.input)
//    - 设为 "." (根目录)
//    - 让 Eleventy 同时读取 content/ 和 src/_templates/ 两个目录
//    - 实现内容与模板分离的架构
//
// 2. 内容文件目录 (下面的 inputDir 变量)  
//    - 指向 "content" 目录
//    - 专门存放用户的 markdown 内容文件
//    - 用于文件复制、集合创建、路径处理等操作
//
// 🎯 架构优势：
//    - content/ 目录纯净，只包含 .md 文件，适配 Obsidian
//    - src/_templates/ 存放系统模板文件(.njk)，不干扰用户内容
//    - 通过 eleventyComputed.permalink 自动移除 URL 中的 /content/ 前缀
const inputDir = "content";  // 内容目录 (用户 markdown 文件)
const outputDir = "_site";   // 输出目录

// 导入简化的资源构建器和完整的报告系统
const AssetBuilder = require("./src/build-tools/AssetBuilder.js");
const { EnhancedWarningCollector } = require("./src/build-tools/ReportingSystem.js");
const AliasesProcessor = require("./src/build-tools/AliasesProcessor.js");

// 初始化全局警告收集器（完整功能版本）
if (!global.buildWarningCollector) {
  global.buildWarningCollector = new EnhancedWarningCollector();
}

// 简化的时间处理辅助函数
function getArticleCreatedDate(article) {
  // 优先级：created -> date -> 文件创建时间
  if (article.data.created || article.data.date) {
    return article.data.created || article.data.date;
  }
  
  // 使用文件系统的创建时间作为fallback
  if (article.inputPath) {
    try {
      const stats = fs.statSync(article.inputPath);
      // 使用birthtime（创建时间），如果不可用则使用mtime（修改时间）
      const fileCreatedTime = stats.birthtime.getFullYear() > 1970 ? stats.birthtime : stats.mtime;
      return fileCreatedTime.toISOString().split('T')[0]; // 返回YYYY-MM-DD格式
    } catch (error) {
      // 如果文件不存在或读取失败，使用当前日期
      return new Date().toISOString().split('T')[0];
    }
  }
  
  return new Date().toISOString().split('T')[0];
}

function getArticleUpdatedDate(article) {
  // 优先级：updated -> date -> created -> 文件修改时间 -> 创建时间
  if (article.data.updated) {
    return article.data.updated;
  }
  
  if (article.data.date) {
    return article.data.date;
  }
  
  if (article.data.created) {
    return article.data.created;
  }
  
  // 使用文件系统的修改时间作为fallback
  if (article.inputPath) {
    try {
      const stats = fs.statSync(article.inputPath);
      return stats.mtime.toISOString().split('T')[0]; // 返回YYYY-MM-DD格式
    } catch (error) {
      // 如果文件不存在或读取失败，使用创建时间
      return getArticleCreatedDate(article);
    }
  }
  
  return getArticleCreatedDate(article);
}

// 图片搜索函数 - 在content目录中递归搜索图片
function findImagePath(imageName, contentDir = inputDir) {
  function searchDirectory(dir) {
    try {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // 递归搜索子目录
          const found = searchDirectory(fullPath);
          if (found) return found;
        } else if (file === imageName) {
          // 找到图片，返回相对于content的路径
          return fullPath.replace(contentDir + path.sep, "").replace(/\\/g, "/");
        }
      }
    } catch (err) {
      // 目录读取失败，忽略
    }
    return null;
  }
  
  return searchDirectory(contentDir);
}


// 添加全局数据以便在搜索数据生成和aliases处理时使用
let allCollections = {};

/**
 * 通用HTML统计函数 - 分析results生成统计信息
 * @param {Array} results - Eleventy构建结果数组
 * @param {Object} config - 配置对象
 * @returns {Object} 统计信息对象
 */
function generateHtmlStats(results, config = {}) {
  const htmlStats = {
    totalPages: results.length,
    totalSize: 0,
    sourceTypes: {},
    pageTypes: {},
    minified: config.minifyHtml || false
  };

  // 分析每个页面
  results.forEach(page => {
    // 计算文件大小
    if (page.content) {
      htmlStats.totalSize += Buffer.byteLength(page.content, 'utf8');
    }

    // 分析源文件类型
    if (page.inputPath) {
      const ext = path.extname(page.inputPath) || '.unknown';
      htmlStats.sourceTypes[ext] = (htmlStats.sourceTypes[ext] || 0) + 1;
    }

    // 分析页面类型（根据URL进行详细分类）
    if (page.url) {
      let type = 'default';
      if (page.url.includes('/theme-doc/')) {
        type = '主题文档';
      } else if (page.url.includes('/tags/')) {
        type = '标签页面';
      } else if (page.url.includes('/categories/')) {
        type = '分类页面';
      } else if (page.url === '/' || page.url.includes('index')) {
        type = '首页';
      } else if (page.url.includes('/404')) {
        type = '错误页面';
      } else if (page.inputPath && page.inputPath.endsWith('.md')) {
        type = '内容页面';
      } else if (page.inputPath && page.inputPath.endsWith('.njk')) {
        type = '模板页面';
      }

      htmlStats.pageTypes[type] = (htmlStats.pageTypes[type] || 0) + 1;
    }
  });

  return htmlStats;
}

module.exports = function(eleventyConfig) {
  // 🎨 主题配置信息 - 从package.json读取版本、名称和描述
  const packageJson = require('./package.json');
  
  // 从devDependencies提取主要技术栈
  const techStack = [];
  if (packageJson.devDependencies) {
    if (packageJson.devDependencies['@11ty/eleventy']) techStack.push('Eleventy');
    if (packageJson.devDependencies['esbuild']) techStack.push('ESBuild');
    if (packageJson.devDependencies['lightningcss']) techStack.push('LightningCSS');
  }
  
  const themeInfo = {
    designer: "微尘",
    website: "https://weichen.ink",
    name: packageJson.description || packageJson.name,
    version: packageJson.version,
    description: packageJson.description, // 使用package.json的description作为主要描述
    techStack: techStack.join(' + '), // 技术栈信息
    slogan: "让想法自由连接，让知识自然生长 🌱" // 主题理念
  };
  
  // 将主题信息添加到全局数据
  eleventyConfig.addGlobalData("themeInfo", themeInfo);
  
  // 检测是否为serve模式
  const isServeMode = process.argv.includes('--serve');
  
  // 初始化资源构建器
  const assetBuilder = new AssetBuilder({
    outputDir: outputDir,
    verbose: !isServeMode  // 只在build模式下显示详细信息
  });
  
  // 为资源构建器添加日志方法以保持兼容性
  assetBuilder.getLogger = () => ({
    collectExternalWarning: (source, message) => {
      global.buildWarningCollector.addWarning(source, message);
    },
    collectExternalError: (source, message) => {
      global.buildWarningCollector.addError(source, message);
    }
  });
  
  assetBuilder.showFinalReport = () => {
    global.buildWarningCollector.showFinalReport();
  };
  
  // 设置全局构建上下文用于报告系统
  global.buildContext = {
    isServeMode: isServeMode,
    totalAssets: 0,
    totalSize: 0,
    assetTypes: {},
    processedAssets: [],
    serverUrl: isServeMode ? 'http://localhost:8080' : null
  };
  
  // 设置全局主题信息
  global.themeInfo = themeInfo;

  // 在构建开始时清理缓存并预构建资源
  eleventyConfig.on('eleventy.before', async () => {
    // 重置警告收集器
    global.buildWarningCollector.clear();
    
    try {
      const wikilinkCaches = require('./src/eleventy-plugins/WikilinkPlugin.js');
      if (wikilinkCaches.clearCaches) {
        wikilinkCaches.clearCaches();
      }
    } catch (e) {
      // 忽略错误
    }
    
    // 预构建资源用于模板渲染
    try {
      const result = await assetBuilder.buildAll();
      
      // 更新构建上下文信息
      if (result) {
        global.buildContext.processedAssets = result.assets || [];
        global.buildContext.totalAssets = result.totalAssets || 0;
        global.buildContext.totalSize = result.totalSize || 0;
        global.buildContext.assetTypes = result.assetTypes || {};
        
        // 检测重复资源
        if (result.duplicates && result.duplicates.length > 0) {
          result.duplicates.forEach(duplicate => {
            global.buildWarningCollector.addDuplicateResource(duplicate.name, duplicate.files);
          });
        }
      }
    } catch (error) {
      global.buildWarningCollector.addError('AssetBuilder', `Asset pre-build failed: ${error.message}`);
    }
  });
  
  // 添加Shiki代码高亮插件
  eleventyConfig.addPlugin(eleventyShikiPlugin);
  
  // 添加Wikilink插件支持所有Obsidian链接格式
  eleventyConfig.addPlugin(wikilinkPlugin, {
    contentDir: inputDir
  });
  
  // 添加全局配置数据
  eleventyConfig.addGlobalData("garden", gardenConfig);
  
  // 标准化cssclasses处理 - 统一转换为空格分隔的字符串
  eleventyConfig.addFilter("cssclasses", function(cssclasses) {
    if (!cssclasses) return '';
    if (Array.isArray(cssclasses)) {
      return cssclasses.join(' ');
    }
    return cssclasses.toString();
  });
  
  // HTML压缩 - 根据配置文件决定是否启用
  if (gardenConfig.build && gardenConfig.build.minifyHtml) {
    eleventyConfig.addTransform("htmlMinifier", function(content, outputPath) {
      if (outputPath && outputPath.endsWith(".html")) {
        try {
          const minified = htmlMinify(content, {
            // 移除注释
            removeComments: true,
            removeCommentsFromCDATA: true,
            
            // 压缩空白字符
            collapseWhitespace: true,
            conservativeCollapse: false,
            
            // 移除冗余属性
            removeRedundantAttributes: true,
            removeScriptTypeAttributes: true,
            removeStyleLinkTypeAttributes: true,
            removeEmptyAttributes: true,
            
            // 优化HTML结构
            useShortDoctype: true,
            removeEmptyElements: false, // 避免破坏布局
            
            // 压缩内联CSS和JS
            minifyCSS: true,
            minifyJS: true,
            
            // 保持兼容性
            removeAttributeQuotes: false,
            preventAttributesEscaping: false
          });
          
          return minified;
        } catch (error) {
          console.warn(`HTML压缩失败 ${outputPath}:`, error.message);
          return content; // 压缩失败时返回原内容
        }
      }
      return content;
    });
    
  }
  
  // 添加内容目录配置
  eleventyConfig.addGlobalData("inputDir", inputDir);
  
  // ⚠️ 重要配置：为所有markdown文件设置默认布局
  // 这样content目录下的文件无需在frontmatter中指定layout
  // 可以保持content目录的纯净，专注内容创作
  // 如需修改默认布局，请修改下面的值，不要删除note.njk文件
  eleventyConfig.addGlobalData("layout", "note.njk");
  
  // 添加hash过滤器用于资源文件缓存清除
  eleventyConfig.addFilter("hash", function(assetPath) {
    // 从资源路径提取类型 (css/js)
    const assetType = assetPath.includes('css') ? 'css' : 'js';
    return assetBuilder.getAssetUrl(assetType) || assetPath;
  });
  
  // 添加分页配置过滤器
  eleventyConfig.addFilter("paginationConfig", (key) => {
    return gardenConfig.pagination && gardenConfig.pagination[key];
  });
  
  // 添加数学运算过滤器
  eleventyConfig.addFilter("int", (value) => {
    return parseInt(value) || 0;
  });
  
  eleventyConfig.addFilter("ceil", (value) => {
    return Math.ceil(value);
  });
  
  eleventyConfig.addFilter("slice", (array, start, end) => {
    return array.slice(start, end);
  });
  
  // 添加range过滤器用于循环
  eleventyConfig.addFilter("range", (start, end) => {
    const result = [];
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return result;
  });
  
  // 静态文件复制 - 排除需要处理的CSS和JS文件
  eleventyConfig.addPassthroughCopy({
    "src/assets/images": "src/assets/images",
    "src/assets/fonts": "src/assets/fonts",
    "src/assets/favicon": "src/assets/favicon",
    "src/assets/css/highlight-themes": "src/assets/css/highlight-themes",
    "src/runtime/colors.config.js": "src/runtime/colors.config.js"
  });
  eleventyConfig.addPassthroughCopy("src/admin/");
  
  // 添加模板文件处理 - 确保src/_templates中的.njk文件被正确处理
  // 由于改为根目录输入，模板文件会被自动发现和处理
  
  // 📷 复制内容目录下的图片文件 (使用 inputDir 变量，指向用户内容目录)
  eleventyConfig.addPassthroughCopy(`${inputDir}/**/*.{jpg,jpeg,png,gif,svg,webp}`);
  
  // Canvas文件将通过Markdown文件处理，无需额外配置
  
  // 👀 监听文件变化 - 开发时自动重新构建
  eleventyConfig.addWatchTarget("src/assets/");        // 监听主题资源文件
  eleventyConfig.addWatchTarget(`${inputDir}/`);       // 监听用户内容目录 (content/)
  eleventyConfig.addWatchTarget("src/assets/css/custom/"); // 监听自定义CSS
  
  // 先定义自定义slug函数
  const customSlug = (str) => {
    if (!str) return '';
    
    const cleanStr = str.toString().trim();
    
    // 自定义中文友好的slug生成逻辑
    const result = cleanStr
      .replace(/^\d+\.\s*/, '')                    // 移除开头的数字序号（如"1. "）
      .replace(/[<>:"\/\\|?*#\[\]]/g, '')          // 移除特殊字符
      .replace(/[\s\u3000]+/g, '-')                // 空格和中文空格转为连字符
      .replace(/[，。！？；：""''（）【】]/g, '')        // 移除中文标点
      .replace(/^-+|-+$/g, '')                     // 移除开头和结尾的连字符
      .replace(/-+/g, '-')                         // 合并多个连字符
      || 'untitled';                               // 如果结果为空，使用默认值
    
    return result;
  };

  // Markdown配置 - 禁用linkify，只处理标准markdown链接
  let markdownLibrary = markdownIt({
    html: true,
    breaks: true,
    linkify: false  // 禁用自动链接，只处理标准markdown链接格式
  }).use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.ariaHidden({
      placement: "after",
      class: "direct-link",
      symbol: "#",
    }),
    level: [1,2,3,4],
    slugify: customSlug
  }).use(markdownItTaskLists, {
    enabled: true,
    label: true,
    labelAfter: false
  }).use(markdownItObsidianCallouts);
  
  eleventyConfig.setLibrary("md", markdownLibrary);
  
  // 自定义过滤器
  eleventyConfig.addFilter("slug", customSlug);
  
  // 限制数组元素数量
  eleventyConfig.addFilter("limit", (array, limit) => {
    return array.slice(0, limit);
  });
  
  // 获取文章创建日期的过滤器
  eleventyConfig.addFilter("getCreatedDate", (article) => {
    return getArticleCreatedDate(article);
  });
  
  // 获取文章更新日期的过滤器
  eleventyConfig.addFilter("getUpdatedDate", (article) => {
    return getArticleUpdatedDate(article);
  });
  
  // 首页配置过滤器
  eleventyConfig.addFilter("homepageConfig", (key) => {
    return gardenConfig.homepage && gardenConfig.homepage[key];
  });
  
  // 字符串分割过滤器
  eleventyConfig.addFilter("split", (str, separator) => {
    if (typeof str !== 'string') return [];
    return str.split(separator);
  });
  
  // 获取数组最后一个元素
  eleventyConfig.addFilter("last", (array) => {
    if (!Array.isArray(array) || array.length === 0) return '';
    return array[array.length - 1];
  });
  
  // 根据文件路径查找文章
  eleventyConfig.addFilter("getByInputPath", (collection, targetPath) => {
    if (!collection || !targetPath) return null;
    return collection.find(item => item.inputPath === targetPath);
  });
  
  // 按创建时间排序
  eleventyConfig.addFilter("sortByCreated", (collection) => {
    return collection.sort((a, b) => {
      const aCreated = getArticleCreatedDate(a);
      const bCreated = getArticleCreatedDate(b);
      
      const aDate = new Date(aCreated);
      const bDate = new Date(bCreated);
      
      return bDate - aDate; // 降序排列（最新的在前）
    });
  });
  
  // 按更新时间排序
  eleventyConfig.addFilter("sortByUpdated", (collection) => {
    return collection.sort((a, b) => {
      const aUpdated = getArticleUpdatedDate(a);
      const bUpdated = getArticleUpdatedDate(b);
      
      const aDate = new Date(aUpdated);
      const bDate = new Date(bUpdated);
      
      return bDate - aDate; // 降序排列（最新的在前）
    });
  });
  
  // 日期格式化过滤器
  eleventyConfig.addFilter("date", (date, format) => {
    const d = new Date(date);
    if (format === "YYYY-MM-DD") {
      return d.toISOString().split('T')[0];
    } else if (format === "YYYY年MM月DD日") {
      return `${d.getFullYear()}年${(d.getMonth() + 1).toString().padStart(2, '0')}月${d.getDate().toString().padStart(2, '0')}日`;
    } else if (format === "MM-DD") {
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    }
    return d.toLocaleDateString();
  });

  // 添加formatDate过滤器作为date过滤器的别名
  eleventyConfig.addFilter("formatDate", (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}年${(d.getMonth() + 1).toString().padStart(2, '0')}月${d.getDate().toString().padStart(2, '0')}日`;
  });

  
  // 提取内容中的标题
  eleventyConfig.addFilter("extractHeadings", (content) => {
    if (!content) return [];
    
    // 匹配markdown标题
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    const headings = [];
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      headings.push({
        level: level,
        text: text,
        id: slugify(text, { lower: true, strict: true })
      });
    }
    
    return headings;
  });
  
  // 检查内容是否有标题 - 检查文章内容区域的标题
  eleventyConfig.addFilter("hasHeadings", (content) => {
    if (!content) return false;
    
    // 检查markdown格式的标题 (h1-h6, 支持所有级别)
    const markdownHeadingRegex = /^#{1,6}\s+.+$/gm;
    const hasMarkdownHeadings = markdownHeadingRegex.test(content);
    
    if (hasMarkdownHeadings) {
      const matches = content.match(markdownHeadingRegex);
      return matches && matches.some(match => match.replace(/^#+\s*/, '').trim().length > 0);
    }
    
    // 检查HTML格式的标题 (h1-h6)
    const htmlHeadingRegex = /<h[1-6][^>]*>.*?<\/h[1-6]>/gi;
    const hasHtmlHeadings = htmlHeadingRegex.test(content);
    
    if (hasHtmlHeadings) {
      const matches = content.match(htmlHeadingRegex);
      // 过滤掉页面主标题和导航标题
      const validHeadings = matches.filter(match => {
        const titleText = match.replace(/<[^>]*>/g, '').trim();
        return titleText && 
               !match.includes('class="note-title"') &&
               !match.includes('class="site-title"') &&
               !titleText.includes('📋 目录') && 
               !titleText.includes('🔗 反向链接');
      });
      return validHeadings.length > 0;
    }
    
    return false;
  });
  
  // 注意: wikilink过滤器已移至 WikilinkPlugin.js
  
  // 外部链接过滤器 - 为外部链接添加class
  eleventyConfig.addFilter("externalLinks", function(content) {
    if (!content) return content;
    
    // 首先处理Obsidian风格的图片
    content = content.replace(/<img src="([^"]*)" alt="([^"]*)">/g, (match, src, alt) => {
      // 检查alt是否包含尺寸信息 (alt|width格式)
      const altParts = alt.split('|');
      const actualAlt = altParts[0];
      const width = altParts[1];
      
      // 检查是否为图片文件
      const imageExtensions = /\.(jpg|jpeg|png|gif|svg|webp)$/i;
      if (!imageExtensions.test(src)) {
        return match; // 不是图片，保持原样
      }
      
      // 构建图片路径 - 如果是相对路径，搜索实际位置
      let imagePath = src;
      if (!src.startsWith('/') && !src.startsWith('http')) {
        const foundImagePath = findImagePath(src);
        if (foundImagePath) {
          // 由于input目录是content，所以生成的路径需要去掉content前缀
          imagePath = `/${foundImagePath}`;
        } else {
          imagePath = `/${src}`; // 保持原始路径作为fallback
        }
      }
      
      // 构建img标签
      let imgTag = `<img src="${imagePath}" alt="${actualAlt}" class="content-image"`;
      
      // 添加宽度样式
      if (width && /^\d+$/.test(width)) {
        imgTag += ` style="max-width: ${width}px; height: auto;"`;
      }
      
      imgTag += '>';
      return imgTag;
    });
    
    // 为外部链接添加class和target属性
    return content.replace(/<a href="(https?:\/\/[^"]*)"([^>]*)>/g, (match, url, attrs) => {
      // 跳过已经处理过的链接
      if (attrs.includes('class="external-link"') || attrs.includes('class="internal-link"')) {
        return match;
      }
      
      return `<a href="${url}" class="external-link" target="_blank" rel="noopener noreferrer"${attrs}>`;
    });
  });
  
  
  // Markdown渲染过滤器
  eleventyConfig.addFilter("markdown", function(content) {
    if (!content) return content;
    return markdownLibrary.render(content);
  });
  
  // 获取反向链接
  eleventyConfig.addFilter("backlinks", function(collections, currentNote) {
    try {
      if (!currentNote || !collections) return [];
      
      const backlinks = [];
      // 优先使用文件名，如果没有文件名才使用title
      const currentFilename = currentNote.fileSlug && currentNote.fileSlug.split('/').pop();
      const currentTitle = (currentNote.data && currentNote.data.title);
      
      // 需要检查的搜索词：优先文件名，然后title
      const searchTerms = [];
      if (currentFilename) searchTerms.push(currentFilename);
      if (currentTitle && currentTitle !== currentFilename) searchTerms.push(currentTitle);
      
      if (searchTerms.length === 0) return [];
      
      const contentItems = collections.content || [];
      
      contentItems.forEach(note => {
        try {
          if (!note || note.url === currentNote.url) return;
          
          // 使用原始内容来查找wikilink，而不是渲染后的HTML
          let content = '';
          if (note.rawInput) {
            content = note.rawInput;
          } else if (note.content) {
            content = note.content;
          } else if (note.templateContent) {
            content = note.templateContent;
          }
          
          if (!content) return;
          
          // 检查内容是否包含任何搜索词的双链
          let foundTerm = null;
          for (const term of searchTerms) {
            // 转义特殊字符以避免正则表达式错误
            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // 支持两种双链格式：[[term]] 和 [[term|display]]
            const regex = new RegExp(`\\[\\[${escapedTerm}(?:\\|[^\\]]*)?\\]\\]`, 'gi');
            const matches = content.match(regex);
            if (matches) {
              // 检查匹配的双链不是图片格式（前面没有!）
              const hasValidMatch = matches.some(match => {
                const matchIndex = content.indexOf(match);
                return matchIndex === 0 || content[matchIndex - 1] !== '!';
              });
              
              if (hasValidMatch) {
                foundTerm = term;
                break;
              }
            }
          }
          
          
          if (foundTerm) {
            // 使用和wikilink过滤器相同的标题逻辑
            const noteTitle = (note.data && note.data.title) || 
                             (note.fileSlug && note.fileSlug.split('/').pop()) || 
                             'Untitled';
            
            backlinks.push({
              title: noteTitle,
              url: note.url || '#',
              excerpt: getExcerpt(content, foundTerm, collections)
            });
          }
        } catch (err) {
          // 静默处理错误，避免影响构建
          // console.warn('Error processing note for backlinks:', err);
        }
      });
      
      return backlinks;
    } catch (err) {
      console.warn('Error in backlinks filter:', err);
      return [];
    }
  });
  
  // 获取摘录
  function getExcerpt(content, searchTerm, collections) {
    if (!content) return '';

    // 移除HTML标签，获取纯文本内容
    let cleanContent = content
      .replace(/<[^>]*>/g, '') // 移除所有HTML标签
      .replace(/#+\s*/g, '') // 移除markdown标题语法 (# ## ### 等)，包括行中的#
      .replace(/\n/g, ' ') // 替换换行符
      .replace(/\s+/g, ' ') // 合并多个空格
      .trim();

    // 先处理双链 - 将 [[filename]] 或 [[filename|display]] 转换为显示文本
    // 为来自双链的文本添加特殊标记，方便后续识别
    cleanContent = cleanContent.replace(/\[\[([^\]]+)\]\]/g, (match, content) => {
      // 解析双链内容，支持 [[filename]] 和 [[filename|display]] 格式
      const parts = content.split('|');
      const filename = parts[0].trim();
      const displayText = parts.length > 1 ? parts[1].trim() : null;

      // 如果有显示文本，使用显示文本；否则查找对应的笔记标题
      if (displayText) {
        // 对于 [[filename|display]] 格式，直接使用显示文本
        return `⟪WIKILINK:${displayText}⟫`;
      } else {
        // 对于 [[filename]] 格式，查找对应的笔记，使用和wikilink过滤器完全相同的逻辑
        let targetNote = null;
        if (collections && collections.content) {
          // 首先尝试通过文件名匹配（使用inputPath）
          targetNote = collections.content.find(note => {
            if (!note.inputPath) return false;
            const pathParts = note.inputPath.split('/');
            const noteFilename = pathParts[pathParts.length - 1].replace('.md', '');
            return noteFilename === filename;
          });

          // 如果通过文件名没找到，尝试通过title匹配
          if (!targetNote) {
            targetNote = collections.content.find(note =>
              note.data && note.data.title === filename
            );
          }
        }

        // 使用和wikilink过滤器相同的标题逻辑
        const resolvedTitle = targetNote ?
          ((targetNote.data && targetNote.data.title) ||
           (targetNote.fileSlug && targetNote.fileSlug.split('/').pop()) ||
           filename) : filename;

        // 为来自双链的文本添加特殊标记
        return `⟪WIKILINK:${resolvedTitle}⟫`;
      }
    });

    // 优先查找双链标记内的搜索词位置
    const lowerSearchTerm = searchTerm.toLowerCase();
    let searchIndex = -1;
    const wikilinkPattern = /⟪WIKILINK:([^⟫]*)⟫/gi;
    let match;

    // 先在所有双链标记中查找搜索词
    while ((match = wikilinkPattern.exec(cleanContent)) !== null) {
      const wikilinkText = match[1];
      if (wikilinkText.toLowerCase().includes(lowerSearchTerm)) {
        // 找到包含搜索词的双链，使用这个位置
        searchIndex = match.index;
        break;
      }
    }

    // 如果在双链中没找到，再查找普通文本中的搜索词
    if (searchIndex === -1) {
      const lowerContent = cleanContent.toLowerCase();
      searchIndex = lowerContent.indexOf(lowerSearchTerm);
    }
    
    if (searchIndex !== -1) {
      // 找到搜索词的位置，提取前后文本作为摘录
      const contextBefore = 50; // 前文字符数
      const contextAfter = 70;  // 后文字符数
      
      const start = Math.max(0, searchIndex - contextBefore);
      const end = Math.min(cleanContent.length, searchIndex + searchTerm.length + contextAfter);
      
      let excerpt = cleanContent.substring(start, end).trim();
      
      // 如果不是从开头开始，添加省略号
      if (start > 0) {
        excerpt = '...' + excerpt;
      }
      
      // 如果不是到结尾，添加省略号
      if (end < cleanContent.length) {
        excerpt = excerpt + '...';
      }
      
      // 智能高亮显示搜索词 - 只高亮来自双链的文本
      let highlighted = excerpt;
      
      // 查找所有来自双链的标记文本
      const wikilinkPattern = new RegExp(`⟪WIKILINK:([^⟫]*)⟫`, 'gi');
      highlighted = highlighted.replace(wikilinkPattern, (match, wikilinkText) => {
        // 检查这个双链文本是否包含搜索词
        if (wikilinkText.toLowerCase().includes(searchTerm.toLowerCase())) {
          // 高亮双链中的搜索词
          const highlightedWikilink = wikilinkText.replace(new RegExp(searchTerm, 'gi'), 
            `<mark class="backlink-highlight">${searchTerm}</mark>`);
          return highlightedWikilink;
        }
        // 如果不包含搜索词，直接返回原文本（移除标记）
        return wikilinkText;
      });
      
      // 最后清理掉所有剩余的特殊标记
      highlighted = highlighted.replace(/⟪WIKILINK:([^⟫]*)⟫/g, '$1');
      
      return highlighted;
    }
    
    // 如果没找到匹配段落，返回内容开头
    if (cleanContent.length > 100) {
      return cleanContent.substring(0, 100) + '...';
    }
    return cleanContent;
  }
  
  
  // 📚 集合配置 - 包含所有内容文件（包括子目录）
  // 注意：这里使用 inputDir 变量来引用用户内容目录，而不是 Eleventy 的输入目录
  eleventyConfig.addCollection("content", function(collectionApi) {
    const mdCollection = collectionApi.getFilteredByGlob(`${inputDir}/**/*.md`) // 扫描用户内容目录下的所有 .md 文件
      .filter(item => !item.data.eleventyExcludeFromCollections); // 排除被标记为排除的文件
    // 保存到全局变量以便搜索数据生成时使用
    allCollections.content = mdCollection;
    return mdCollection;
  });
  
  // 所有内容集合，包括首页
  eleventyConfig.addCollection("all", function(collectionApi) {
    const mdCollection = collectionApi.getFilteredByGlob(`${inputDir}/**/*.md`);
    // 保存到全局变量以便aliases处理时使用
    allCollections.all = mdCollection;
    return mdCollection;
  });


  // 自动识别文件夹 - 为每个content下的子文件夹生成页面
  eleventyConfig.addCollection("folderList", function(collectionApi) {
    const folderSet = new Set();
    
    // 获取所有markdown文件
    collectionApi.getFilteredByGlob(`${inputDir}/**/*.md`).forEach(item => {
      if (item.inputPath) {
        // 提取文件夹路径 - 处理绝对路径
        const pathParts = item.inputPath.split('/');
        const contentIndex = pathParts.indexOf(inputDir);
        
        if (contentIndex >= 0 && pathParts.length > contentIndex + 2) {
          const folderName = pathParts[contentIndex + 1];
          // 排除特殊文件夹或文件
          if (!folderName.startsWith('.') && !folderName.startsWith('_') && 
              folderName !== 'tags' && folderName !== 'folders') {
            folderSet.add(folderName);
          }
        }
      }
    });
    
    return [...folderSet].sort();
  });

  // 为每个文件夹创建文章集合
  eleventyConfig.addCollection("postsByFolder", function(collectionApi) {
    const folderMap = {};
    
    collectionApi.getFilteredByGlob(`${inputDir}/**/*.md`).forEach(item => {
      if (item.inputPath && !item.data.eleventyExcludeFromCollections) {
        // 提取文件夹路径 - 处理绝对路径
        const pathParts = item.inputPath.split('/');
        const contentIndex = pathParts.indexOf(inputDir);
        
        if (contentIndex >= 0 && pathParts.length > contentIndex + 2) {
          const folderName = pathParts[contentIndex + 1];
          const fileName = pathParts[pathParts.length - 1].replace('.md', '');
          
          // 排除特定文件夹和_index.md文件
          if (!folderName.startsWith('.') && 
              fileName !== '_index' &&
              folderName !== 'tags' && folderName !== 'categories' && folderName !== 'folders') {
            if (!folderMap[folderName]) {
              folderMap[folderName] = [];
            }
            folderMap[folderName].push(item);
          }
        }
      }
    });
    
    // 按日期排序每个文件夹的文章
    Object.keys(folderMap).forEach(folder => {
      folderMap[folder].sort((a, b) => {
        const dateA = getArticleUpdatedDate(a);
        const dateB = getArticleUpdatedDate(b);
        return new Date(dateB) - new Date(dateA);
      });
    });
    
    return folderMap;
  });



  // 标签集合 - 生成所有标签的列表
  eleventyConfig.addCollection("tagList", function(collectionApi) {
    const tagSet = new Set();
    
    collectionApi.getAll().forEach(item => {
      if (item.data) {
        // 支持单数 tag 字段
        if (item.data.tag && typeof item.data.tag === 'string') {
          tagSet.add(item.data.tag.trim());
        }
        // 支持复数 tags 字段
        if (item.data.tags) {
          const tags = Array.isArray(item.data.tags) ? item.data.tags : [item.data.tags];
          tags.filter(tag => tag && typeof tag === 'string').forEach(tag => {
            tagSet.add(tag.trim());
          });
        }
      }
    });
    
    return Array.from(tagSet).sort();
  });

  // 按标签分组的文章集合
  eleventyConfig.addCollection("postsByTag", function(collectionApi) {
    const tagMap = {};
    
    collectionApi.getAll().forEach(item => {
      // 只处理内容文章，排除_index.md文件
      if (item.inputPath && item.inputPath.includes(`/${inputDir}/`) && 
          item.inputPath.endsWith('.md') && item.data && 
          (item.data.tag || item.data.tags)) {
        
        const fileName = item.inputPath.split('/').pop();
        if (fileName === '_index.md') {
          return; // 跳过所有_index.md文件
        }
        
        // 获取所有标签
        let tags = [];
        if (item.data.tag && typeof item.data.tag === 'string') {
          tags.push(item.data.tag.trim());
        }
        if (item.data.tags) {
          const itemTags = Array.isArray(item.data.tags) ? item.data.tags : [item.data.tags];
          tags = tags.concat(itemTags.filter(tag => tag && typeof tag === 'string').map(tag => tag.trim()));
        }
        
        // 将文章添加到每个标签中
        tags.forEach(tagKey => {
          if (!tagMap[tagKey]) {
            tagMap[tagKey] = [];
          }
          tagMap[tagKey].push(item);
        });
      }
    });
    
    // 按日期排序每个标签下的文章
    Object.keys(tagMap).forEach(tag => {
      tagMap[tag].sort((a, b) => {
        const dateA = getArticleUpdatedDate(a);
        const dateB = getArticleUpdatedDate(b);
        return new Date(dateB) - new Date(dateA);
      });
    });
    
    return tagMap;
  });

  // 分类集合 - 生成所有分类的列表
  eleventyConfig.addCollection("categoryList", function(collectionApi) {
    const categorySet = new Set();
    
    collectionApi.getAll().forEach(item => {
      if (item.data) {
        // 支持单数 category 字段
        if (item.data.category && typeof item.data.category === 'string') {
          categorySet.add(item.data.category.trim());
        }
        // 支持复数 categories 字段
        if (item.data.categories) {
          const categories = Array.isArray(item.data.categories) ? item.data.categories : [item.data.categories];
          categories.filter(cat => cat && typeof cat === 'string').forEach(cat => {
            categorySet.add(cat.trim());
          });
        }
      }
    });
    
    return Array.from(categorySet).sort();
  });

  // 按分类分组的文章集合
  eleventyConfig.addCollection("postsByCategory", function(collectionApi) {
    const categoryMap = {};
    
    collectionApi.getAll().forEach(item => {
      // 只处理内容文章，排除_index.md文件
      if (item.inputPath && item.inputPath.includes(`/${inputDir}/`) && 
          item.inputPath.endsWith('.md') && item.data && 
          (item.data.category || item.data.categories)) {
        
        const fileName = item.inputPath.split('/').pop();
        if (fileName === '_index.md') {
          return; // 跳过所有_index.md文件
        }
        
        // 获取所有分类
        let categories = [];
        if (item.data.category && typeof item.data.category === 'string') {
          categories.push(item.data.category.trim());
        }
        if (item.data.categories) {
          const cats = Array.isArray(item.data.categories) ? item.data.categories : [item.data.categories];
          categories = categories.concat(cats.filter(cat => cat && typeof cat === 'string').map(cat => cat.trim()));
        }
        
        // 将文章添加到每个分类中
        categories.forEach(categoryKey => {
          if (!categoryMap[categoryKey]) {
            categoryMap[categoryKey] = [];
          }
          categoryMap[categoryKey].push(item);
        });
      }
    });
    
    // 按日期排序每个分类下的文章
    Object.keys(categoryMap).forEach(category => {
      categoryMap[category].sort((a, b) => {
        const dateA = getArticleUpdatedDate(a);
        const dateB = getArticleUpdatedDate(b);
        return new Date(dateB) - new Date(dateA);
      });
    });
    
    return categoryMap;
  });

  // 为每个标签动态添加页面
  eleventyConfig.addGlobalData('eleventyComputed', {
    dynamicTagPages: (data) => {
      // 这将在运行时计算
      return {};
    }
  });

  // 在构建完成后生成搜索数据和处理自定义CSS
  eleventyConfig.on('eleventy.after', async ({dir, results, runMode, outputMode}) => {
    // 使用通用函数收集HTML文件构建统计
    const htmlStats = generateHtmlStats(results, gardenConfig.build || {});

    // 生成搜索数据JSON文件（仅当搜索功能启用时）
    if (gardenConfig.search && gardenConfig.search.enabled) {
      const searchDataPath = path.join(dir.output, 'search-data.json');
      
      try {
      // 收集所有内容页面
      const searchData = {
        notes: [],
        generated: new Date().toISOString().split('T')[0]
      };
      
      // 直接使用已过滤的content集合，避免复杂的排除逻辑
      if (allCollections.content) {
        allCollections.content.forEach(note => {
          const result = results.find(r => r.inputPath === note.inputPath);
          if (!result) return;
          
          const content = result.content || '';
          
          // 提取纯文本内容用于搜索
          let textContent = content;
          
          // 移除头部和尾部的HTML结构，只保留主要内容
          const contentMatch = content.match(/<article[^>]*class="main-article"[^>]*>(.*?)<\/article>/s);
          if (contentMatch) {
            textContent = contentMatch[1];
          }
          
          textContent = textContent
            .replace(/<[^>]*>/g, '') // 移除HTML标签
            // 保留双链语法 [[]] - 不移除，保持原始形式
            .replace(/&#x27;/g, "'") // 解码HTML实体
            .replace(/&quot;/g, '"') // 解码HTML实体
            .replace(/&amp;/g, '&') // 解码HTML实体
            .replace(/&lt;/g, '<') // 解码HTML实体
            .replace(/&gt;/g, '>') // 解码HTML实体
            .replace(/&#x26;/g, '&') // 解码&的HTML实体
            .replace(/&nbsp;/g, ' ') // 解码空格实体
            .replace(/&#x[\dA-Fa-f]+;/g, '') // 移除十六进制HTML实体
            .replace(/&#\d+;/g, '') // 移除数字HTML实体
            .replace(/&[a-zA-Z]+;/g, '') // 移除命名HTML实体
            .replace(/\uFFFD/g, '') // 移除替换字符（菱形问号）
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // 移除零宽字符
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // 移除控制字符
            .replace(/\n/g, ' ') // 替换换行符
            .replace(/\r/g, ' ') // 替换回车符
            .replace(/\s+/g, ' ') // 合并多个空格
            .trim();
          
          // 获取标题 - 优先文件名，用于索引匹配
          const filename = result.inputPath ? path.basename(result.inputPath, '.md') : 'Untitled';
          const title = filename; // 搜索索引使用文件名作为主要标识符
          const displayTitle = note.data.title || filename; // displayTitle用于显示
          
          // 获取URL
          const url = result.url || '/';
          
          // 获取摘要
          const excerpt = note.data.description || note.data.excerpt || '';
          
          searchData.notes.push({
            title: title, // 使用文件名作为搜索标识符
            displayTitle: displayTitle, // 用于显示的标题
            url: url,
            content: textContent,
            excerpt: excerpt
          });
        });
      }
      
      // 写入搜索数据文件
      fs.writeFileSync(searchDataPath, JSON.stringify(searchData, null, 2), 'utf8');
        console.log(`[Search] Generated search data with ${searchData.notes.length} pages`);
        
      } catch (error) {
        console.error('[Search] Error generating search data:', error);
      }
    }

    // 🏗️ 构建静态资源文件
    try {
      await assetBuilder.buildAll();

      if (!isServeMode) {
        console.log('🎉 Assets processed successfully');
      }

    } catch (error) {
      console.error('❌ Asset processing failed:', error.message);
    }

    // 🔗 处理页面别名 (Aliases) - 仅在serve模式下处理
    if (isServeMode) {
      try {
        const aliasProcessor = new AliasesProcessor(
          dir.output,
          global.buildWarningCollector
        );

        const aliasStats = await aliasProcessor.processAliases(allCollections);

        // 将统计信息添加到全局构建上下文
        if (global.buildContext) {
          global.buildContext.aliasStats = aliasStats;
        }

      } catch (error) {
        console.error('❌ Aliases处理失败:', error.message);
        if (error.stack) {
          console.error(error.stack);
        }
      }
    }
  });
  
  // 自动处理文件夹索引页面和标签/分类页面
  eleventyConfig.on('beforeBuild', async () => {
    try {
      // 1. 处理文件夹索引页面
      const folderList = ['post', 'article'];
      
      for (const folderName of folderList) {
        const indexPath = path.join(inputDir, folderName, '_index.md'); // 使用配置的内容目录
        
        // 检查是否存在 _index.md
        if (fs.existsSync(indexPath)) {
          try {
            const indexFile = fs.readFileSync(indexPath, 'utf8');
            
            // 检查文件是否已经有正确的 frontmatter
            if (!indexFile.includes('layout: article-list.njk') || !indexFile.includes('hideSidebar: true') || !indexFile.includes('permalink:')) {
              // 解析现有的 frontmatter
              const lines = indexFile.split('\n');
              let inFrontmatter = false;
              let frontmatterEnd = -1;
              
              for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim() === '---') {
                  if (!inFrontmatter) {
                    inFrontmatter = true;
                  } else {
                    frontmatterEnd = i;
                    break;
                  }
                }
              }
              
              // 构建新的 frontmatter
              let newFrontmatter = '---\n';
              let title = `${folderName}`;
              let description = `${folderName} 文件夹中的所有文章`;
              
              // 保留现有的 title 和 description
              if (frontmatterEnd > 0) {
                for (let i = 1; i < frontmatterEnd; i++) {
                  const line = lines[i];
                  if (line.startsWith('title:')) {
                    title = line.replace('title:', '').trim().replace(/"/g, '');
                  } else if (line.startsWith('description:')) {
                    description = line.replace('description:', '').trim().replace(/"/g, '');
                  }
                }
              }
              
              newFrontmatter += `title: "${title}"\n`;
              newFrontmatter += `description: "${description}"\n`;
              newFrontmatter += `layout: article-list.njk\n`;
              newFrontmatter += `hideSidebar: true\n`;
              newFrontmatter += `listType: "folder"\n`;
              newFrontmatter += `permalink: /${folderName}/\n`;
              newFrontmatter += '---\n';
              
              // 获取内容部分
              let content = '';
              if (frontmatterEnd > 0) {
                content = lines.slice(frontmatterEnd + 1).join('\n');
              } else {
                content = indexFile;
              }
              
              const newContent = newFrontmatter + content;
              fs.writeFileSync(indexPath, newContent, 'utf8');
              console.log(`[Folder Index] Updated ${indexPath}`);
            }
          } catch (err) {
            console.log(`[Folder Index] Could not process ${indexPath}:`, err.message);
          }
        }
      }

      // 标签和分类页面现在通过 src/tags.njk 和 src/categories.njk 动态生成
      // 不再需要自动创建文件到 content 文件夹
      
    } catch (error) {
      console.error('[Auto Generate] Error processing pages:', error);
    }
  });

  // 配置多个输入目录
  eleventyConfig.addGlobalData("templateDir", "src/_templates");
  
  // 🏷️ 从 _tags.md 和 _categories.md 提取taxonomy配置
  eleventyConfig.addGlobalData("taxonomyConfig", async () => {
    const fs = require('fs');
    const path = require('path');
    const matter = require('gray-matter');
    
    const config = {};
    
    try {
      // 读取标签配置
      const tagsPath = path.join(inputDir, '_tags.md');
      if (fs.existsSync(tagsPath)) {
        const tagsContent = fs.readFileSync(tagsPath, 'utf8');
        const tagsMatter = matter(tagsContent);
        config.tags = tagsMatter.data;
      }
      
      // 读取分类配置
      const categoriesPath = path.join(inputDir, '_categories.md');
      if (fs.existsSync(categoriesPath)) {
        const categoriesContent = fs.readFileSync(categoriesPath, 'utf8');
        const categoriesMatter = matter(categoriesContent);
        config.categories = categoriesMatter.data;
      }
    } catch (error) {
      console.warn('Warning: Could not load taxonomy config:', error);
    }
    
    return config;
  });
  
  // 🔗 为内容目录下的文件设置永久链接，避免URL中的内容目录前缀
  // 这是实现内容与模板分离架构的关键部分
  eleventyConfig.addGlobalData("eleventyComputed", {
    permalink: (data) => {
      // 如果文件明确设置了permalink，优先使用
      if (data.permalink) {
        return data.permalink;
      }
      
      // 如果是内容目录下的文件，移除内容目录前缀
      const contentPrefix = `./${inputDir}/`;
      if (data.page.inputPath && data.page.inputPath.startsWith(contentPrefix)) {
        const pathWithoutContent = data.page.inputPath.replace(contentPrefix, '');
        const pathParts = pathWithoutContent.split('/');
        const filename = pathParts[pathParts.length - 1].replace('.md', '');
        
        // 特殊处理根目录文件
        if (pathParts.length === 1) {
          if (filename === '_index') return '/';
          if (filename === '_404') return '/404.html';
          return `/${filename}/`;
        }
        
        // 子目录文件
        const dir = pathParts.slice(0, -1).join('/');
        if (filename === '_index') return `/${dir}/`;
        return `/${dir}/${filename}/`;
      }
      
      // 其他文件保持默认行为
      return data.permalink;
    }
  });

  // serve模式下的特殊处理：等Eleventy输出服务器信息后再显示报告
  if (isServeMode) {
    eleventyConfig.on('eleventy.after', ({ results }) => {
      // 在serve模式下，延迟一点时间让Eleventy的服务器启动信息先输出
      setTimeout(() => {
        // 更新HTML统计信息（使用通用函数）
        if (results && results.length > 0) {
          // 保留已有的 aliasStats，只更新 htmlStats
          const existingAliasStats = global.buildContext.aliasStats;

          global.buildContext.htmlStats = generateHtmlStats(results, gardenConfig.build || {});

          // 恢复 aliasStats（如果有的话）
          if (existingAliasStats) {
            global.buildContext.aliasStats = existingAliasStats;
          }
        }

        // 手动触发WikilinkPlugin的重复检测（确保在报告之前）
        try {
          const wikilinkPlugin = require('./src/eleventy-plugins/WikilinkPlugin.js');
          if (wikilinkPlugin.WikilinkPlugin) {
            const pluginInstance = new wikilinkPlugin.WikilinkPlugin({ contentDir: inputDir });
            pluginInstance.performDuplicateCheck();
          }
        } catch (error) {
          // 忽略错误，继续生成报告
        }
        
        // 显示完整的构建报告（传入buildContext和themeInfo，避免隐式依赖global）
        global.buildWarningCollector.showFinalReport(
          global.buildContext || {},
          global.themeInfo || {}
        );

        // 清理警告收集器，为下次构建做准备
        global.buildWarningCollector.clear();
      }, 500); // 给Eleventy足够时间输出服务器信息
    });
  } else {
    // 构建模式下在构建结束时显示报告
    eleventyConfig.on('eleventy.after', async ({ dir, results }) => {
      // 更新HTML统计信息（使用通用函数）
      if (results && results.length > 0) {
        global.buildContext.htmlStats = generateHtmlStats(results, gardenConfig.build || {});
      }

      // 🔗 处理页面别名 (Aliases) - 在构建模式下，在显示报告之前处理
      try {
        const aliasProcessor = new AliasesProcessor(
          dir.output || '_site',
          global.buildWarningCollector
        );

        const aliasStats = await aliasProcessor.processAliases(allCollections);

        // 将统计信息添加到全局构建上下文
        if (global.buildContext) {
          global.buildContext.aliasStats = aliasStats;
        }

      } catch (error) {
        console.error('❌ Aliases处理失败:', error.message);
        if (error.stack) {
          console.error(error.stack);
        }
      }

      // 手动触发WikilinkPlugin的重复检测（确保在报告之前）
      try {
        const wikilinkPlugin = require('./src/eleventy-plugins/WikilinkPlugin.js');
        if (wikilinkPlugin.WikilinkPlugin) {
          const pluginInstance = new wikilinkPlugin.WikilinkPlugin({ contentDir: inputDir });
          pluginInstance.performDuplicateCheck();
        }
      } catch (error) {
        // 忽略错误，继续生成报告
      }

      // 显示完整的构建报告（传入buildContext和themeInfo，避免隐式依赖global）
      global.buildWarningCollector.showFinalReport(
        global.buildContext || {},
        global.themeInfo || {}
      );
    });
  }

  // 设置忽略的文件和目录
  // 🚫 忽略项目根目录的文档文件
  eleventyConfig.ignores.add("README.md");
  eleventyConfig.ignores.add("CONTRIBUTING.md");
  eleventyConfig.ignores.add("DEVELOPMENT_WORKFLOW.md");
  
  // 🚫 忽略GitHub相关的markdown文件
  eleventyConfig.ignores.add(".github/**/*.md");
  
  // 🚫 忽略src目录下的markdown文件（这些是开发文档，不是内容）
  eleventyConfig.ignores.add("src/**/*.md");
  
  // 🚫 忽略Obsidian相关文件和目录
  eleventyConfig.ignores.add(".trash/**");
  eleventyConfig.ignores.add(".obsidian/**");
  eleventyConfig.ignores.add("obsidian-node-canvas-master/**");
  
  // 🚫 忽略其他系统目录
  eleventyConfig.ignores.add("node_modules/**");
  eleventyConfig.ignores.add("package*.json");
  eleventyConfig.ignores.add(".git/**");

  return {
    templateFormats: ["md", "njk", "html", "liquid"],
    markdownTemplateEngine: "njk", 
    htmlTemplateEngine: "njk",
    dir: {
      input: ".",  // 🔍 Eleventy 输入目录：根目录，同时读取 content/ 和 src/_templates/
      output: outputDir,  // 🏗️ 构建输出目录
      includes: "src/_includes",  // 📦 模板片段目录
      layouts: "src/_layouts"     // 🎨 页面布局目录
    }
  };
};