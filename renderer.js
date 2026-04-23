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

class EditorManager {
  constructor() {
    this.editors = {
      leftEditor: {
        element: null,
        isMarkdownMode: false,
        markdownSource: '',
        lastHtmlContent: ''
      },
      cuesEditor: {
        element: null,
        isMarkdownMode: false,
        markdownSource: '',
        lastHtmlContent: ''
      },
      notesEditor: {
        element: null,
        isMarkdownMode: false,
        markdownSource: '',
        lastHtmlContent: ''
      },
      summaryEditor: {
        element: null,
        isMarkdownMode: false,
        markdownSource: '',
        lastHtmlContent: ''
      }
    };
    this.activeEditorId = null;
    this.globalMarkdownMode = false;
    this.init();
  }

  init() {
    Object.keys(this.editors).forEach(editorId => {
      const element = document.getElementById(editorId);
      if (element) {
        this.editors[editorId].element = element;
        this.setupEditorEvents(editorId);
      }
    });
    this.setupGlobalMarkdownToggle();
  }

  setupEditorEvents(editorId) {
    const editor = this.editors[editorId].element;
    
    editor.addEventListener('focus', () => {
      this.activeEditorId = editorId;
    });

    editor.addEventListener('click', () => {
      this.activeEditorId = editorId;
    });

    editor.addEventListener('keydown', (e) => {
      this.activeEditorId = editorId;
    });
  }

  setupGlobalMarkdownToggle() {
    const markdownToggle = document.getElementById('markdownModeToggle');
    if (markdownToggle) {
      markdownToggle.addEventListener('change', (e) => {
        this.globalMarkdownMode = e.target.checked;
        this.updateAllEditorsMarkdownMode();
      });
    }
  }

  updateAllEditorsMarkdownMode() {
    Object.keys(this.editors).forEach(editorId => {
      const editor = this.editors[editorId];
      if (this.globalMarkdownMode) {
        this.enterMarkdownMode(editorId);
      } else {
        this.exitMarkdownMode(editorId);
      }
    });
  }

  enterMarkdownMode(editorId) {
    const editor = this.editors[editorId];
    if (!editor.element || editor.isMarkdownMode) return;

    if (!marked) {
      alert('Markdown 功能需要安装依赖。请先运行: npm install');
      const markdownToggle = document.getElementById('markdownModeToggle');
      if (markdownToggle) {
        markdownToggle.checked = false;
      }
      this.globalMarkdownMode = false;
      return;
    }

    editor.markdownSource = this.getPlainText(editor.element);
    editor.lastHtmlContent = editor.element.innerHTML;

    try {
      const renderedHtml = marked(editor.markdownSource);
      editor.element.innerHTML = renderedHtml;
      editor.element.contentEditable = 'false';
      editor.isMarkdownMode = true;
    } catch (e) {
      console.error('Markdown 渲染失败:', e);
    }
  }

  exitMarkdownMode(editorId) {
    const editor = this.editors[editorId];
    if (!editor.element || !editor.isMarkdownMode) return;

    if (editor.lastHtmlContent) {
      editor.element.innerHTML = editor.lastHtmlContent;
    } else {
      editor.element.innerHTML = editor.markdownSource
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');
    }
    editor.element.contentEditable = 'true';
    editor.isMarkdownMode = false;
  }

  getPlainText(element) {
    let text = element.innerText || element.textContent || '';
    const html = element.innerHTML;
    
    if (html.includes('<br') || html.includes('<p') || html.includes('<div')) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      text = tempDiv.innerText || tempDiv.textContent || '';
    }
    
    return text;
  }

  getActiveEditor() {
    if (!this.activeEditorId) return null;
    return this.editors[this.activeEditorId];
  }

  getContent(editorId) {
    const editor = this.editors[editorId];
    if (!editor.element) return '';
    
    if (editor.isMarkdownMode) {
      return editor.markdownSource;
    }
    return editor.element.innerHTML;
  }

  setContent(editorId, content) {
    const editor = this.editors[editorId];
    if (!editor.element) return;

    editor.isMarkdownMode = false;
    editor.markdownSource = '';
    editor.lastHtmlContent = content || '';
    editor.element.innerHTML = content || '';
    editor.element.contentEditable = 'true';
  }

  executeCommand(command, value = null) {
    const activeEditor = this.getActiveEditor();
    if (!activeEditor || !activeEditor.element || activeEditor.isMarkdownMode) {
      return;
    }

    activeEditor.element.focus();
    
    if (command === 'fontSize') {
      document.execCommand('fontSize', false, value);
    } else if (command === 'foreColor') {
      document.execCommand('foreColor', false, value);
      this.updateTextColorLabel(value);
    } else if (command === 'backColor') {
      document.execCommand('hiliteColor', false, value);
      this.updateBgColorLabel(value);
    } else {
      document.execCommand(command, false, value);
    }
    
    activeEditor.element.focus();
    this.updateToolbarState();
  }

  updateTextColorLabel(color) {
    const label = document.getElementById('textColorLabel');
    if (label) {
      label.style.color = color;
      label.style.textDecorationColor = color;
    }
  }

  updateBgColorLabel(color) {
    const label = document.getElementById('bgColorLabel');
    if (label) {
      label.style.backgroundColor = color;
    }
  }

  updateToolbarState() {
    const boldBtn = document.getElementById('boldBtn');
    const italicBtn = document.getElementById('italicBtn');
    const underlineBtn = document.getElementById('underlineBtn');

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
}

