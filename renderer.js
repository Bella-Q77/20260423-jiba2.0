const isElectron = () => {
  return window.process && window.process.type;
};

let ipcRenderer = null;
let marked = null;

if (isElectron()) {
  try {
    ipcRenderer = require('electron').ipcRenderer;
  } catch (e) {
    ipcRenderer = null;
  }
  try {
    marked = require('marked');
    if (marked && marked.marked) {
      marked = marked.marked;
    }
  } catch (e) {
    console.warn('Marked 库未加载，Markdown 功能可能受限');
    marked = null;
  }
} else {
  marked = null;
}

class RichTextEditor {
  constructor(editorId) {
    this.editor = document.getElementById(editorId);
    this.editorId = editorId;
    this.isMarkdownMode = false;
    this.markdownSource = '';
    this.setupToolbar();
  }

  setupToolbar() {
    const toolbar = this.editor.previousElementSibling;
    if (!toolbar || !toolbar.classList.contains('editor-toolbar')) {
      return;
    }

    const fontSelect = toolbar.querySelector('.font-size-select');
    if (fontSelect) {
      fontSelect.addEventListener('change', (e) => {
        this.executeCommand('fontSize', e.target.value);
      });
    }

    const commandButtons = toolbar.querySelectorAll('[data-command]');
    commandButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const command = btn.getAttribute('data-command');
        const colorPicker = btn.querySelector('.color-picker');
        if (colorPicker) {
          this.executeCommand(command, colorPicker.value);
        } else {
          this.executeCommand(command);
        }
        this.updateToolbarState();
      });
    });

    const colorPickers = toolbar.querySelectorAll('.color-picker');
    colorPickers.forEach(picker => {
      picker.addEventListener('input', (e) => {
        const command = picker.getAttribute('data-command');
        this.executeCommand(command, e.target.value);
      });
    });

    const markdownBtn = toolbar.querySelector('[data-action="toggleMarkdown"]');
    if (markdownBtn) {
      markdownBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleMarkdownMode();
      });
    }
  }

  executeCommand(command, value = null) {
    if (this.isMarkdownMode) {
      return;
    }
    
    this.editor.focus();
    
    if (command === 'fontSize') {
      document.execCommand('fontSize', false, value);
    } else if (command === 'foreColor') {
      document.execCommand('foreColor', false, value);
    } else if (command === 'backColor') {
      document.execCommand('hiliteColor', false, value);
    } else {
      document.execCommand(command, false, value);
    }
    
    this.editor.focus();
  }

  updateToolbarState() {
    const toolbar = this.editor.previousElementSibling;
    if (!toolbar) return;

    const boldBtn = toolbar.querySelector('[data-command="bold"]');
    const italicBtn = toolbar.querySelector('[data-command="italic"]');
    const underlineBtn = toolbar.querySelector('[data-command="underline"]');

    if (boldBtn) {
      boldBtn.classList.toggle('active', document.queryCommandState('bold'));
    }
    if (italicBtn) {
      italicBtn.classList.toggle('active', document.queryCommandState('italic'));
    }
    if (underlineBtn) {
      underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
    }
  }

  toggleMarkdownMode() {
    const toolbar = this.editor.previousElementSibling;
    const markdownBtn = toolbar?.querySelector('[data-action="toggleMarkdown"]');
    
    if (!marked) {
      alert('Markdown 功能需要安装依赖。请先运行: npm install');
      return;
    }

    if (this.isMarkdownMode) {
      this.editor.contentEditable = 'true';
      this.editor.innerHTML = this.markdownSource;
      this.isMarkdownMode = false;
      if (markdownBtn) markdownBtn.classList.remove('active');
      
      const toolbarControls = toolbar?.querySelectorAll('.font-size-select, .toolbar-btn:not(.markdown-btn), .color-picker-wrapper');
      toolbarControls?.forEach(ctrl => {
        ctrl.style.display = '';
      });
    } else {
      this.markdownSource = this.editor.innerHTML;
      const plainText = this.htmlToMarkdown(this.markdownSource);
      
      try {
        const renderedHtml = marked(plainText);
        this.editor.innerHTML = renderedHtml;
        this.editor.contentEditable = 'false';
        this.isMarkdownMode = true;
        if (markdownBtn) markdownBtn.classList.add('active');
        
        const toolbarControls = toolbar?.querySelectorAll('.font-size-select, .toolbar-btn:not(.markdown-btn), .color-picker-wrapper');
        toolbarControls?.forEach(ctrl => {
          ctrl.style.display = 'none';
        });
      } catch (e) {
        console.error('Markdown 渲染失败:', e);
        alert('Markdown 渲染失败: ' + e.message);
      }
    }
  }

  htmlToMarkdown(html) {
    let text = html;
    
    text = text.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<p[^>]*>/gi, '\n');
    text = text.replace(/<\/p>/gi, '');
    text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    text = text.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    text = text.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    text = text.replace(/<u[^>]*>(.*?)<\/u>/gi, '__$1__');
    text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
    text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
    text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
    text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n');
    text = text.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n');
    text = text.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n');
    text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
    text = text.replace(/<ul[^>]*>/gi, '');
    text = text.replace(/<\/ul>/gi, '');
    text = text.replace(/<ol[^>]*>/gi, '');
    text = text.replace(/<\/ol>/gi, '');
    text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
    text = text.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)');
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/\n{3,}/g, '\n\n');
    
    return text.trim();
  }

  getContent() {
    if (this.isMarkdownMode) {
      return this.markdownSource;
    }
    return this.editor.innerHTML;
  }

  setContent(content) {
    this.markdownSource = '';
    this.isMarkdownMode = false;
    this.editor.innerHTML = content || '';
    
    const toolbar = this.editor.previousElementSibling;
    const markdownBtn = toolbar?.querySelector('[data-action="toggleMarkdown"]');
    if (markdownBtn) markdownBtn.classList.remove('active');
    
    const toolbarControls = toolbar?.querySelectorAll('.font-size-select, .toolbar-btn:not(.markdown-btn), .color-picker-wrapper');
    toolbarControls?.forEach(ctrl => {
      ctrl.style.display = '';
    });
  }
}

