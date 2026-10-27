import { useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Battery,
  CheckCircle2,
  ChevronRight,
  Cpu,
  HardDrive,
  Loader2,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Terminal,
  Trash2,
  XCircle,
  type LucideIcon
} from 'lucide-react'
import {
  ADB_ACTIONS,
  parseGetProp,
  summariseDevice,
  type AdbActionId,
  type AdbDevice,
  type AdbLogEntry
} from '@shared/adb'
import { PlatformToolsCard } from '../components/PlatformToolsCard'
import { RestartGate } from '../components/RestartGate'
import { SectionHeader } from '../components/SectionHeader'
import { useAdbWorkspace } from '../hooks/useAdbWorkspace'
import { useI18n } from '../i18n'

const ACTION_LABEL_KEYS: Record<AdbActionId, string> = {
  'adb-version': 'adb.actions.version',
  'adb-devices': 'adb.actions.devices',
  'adb-device-info': 'adb.actions.info',
  'adb-battery': 'adb.actions.battery',
  'adb-storage': 'adb.actions.storage',
  'adb-reboot-system': 'adb.actions.rebootSystem',
  'adb-reboot-bootloader': 'adb.actions.rebootBootloader',
  'adb-reboot-recovery': 'adb.actions.rebootRecovery',
  'fastboot-devices': 'adb.fastboot.scan',
  'fastboot-info': 'adb.fastboot.vars'
}

function formatClock(value: string, lang: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}

function deviceStateLabel(state: string, t: (key: string) => string): string {
  if (state === 'device') return t('adb.devices.ready')
  if (state === 'unauthorized') return t('adb.devices.unauthorizedState')
  if (state === 'offline') return t('adb.devices.offline')
  return state
}

function ActionButton({
  icon: Icon,
  label,
  detail,
  onClick,
  disabled,
  running,
  tone = 'default'
}: {
  icon: LucideIcon
  label: string
  detail: string
  onClick: () => void
  disabled: boolean
  running: boolean
  tone?: 'default' | 'warm'
}) {
  return (
    <button
      type="button"
      className={`action-button${tone === 'warm' ? ' action-button--warm' : ''}`}
      onClick={onClick}
      disabled={disabled || running}
    >
      <span className="action-button__icon">
        {running ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Icon size={16} aria-hidden="true" />}
      </span>
      <span className="action-button__copy">
        <strong>{label}</strong>
        <span>{detail}</span>
      </span>
      <ChevronRight size={14} className="action-button__chevron" aria-hidden="true" />
    </button>
  )
}

function DeviceRow({
  device,
  active,
  onSelect
}: {
  device: AdbDevice
  active: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      className={`device-pick${active ? ' is-active' : ''}`}
      onClick={onSelect}
      aria-pressed={active}
    >
      <span className={`device-pick__dot device-pick__dot--${device.state}`} aria-hidden="true" />
      <span className="device-pick__copy">
        <strong>{device.model ?? device.product ?? device.serial}</strong>
        <span>
          {device.serial}
          <span className="device-pick__state">{device.state}</span>
        </span>
      </span>
      {active ? <CheckCircle2 size={15} aria-hidden="true" /> : null}
    </button>
  )
}

function LogRow({ entry, lang }: { entry: AdbLogEntry; lang: string }) {
  const { t } = useI18n()
  return (
    <details className={`log-entry${entry.ok ? '' : ' log-entry--error'}`}>
      <summary>
        <span className="log-entry__status">
          {entry.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
        </span>
        <span className="log-entry__time">{formatClock(entry.startedAt, lang)}</span>
        <code>{entry.command}</code>
        <span className="log-entry__duration">{entry.durationMs} ms</span>
        <span className="log-entry__chevron" aria-hidden="true">
          <ChevronRight size={13} />
        </span>
      </summary>
      <div className="log-entry__body">
        {entry.error ? (
          <p className="log-entry__error">
            <AlertTriangle size={13} aria-hidden="true" />
            {entry.error}
          </p>
        ) : null}
        <pre>{entry.output || t('adb.log.noOutput')}</pre>
      </div>
    </details>
  )
}

function GroupTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="action-group__title">
      <strong>{children}</strong>
      {hint ? <span>{hint}</span> : null}
    </div>
  )
}

