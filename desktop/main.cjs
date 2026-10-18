'use strict';

const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');

const APP_URL = 'https://smartnekam.vercel.app/';
const APP_HOST = 'smartnekam.vercel.app';

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isSmartNekamUrl(value) {
  const url = parseUrl(value);
  return Boolean(url && url.protocol === 'https:' && url.hostname === APP_HOST);
}

function isAuthenticationUrl(value) {
  const url = parseUrl(value);
  if (!url || url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return (
    host === 'accounts.google.com' ||
    host === 'oauth2.googleapis.com' ||
    host === 'github.com' ||
    host.endsWith('.github.com') ||
    host.endsWith('.supabase.co')
  );
}

function mayStayInApp(value) {
  return isSmartNekamUrl(value) || isAuthenticationUrl(value);
}

async function openExternalSafely(value) {
  const url = parseUrl(value);
  if (!url) return;
  if (['https:', 'http:', 'mailto:'].includes(url.protocol)) {
    try {
      await shell.openExternal(url.href);
    } catch (error) {
      console.error('[SmartNekam] Could not open external link:', error);
    }
  }
}

function createMainWindow() {
  const win = new BrowserWindow({
    title: 'SmartNekam',
    width: 1280,
    height: 860,
    minWidth: 375,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0B0F1A',
    icon: path.join(__dirname, 'assets', 'smartnekam.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  win.once('ready-to-show', () => win.show());

  // Keep SmartNekam and known sign-in endpoints in the app; send other links to the system browser.
  win.webContents.on('will-navigate', (event, destination) => {
    if (mayStayInApp(destination)) return;
    event.preventDefault();
    void openExternalSafely(destination);
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (mayStayInApp(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true
          }
        }
      };
    }
    void openExternalSafely(url);
    return { action: 'deny' };
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[SmartNekam] Renderer stopped:', details.reason);
  });

  win.loadURL(APP_URL).catch((error) => {
    console.error('[SmartNekam] Failed to load the hosted app:', error);
  });

  return win;
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
