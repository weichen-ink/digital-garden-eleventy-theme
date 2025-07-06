/**
 * 文章排序插件
 * 为文章列表页面提供客户端排序功能
 * 支持按更新时间/发布时间排序，正序/倒序切换
 */

class ArticleSortPlugin {
  constructor() {
    this.currentSort = 'updated'; // 'updated' | 'created'
    this.currentOrder = 'desc';   // 'desc' | 'asc'
    this.storageKey = 'article-sort-preferences';
    
    this.init();
  }

  init() {
    // 等待DOM加载完成
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initPlugin());
    } else {
      this.initPlugin();
    }
  }

  initPlugin() {
    // 检查是否在文章列表页面
    const postsList = document.querySelector('.posts-list');
    if (!postsList) return;

    // 加载保存的排序偏好
    this.loadPreferences();
    
    // 初始化UI
    this.initSortControls();
    
    // 应用当前排序
    this.applySorting();
  }

  initSortControls() {
    const sortButtons = document.querySelectorAll('.sort-btn');

    if (!sortButtons.length) return;

    // 更新UI状态
    this.updateUIState();

    // 排序按钮事件
    sortButtons.forEach(button => {
      button.addEventListener('click', () => {
        const sortType = button.dataset.sort;
        const sortOrder = button.dataset.order;

        let hasChanged = false;

        if (sortType && sortType !== this.currentSort) {
          this.currentSort = sortType;
          hasChanged = true;
        }
        
        if (sortOrder && sortOrder !== this.currentOrder) {
          this.currentOrder = sortOrder;
          hasChanged = true;
        }

        if (hasChanged) {
          this.updateUIState();
          this.applySorting();
          this.savePreferences();
        }
      });
    });
  }

  updateUIState() {
    const sortButtons = document.querySelectorAll('.sort-btn');
    
    sortButtons.forEach(button => {
      let isActive = false;
      
      if (button.dataset.sort) {
        isActive = button.dataset.sort === this.currentSort;
      }
      
      if (button.dataset.order) {
        isActive = button.dataset.order === this.currentOrder;
      }
      
      button.classList.toggle('active', isActive);
    });
  }

  applySorting() {
    const postsList = document.querySelector('.posts-list');
    if (!postsList) return;

    const postItems = Array.from(postsList.querySelectorAll('.post-item'));
    
    // 对文章项进行排序
    postItems.sort((a, b) => {
      const dateA = this.getDateForSorting(a);
      const dateB = this.getDateForSorting(b);
      
      if (!dateA || !dateB) return 0;
      
      const comparison = new Date(dateA) - new Date(dateB);
      return this.currentOrder === 'desc' ? -comparison : comparison;
    });

    // 重新排列DOM元素
    postItems.forEach(item => {
      postsList.appendChild(item);
    });

    // 更新显示的日期
    this.updateDisplayedDates();
  }

  getDateForSorting(postItem) {
    // 根据当前排序类型获取对应的日期数据
    if (this.currentSort === 'updated') {
      return postItem.dataset.updated;
    } else {
      return postItem.dataset.created;
    }
  }

  updateDisplayedDates() {
    const postItems = document.querySelectorAll('.post-item');
    
    postItems.forEach(item => {
      const dateElement = item.querySelector('.post-date');
      if (!dateElement) return;
      
      let dateValue;
      if (this.currentSort === 'updated') {
        dateValue = item.dataset.updated;
      } else {
        dateValue = item.dataset.created;
      }
      
      if (dateValue) {
        // 格式化日期显示
        const formattedDate = this.formatDate(dateValue);
        dateElement.textContent = formattedDate;
      }
    });
  }

  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}年${month}月${day}日`;
    } catch (error) {
      return dateString; // 如果格式化失败，返回原字符串
    }
  }

  loadPreferences() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const preferences = JSON.parse(saved);
        this.currentSort = preferences.sort || 'updated';
        this.currentOrder = preferences.order || 'desc';
      }
    } catch (error) {
      console.warn('无法加载排序偏好:', error);
    }
  }

  savePreferences() {
    try {
      const preferences = {
        sort: this.currentSort,
        order: this.currentOrder
      };
      localStorage.setItem(this.storageKey, JSON.stringify(preferences));
    } catch (error) {
      console.warn('无法保存排序偏好:', error);
    }
  }
}

// 自动初始化插件
if (typeof window !== 'undefined') {
  new ArticleSortPlugin();
}

export default ArticleSortPlugin;