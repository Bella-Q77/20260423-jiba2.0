const isElectron = () => {
  return window.process && window.process.type;
};

let ipcRenderer = null;
if (isElectron()) {
  try {
    ipcRenderer = require('electron').ipcRenderer;
  } catch (e) {
    ipcRenderer = null;
  }
}

class NoteBookApp {
  constructor() {
    this.pages = [];
    this.currentPageIndex = 0;
    this.saveTimeout = null;
    this.isSaving = false;
    this.init();
  }

  init() {
    this.loadData();
    this.setupEventListeners();
    this.setupAutoSave();
    this.setupDatePicker();
  }

  loadData() {
    if (isElectron() && ipcRenderer) {
      ipcRenderer.send('load-notes');
      
      ipcRenderer.on('notes-loaded', (event, data) => {
        this.handleLoadedData(data);
      });

      ipcRenderer.on('notes-saved', () => {
        this.isSaving = false;
        this.updateSaveStatus(false);
      });
    } else {
      const savedData = localStorage.getItem('notebook-data');
      if (savedData) {
        try {
          const data = JSON.parse(savedData);
          this.handleLoadedData(data);
        } catch (e) {
          this.createDefaultPage();
          this.renderTOC();
          this.renderCurrentPage();
        }
      } else {
        this.createDefaultPage();
        this.renderTOC();
        this.renderCurrentPage();
      }
    }
  }

  handleLoadedData(data) {
    if (data && data.pages && data.pages.length > 0) {
      this.pages = data.pages;
      this.currentPageIndex = data.currentPageIndex || 0;
    } else {
      this.createDefaultPage();
    }
    this.renderTOC();
    this.renderCurrentPage();
  }

  createDefaultPage() {
    this.pages = [{
      id: this.generateId(),
      title: '第 1 页',
      leftContent: '',
      cornell: {
        title: '',
        date: '',
        cues: '',
        notes: '',
        summary: ''
      }
    }];
    this.currentPageIndex = 0;
  }

