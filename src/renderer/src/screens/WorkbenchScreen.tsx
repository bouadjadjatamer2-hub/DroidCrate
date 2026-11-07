import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactElement,
} from "react";
import {
  AlertTriangle,
  AppWindow,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Download,
  FileUp,
  FolderDown,
  Image as ImageIcon,
  Loader2,
  MonitorSmartphone,
  Play,
  Power,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Smartphone,
  Square,
  Terminal,
  Trash2,
  Upload,
  Usb,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { AdbDevice } from "@shared/adb";
import { parseGetProp, summariseDevice, type DeviceSummary } from "@shared/adb";
import {
  BACKUP_FOLDERS,
  COMMON_PARTITIONS,
  type BackupResult,
  type LogcatState,
  type PackageAction,
  type RecordingState,
  type RebootTarget,
  type ScreenshotResult,
  type ToolkitPackage,
  type ToolkitProgress,
  type ToolkitResult,
  type ToolkitTool,
} from "@shared/toolkit";
import { PlatformToolsCard } from "../components/PlatformToolsCard";
import { SectionHeader } from "../components/SectionHeader";
import { useAdbWorkspace } from "../hooks/useAdbWorkspace";
import { useI18n } from "../i18n";

type TabId = "overview" | "apps" | "files" | "screen" | "flash" | "terminal";
type Tone = "info" | "success" | "error";
type Notify = (tone: Tone, text: string) => void;

const TABS: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "wb.tab.overview", icon: Smartphone },
  { id: "apps", label: "wb.tab.apps", icon: AppWindow },
  { id: "files", label: "wb.tab.files", icon: FolderDown },
  { id: "screen", label: "wb.tab.screen", icon: MonitorSmartphone },
  { id: "flash", label: "wb.tab.flash", icon: Zap },
  { id: "terminal", label: "wb.tab.terminal", icon: Terminal },
];

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function basename(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  disabled,
  className = "button button--ghost button--compact",
  icon: Icon,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
  icon?: LucideIcon;
}): ReactElement {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [armed]);

  return (
    <button
      type="button"
      className={`${className}${armed ? " wb-confirm-armed" : ""}`}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {Icon ? <Icon size={13} aria-hidden="true" /> : null}
      {armed ? confirmLabel : label}
    </button>
  );
}

function EmptyHint({
  icon: Icon,
  title,
  body,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="wb-empty">
      <Icon size={22} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{body}</span>
    </div>
  );
}

export function WorkbenchScreen() {
  const { t } = useI18n();
  const workspace = useAdbWorkspace();
  const [tab, setTab] = useState<TabId>("overview");
  const [progress, setProgress] = useState<ToolkitProgress | null>(null);
  const [notice, setNotice] = useState<{ tone: Tone; text: string } | null>(
    null,
  );

  const notify = useCallback<Notify>(
    (tone, text) => setNotice({ tone, text }),
    [],
  );

  useEffect(() => {
    const off = window.droidcrate.onToolkitProgress((next) => {
      setProgress(next);
      if (next.state === "failed" && next.detail) {
        setNotice({ tone: "error", text: next.detail });
      }
    });
    return off;
  }, []);

  const status = workspace.status;
  const ready = status?.installed === true;
  const selectedDevice = useMemo(
    () =>
      workspace.adbDevices.find(
        (device) => device.serial === workspace.selectedSerial,
      ) ?? null,
    [workspace.adbDevices, workspace.selectedSerial],
  );
  const serial =
    selectedDevice?.state === "device" ? selectedDevice.serial : null;
  const fastbootSerial = workspace.selectedFastboot;

  const running = progress?.state === "running" ? progress : null;

  return (
    <div className="screen">
      <SectionHeader
        eyebrow={t("wb.eyebrow")}
        title={t("wb.title")}
        subtitle={t("wb.subtitle")}
        aside={
          <div className="status-chip">
            <span
              className={`status-chip__dot${ready ? " status-chip__dot--live" : ""}`}
              aria-hidden="true"
            />
            <span>
              {ready
                ? t("wb.ready", { version: status?.version ?? "" })
                : t("wb.notReady")}
            </span>
            <span className="status-chip__sep" aria-hidden="true" />
            <span className="status-chip__muted">{t("wb.local")}</span>
          </div>
        }
      />

      {!ready ? (
        <PlatformToolsCard
          status={status}
          loading={workspace.statusLoading}
          installing={workspace.installing}
          onInstall={() => void workspace.install()}
          onCancel={() => void workspace.cancelInstall()}
          onRecheck={() => void workspace.recheck()}
        />
      ) : null}

      <div className="wb-devices">
        <div className="wb-devices__head">
          <Usb size={15} aria-hidden="true" />
          <strong>{t("wb.device.title")}</strong>
          <span className="wb-devices__hint">
            {workspace.adbDevices.length === 0
              ? t("wb.device.none")
              : t("wb.device.count", { count: workspace.adbDevices.length })}
          </span>
          <button
            type="button"
            className="button button--ghost button--compact"
            onClick={() => void workspace.refreshDevices()}
            disabled={!ready || workspace.refreshing}
          >
            <RefreshCw
              size={13}
              className={workspace.refreshing ? "spin" : undefined}
              aria-hidden="true"
            />
            {t("wb.device.refresh")}
          </button>
        </div>
        {workspace.adbDevices.length > 0 ? (
          <div className="wb-device-row">
            {workspace.adbDevices.map((device) => (
              <button
                key={device.serial}
                type="button"
                className={`wb-device-chip${device.serial === workspace.selectedSerial ? " is-active" : ""}`}
                onClick={() => workspace.selectSerial(device.serial)}
              >
                <span
                  className={`device-pick__dot device-pick__dot--${device.state}`}
                  aria-hidden="true"
                />
                <span>
                  <strong>
                    {device.model ?? device.product ?? device.serial}
                  </strong>
                  <code>{device.serial}</code>
                </span>
                <span className="wb-device-chip__state">{device.state}</span>
              </button>
            ))}
          </div>
        ) : null}
        {workspace.adbDevices.some(
          (device) => device.state === "unauthorized",
        ) ? (
          <div className="inline-note inline-note--warn">
            <AlertTriangle size={15} aria-hidden="true" />
            <div>
              <strong>{t("wb.device.unauthorized")}</strong>
              <span>{t("wb.device.unauthorizedBody")}</span>
            </div>
          </div>
        ) : null}
        {workspace.adbError ? (
          <div className="inline-note inline-note--warn">
            <AlertTriangle size={15} aria-hidden="true" />
            <div>
              <strong>{t("wb.device.error")}</strong>
              <span>{workspace.adbError}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="wb-tabs" role="tablist">
        {TABS.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              className={`wb-tab${tab === entry.id ? " is-active" : ""}`}
              onClick={() => setTab(entry.id)}
            >
              <Icon size={15} aria-hidden="true" />
              {t(entry.label)}
            </button>
          );
        })}
      </div>

      {running ? (
        <div className="wb-progress">
          <div className="wb-progress__meta">
            <span>{running.label}</span>
            <span>
              {running.detail ??
                (running.percent === null
                  ? t("wb.working")
                  : `${running.percent}%`)}
            </span>
          </div>
          <div
            className={`progress${running.percent === null ? " progress--busy" : ""}`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={running.percent ?? undefined}
          >
            <span
              style={
                running.percent === null
                  ? undefined
                  : { width: `${running.percent}%` }
              }
            />
          </div>
        </div>
      ) : null}

      {notice ? (
        <div
          className={`inline-note inline-note--${notice.tone === "error" ? "warn" : "info"} wb-notice`}
        >
          {notice.tone === "error" ? (
            <AlertTriangle size={15} aria-hidden="true" />
          ) : (
            <CheckCircle2 size={15} aria-hidden="true" />
          )}
          <div>
            <span>{notice.text}</span>
          </div>
          <button
            type="button"
            className="link-button"
            onClick={() => setNotice(null)}
          >
            {t("wb.dismiss")}
          </button>
        </div>
      ) : null}

      {tab === "overview" ? (
        <OverviewTab
          serial={serial}
          device={selectedDevice}
          notify={notify}
          onGoTo={setTab}
        />
      ) : null}
      {tab === "apps" ? <AppsTab serial={serial} notify={notify} /> : null}
      {tab === "files" ? <FilesTab serial={serial} notify={notify} /> : null}
      {tab === "screen" ? <ScreenTab serial={serial} notify={notify} /> : null}
      {tab === "flash" ? (
        <FlashTab
          fastbootSerial={fastbootSerial}
          selectFastboot={workspace.selectFastboot}
          fastbootDevices={workspace.fastbootDevices}
          scanFastboot={workspace.scanFastboot}
          scanning={workspace.fastbootScanning}
          adbSerial={serial}
          notify={notify}
        />
      ) : null}
      {tab === "terminal" ? (
        <TerminalTab
          serial={serial}
          fastbootSerial={fastbootSerial}
          notify={notify}
        />
      ) : null}
    </div>
  );
}