export function AdbScreen() {
  const { t, lang } = useI18n()
  const workspace = useAdbWorkspace()
  const [gateAction, setGateAction] = useState<AdbActionId | null>(null)

  const status = workspace.status
  const ready = status?.installed === true
  const selectedDevice = useMemo(
    () => workspace.adbDevices.find((device) => device.serial === workspace.selectedSerial) ?? null,
    [workspace.adbDevices, workspace.selectedSerial]
  )
  const selectedFastboot = useMemo(
    () => workspace.fastbootDevices.find((device) => device.serial === workspace.selectedFastboot) ?? null,
    [workspace.fastbootDevices, workspace.selectedFastboot]
  )
  const unauthorized = workspace.adbDevices.filter((device) => device.state === 'unauthorized')
  const busy = workspace.busyAction !== null

  /**
   * The last successful `getprop` entry is parsed into a small, readable
   * snapshot so the raw property dump is not the only result of the action.
   */
  const snapshot = useMemo(() => {
    const entry = workspace.log.find(
      (item) => item.action === 'adb-device-info' && item.ok && item.output.trim().length > 0
    )
    return entry ? summariseDevice(parseGetProp(entry.output)) : null
  }, [workspace.log])

  function runRead(action: AdbActionId): void {
    void workspace.runAction(action)
  }

  function requestAction(action: AdbActionId): void {
    if (ADB_ACTIONS[action].requiresConfirmation) {
      setGateAction(action)
      return
    }
    runRead(action)
  }

  function confirmRestart(): void {
    if (!gateAction) return
    const action = gateAction
    setGateAction(null)
    void workspace.runAction(action, true)
  }

  return (
    <div className="screen">
      <SectionHeader
        eyebrow={t('adb.eyebrow')}
        title={t('adb.title')}
        subtitle={t('adb.subtitle')}
        aside={
          <div className="status-chip">
            <span
              className={`status-chip__dot${ready ? ' status-chip__dot--live' : ''}`}
              aria-hidden="true"
            />
            <span>
              {workspace.statusLoading
                ? t('adb.checking')
                : ready
                  ? t('adb.installed', { version: status?.version ?? '' })
                  : t('adb.notInstalled')}
            </span>
            <span className="status-chip__sep" aria-hidden="true" />
            <span className="status-chip__muted">{t('adb.readOnly')}</span>
          </div>
        }
      />

      <PlatformToolsCard
        status={status}
        loading={workspace.statusLoading}
        installing={workspace.installing}
        onInstall={() => void workspace.install()}
        onCancel={() => void workspace.cancelInstall()}
        onRecheck={() => void workspace.recheck()}
      />

      <div className="adb-banner">
        <span className="adb-banner__icon">
          <ShieldCheck size={18} aria-hidden="true" />
        </span>
        <div>
          <strong>{t('adb.safety.title')}</strong>
          <span>{t('adb.safety.body')}</span>
        </div>
        <span className="badge">{t('adb.stage')}</span>
      </div>

      {workspace.bridgeError ? (
        <div className="inline-note inline-note--warn adb-bridge-error">
          <AlertTriangle size={15} aria-hidden="true" />
          <div>
            <strong>{t('adb.bridgeError')}</strong>
            <span>{workspace.bridgeError}</span>
          </div>
        </div>
      ) : null}

      <div className="adb-grid">
        <section className="panel adb-panel">
          <div className="adb-panel__head">
            <div>
              <div className="eyebrow">{t('adb.devices.eyebrow')}</div>
              <h2>
                <Smartphone size={17} aria-hidden="true" />
                {t('adb.devices.title')}
              </h2>
            </div>
            <button
              type="button"
              className="button button--ghost button--compact"
              onClick={() => void workspace.refreshDevices()}
              disabled={!ready || workspace.refreshing}
            >
              <RefreshCw
                size={13}
                className={workspace.refreshing ? 'spin' : undefined}
                aria-hidden="true"
              />
              {t('adb.devices.refresh')}
            </button>
          </div>

          {!ready ? (
            <div className="adb-empty">
              <Terminal size={22} aria-hidden="true" />
              <strong>{t('adb.notReady')}</strong>
              <span>{t('adb.devices.notReadyBody')}</span>
            </div>
          ) : workspace.adbDevices.length === 0 ? (
            <div className="adb-empty">
              <Smartphone size={22} aria-hidden="true" />
              <strong>{t('adb.devices.empty')}</strong>
              <span>{t('adb.devices.emptyBody')}</span>
            </div>
          ) : (
            <div className="device-picks">
              {workspace.adbDevices.map((device) => (
                <DeviceRow
                  key={device.serial}
                  device={device}
                  active={device.serial === workspace.selectedSerial}
                  onSelect={() => workspace.selectSerial(device.serial)}
                />
              ))}
            </div>
          )}

          {workspace.adbError ? (
            <p className="adb-panel__error">{workspace.adbError}</p>
          ) : null}

          {unauthorized.length > 0 ? (
            <div className="inline-note inline-note--warn adb-unauthorized">
              <AlertTriangle size={15} aria-hidden="true" />
              <div>
                <strong>{t('adb.devices.unauthorized')}</strong>
                <span>{t('adb.devices.unauthorizedBody')}</span>
              </div>
            </div>
          ) : null}

          {selectedDevice ? (
            <div className="adb-target">
              <span className="adb-target__label">{t('adb.devices.target')}</span>
              <strong>{selectedDevice.model ?? selectedDevice.product ?? selectedDevice.serial}</strong>
              <code>{selectedDevice.serial}</code>
              <span className={`badge${selectedDevice.state === 'device' ? '' : ' badge--quiet'}`}>
                {deviceStateLabel(selectedDevice.state, t)}
              </span>
            </div>
          ) : null}

          {snapshot ? (
            <div className="adb-snapshot">
              <div className="adb-snapshot__head">
                <Cpu size={13} aria-hidden="true" />
                <strong>{t('adb.snapshot.title')}</strong>
              </div>
              <dl className="adb-snapshot__grid">
                <div>
                  <dt>{t('adb.snapshot.model')}</dt>
                  <dd>{snapshot.model ?? t('adb.snapshot.unknown')}</dd>
                </div>
                <div>
                  <dt>{t('adb.snapshot.android')}</dt>
                  <dd>
                    {snapshot.androidVersion ?? t('adb.snapshot.unknown')}
                    {snapshot.sdk ? ` · API ${snapshot.sdk}` : ''}
                  </dd>
                </div>
                <div>
                  <dt>{t('adb.snapshot.build')}</dt>
                  <dd title={snapshot.build ?? undefined}>
                    {snapshot.build ?? t('adb.snapshot.unknown')}
                  </dd>
                </div>
                <div>
                  <dt>{t('adb.snapshot.patch')}</dt>
                  <dd>{snapshot.securityPatch ?? t('adb.snapshot.unknown')}</dd>
                </div>
                <div>
                  <dt>{t('adb.snapshot.soc')}</dt>
                  <dd>{snapshot.soc ?? t('adb.snapshot.unknown')}</dd>
                </div>
                <div>
                  <dt>{t('adb.snapshot.bootloader')}</dt>
                  <dd className={snapshot.bootloaderUnlocked === true ? 'is-warn' : undefined}>
                    {snapshot.bootloaderUnlocked === true
                      ? t('adb.snapshot.unlocked')
                      : snapshot.bootloaderUnlocked === false
                        ? t('adb.snapshot.locked')
                        : t('adb.snapshot.unknown')}
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          <div className="adb-subsection">
            <div className="adb-subsection__head">
              <div>
                <strong>{t('adb.fastboot.title')}</strong>
                <span>{t('adb.fastboot.body')}</span>
              </div>
              <button
                type="button"
                className="button button--ghost button--compact"
                onClick={() => void workspace.scanFastboot()}
                disabled={!ready || workspace.fastbootScanning}
              >
                <RefreshCw
                  size={13}
                  className={workspace.fastbootScanning ? 'spin' : undefined}
                  aria-hidden="true"
                />
                {workspace.fastbootScanning ? t('adb.fastboot.scanning') : t('adb.fastboot.scan')}
              </button>
            </div>

            {workspace.fastbootDevices.length > 0 ? (
              <div className="fastboot-list">
                {workspace.fastbootDevices.map((device) => (
                  <button
                    key={device.serial}
                    type="button"
                    className={`fastboot-pick${device.serial === workspace.selectedFastboot ? ' is-active' : ''}`}
                    onClick={() => workspace.selectFastboot(device.serial)}
                    aria-pressed={device.serial === workspace.selectedFastboot}
                  >
                    <Cpu size={14} aria-hidden="true" />
                    <code>{device.serial}</code>
                    <span>{device.state}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="adb-subsection__empty">{t('adb.fastboot.empty')}</p>
            )}
            {workspace.fastbootError ? (
              <p className="adb-panel__error">{workspace.fastbootError}</p>
            ) : null}
          </div>
        </section>

        <section className="panel adb-panel">
          <div className="adb-panel__head">
            <div>
              <div className="eyebrow">{t('adb.actions.eyebrow')}</div>
              <h2>
                <Play size={16} aria-hidden="true" />
                {t('adb.actions.title')}
              </h2>
            </div>
            {selectedDevice ? (
              <span className="badge badge--quiet">{selectedDevice.serial}</span>
            ) : null}
          </div>

          <GroupTitle hint={t('adb.actions.readHint')}>{t('adb.actions.readGroup')}</GroupTitle>
          <div className="action-grid">
            <ActionButton
              icon={Terminal}
              label={t('adb.actions.version')}
              detail={t('adb.actions.versionBody')}
              onClick={() => runRead('adb-version')}
              disabled={!ready || busy}
              running={workspace.busyAction === 'adb-version'}
            />
            <ActionButton
              icon={Cpu}
              label={t('adb.actions.info')}
              detail={t('adb.actions.infoBody')}
              onClick={() => runRead('adb-device-info')}
              disabled={!ready || !selectedDevice || busy}
              running={workspace.busyAction === 'adb-device-info'}
            />
            <ActionButton
              icon={Battery}
              label={t('adb.actions.battery')}
              detail={t('adb.actions.batteryBody')}
              onClick={() => runRead('adb-battery')}
              disabled={!ready || !selectedDevice || busy}
              running={workspace.busyAction === 'adb-battery'}
            />
            <ActionButton
              icon={HardDrive}
              label={t('adb.actions.storage')}
              detail={t('adb.actions.storageBody')}
              onClick={() => runRead('adb-storage')}
              disabled={!ready || !selectedDevice || busy}
              running={workspace.busyAction === 'adb-storage'}
            />
          </div>

          <div className="action-group">
            <GroupTitle hint={t('adb.actions.restartHint')}>{t('adb.actions.restartGroup')}</GroupTitle>
            <div className="restart-row">
              <button
                type="button"
                className="restart-button"
                onClick={() => requestAction('adb-reboot-system')}
                disabled={!ready || !selectedDevice || busy}
              >
                <RotateCcw size={15} aria-hidden="true" />
                {t('adb.actions.rebootSystem')}
              </button>
              <button
                type="button"
                className="restart-button restart-button--warm"
                onClick={() => requestAction('adb-reboot-bootloader')}
                disabled={!ready || !selectedDevice || busy}
              >
                <Power size={15} aria-hidden="true" />
                {t('adb.actions.rebootBootloader')}
              </button>
              <button
                type="button"
                className="restart-button"
                onClick={() => requestAction('adb-reboot-recovery')}
                disabled={!ready || !selectedDevice || busy}
              >
                <RefreshCw size={15} aria-hidden="true" />
                {t('adb.actions.rebootRecovery')}
              </button>
            </div>
            <p className="action-group__note">{t('adb.actions.rebootBody')}</p>
          </div>

          <div className="action-group">
            <GroupTitle>{t('adb.fastboot.group')}</GroupTitle>
            <ActionButton
              icon={ShieldCheck}
              label={t('adb.fastboot.vars')}
              detail={
                selectedFastboot
                  ? t('adb.fastboot.varsBody')
                  : t('adb.fastboot.noTarget')
              }
              onClick={() => runRead('fastboot-info')}
              disabled={!ready || !selectedFastboot || busy}
              running={workspace.busyAction === 'fastboot-info'}
            />
          </div>
        </section>
      </div>

      <section className="panel adb-console">
        <div className="adb-console__head">
          <div>
            <div className="eyebrow">{t('adb.log.eyebrow')}</div>
            <h2>
              <Terminal size={16} aria-hidden="true" />
              {t('adb.log.title')}
              {workspace.log.length > 0 ? (
                <span className="adb-console__count">{workspace.log.length}</span>
              ) : null}
            </h2>
            <p>{t('adb.log.subtitle')}</p>
          </div>
          <div className="adb-console__actions">
            <span className="badge badge--quiet">{t('adb.log.local')}</span>
            <button
              type="button"
              className="button button--ghost button--compact"
              onClick={() => void workspace.clearLog()}
              disabled={workspace.log.length === 0}
            >
              <Trash2 size={13} aria-hidden="true" />
              {t('adb.log.clear')}
            </button>
          </div>
        </div>

        {workspace.log.length === 0 ? (
          <div className="adb-console__empty">
            <Terminal size={20} aria-hidden="true" />
            <div>
              <strong>{t('adb.log.empty')}</strong>
              <span>{t('adb.log.emptyBody')}</span>
            </div>
          </div>
        ) : (
          <div className="log-list">
            {workspace.log.map((entry) => (
              <LogRow key={entry.id} entry={entry} lang={lang} />
            ))}
          </div>
        )}
      </section>

      {gateAction ? (
        <RestartGate
          actionLabel={t(ACTION_LABEL_KEYS[gateAction])}
          serial={workspace.selectedSerial ?? ''}
          onCancel={() => setGateAction(null)}
          onConfirm={confirmRestart}
        />
      ) : null}
    </div>
  )
}
