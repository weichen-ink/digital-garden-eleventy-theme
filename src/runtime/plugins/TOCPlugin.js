// ES模块导入
import { Plugin } from '../core/Plugin.js';

/**
 * 目录插件
 */
class TOCPlugin extends Plugin {
  constructor() {
    super('toc');
  }

  getDefaultConfig() {
    return {
      selectors: '.note-content h1, .note-content h2, .note-content h3, .note-content h4, .note-content h5, .note-content h6, .home-content h1, .home-content h2, .home-content h3, .home-content h4, .home-content h5, .home-content h6',
      container: '.table-of-contents',
      scrollSpyMargin: '-20% 0px -60% 0px'
    };
  }

  cacheElements() {
    this.elements = {
      container: this.getElement(this.config.container)
    };
  }

  bindEvents() {
    if (this.elements.container) {
      this.initializeTOC();
    }
  }

  /**
   * 生成slug，与服务器端保持一致
   */
  generateSlug(str) {
    if (!str) return '';
    
    return str
      .trim()
      .replace(/^\d+\.\s*/, '')                    // 移除开头的数字序号（如"1. "）
      .replace(/[<>:"\/\\|?*#\[\]]/g, '')          // 移除特殊字符
      .replace(/[\s\u3000]+/g, '-')                // 空格和中文空格转为连字符
      .replace(/[，。！？；：""''（）【】]/g, '')        // 移除中文标点
      .replace(/^-+|-+$/g, '')                     // 移除开头和结尾的连字符
      .replace(/-+/g, '-')                         // 合并多个连字符
      || 'untitled';                               // 如果结果为空，使用默认值
  }

  initializeTOC() {
    const headings = this.getElements(this.config.selectors);
    
    if (headings.length === 0) {
      return;
    }
    
    const tocList = document.createElement('ul');
    tocList.className = 'toc-list';
    
    headings.forEach((heading, index) => {
      // 为标题添加ID（如果没有的话）
      if (!heading.id) {
        let titleText = '';
        for (let node of heading.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            titleText += node.textContent;
          } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('direct-link')) {
            titleText += node.textContent;
          }
        }
        
        const cleanText = titleText.replace(/^#+\s*/, '').trim();
        heading.id = this.generateSlug(cleanText) || `heading-${index}`;
      }
      
      const li = document.createElement('li');
      li.className = `toc-item toc-${heading.tagName.toLowerCase()}`;
      
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      
      // 获取标题文本，排除direct-link元素
      let titleText = '';
      for (let node of heading.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          titleText += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE && !node.classList.contains('direct-link')) {
          titleText += node.textContent;
        }
      }
      
      link.textContent = titleText.replace(/^#+\s*/, '').trim();
      link.className = 'toc-link';
      
      // 平滑滚动
      link.addEventListener('click', (e) => {
        e.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth' });
        history.pushState(null, null, `#${heading.id}`);
      });
      
      li.appendChild(link);
      tocList.appendChild(li);
    });
    
    this.elements.container.appendChild(tocList);
    
    // 滚动时高亮当前标题
    this.initScrollSpy(headings);
  }

  initScrollSpy(headings) {
    const tocLinks = this.getElements('.toc-link');
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const id = entry.target.id;
        const tocLink = this.getElement(`.toc-link[href="#${id}"]`);
        
        if (entry.isIntersecting) {
          tocLinks.forEach(link => link.classList.remove('active'));
          if (tocLink) tocLink.classList.add('active');
        }
      });
    }, {
      rootMargin: this.config.scrollSpyMargin
    });
    
    headings.forEach(heading => observer.observe(heading));
  }
}

// ES模块导出
export { TOCPlugin };