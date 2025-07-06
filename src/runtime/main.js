/**
 * 数字花园主入口文件 - ES模块版本
 * 采用插件化架构，支持按需加载和配置
 */

// ES模块导入
import { DigitalGarden } from './core/DigitalGarden.js';
import { SearchPlugin } from './plugins/SearchPlugin.js';
import { PreviewPlugin } from './plugins/PreviewPlugin.js';
import { TOCPlugin } from './plugins/TOCPlugin.js';
import { LazyLoadPlugin } from './plugins/LazyLoadPlugin.js';
import { UIPlugin } from './plugins/UIPlugin.js';
import { ShikiPlugin } from './plugins/ShikiPlugin.js';
import ArticleSortPlugin from './plugins/ArticleSortPlugin.js';

// 应用配置
const appConfig = {
  plugins: {
    search: {}, // 搜索配置已内置在SearchPlugin中
    preview: {
      delay: 300,
      hideDelay: 200,
      maxWidth: 480,
      maxHeight: 400
    },
    toc: {
      selectors: '.note-content h1, .note-content h2, .note-content h3, .note-content h4, .home-content h2',
      container: '.table-of-contents'
    },
    lazyLoad: {
      rootMargin: '50px',
      selector: 'img[data-src]'
    },
    ui: {
      backToTopThreshold: 300
    }
  }
};

// 创建应用实例
const app = new DigitalGarden(appConfig);

// 注册插件
app.registerPlugin('search', new SearchPlugin());
app.registerPlugin('preview', new PreviewPlugin());
app.registerPlugin('toc', new TOCPlugin());
app.registerPlugin('lazyLoad', new LazyLoadPlugin());
app.registerPlugin('ui', new UIPlugin());
app.registerPlugin('shiki', new ShikiPlugin());

// DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});


// 暴露应用实例和全局函数到window对象（保持向后兼容）
if (typeof window !== 'undefined') {
  window.digitalGarden = app;
  
  // 全局函数（保持HTML onclick兼容性）
  window.toggleSearch = () => app.getPlugin('search')?.toggle();
  window.closeSearch = () => app.getPlugin('search')?.hide();
  window.clearSearch = () => app.getPlugin('search')?.clear();
  window.toggleMobileNav = () => {
    const navList = document.querySelector('.nav-list');
    if (navList) navList.classList.toggle('show');
  };
  window.scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  window.performSearch = () => {
    const input = document.getElementById('searchInput');
    const searchPlugin = app.getPlugin('search');
    
    if (input && searchPlugin) {
      searchPlugin.performSearch(input.value);
      
      // 显示/隐藏清除按钮
      const clearBtn = document.getElementById('searchClear');
      if (clearBtn) {
        if (input.value.length > 0) {
          clearBtn.classList.add('visible');
        } else {
          clearBtn.classList.remove('visible');
        }
      }
    }
  };
  window.handleSearchKeydown = (event) => {
    const searchPlugin = app.getPlugin('search');
    if (searchPlugin) {
      searchPlugin.handleKeydown(event);
    }
    
    if (event.key === 'Escape') {
      window.closeSearch();
    }
  };
}