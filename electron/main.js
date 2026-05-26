const { app, BrowserWindow, ipcMain, globalShortcut, screen, Menu } = require('electron');
const path = require('path');
const { createTray } = require('./tray.js');

let mainWindow = null;
let isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Shaking detection variables
let moveHistory = [];
const SHAKE_THRESHOLD = 5; // number of direction changes
const SHAKE_WINDOW_MS = 800; // time window
const SHAKE_MIN_DELTA = 15; // minimum pixel movement to count

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: workX, y: workY, width, height } = primaryDisplay.workArea;

  const winWidth = 240;
  const winHeight = 340;
  const posX = workX + width - winWidth;
  const posY = workY + height - winHeight;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: posX,
    y: posY,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // allow loading local sound assets
      autoplayPolicy: 'no-user-gesture-required'
    }
  });

  // Set screen-saver level so it floats above other fullscreen apps
  mainWindow.setAlwaysOnTop(true, 'screen-saver');

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    // Open devtools if needed, but detach it so transparent window stays clear
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Set ignore mouse events to pass clicks through transparent pixels
  ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setIgnoreMouseEvents(ignore, options);
    }
  });

  // Dynamic window resize request (e.g., when opening Settings panel)
  ipcMain.on('resize-window', (event, width, height) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      const [oldWidth, oldHeight] = win.getSize();
      if (oldWidth !== width || oldHeight !== height) {
        const [x, y] = win.getPosition();
        // Adjust position so the window expands/shrinks relative to the bottom-right corner
        const newX = x - (width - oldWidth);
        const newY = y - (height - oldHeight);
        win.setBounds({ x: newX, y: newY, width, height }, true);
      }
    }
  });

  // Setup window dragging
  let dragOffset = null;
  ipcMain.on('start-drag', (event) => {
    const cursor = screen.getCursorScreenPoint();
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      const [winX, winY] = win.getPosition();
      dragOffset = { x: cursor.x - winX, y: cursor.y - winY };
    }
  });

  mainWindow.on('move', () => {
    if (!mainWindow) return;
    const now = Date.now();
    const [x, y] = mainWindow.getPosition();
    
    // Add to movement history
    moveHistory.push({ x, y, time: now });
    // Clean history older than SHAKE_WINDOW_MS
    moveHistory = moveHistory.filter(pt => now - pt.time < SHAKE_WINDOW_MS);

    // Analyze history for rapid direction reversals (shaking)
    if (moveHistory.length >= 6) {
      let directionChanges = 0;
      let lastDx = 0;
      let lastDy = 0;

      for (let i = 1; i < moveHistory.length; i++) {
        const dx = moveHistory[i].x - moveHistory[i-1].x;
        const dy = moveHistory[i].y - moveHistory[i-1].y;

        // Only count if there was a real movement
        if (Math.abs(dx) > SHAKE_MIN_DELTA || Math.abs(dy) > SHAKE_MIN_DELTA) {
          // Check horizontal direction change
          if (lastDx !== 0 && ((dx > 0 && lastDx < 0) || (dx < 0 && lastDx > 0))) {
            directionChanges++;
          }
          // Check vertical direction change
          if (lastDy !== 0 && ((dy > 0 && lastDy < 0) || (dy < 0 && lastDy > 0))) {
            directionChanges++;
          }
          lastDx = dx;
          lastDy = dy;
        }
      }

      if (directionChanges >= SHAKE_THRESHOLD) {
        mainWindow.webContents.send('window-shaking');
        // Clear history to prevent rapid duplicate events
        moveHistory = [];
      }
    }
  });

  // Global drag handler loop when dragging is active
  mainWindow.on('blur', () => {
    dragOffset = null;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Initialize System Tray
  createTray(mainWindow);
}

// Manage app ready state
app.whenReady().then(() => {
  createWindow();

  // Set default Menu to enable Cut, Copy, Paste, Undo, Redo, Select All keyboard shortcuts in frameless mode
  const template = [
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: 'Copy', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', role: 'paste' },
        { label: 'Select All', accelerator: 'CmdOrCtrl+A', role: 'selectAll' }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  // Register shortcut toggle: Ctrl+Shift+A
  globalShortcut.register('CommandOrControl+Shift+A', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Shortcut cleanups
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// Close rules
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
