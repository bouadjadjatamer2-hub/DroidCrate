import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'node:path'
import { DeviceWatcher } from './device/watcher'
import { registerIpc } from './ipc'
import { loadPlatformToolsCatalog } from './platformTools/catalog'
import { PlatformToolsService } from './platformTools/service'
import { AdbService } from './adb/service'
import { LearningStore } from './learning/store'
import { LearningService } from './learning/service'
import { HistoryService } from './history/service'

const isWindows = process.platform === 'win32'
const deviceWatcher = new DeviceWatcher()
let learningStore: LearningStore | null = null

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

app.whenReady().then(async () => {
  if (process.platform === 'win32') app.setAppUserModelId('app.droidcrate.desktop')

  try {
    const catalog = await loadPlatformToolsCatalog()
    const platformTools = new PlatformToolsService(catalog, app.getPath('userData'))
    await platformTools.initialize()
    learningStore = new LearningStore(join(app.getPath('userData'), 'droidcrate.db'))
    const learning = new LearningService(learningStore)
    const history = new HistoryService(learningStore)
    const adbWithHistory = new AdbService(platformTools, (entry) => history.record(entry))
    registerIpc(deviceWatcher, platformTools, adbWithHistory, learning, history)
  } catch (error) {
    dialog.showErrorBox(
      'DroidCrate could not start',
      `The bundled tool catalog could not be loaded.\n\n${error instanceof Error ? error.message : String(error)}`
    )
    app.quit()
    return
  }

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

app.on('before-quit', () => {
  deviceWatcher.stop()
  learningStore?.close()
  learningStore = null
})