class NoteBookApp {
  constructor() {
    this.pages = [];
    this.currentPageIndex = 0;
    this.saveTimeout = null;
    this.isSaving = false;
    this.editors = {};
    this.init();
  }

  init() {
    this.initEditors();
    this.loadData();
    this.setupEventListeners();
    this.setupAutoSave();
    this.setupDatePicker();
    this.setupKeyboardShortcuts();
  }

  initEditors() {
    this.editors = {
      leftEditor: new RichTextEditor('leftEditor'),
      cuesEditor: new RichTextEditor('cuesEditor'),
      notesEditor: new RichTextEditor('notesEditor'),
      summaryEditor: new RichTextEditor('summaryEditor')
    };
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        const activeElement = document.activeElement;
        if (!activeElement || !activeElement.classList.contains('editor')) {
          return;
        }

        const editorId = activeElement.id;
        const editor = this.editors[editorId];
        
        if (!editor || editor.isMarkdownMode) {
          return;
        }

        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          editor.executeCommand('bold');
          editor.updateToolbarState();
        } else if (e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          editor.executeCommand('italic');
          editor.updateToolbarState();
        } else if (e.key === 'u' || e.key === 'U') {
          e.preventDefault();
          editor.executeCommand('underline');
          editor.updateToolbarState();
        }
      }
    });
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
    currentPage.leftContent = this.editors.leftEditor.getContent();
    currentPage.cornell.title = document.getElementById('cornellTitle').value;
    currentPage.cornell.date = document.getElementById('cornellDate').value;
    currentPage.cornell.cues = this.editors.cuesEditor.getContent();
    currentPage.cornell.notes = this.editors.notesEditor.getContent();
    currentPage.cornell.summary = this.editors.summaryEditor.getContent();
  }

  renderCurrentPage() {
    if (this.pages.length === 0) return;
    
    const page = this.pages[this.currentPageIndex];
    
    document.getElementById('leftPageTitle').value = page.title;
    this.editors.leftEditor.setContent(page.leftContent || '');
    document.getElementById('cornellTitle').value = page.cornell.title || '';
    document.getElementById('cornellDate').value = page.cornell.date || '';
    this.editors.cuesEditor.setContent(page.cornell.cues || '');
    this.editors.notesEditor.setContent(page.cornell.notes || '');
    this.editors.summaryEditor.setContent(page.cornell.summary || '');
    
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
