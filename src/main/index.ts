import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { DeviceWatcher } from './device/watcher'
import { registerIpc } from './ipc'

const isWindows = process.platform === 'win32'
const deviceWatcher = new DeviceWatcher()

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#0c110f',
    title: 'DroidCrate',
    titleBarStyle: isWindows ? 'hidden' : 'default',
    ...(isWindows
      ? {
          titleBarOverlay: {
            color: '#0c110f',
            symbolColor: '#c9ded5',
            height: 36
          }
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.once('ready-to-show', () => window.show())

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  window.webContents.on('will-navigate', (event, url) => {
    const current = window.webContents.getURL()
    if (url !== current) event.preventDefault()
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('app.droidcrate.desktop')
  registerIpc(deviceWatcher)
  const window = createWindow()
  deviceWatcher.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else window.focus()
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
})

app.on('before-quit', () => deviceWatcher.stop())
