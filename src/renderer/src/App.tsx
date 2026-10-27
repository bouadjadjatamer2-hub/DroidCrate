import { useEffect, useState } from 'react'
import type { AppInfo, SectionId } from '@shared/api'
import { WELCOME_STORAGE_KEY, createWelcomeRecord, isWelcomeAccepted } from '@shared/welcome'
import { Sidebar } from './components/Sidebar'
import { Titlebar } from './components/Titlebar'
import { WelcomeGate } from './components/WelcomeGate'
import { DeviceScreen } from './screens/DeviceScreen'
import { ToolsScreen } from './screens/ToolsScreen'
import { AdbScreen } from './screens/AdbScreen'
import { ChecklistsScreen } from './screens/ChecklistsScreen'
import { LessonsScreen } from './screens/LessonsScreen'
import { HistoryScreen } from './screens/HistoryScreen'
import { SettingsScreen } from './screens/SettingsScreen'

function SectionContent({
  section,
  info
}: {
  section: SectionId
  info: AppInfo | null
}) {
  switch (section) {
    case 'device':
      return <DeviceScreen />
    case 'tools':
      return <ToolsScreen />
    case 'adb':
      return <AdbScreen />
    case 'checklists':
      return <ChecklistsScreen />
    case 'lessons':
      return <LessonsScreen />
    case 'history':
      return <HistoryScreen />
    case 'settings':
      return <SettingsScreen info={info} />
  }
}

export function App() {
  const [section, setSection] = useState<SectionId>('device')
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [welcomeAccepted, setWelcomeAccepted] = useState(() =>
    isWelcomeAccepted(localStorage.getItem(WELCOME_STORAGE_KEY))
  )

  useEffect(() => {
    let cancelled = false
    window.droidcrate
      .getAppInfo()
      .then((value) => {
        if (!cancelled) setInfo(value)
      })
      .catch(() => {
        // The shell remains usable even if the bridge is unavailable.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="app-shell">
      <Titlebar version={info?.version ?? '0.1.0'} />
      {welcomeAccepted ? (
        <div className="shell">
          <Sidebar active={section} version={info?.version ?? '0.1.0'} onSelect={setSection} />
          <main className="main">
            <div key={section} className="screen-wrap">
              <SectionContent section={section} info={info} />
            </div>
          </main>
        </div>
      ) : (
        <WelcomeGate
          onAccept={() => {
            localStorage.setItem(WELCOME_STORAGE_KEY, JSON.stringify(createWelcomeRecord()))
            setWelcomeAccepted(true)
          }}
        />
      )}
    </div>
  )
}
