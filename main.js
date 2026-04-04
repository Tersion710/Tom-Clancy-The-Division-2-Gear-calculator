const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createSplash() {
  const splash = new BrowserWindow({
    width: 520,
    height: 340,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#080c10',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  splash.loadFile('splash.html');
  return splash;
}

function createMain() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Division 2 Gear Calculator',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#080c10',
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  Menu.setApplicationMenu(null);
  win.loadFile('division2-gear-calculator.html');
  return win;
}

app.whenReady().then(() => {
  const splash = createSplash();
  const main  = createMain();

  main.once('ready-to-show', () => {
    setTimeout(() => {
      splash.webContents.executeJavaScript(
        'document.body.style.transition="opacity 0.6s"; document.body.style.opacity="0";'
      );
      setTimeout(() => {
        main.show();
        main.focus();
        splash.destroy();
      }, 650);
    }, 2500);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMain().show();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
