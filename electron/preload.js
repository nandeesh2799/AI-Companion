const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  startDrag: () => ipcRenderer.send('start-drag'),
  toggleAlwaysOnTop: () => ipcRenderer.send('toggle-always-on-top'),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
  onShortcutTriggered: (callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on('shortcut-triggered', subscription);
    return () => ipcRenderer.removeListener('shortcut-triggered', subscription);
  },
  onWindowShaking: (callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on('window-shaking', subscription);
    return () => ipcRenderer.removeListener('window-shaking', subscription);
  },
  onSystemNotification: (callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on('system-notification', subscription);
    return () => ipcRenderer.removeListener('system-notification', subscription);
  },
  onOpenSettings: (callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on('open-settings', subscription);
    return () => ipcRenderer.removeListener('open-settings', subscription);
  }
});