// --------------------------------------------------------------------- overview

function OverviewTab({
  serial,
  device,
  notify,
  onGoTo,
}: {
  serial: string | null;
  device: AdbDevice | null;
  notify: Notify;
  onGoTo: (tab: TabId) => void;
}): ReactElement {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<DeviceSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!serial) {
      setSnapshot(null);
      return;
    }
    setLoading(true);
    try {
      const result = await window.droidcrate.runToolkitCommand({
        tool: "adb",
        serial,
        args: ["shell", "getprop"],
      });
      if (result.ok) setSnapshot(summariseDevice(parseGetProp(result.output)));
      else notify("error", result.error ?? t("wb.failed"));
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setLoading(false);
    }
  }, [notify, serial, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function reboot(target: RebootTarget): Promise<void> {
    if (!serial) return;
    setBusy(target);
    try {
      const result = await window.droidcrate.rebootDevice(
        serial,
        target,
        "adb",
      );
      notify(
        result.ok ? "success" : "error",
        result.ok
          ? t("wb.overview.rebootSent", { target })
          : (result.error ?? t("wb.failed")),
      );
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  if (!serial) {
    return (
      <section className="panel">
        <EmptyHint
          icon={Smartphone}
          title={t("wb.needDevice")}
          body={t("wb.needDeviceBody")}
        />
      </section>
    );
  }

  const rows: Array<{ label: string; value: string | null }> = [
    { label: t("wb.overview.model"), value: snapshot?.model ?? null },
    {
      label: t("wb.overview.android"),
      value: snapshot?.androidVersion
        ? `${snapshot.androidVersion}${snapshot.sdk ? ` · API ${snapshot.sdk}` : ""}`
        : null,
    },
    { label: t("wb.overview.build"), value: snapshot?.build ?? null },
    { label: t("wb.overview.patch"), value: snapshot?.securityPatch ?? null },
    { label: t("wb.overview.soc"), value: snapshot?.soc ?? null },
    { label: t("wb.overview.abi"), value: snapshot?.abi ?? null },
  ];

  return (
    <div className="wb-grid">
      <section className="panel">
        <div className="adb-panel__head">
          <div>
            <div className="eyebrow">{t("wb.overview.eyebrow")}</div>
            <h2>
              <Smartphone size={17} aria-hidden="true" />
              {device?.model ?? device?.serial ?? t("wb.overview.title")}
            </h2>
          </div>
          <button
            type="button"
            className="button button--ghost button--compact"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              size={13}
              className={loading ? "spin" : undefined}
              aria-hidden="true"
            />
            {t("wb.overview.refresh")}
          </button>
        </div>

        <dl className="wb-facts">
          {rows.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value ?? t("wb.overview.unknown")}</dd>
            </div>
          ))}
          <div>
            <dt>{t("wb.overview.bootloader")}</dt>
            <dd
              className={
                snapshot?.bootloaderUnlocked === true ? "is-warn" : undefined
              }
            >
              {snapshot?.bootloaderUnlocked === true
                ? t("wb.overview.unlocked")
                : snapshot?.bootloaderUnlocked === false
                  ? t("wb.overview.locked")
                  : t("wb.overview.unknown")}
            </dd>
          </div>
        </dl>

        <div className="wb-quick">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onGoTo("apps")}
          >
            <AppWindow size={14} aria-hidden="true" />
            {t("wb.overview.apps")}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onGoTo("files")}
          >
            <FolderDown size={14} aria-hidden="true" />
            {t("wb.overview.files")}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onGoTo("screen")}
          >
            <MonitorSmartphone size={14} aria-hidden="true" />
            {t("wb.overview.screen")}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => onGoTo("terminal")}
          >
            <Terminal size={14} aria-hidden="true" />
            {t("wb.overview.terminal")}
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="adb-panel__head">
          <div>
            <div className="eyebrow">{t("wb.overview.powerEyebrow")}</div>
            <h2>
              <Power size={16} aria-hidden="true" />
              {t("wb.overview.power")}
            </h2>
          </div>
        </div>
        <div className="wb-power">
          <ConfirmButton
            label={t("wb.overview.rebootSystem")}
            confirmLabel={t("wb.confirm")}
            icon={RotateCcw}
            disabled={busy !== null}
            onConfirm={() => void reboot("system")}
          />
          <ConfirmButton
            label={t("wb.overview.rebootBootloader")}
            confirmLabel={t("wb.confirm")}
            icon={Zap}
            disabled={busy !== null}
            onConfirm={() => void reboot("bootloader")}
          />
          <ConfirmButton
            label={t("wb.overview.rebootRecovery")}
            confirmLabel={t("wb.confirm")}
            icon={RefreshCw}
            disabled={busy !== null}
            onConfirm={() => void reboot("recovery")}
          />
          <ConfirmButton
            label={t("wb.overview.rebootFastbootd")}
            confirmLabel={t("wb.confirm")}
            icon={Usb}
            disabled={busy !== null}
            onConfirm={() => void reboot("fastbootd")}
          />
          <ConfirmButton
            label={t("wb.overview.poweroff")}
            confirmLabel={t("wb.confirm")}
            icon={Power}
            disabled={busy !== null}
            onConfirm={() => void reboot("poweroff")}
          />
        </div>
        <p className="wb-note">{t("wb.overview.powerBody")}</p>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------------- apps

