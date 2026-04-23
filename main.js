const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.on('save-notes', (event, data) => {
  const dataPath = path.join(app.getPath('userData'), 'notes-data.json');
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  event.reply('notes-saved');
});

ipcMain.on('load-notes', (event) => {
  const dataPath = path.join(app.getPath('userData'), 'notes-data.json');
  try {
    if (fs.existsSync(dataPath)) {
      const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      event.reply('notes-loaded', data);
    } else {
      event.reply('notes-loaded', null);
    }
  } catch (error) {
    event.reply('notes-loaded', null);
  }
});
