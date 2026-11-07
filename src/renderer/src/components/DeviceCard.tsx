import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  LockOpen,
  Smartphone,
  Terminal,
  Usb,
} from "lucide-react";
import type { DetectedDevice } from "@shared/device";
import { useI18n } from "../i18n";

type Translate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

function seenLabel(iso: string, t: Translate): string {
  if (!iso) return t("device.time.unknown");
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return t("device.time.unknown");
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 5) return t("device.time.justNow");
  if (seconds < 60) return t("device.time.seconds", { count: seconds });
  if (seconds < 3600)
    return t("device.time.minutes", { count: Math.round(seconds / 60) });
  return t("device.time.hours", { count: Math.round(seconds / 3600) });
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="spec-row">
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  );
}

export function DeviceCard({
  device,
  onOpenWorkbench,
}: {
  device: DetectedDevice;
  onOpenWorkbench: () => void;
}) {
  const { t } = useI18n();
  const summary = device.summary;
  const state = device.state;
  const connected = state === "device";
  const bootloaderMode = device.mode === "fastboot";
  const hasMode = device.mode !== "unknown";
  const stateKey = state ?? "usb";
  const canOpenWorkbench = connected || bootloaderMode;
  const value = (input: string | null): string => input ?? t("device.valueUnknown");

  return (
    <article className="device-card">
      <div className="device-card__head">
        <span className="device-card__icon" aria-hidden="true">
          <Smartphone size={22} strokeWidth={1.4} />
        </span>
        <div className="device-card__identity">
          <span className="device-card__brand">
            {device.brand || t("device.unknownBrand")}
          </span>
          <h2>{device.model ?? t("device.modelUnknown")}</h2>
        </div>
        <div className="device-card__badges">
          <span className={`mode-badge mode-badge--${device.mode}`}>
            {device.mode === "unknown"
              ? t("device.mode.unknown")
              : t(`device.mode.${device.mode}`)}
          </span>
          <span className={`state-badge state-badge--${stateKey}`}>
            <span className="state-badge__dot" aria-hidden="true" />
            {t(`device.state.${stateKey}`)}
          </span>
        </div>
      </div>

      {connected ? (
        <div className="device-card__live">
          <CheckCircle2 size={14} aria-hidden="true" />
          <span>{t("device.readyBody")}</span>
        </div>
      ) : null}

      {state === "unauthorized" ? (
        <div className="inline-note inline-note--warn">
          <AlertTriangle size={15} aria-hidden="true" />
          <div>
            <strong>{t("device.unauthorizedTitle")}</strong>
            <span>{t("device.unauthorizedBody")}</span>
          </div>
        </div>
      ) : null}

      {state === "offline" ? (
        <div className="inline-note inline-note--warn">
          <AlertTriangle size={15} aria-hidden="true" />
          <div>
            <strong>{t("device.offlineTitle")}</strong>
            <span>{t("device.offlineBody")}</span>
          </div>
        </div>
      ) : null}

      {!hasMode ? (
        <div className="inline-note inline-note--warn">
          <AlertTriangle size={15} aria-hidden="true" />
          <div>
            <strong>{t("device.unknownModeTitle")}</strong>
            <span>{t("device.unknownModeBody")}</span>
          </div>
        </div>
      ) : null}

      {connected && !summary ? (
        <p className="device-card__reading">
          <span className="reading-dot" aria-hidden="true" />
          {t("device.readingSpecs")}
        </p>
      ) : null}

      {summary ? (
        <div className="device-specs">
          <SpecRow
            label={t("device.spec.android")}
            value={
              summary.androidVersion
                ? t("device.spec.androidValue", {
                    version: summary.androidVersion,
                    sdk: summary.sdk ?? "?",
                  })
                : value(null)
            }
          />
          <SpecRow label={t("device.spec.build")} value={value(summary.build)} />
          <SpecRow
            label={t("device.spec.patch")}
            value={value(summary.securityPatch)}
          />
          <SpecRow
            label={t("device.spec.chipset")}
            value={value(summary.soc)}
          />
          <SpecRow label={t("device.spec.abi")} value={value(summary.abi)} />
          <SpecRow
            label={t("device.spec.bootloader")}
            value={
              summary.bootloaderUnlocked === true
                ? t("device.spec.unlocked")
                : summary.bootloaderUnlocked === false
                  ? t("device.spec.locked")
                  : t("device.valueUnknown")
            }
          />
        </div>
      ) : null}

      <dl className="device-facts">
        <div>
          <dt>{t("device.serial")}</dt>
          <dd>{device.serial ?? t("device.serialHidden")}</dd>
        </div>
        <div>
          <dt>{t("device.usbId")}</dt>
          <dd>{device.usbId || t("device.usbIdUnknown")}</dd>
        </div>
        <div>
          <dt>{t("device.source")}</dt>
          <dd>{t(`device.source.${device.source}`)}</dd>
        </div>
        <div>
          <dt>{t("device.lastSeen")}</dt>
          <dd>{seenLabel(device.lastSeenAt, t)}</dd>
        </div>
      </dl>

      {device.note ? <p className="device-card__note">{device.note}</p> : null}

      {device.names.length > 0 ? (
        <div className="device-card__names">
          <Usb size={13} aria-hidden="true" />
          <div className="chip-row">
            {device.names.map((name) => (
              <span key={name} className="chip chip--tiny">
                {name}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {summary?.bootloaderUnlocked === true ? (
        <p className="device-card__lock device-card__lock--open">
          <LockOpen size={13} aria-hidden="true" />
          {t("device.unlockedNote")}
        </p>
      ) : summary?.bootloaderUnlocked === false ? (
        <p className="device-card__lock">
          <Lock size={13} aria-hidden="true" />
          {t("device.lockedNote")}
        </p>
      ) : null}

      {canOpenWorkbench ? (
        <div className="device-card__tools">
          <div className="tool-suggestion">
            <div className="tool-suggestion__copy">
              <span className="tool-suggestion__label">
                {t("device.nextStep")}
              </span>
              <strong>
                {bootloaderMode
                  ? t("device.workbenchFastbootTitle")
                  : t("device.workbenchTitle")}
              </strong>
              <span>
                {bootloaderMode
                  ? t("device.workbenchFastbootBody")
                  : t("device.workbenchBody")}
              </span>
            </div>
            <button
              type="button"
              className="button button--primary"
              onClick={onOpenWorkbench}
            >
              <Terminal size={14} aria-hidden="true" />
              {t("device.openWorkbench")}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}
