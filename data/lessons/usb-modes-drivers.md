A phone can present itself to Windows in several completely different ways. Each mode exposes different commands, and mixing them up is the most common source of "the tool does not detect my phone".

## The four modes you will meet

| Mode | What it is for | Typical tool |
| --- | --- | --- |
| MTP / PTP | File transfer while Android runs | Windows Explorer |
| ADB | Debug bridge into a running Android system | `adb` |
| Fastboot | Direct access to the bootloader | `fastboot` |
| Download / EDL / BROM | Vendor or chipset recovery mode | Vendor tool only |

ADB and Fastboot are not interchangeable. `adb devices` will not show a phone sitting in the bootloader, and `fastboot devices` will not show a phone that has booted Android. If a command returns nothing, confirm the mode before changing drivers.

## Authorisation is a phone-side decision

The first time a computer talks to a phone over ADB, the phone shows an RSA fingerprint prompt. Until someone taps **Allow**, the device is listed as `unauthorized`.

```text
List of devices attached
2118294910DA24YT   unauthorized
```

No driver reinstall will fix this. Unlock the phone, accept the prompt, and optionally tick "Always allow from this computer". If the prompt never appears, revoke USB debugging authorisations in Developer options and reconnect.

## Drivers: official only

Windows usually installs MTP support by itself. For ADB and Fastboot, install:

- the **Google USB Driver** for Pixel and generic devices, or
- the phone vendor's official driver package (Samsung, Xiaomi, Qualcomm-based brands, and so on).

Avoid driver packs from download sites. They are frequently stale, bundled with installers you did not ask for, and impossible to audit. A wrong or unsigned driver can also cause repeated disconnects mid-flash, which is far more dangerous than a phone that is simply not detected.

## Reading Windows signals

- **Unknown USB device (Device Descriptor Request Failed)** — cable, port, or driver problem. Try a known-good data cable and a rear USB port.
- **Device shows in Device Manager but not in ADB** — often a mode or authorisation issue, not a driver issue.
- **Device disconnects during a flash** — stop. Do not retry blindly. Check the cable and port first, because an interrupted write is how soft bricks happen.

## Practical routine

1. Connect with a data-capable cable, not a charge-only cable.
2. Confirm the mode on the phone screen.
3. Run the matching `devices` command and read the state word carefully: `device`, `unauthorized`, `offline`, or `fastboot`.
4. Only then run the action you intended.

Treat the state word as the source of truth. It tells you which part of the stack is answering.
