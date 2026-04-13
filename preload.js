const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronBridge', {
  saveTheme: (themeName) => ipcRenderer.send('save-theme', themeName)
});