function AppsTab({
  serial,
  notify,
}: {
  serial: string | null;
  notify: Notify;
}): ReactElement {
  const { t } = useI18n();
  const [packages, setPackages] = useState<ToolkitPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [system, setSystem] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);

  const load = useCallback(async () => {
    if (!serial) {
      setPackages([]);
      return;
    }
    setLoading(true);
    try {
      const result = await window.droidcrate.listPackages(serial, system);
      setPackages(result.packages);
      if (!result.ok && result.error) notify("error", result.error);
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setLoading(false);
    }
  }, [notify, serial, system]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return packages;
    return packages.filter((entry) =>
      entry.name.toLowerCase().includes(needle),
    );
  }, [packages, query]);

  async function install(path: string): Promise<void> {
    if (!serial) return;
    setInstalling(true);
    try {
      const result = await window.droidcrate.installApk(serial, path);
      notify(
        result.ok ? "success" : "error",
        result.ok
          ? t("wb.apps.installed", { name: basename(path) })
          : (result.error ?? t("wb.failed")),
      );
      if (result.ok) await load();
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setInstalling(false);
    }
  }

  async function pickAndInstall(): Promise<void> {
    const path = await window.droidcrate.pickFile("apk");
    if (path) await install(path);
  }

  async function act(
    entry: ToolkitPackage,
    action: PackageAction,
  ): Promise<void> {
    if (!serial) return;
    setBusy(`${action}:${entry.name}`);
    try {
      const result = await window.droidcrate.packageAction(
        serial,
        entry.name,
        action,
      );
      notify(
        result.ok ? "success" : "error",
        result.ok
          ? t("wb.apps.done", { action: t(`wb.apps.${action}`) })
          : (result.error ?? t("wb.failed")),
      );
      if (result.ok) await load();
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function exportApk(entry: ToolkitPackage): Promise<void> {
    if (!serial) return;
    setBusy(`export:${entry.name}`);
    try {
      const result = await window.droidcrate.exportApk(serial, entry.name);
      if (result.ok && result.path) {
        notify("success", t("wb.apps.exported", { path: result.path }));
        void window.droidcrate.revealPath(result.path);
      } else {
        notify("error", result.error ?? t("wb.failed"));
      }
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  if (!serial) {
    return (
      <section className="panel">
        <EmptyHint
          icon={AppWindow}
          title={t("wb.needDevice")}
          body={t("wb.needDeviceBody")}
        />
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="adb-panel__head">
        <div>
          <div className="eyebrow">{t("wb.apps.eyebrow")}</div>
          <h2>
            <AppWindow size={17} aria-hidden="true" />
            {t("wb.apps.title")}
            {packages.length > 0 ? (
              <span className="adb-console__count">{packages.length}</span>
            ) : null}
          </h2>
          <p>{t("wb.apps.subtitle")}</p>
        </div>
        <div className="wb-head-actions">
          <button
            type="button"
            className="button button--primary button--compact"
            onClick={() => void pickAndInstall()}
            disabled={installing}
          >
            {installing ? (
              <Loader2 size={13} className="spin" aria-hidden="true" />
            ) : (
              <Download size={13} aria-hidden="true" />
            )}
            {t("wb.apps.install")}
          </button>
          <button
            type="button"
            className="button button--ghost button--compact"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              size={13}
              className={loading ? "spin" : undefined}
              aria-hidden="true"
            />
            {t("wb.overview.refresh")}
          </button>
        </div>
      </div>

      <div
        className="wb-drop"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const file = event.dataTransfer.files[0];
          if (!file) return;
          const path = window.droidcrate.pathForFile(file);
          if (path) void install(path);
        }}
      >
        <Upload size={16} aria-hidden="true" />
        <span>{t("wb.apps.drop")}</span>
      </div>

      <div className="wb-toolbar">
        <div className="wb-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder={t("wb.apps.search")}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t("wb.apps.search")}
          />
        </div>
        <label className="wb-check">
          <input
            type="checkbox"
            checked={system}
            onChange={(event) => setSystem(event.target.checked)}
          />
          {t("wb.apps.system")}
        </label>
      </div>

      {filtered.length === 0 ? (
        <EmptyHint
          icon={AppWindow}
          title={t("wb.apps.empty")}
          body={t("wb.apps.emptyBody")}
        />
      ) : (
        <div className="wb-pkg-list">
          {filtered.map((entry) => {
            const isBusy = busy !== null && busy.endsWith(entry.name);
            return (
              <div key={entry.name} className="wb-pkg">
                <div className="wb-pkg__copy">
                  <strong>{entry.name}</strong>
                  <code title={entry.apkPath ?? undefined}>
                    {entry.apkPath ?? "—"}
                  </code>
                </div>
                <div className="wb-pkg__actions">
                  <button
                    type="button"
                    className="button button--ghost button--compact"
                    disabled={isBusy}
                    onClick={() => void exportApk(entry)}
                  >
                    {busy === `export:${entry.name}` ? (
                      <Loader2 size={12} className="spin" />
                    ) : (
                      <FileUp size={12} />
                    )}
                    {t("wb.apps.export")}
                  </button>
                  <button
                    type="button"
                    className="button button--ghost button--compact"
                    disabled={isBusy}
                    onClick={() => void act(entry, "disable")}
                  >
                    {t("wb.apps.disable")}
                  </button>
                  <button
                    type="button"
                    className="button button--ghost button--compact"
                    disabled={isBusy}
                    onClick={() => void act(entry, "enable")}
                  >
                    {t("wb.apps.enable")}
                  </button>
                  <ConfirmButton
                    label={t("wb.apps.clear")}
                    confirmLabel={t("wb.confirm")}
                    disabled={isBusy}
                    onConfirm={() => void act(entry, "clear")}
                  />
                  <ConfirmButton
                    label={t("wb.apps.uninstall")}
                    confirmLabel={t("wb.confirm")}
                    disabled={isBusy}
                    onConfirm={() => void act(entry, "uninstall")}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------------ files

function FilesTab({
  serial,
  notify,
}: {
  serial: string | null;
  notify: Notify;
}): ReactElement {
  const { t } = useI18n();
  const [remotePath, setRemotePath] = useState("/sdcard/Download");
  const [sendPath, setSendPath] = useState<string | null>(null);
  const [sendRemote, setSendRemote] = useState("/sdcard/Download");
  const [busy, setBusy] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>([
    "DCIM",
    "Pictures",
    "WhatsApp",
  ]);
  const [destination, setDestination] = useState<string | null>(null);
  const [lastBackup, setLastBackup] = useState<BackupResult | null>(null);

  if (!serial) {
    return (
      <section className="panel">
        <EmptyHint
          icon={FolderDown}
          title={t("wb.needDevice")}
          body={t("wb.needDeviceBody")}
        />
      </section>
    );
  }

  async function pickSend(): Promise<void> {
    const path = await window.droidcrate.pickFile("any");
    if (path) {
      setSendPath(path);
      setSendRemote(`/sdcard/Download/${basename(path)}`);
    }
  }

  async function send(): Promise<void> {
    if (!serial || !sendPath) return;
    setBusy("send");
    try {
      const result = await window.droidcrate.pushFile({
        serial,
        localPath: sendPath,
        remotePath: sendRemote,
      });
      notify(
        result.ok ? "success" : "error",
        result.ok
          ? t("wb.files.sent", { name: basename(sendPath) })
          : (result.error ?? t("wb.failed")),
      );
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function receive(): Promise<void> {
    if (!serial) return;
    const folder = await window.droidcrate.pickFolder();
    if (!folder) return;
    setBusy("receive");
    try {
      const name = basename(remotePath) || "phone";
      const result = await window.droidcrate.pullFile({
        serial,
        localPath: `${folder}\\${name}`,
        remotePath,
      });
      if (result.ok) {
        notify(
          "success",
          t("wb.files.received", { path: `${folder}\\${name}` }),
        );
        void window.droidcrate.revealPath(`${folder}\\${name}`);
      } else {
        notify("error", result.error ?? t("wb.failed"));
      }
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function pickDestination(): Promise<string | null> {
    const folder = await window.droidcrate.pickFolder();
    if (folder) setDestination(folder);
    return folder;
  }

  async function backup(): Promise<void> {
    if (!serial) return;
    const folder = destination ?? (await pickDestination());
    if (!folder) return;
    setBusy("backup");
    try {
      const result = await window.droidcrate.backupDevice({
        serial,
        folders,
        destination: folder,
      });
      setLastBackup(result);
      const failed = result.folders.filter((entry) => !entry.ok);
      notify(
        result.ok ? "success" : "error",
        result.ok
          ? t("wb.files.backupDone", { path: result.destination })
          : failed
              .map((entry) => `${entry.folder}: ${entry.error ?? ""}`)
              .join(" · ") || t("wb.failed"),
      );
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function restore(): Promise<void> {
    if (!serial) return;
    const folder = destination ?? (await pickDestination());
    if (!folder) return;
    setBusy("restore");
    try {
      const result = await window.droidcrate.restoreDevice({
        serial,
        folders,
        destination: folder,
      });
      notify(
        result.ok ? "success" : "error",
        result.ok ? t("wb.files.restoreDone") : t("wb.failed"),
      );
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="wb-grid">
      <section className="panel">
        <div className="adb-panel__head">
          <div>
            <div className="eyebrow">{t("wb.files.sendEyebrow")}</div>
            <h2>
              <Upload size={16} aria-hidden="true" />
              {t("wb.files.send")}
            </h2>
            <p>{t("wb.files.sendBody")}</p>
          </div>
        </div>
        <div className="wb-field">
          <span>{t("wb.files.file")}</span>
          <div className="wb-field__row">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => void pickSend()}
              disabled={busy !== null}
            >
              <Upload size={13} aria-hidden="true" />
              {t("wb.files.pickFile")}
            </button>
            <code>{sendPath ?? t("wb.files.noFile")}</code>
          </div>
        </div>
        <label className="wb-field">
          <span>{t("wb.files.remotePath")}</span>
          <input
            value={sendRemote}
            onChange={(event) => setSendRemote(event.target.value)}
            spellCheck={false}
          />
        </label>
        <button
          type="button"
          className="button button--primary"
          onClick={() => void send()}
          disabled={!sendPath || busy !== null}
        >
          {busy === "send" ? (
            <Loader2 size={14} className="spin" aria-hidden="true" />
          ) : (
            <Upload size={14} aria-hidden="true" />
          )}
          {t("wb.files.sendAction")}
        </button>
      </section>

      <section className="panel">
        <div className="adb-panel__head">
          <div>
            <div className="eyebrow">{t("wb.files.receiveEyebrow")}</div>
            <h2>
              <Download size={16} aria-hidden="true" />
              {t("wb.files.receive")}
            </h2>
            <p>{t("wb.files.receiveBody")}</p>
          </div>
        </div>
        <label className="wb-field">
          <span>{t("wb.files.phonePath")}</span>
          <input
            value={remotePath}
            onChange={(event) => setRemotePath(event.target.value)}
            spellCheck={false}
          />
        </label>
        <div className="wb-chips">
          {[
            "/sdcard/DCIM",
            "/sdcard/Pictures",
            "/sdcard/Download",
            "/sdcard/WhatsApp",
            "/sdcard/Documents",
          ].map((path) => (
            <button
              key={path}
              type="button"
              className="chip"
              onClick={() => setRemotePath(path)}
            >
              {path.replace("/sdcard/", "")}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => void receive()}
          disabled={busy !== null}
        >
          {busy === "receive" ? (
            <Loader2 size={14} className="spin" aria-hidden="true" />
          ) : (
            <Download size={14} aria-hidden="true" />
          )}
          {t("wb.files.receiveAction")}
        </button>
      </section>

      <section className="panel wb-span">
        <div className="adb-panel__head">
          <div>
            <div className="eyebrow">{t("wb.files.backupEyebrow")}</div>
            <h2>
              <FolderDown size={16} aria-hidden="true" />
              {t("wb.files.backup")}
            </h2>
            <p>{t("wb.files.backupBody")}</p>
          </div>
        </div>

        <div className="wb-chips">
          {BACKUP_FOLDERS.map((folder) => {
            const active = folders.includes(folder);
            return (
              <button
                key={folder}
                type="button"
                className={`chip chip--filter${active ? " is-active" : ""}`}
                onClick={() =>
                  setFolders((previous) =>
                    previous.includes(folder)
                      ? previous.filter((entry) => entry !== folder)
                      : [...previous, folder],
                  )
                }
              >
                {folder}
              </button>
            );
          })}
        </div>

        <div className="wb-field__row">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => void pickDestination()}
            disabled={busy !== null}
          >
            <FolderDown size={13} aria-hidden="true" />
            {t("wb.files.destination")}
          </button>
          <code>{destination ?? t("wb.files.noFolder")}</code>
        </div>

        <div className="wb-actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => void backup()}
            disabled={busy !== null || folders.length === 0}
          >
            {busy === "backup" ? (
              <Loader2 size={14} className="spin" aria-hidden="true" />
            ) : (
              <FolderDown size={14} aria-hidden="true" />
            )}
            {t("wb.files.backupAction")}
          </button>
          <ConfirmButton
            label={t("wb.files.restoreAction")}
            confirmLabel={t("wb.confirm")}
            className="button button--ghost"
            disabled={busy !== null || folders.length === 0}
            onConfirm={() => void restore()}
          />
        </div>

        {lastBackup ? (
          <ul className="wb-backup-list">
            {lastBackup.folders.map((entry) => (
              <li key={entry.folder}>
                {entry.ok ? (
                  <CheckCircle2 size={13} className="is-ok" />
                ) : (
                  <XCircle size={13} className="is-error" />
                )}
                <span>{entry.folder}</span>
                <span className="muted">
                  {entry.ok ? t("wb.files.copied") : entry.error}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

// ----------------------------------------------------------------------- screen

function ScreenTab({
  serial,
  notify,
}: {
  serial: string | null;
  notify: Notify;
}): ReactElement {
  const { t } = useI18n();
  const [shot, setShot] = useState<ScreenshotResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [frame, setFrame] = useState<{
    dataUrl: string;
    width: number;
    height: number;
  } | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [recording, setRecording] = useState<RecordingState>({
    active: false,
    serial: null,
    startedAt: null,
  });
  const imageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    void window.droidcrate.getRecordingState().then(setRecording);
  }, []);

  useEffect(() => {
    if (!live || !serial) return;
    let cancelled = false;
    let timer = 0;

    const tick = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const next = await window.droidcrate.getLiveFrame(serial);
        if (!cancelled) {
          setFrame(next);
          setLiveError(null);
        }
      } catch (error) {
        if (!cancelled) setLiveError(errorText(error));
      }
      if (!cancelled) timer = window.setTimeout(() => void tick(), 800);
    };

    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [live, serial]);

  if (!serial) {
    return (
      <section className="panel">
        <EmptyHint
          icon={MonitorSmartphone}
          title={t("wb.needDevice")}
          body={t("wb.needDeviceBody")}
        />
      </section>
    );
  }

  async function screenshot(): Promise<void> {
    if (!serial) return;
    setBusy("shot");
    try {
      const result = await window.droidcrate.takeScreenshot(serial);
      setShot(result);
      notify("success", t("wb.screen.shotSaved", { path: result.path }));
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function toggleRecording(): Promise<void> {
    if (!serial) return;
    setBusy("record");
    try {
      if (recording.active) {
        const result = await window.droidcrate.stopRecording();
        setRecording({ active: false, serial: null, startedAt: null });
        if (result.path) {
          notify("success", t("wb.screen.recordSaved", { path: result.path }));
          void window.droidcrate.revealPath(result.path);
        } else {
          notify("error", result.error ?? t("wb.failed"));
        }
      } else {
        const next = await window.droidcrate.startRecording(serial);
        setRecording(next);
        notify("info", t("wb.screen.recordStarted"));
      }
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function tap(event: PointerEvent<HTMLImageElement>): Promise<void> {
    if (!frame || !serial) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(
      ((event.clientX - rect.left) / rect.width) * frame.width,
    );
    const y = Math.round(
      ((event.clientY - rect.top) / rect.height) * frame.height,
    );
    try {
      await window.droidcrate.sendInput(serial, ["tap", String(x), String(y)]);
    } catch (error) {
      notify("error", errorText(error));
    }
  }

  async function key(code: number): Promise<void> {
    if (!serial) return;
    try {
      await window.droidcrate.sendInput(serial, ["keyevent", String(code)]);
    } catch (error) {
      notify("error", errorText(error));
    }
  }

  return (
    <div className="wb-grid">
      <section className="panel">
        <div className="adb-panel__head">
          <div>
            <div className="eyebrow">{t("wb.screen.eyebrow")}</div>
            <h2>
              <ImageIcon size={16} aria-hidden="true" />
              {t("wb.screen.shot")}
            </h2>
            <p>{t("wb.screen.shotBody")}</p>
          </div>
        </div>
        <button
          type="button"
          className="button button--primary"
          onClick={() => void screenshot()}
          disabled={busy !== null}
        >
          {busy === "shot" ? (
            <Loader2 size={14} className="spin" aria-hidden="true" />
          ) : (
            <ImageIcon size={14} aria-hidden="true" />
          )}
          {t("wb.screen.shotAction")}
        </button>
        {shot ? (
          <div className="wb-shot">
            {shot.dataUrl ? (
              <img src={shot.dataUrl} alt={t("wb.screen.shot")} />
            ) : null}
            <div className="wb-shot__meta">
              <code>{shot.path}</code>
              <span>
                {shot.width && shot.height
                  ? `${shot.width}×${shot.height} · `
                  : ""}
                {formatBytes(shot.bytes)}
              </span>
              <button
                type="button"
                className="link-button"
                onClick={() => void window.droidcrate.revealPath(shot.path)}
              >
                {t("wb.openFolder")}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="adb-panel__head">
          <div>
            <div className="eyebrow">{t("wb.screen.recordEyebrow")}</div>
            <h2>
              <Circle size={16} aria-hidden="true" />
              {t("wb.screen.record")}
            </h2>
            <p>{t("wb.screen.recordBody")}</p>
          </div>
        </div>
        <button
          type="button"
          className={`button ${recording.active ? "button--warm" : "button--primary"}`}
          onClick={() => void toggleRecording()}
          disabled={busy !== null}
        >
          {busy === "record" ? (
            <Loader2 size={14} className="spin" aria-hidden="true" />
          ) : recording.active ? (
            <Square size={13} aria-hidden="true" />
          ) : (
            <Play size={13} aria-hidden="true" />
          )}
          {recording.active
            ? t("wb.screen.stopRecord")
            : t("wb.screen.startRecord")}
        </button>
      </section>

      <section className="panel wb-span">
        <div className="adb-panel__head">
          <div>
            <div className="eyebrow">{t("wb.screen.liveEyebrow")}</div>
            <h2>
              <MonitorSmartphone size={16} aria-hidden="true" />
              {t("wb.screen.live")}
            </h2>
            <p>{t("wb.screen.liveBody")}</p>
          </div>
          <button
            type="button"
            className={`button ${live ? "button--warm" : "button--primary"} button--compact`}
            onClick={() => setLive((previous) => !previous)}
          >
            {live ? (
              <Square size={12} aria-hidden="true" />
            ) : (
              <Play size={12} aria-hidden="true" />
            )}
            {live ? t("wb.screen.stopLive") : t("wb.screen.startLive")}
          </button>
        </div>

        {live ? (
          <>
            <div className="wb-live">
              {frame ? (
                <img
                  ref={imageRef}
                  src={frame.dataUrl}
                  alt={t("wb.screen.live")}
                  onPointerDown={(event) => void tap(event)}
                />
              ) : (
                <div className="wb-live__wait">
                  <Loader2 size={18} className="spin" aria-hidden="true" />
                  {t("wb.screen.waiting")}
                </div>
              )}
            </div>
            <div className="wb-live__controls">
              <button
                type="button"
                className="button button--ghost button--compact"
                onClick={() => void key(4)}
              >
                <ArrowLeft size={13} aria-hidden="true" />
                {t("wb.screen.back")}
              </button>
              <button
                type="button"
                className="button button--ghost button--compact"
                onClick={() => void key(3)}
              >
                {t("wb.screen.home")}
              </button>
              <button
                type="button"
                className="button button--ghost button--compact"
                onClick={() => void key(187)}
              >
                {t("wb.screen.recents")}
              </button>
              <button
                type="button"
                className="button button--ghost button--compact"
                onClick={() => void key(26)}
              >
                <Power size={13} aria-hidden="true" />
                {t("wb.screen.power")}
              </button>
            </div>
            <p className="wb-note">{t("wb.screen.tapHint")}</p>
            {liveError ? <p className="adb-panel__error">{liveError}</p> : null}
          </>
        ) : (
          <EmptyHint
            icon={MonitorSmartphone}
            title={t("wb.screen.liveOff")}
            body={t("wb.screen.liveOffBody")}
          />
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------------ flash

function FlashTab({
  fastbootSerial,
  fastbootDevices,
  selectFastboot,
  scanFastboot,
  scanning,
  adbSerial,
  notify,
}: {
  fastbootSerial: string | null;
  fastbootDevices: AdbDevice[];
  selectFastboot: (serial: string) => void;
  scanFastboot: () => Promise<void>;
  scanning: boolean;
  adbSerial: string | null;
  notify: Notify;
}): ReactElement {
  const { t } = useI18n();
  const [partition, setPartition] = useState("boot");
  const [custom, setCustom] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [vars, setVars] = useState<string | null>(null);

  const target = custom.trim() || partition;

  async function pickImage(): Promise<void> {
    const path = await window.droidcrate.pickFile("image");
    if (path) setImage(path);
  }

  async function flash(): Promise<void> {
    if (!fastbootSerial || !image) return;
    setBusy("flash");
    try {
      const result = await window.droidcrate.flashPartition({
        serial: fastbootSerial,
        partition: target,
        imagePath: image,
      });
      notify(
        result.ok ? "success" : "error",
        result.ok
          ? t("wb.flash.flashed", { partition: target })
          : (result.error ?? t("wb.failed")),
      );
      if (result.ok) setConfirmed(false);
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function erase(): Promise<void> {
    if (!fastbootSerial) return;
    setBusy("erase");
    try {
      const result = await window.droidcrate.erasePartition(
        fastbootSerial,
        target,
      );
      notify(
        result.ok ? "success" : "error",
        result.ok
          ? t("wb.flash.erased", { partition: target })
          : (result.error ?? t("wb.failed")),
      );
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function sideload(): Promise<void> {
    if (!adbSerial) return;
    const path = await window.droidcrate.pickFile("zip");
    if (!path) return;
    setBusy("sideload");
    try {
      const result = await window.droidcrate.sideloadPackage({
        serial: adbSerial,
        zipPath: path,
      });
      notify(
        result.ok ? "success" : "error",
        result.ok ? t("wb.flash.sideloaded") : (result.error ?? t("wb.failed")),
      );
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function loadVars(): Promise<void> {
    if (!fastbootSerial) return;
    setBusy("vars");
    try {
      const result = await window.droidcrate.getFastbootVars(fastbootSerial);
      setVars(result.output || result.error || "");
      if (!result.ok) notify("error", result.error ?? t("wb.failed"));
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function oem(action: "unlock" | "lock"): Promise<void> {
    if (!fastbootSerial) return;
    setBusy(action);
    try {
      const result = await window.droidcrate.fastbootOem(
        fastbootSerial,
        action,
      );
      notify(
        result.ok ? "success" : "error",
        result.ok
          ? t(`wb.flash.${action}Done`)
          : (result.error ?? t("wb.failed")),
      );
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  async function rebootFastboot(target: RebootTarget): Promise<void> {
    if (!fastbootSerial) return;
    setBusy(target);
    try {
      const result = await window.droidcrate.rebootDevice(
        fastbootSerial,
        target,
        "fastboot",
      );
      notify(
        result.ok ? "success" : "error",
        result.ok
          ? t("wb.overview.rebootSent", { target })
          : (result.error ?? t("wb.failed")),
      );
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="wb-grid">
      <section className="panel wb-span">
        <div className="adb-panel__head">
          <div>
            <div className="eyebrow">{t("wb.flash.eyebrow")}</div>
            <h2>
              <Usb size={16} aria-hidden="true" />
              {t("wb.flash.device")}
            </h2>
            <p>{t("wb.flash.deviceBody")}</p>
          </div>
          <button
            type="button"
            className="button button--ghost button--compact"
            onClick={() => void scanFastboot()}
            disabled={scanning}
          >
            <RefreshCw
              size={13}
              className={scanning ? "spin" : undefined}
              aria-hidden="true"
            />
            {t("wb.flash.scan")}
          </button>
        </div>
        {fastbootDevices.length > 0 ? (
          <div className="wb-device-row">
            {fastbootDevices.map((device) => (
              <button
                key={device.serial}
                type="button"
                className={`wb-device-chip${device.serial === fastbootSerial ? " is-active" : ""}`}
                onClick={() => selectFastboot(device.serial)}
              >
                <Usb size={14} aria-hidden="true" />
                <span>
                  <strong>{device.serial}</strong>
                  <code>{device.state}</code>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="wb-note">{t("wb.flash.noDevice")}</p>
        )}
        {adbSerial ? (
          <div className="wb-actions">
            <ConfirmButton
              label={t("wb.flash.rebootBootloader")}
              confirmLabel={t("wb.confirm")}
              icon={Zap}
              disabled={busy !== null}
              onConfirm={() =>
                void window.droidcrate
                  .rebootDevice(adbSerial, "bootloader", "adb")
                  .then(() => notify("info", t("wb.flash.rebootSent")))
              }
            />
            <ConfirmButton
              label={t("wb.flash.rebootFastbootd")}
              confirmLabel={t("wb.confirm")}
              icon={Usb}
              disabled={busy !== null}
              onConfirm={() =>
                void window.droidcrate
                  .rebootDevice(adbSerial, "fastbootd", "adb")
                  .then(() => notify("info", t("wb.flash.rebootSent")))
              }
            />
          </div>
        ) : null}
      </section>

      <section className="panel">
        <div className="adb-panel__head">
          <div>
            <div className="eyebrow">{t("wb.flash.eyebrow")}</div>
            <h2>
              <Zap size={16} aria-hidden="true" />
              {t("wb.flash.title")}
            </h2>
            <p>{t("wb.flash.body")}</p>
          </div>
        </div>

        <div className="wb-field">
          <span>{t("wb.flash.partition")}</span>
          <div className="wb-chips">
            {COMMON_PARTITIONS.map((entry) => (
              <button
                key={entry}
                type="button"
                className={`chip chip--filter${partition === entry && !custom.trim() ? " is-active" : ""}`}
                onClick={() => {
                  setPartition(entry);
                  setCustom("");
                }}
              >
                {entry}
              </button>
            ))}
          </div>
        </div>

        <label className="wb-field">
          <span>{t("wb.flash.custom")}</span>
          <input
            value={custom}
            onChange={(event) => setCustom(event.target.value)}
            placeholder={partition}
            spellCheck={false}
          />
        </label>

        <div className="wb-field__row">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => void pickImage()}
            disabled={busy !== null}
          >
            <ImageIcon size={13} aria-hidden="true" />
            {t("wb.flash.image")}
          </button>
          <code>{image ?? t("wb.flash.noImage")}</code>
        </div>

        <label className="wb-check wb-check--warn">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          {t("wb.flash.confirm")}
        </label>

        <div className="wb-actions">
          <button
            type="button"
            className="button button--warm"
            onClick={() => void flash()}
            disabled={!fastbootSerial || !image || !confirmed || busy !== null}
          >
            {busy === "flash" ? (
              <Loader2 size={14} className="spin" aria-hidden="true" />
            ) : (
              <Zap size={14} aria-hidden="true" />
            )}
            {t("wb.flash.flashAction", { partition: target })}
          </button>
          <ConfirmButton
            label={t("wb.flash.erase")}
            confirmLabel={t("wb.confirm")}
            className="button button--ghost"
            disabled={!fastbootSerial || busy !== null}
            onConfirm={() => void erase()}
          />
        </div>
      </section>

      <section className="panel">
        <div className="adb-panel__head">
          <div>
            <div className="eyebrow">{t("wb.flash.advancedEyebrow")}</div>
            <h2>
              <ShieldCheck size={16} aria-hidden="true" />
              {t("wb.flash.advanced")}
            </h2>
          </div>
        </div>

        <div className="wb-actions wb-actions--stack">
          <button
            type="button"
            className="button button--ghost"
            onClick={() => void sideload()}
            disabled={!adbSerial || busy !== null}
          >
            {busy === "sideload" ? (
              <Loader2 size={13} className="spin" aria-hidden="true" />
            ) : (
              <FileUp size={13} aria-hidden="true" />
            )}
            {t("wb.flash.sideload")}
          </button>
          <ConfirmButton
            label={t("wb.flash.unlock")}
            confirmLabel={t("wb.confirm")}
            className="button button--ghost"
            disabled={!fastbootSerial || busy !== null}
            onConfirm={() => void oem("unlock")}
          />
          <ConfirmButton
            label={t("wb.flash.lock")}
            confirmLabel={t("wb.confirm")}
            className="button button--ghost"
            disabled={!fastbootSerial || busy !== null}
            onConfirm={() => void oem("lock")}
          />
          <button
            type="button"
            className="button button--ghost"
            onClick={() => void loadVars()}
            disabled={!fastbootSerial || busy !== null}
          >
            {busy === "vars" ? (
              <Loader2 size={13} className="spin" aria-hidden="true" />
            ) : (
              <Terminal size={13} aria-hidden="true" />
            )}
            {t("wb.flash.vars")}
          </button>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => void rebootFastboot("system")}
            disabled={!fastbootSerial || busy !== null}
          >
            <RotateCcw size={13} aria-hidden="true" />
            {t("wb.flash.rebootSystem")}
          </button>
        </div>
        <p className="wb-note">{t("wb.flash.sideloadBody")}</p>
        {vars ? <pre className="wb-output wb-output--short">{vars}</pre> : null}
      </section>
    </div>
  );
}

// --------------------------------------------------------------------- terminal

function TerminalTab({
  serial,
  fastbootSerial,
  notify,
}: {
  serial: string | null;
  fastbootSerial: string | null;
  notify: Notify;
}): ReactElement {
  const { t } = useI18n();
  const [tool, setTool] = useState<ToolkitTool>("adb");
  const [command, setCommand] = useState("shell getprop");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ToolkitResult | null>(null);
  const [logcat, setLogcat] = useState<LogcatState>({
    active: false,
    serial: null,
  });
  const [lines, setLines] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const logRef = useRef<HTMLPreElement | null>(null);

  useEffect(() => {
    void window.droidcrate.getLogcatState().then(setLogcat);
    return window.droidcrate.onLogcat((batch) => {
      setLines((previous) =>
        batch.reset ? [] : [...previous, ...batch.lines].slice(-2000),
      );
    });
  }, []);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return lines;
    return lines.filter((line) => line.toLowerCase().includes(needle));
  }, [filter, lines]);

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [visible]);

  const activeSerial = tool === "adb" ? serial : fastbootSerial;

  async function run(): Promise<void> {
    if (!activeSerial) {
      notify("error", t("wb.term.noDevice"));
      return;
    }
    const args = command.trim().split(/\s+/).filter(Boolean);
    if (args.length === 0) return;
    setBusy(true);
    try {
      const next = await window.droidcrate.runToolkitCommand({
        tool,
        serial: activeSerial,
        args,
      });
      setResult(next);
      if (!next.ok) notify("error", next.error ?? t("wb.failed"));
    } catch (error) {
      notify("error", errorText(error));
    } finally {
      setBusy(false);
    }
  }

  async function toggleLogcat(): Promise<void> {
    if (!serial) {
      notify("error", t("wb.needDevice"));
      return;
    }
    try {
      if (logcat.active) {
        setLogcat(await window.droidcrate.stopLogcat());
      } else {
        setLines([]);
        setLogcat(await window.droidcrate.startLogcat(serial));
      }
    } catch (error) {
      notify("error", errorText(error));
    }
  }

  async function clearLogcat(): Promise<void> {
    if (!serial) return;
    try {
      await window.droidcrate.clearLogcat(serial);
      setLines([]);
    } catch (error) {
      notify("error", errorText(error));
    }
  }

  return (
    <div className="wb-grid">
      <section className="panel wb-span">
        <div className="adb-panel__head">
          <div>
            <div className="eyebrow">{t("wb.term.eyebrow")}</div>
            <h2>
              <Terminal size={16} aria-hidden="true" />
              {t("wb.term.title")}
            </h2>
            <p>{t("wb.term.body")}</p>
          </div>
          <div className="wb-seg">
            <button
              type="button"
              className={`wb-seg__item${tool === "adb" ? " is-active" : ""}`}
              onClick={() => setTool("adb")}
            >
              adb
            </button>
            <button
              type="button"
              className={`wb-seg__item${tool === "fastboot" ? " is-active" : ""}`}
              onClick={() => setTool("fastboot")}
            >
              fastboot
            </button>
          </div>
        </div>

        <div className="wb-chips">
          {[
            "shell getprop",
            "shell dumpsys battery",
            "shell pm list packages -3",
            "devices -l",
            "shell df -h",
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              className="chip"
              onClick={() => setCommand(preset)}
            >
              {preset}
            </button>
          ))}
        </div>

        <div className="wb-term">
          <span className="wb-term__prompt">
            {tool}
            {activeSerial ? ` -s ${activeSerial}` : ""} $
          </span>
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void run();
            }}
            spellCheck={false}
            aria-label={t("wb.term.command")}
          />
          <button
            type="button"
            className="button button--primary button--compact"
            onClick={() => void run()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 size={13} className="spin" aria-hidden="true" />
            ) : (
              <Play size={13} aria-hidden="true" />
            )}
            {t("wb.term.run")}
          </button>
        </div>

        {result ? (
          <div className="wb-result">
            <div className="wb-result__head">
              <span className={result.ok ? "is-ok" : "is-error"}>
                {result.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                {result.command}
              </span>
              <span className="muted">{result.durationMs} ms</span>
            </div>
            {result.error ? (
              <p className="adb-panel__error">{result.error}</p>
            ) : null}
            <pre className="wb-output">
              {result.output || t("wb.term.noOutput")}
            </pre>
          </div>
        ) : null}
      </section>

      <section className="panel wb-span">
        <div className="adb-panel__head">
          <div>
            <div className="eyebrow">{t("wb.term.logEyebrow")}</div>
            <h2>
              <Terminal size={16} aria-hidden="true" />
              {t("wb.term.logcat")}
              {lines.length > 0 ? (
                <span className="adb-console__count">{visible.length}</span>
              ) : null}
            </h2>
            <p>{t("wb.term.logBody")}</p>
          </div>
          <div className="wb-head-actions">
            <button
              type="button"
              className={`button ${logcat.active ? "button--warm" : "button--primary"} button--compact`}
              onClick={() => void toggleLogcat()}
            >
              {logcat.active ? (
                <Square size={12} aria-hidden="true" />
              ) : (
                <Play size={12} aria-hidden="true" />
              )}
              {logcat.active ? t("wb.term.stopLog") : t("wb.term.startLog")}
            </button>
            <button
              type="button"
              className="button button--ghost button--compact"
              onClick={() => void clearLogcat()}
            >
              <Trash2 size={12} aria-hidden="true" />
              {t("wb.term.clear")}
            </button>
          </div>
        </div>

        <div className="wb-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={filter}
            placeholder={t("wb.term.filter")}
            onChange={(event) => setFilter(event.target.value)}
            aria-label={t("wb.term.filter")}
          />
        </div>

        <pre ref={logRef} className="wb-log">
          {visible.length === 0 ? t("wb.term.logEmpty") : visible.join("\n")}
        </pre>
      </section>
    </div>
  );
}