  generateId() {
    return 'page_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  setupEventListeners() {
    document.getElementById('addPageBtn').addEventListener('click', () => {
      this.addNewPage();
    });

    document.getElementById('prevPageBtn').addEventListener('click', () => {
      this.goToPrevPage();
    });

    document.getElementById('nextPageBtn').addEventListener('click', () => {
      this.goToNextPage();
    });

    document.getElementById('leftPageTitle').addEventListener('input', () => {
      this.saveCurrentPageData();
      this.updateTOC();
    });

    document.getElementById('cornellTitle').addEventListener('input', () => {
      this.saveCurrentPageData();
      this.reorganizeAllPagesByTitle();
      this.updateTOC();
    });

    document.getElementById('cornellDate').addEventListener('input', () => {
      this.saveCurrentPageData();
    });

    document.getElementById('leftEditor').addEventListener('input', () => {
      this.scheduleAutoSave();
    });

    document.getElementById('cuesEditor').addEventListener('input', () => {
      this.scheduleAutoSave();
    });

    document.getElementById('notesEditor').addEventListener('input', () => {
      this.scheduleAutoSave();
    });

    document.getElementById('summaryEditor').addEventListener('input', () => {
      this.scheduleAutoSave();
    });

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.goToPrevPage();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.goToNextPage();
        }
      }
    });
  }

  setupAutoSave() {
    this.scheduleAutoSave = () => {
      this.saveCurrentPageData();
      this.updateSaveStatus(true);
      
      if (this.saveTimeout) {
        clearTimeout(this.saveTimeout);
      }
      
      this.saveTimeout = setTimeout(() => {
        this.saveData();
      }, 1000);
    };
  }

  setupDatePicker() {
    const dateInput = document.getElementById('cornellDate');
    const today = new Date();
    const dateStr = today.getFullYear() + '年' + 
                   (today.getMonth() + 1) + '月' + 
                   today.getDate() + '日';
    if (!dateInput.value) {
      dateInput.placeholder = dateStr;
    }
  }

  addNewPage() {
    const newPage = {
      id: this.generateId(),
      title: '第 ' + (this.pages.length + 1) + ' 页',
      leftContent: '',
      cornell: {
        title: '',
        date: '',
        cues: '',
        notes: '',
        summary: ''
      }
    };
    
    this.pages.splice(this.currentPageIndex + 1, 0, newPage);
    this.currentPageIndex = this.currentPageIndex + 1;
    
    this.renderTOC();
    this.renderCurrentPage();
    this.saveData();
  }

  reorganizeAllPagesByTitle() {
    if (this.pages.length === 0) return;
    
    const currentPage = this.pages[this.currentPageIndex];
    const currentPageId = currentPage.id;
    
    const titleGroups = new Map();
    const untitledPages = [];
    
    for (const page of this.pages) {
      const cornellTitle = page.cornell?.title?.trim();
      
      if (cornellTitle) {
        if (!titleGroups.has(cornellTitle)) {
          titleGroups.set(cornellTitle, []);
        }
        titleGroups.get(cornellTitle).push(page);
      } else {
        untitledPages.push(page);
      }
    }
    
    const newPages = [];
    for (const [title, pages] of titleGroups) {
      newPages.push(...pages);
    }
    newPages.push(...untitledPages);
    
    this.pages = newPages;
    
    this.currentPageIndex = this.pages.findIndex(page => page.id === currentPageId);
    if (this.currentPageIndex === -1) {
      this.currentPageIndex = 0;
    }
    
    this.renderTOC();
    this.renderCurrentPage();
  }

  deletePage(index) {
    if (this.pages.length <= 1) {
      return;
    }
    
    this.pages.splice(index, 1);
    
    if (this.currentPageIndex >= this.pages.length) {
      this.currentPageIndex = this.pages.length - 1;
    }
    
    this.renderTOC();
    this.renderCurrentPage();
    this.saveData();
  }

  goToPage(index) {
    if (index >= 0 && index < this.pages.length) {
      this.currentPageIndex = index;
      this.renderTOC();
      this.renderCurrentPage();
    }
  }

  goToPrevPage() {
    if (this.currentPageIndex > 0) {
      this.currentPageIndex--;
      this.renderTOC();
      this.renderCurrentPage();
    }
  }

  goToNextPage() {
    if (this.currentPageIndex < this.pages.length - 1) {
      this.currentPageIndex++;
      this.renderTOC();
      this.renderCurrentPage();
    }
  }

  saveCurrentPageData() {
    if (this.pages.length === 0) return;
    
    const currentPage = this.pages[this.currentPageIndex];
    
    currentPage.title = document.getElementById('leftPageTitle').value || 
                        ('第 ' + (this.currentPageIndex + 1) + ' 页');
    currentPage.leftContent = document.getElementById('leftEditor').innerHTML;
    currentPage.cornell.title = document.getElementById('cornellTitle').value;
    currentPage.cornell.date = document.getElementById('cornellDate').value;
    currentPage.cornell.cues = document.getElementById('cuesEditor').innerHTML;
    currentPage.cornell.notes = document.getElementById('notesEditor').innerHTML;
    currentPage.cornell.summary = document.getElementById('summaryEditor').innerHTML;
  }

  renderCurrentPage() {
    if (this.pages.length === 0) return;
    
    const page = this.pages[this.currentPageIndex];
    
    document.getElementById('leftPageTitle').value = page.title;
    document.getElementById('leftEditor').innerHTML = page.leftContent || '';
    document.getElementById('cornellTitle').value = page.cornell.title || '';
    document.getElementById('cornellDate').value = page.cornell.date || '';
    document.getElementById('cuesEditor').innerHTML = page.cornell.cues || '';
    document.getElementById('notesEditor').innerHTML = page.cornell.notes || '';
    document.getElementById('summaryEditor').innerHTML = page.cornell.summary || '';
    
    document.getElementById('currentPageDisplay').textContent = 
      '第 ' + (this.currentPageIndex + 1) + ' 页 / 共 ' + this.pages.length + ' 页';
    
    document.getElementById('leftPageNumber').textContent = this.currentPageIndex + 1;
    document.getElementById('rightPageNumber').textContent = this.currentPageIndex + 1;
    
    document.getElementById('prevPageBtn').disabled = this.currentPageIndex === 0;
    document.getElementById('nextPageBtn').disabled = this.currentPageIndex >= this.pages.length - 1;
  }

  renderTOC() {
    const tocList = document.getElementById('tocList');
    tocList.innerHTML = '';
    
    this.pages.forEach((page, index) => {
      const item = document.createElement('div');
      item.className = 'toc-item' + (index === this.currentPageIndex ? ' active' : '');
      
      const number = document.createElement('div');
      number.className = 'toc-item-number';
      number.textContent = index + 1;
      
      const title = document.createElement('div');
      title.className = 'toc-item-title';
      
      const pageNum = index + 1;
      const cornellTitle = page.cornell?.title?.trim();
      
      let displayTitle;
      if (cornellTitle) {
        displayTitle = '第 ' + pageNum + ' 页：' + cornellTitle;
      } else {
        displayTitle = '第 ' + pageNum + ' 页';
      }
      
      title.textContent = displayTitle;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'toc-item-delete';
      deleteBtn.textContent = '×';
      deleteBtn.title = '删除此页';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deletePage(index);
      });
      
      item.appendChild(number);
      item.appendChild(title);
      item.appendChild(deleteBtn);
      
      item.addEventListener('click', () => {
        this.goToPage(index);
      });
      
      tocList.appendChild(item);
    });
  }

  updateTOC() {
    this.renderTOC();
  }

  updateSaveStatus(isSaving) {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    
    if (isSaving) {
      indicator.className = 'status-indicator saving';
      text.textContent = '正在保存...';
    } else {
      indicator.className = 'status-indicator';
      text.textContent = '已保存';
    }
  }

  saveData() {
    this.saveCurrentPageData();
    this.isSaving = true;
    this.updateSaveStatus(true);
    
    const data = {
      pages: this.pages,
      currentPageIndex: this.currentPageIndex
    };
    
    if (isElectron() && ipcRenderer) {
      ipcRenderer.send('save-notes', data);
    } else {
      try {
        localStorage.setItem('notebook-data', JSON.stringify(data));
        this.isSaving = false;
        this.updateSaveStatus(false);
      } catch (e) {
        console.error('保存失败:', e);
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new NoteBookApp();
});
