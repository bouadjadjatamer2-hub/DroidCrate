Recovery is a small environment that runs when Android cannot, or when you explicitly ask for it. Custom recoveries add tools such as full backups, partition management, and package installation. They are powerful and easy to misuse.

## Recovery, fastbootd, and Fastboot

- **Stock recovery** — the vendor's minimal environment. It accepts signed OTA packages and factory reset commands.
- **Custom recovery** (TWRP, OrangeFox, and similar) — community-built, with backup, file manager, terminal, and sideload.
- **Fastbootd** — a userspace fastboot implementation inside newer recovery images. It can write logical partitions that the bootloader's fastboot cannot reach.
- **Bootloader Fastboot** — the lowest-level interface, available before Android or recovery starts.

`adb sideload` works in recovery or an update mode, not in a normal booted system. The phone must be sitting in the mode that expects the package.

## Sideloading safely

Sideload is useful for applying an official OTA when the phone cannot boot, or for installing a custom package you built and signed.

```text
adb devices
adb sideload update.zip
```

Rules:

1. Confirm the package is for the exact model and build.
2. Prefer signed official packages for repair work.
3. Do not sideload a package from an unknown source just because it promises to remove a lock or bypass an account.
4. Keep the cable connected. An interrupted sideload can leave the system partition incomplete.

## Encryption and data

Modern Android encrypts `/data` with keys protected by the lock screen and hardware keystore. A custom recovery cannot magically read that data. In practice you will be asked to:

- decrypt with the user's credential, if the recovery supports it, or
- format data, which destroys everything.

Formatting data also removes the encryption keys, so the phone will boot clean but the owner's files are gone. Confirm what the owner needs before formatting, and say clearly that the data cannot be recovered afterwards.

## A/B devices and recovery

On A/B phones, recovery may be part of the boot image rather than a separate partition. Flashing a "recovery.img" onto a device that expects `boot.img` can break boot. Read the device-specific instructions; do not generalise from an older phone.

Also check whether the custom recovery supports the current Android version's dynamic partitions and metadata encryption. An outdated recovery can appear to work and then fail during a write.

## When to avoid custom recovery entirely

- The phone is under warranty and the owner wants it preserved.
- The task can be done with official Fastboot firmware.
- The owner cannot afford to lose data and no verified backup exists.
- The recovery build is unofficial and unsigned, with no trusted maintainer.

> A custom recovery is a tool for a defined job. Install it because the job requires it, not because it is the next step in a tutorial.