class ToolbarController {
  constructor(editorManager) {
    this.editorManager = editorManager;
    this.init();
  }

  init() {
    this.setupFontSizeSelect();
    this.setupCommandButtons();
    this.setupColorPickers();
    this.setupKeyboardShortcuts();
  }

  setupFontSizeSelect() {
    const fontSizeSelect = document.getElementById('fontSizeSelect');
    if (fontSizeSelect) {
      fontSizeSelect.addEventListener('change', (e) => {
        this.editorManager.executeCommand('fontSize', e.target.value);
      });
    }
  }

  setupCommandButtons() {
    const buttonIds = ['boldBtn', 'italicBtn', 'underlineBtn'];
    buttonIds.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          const command = btn.getAttribute('data-command');
          if (command) {
            this.editorManager.executeCommand(command);
          }
        });
      }
    });
  }

  setupColorPickers() {
    const textColorPicker = document.getElementById('textColorPicker');
    const bgColorPicker = document.getElementById('bgColorPicker');

    if (textColorPicker) {
      textColorPicker.addEventListener('input', (e) => {
        this.editorManager.executeCommand('foreColor', e.target.value);
      });
    }

    if (bgColorPicker) {
      bgColorPicker.addEventListener('input', (e) => {
        this.editorManager.executeCommand('backColor', e.target.value);
      });
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        const activeElement = document.activeElement;
        if (!activeElement || !activeElement.classList.contains('editor')) {
          return;
        }

        const editorId = activeElement.id;
        const editor = this.editorManager.editors[editorId];
        
        if (!editor || editor.isMarkdownMode) {
          return;
        }

        if (e.key === 'b' || e.key === 'B') {
          e.preventDefault();
          this.editorManager.executeCommand('bold');
        } else if (e.key === 'i' || e.key === 'I') {
          e.preventDefault();
          this.editorManager.executeCommand('italic');
        } else if (e.key === 'u' || e.key === 'U') {
          e.preventDefault();
          this.editorManager.executeCommand('underline');
        }
      }
    });
  }
}

class NoteBookApp {
  constructor() {
    this.pages = [];
    this.currentPageIndex = 0;
    this.saveTimeout = null;
    this.isSaving = false;
    this.editorManager = null;
    this.toolbarController = null;
    this.init();
  }

  init() {
    this.editorManager = new EditorManager();
    this.toolbarController = new ToolbarController(this.editorManager);
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
    currentPage.leftContent = this.editorManager.getContent('leftEditor');
    currentPage.cornell.title = document.getElementById('cornellTitle').value;
    currentPage.cornell.date = document.getElementById('cornellDate').value;
    currentPage.cornell.cues = this.editorManager.getContent('cuesEditor');
    currentPage.cornell.notes = this.editorManager.getContent('notesEditor');
    currentPage.cornell.summary = this.editorManager.getContent('summaryEditor');
  }

  renderCurrentPage() {
    if (this.pages.length === 0) return;
    
    const page = this.pages[this.currentPageIndex];
    
    document.getElementById('leftPageTitle').value = page.title;
    this.editorManager.setContent('leftEditor', page.leftContent || '');
    document.getElementById('cornellTitle').value = page.cornell.title || '';
    document.getElementById('cornellDate').value = page.cornell.date || '';
    this.editorManager.setContent('cuesEditor', page.cornell.cues || '');
    this.editorManager.setContent('notesEditor', page.cornell.notes || '');
    this.editorManager.setContent('summaryEditor', page.cornell.summary || '');
    
    document.getElementById('currentPageDisplay').textContent = 
      '第 ' + (this.currentPageIndex + 1) + ' 页 / 共 ' + this.pages.length + ' 页';
    
    document.getElementById('leftPageNumber').textContent = this.currentPageIndex + 1;
    document.getElementById('rightPageNumber').textContent = this.currentPageIndex + 1;
    
    document.getElementById('prevPageBtn').disabled = this.currentPageIndex === 0;
    document.getElementById('nextPageBtn').disabled = this.currentPageIndex >= this.pages.length - 1;

    const markdownToggle = document.getElementById('markdownModeToggle');
    if (markdownToggle && markdownToggle.checked) {
      this.editorManager.globalMarkdownMode = true;
      this.editorManager.updateAllEditorsMarkdownMode();
    }
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
