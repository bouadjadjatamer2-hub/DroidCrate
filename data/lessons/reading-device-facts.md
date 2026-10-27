Before any repair, collect facts. Read-only commands cannot break a phone, and the information they return decides everything that follows: firmware choice, unlock eligibility, and whether a software fix is even the right approach.

## The properties that matter

`adb shell getprop` prints hundreds of properties. These are the ones to record:

| Property | Meaning |
| --- | --- |
| `ro.product.manufacturer` | Brand |
| `ro.product.model` | Marketing model name |
| `ro.product.device` | Internal device codename |
| `ro.build.display.id` | Exact installed build |
| `ro.build.version.release` | Android version |
| `ro.build.version.sdk` | API level |
| `ro.build.version.security_patch` | Patch date |
| `ro.soc.model` / `ro.board.platform` | Chipset |
| `ro.boot.flash.locked` | Bootloader lock state |
| `ro.boot.slot_suffix` | Active A/B slot |

The **build string** is more important than the model name. Two phones sold under the same name can carry different regional builds, different modems, and different partition layouts.

## Why the model is not enough

A retailer might sell "Model X" in three variants with different modem firmware. Flashing the wrong regional package can leave the phone without a radio, or fail signature checks and refuse to boot. Always match:

- exact model code,
- region or carrier variant,
- current build number,
- Android version and patch level.

## Bootloader state

On most devices, `ro.boot.flash.locked=1` means the bootloader is locked. Some vendors report the state through other properties, and some hide it entirely. Treat an unknown state as locked until Fastboot confirms it with `fastboot getvar unlocked`.

Do not assume that an unlocked bootloader is desirable. It weakens verified boot and may break banking apps, DRM playback, and warranty coverage. It is a tool for a specific job, not a default improvement.

## Record before you act

A simple service note is enough:

```text
Model:        RMX3263
Build:        RMX3263_11_A.119
Android:      11 (API 30)
Patch:        2024-02-05
Chipset:      ums512
Bootloader:   locked
Slot:         a
Symptoms:     bootloop after OTA
```

If the repair goes wrong, this note is the difference between a controlled recovery and guesswork. It also protects you if the owner later claims the phone was in a different condition.

## Limits of read-only inspection

Properties come from Android itself. If the phone cannot boot Android, you cannot read them with ADB. In that case use Fastboot variables, the sticker under the battery or SIM tray, and the vendor's serial lookup. Never invent a model from the shape of the phone.

## Key takeaway

Facts first, firmware second, commands last. The five minutes spent recording the build and lock state routinely save hours of recovery.
