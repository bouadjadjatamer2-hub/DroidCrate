Every repair decision starts with one question: **which stage of the boot chain is failing?** Android does not boot in a single step. It hands control from one small program to the next, and each stage verifies the one after it when the bootloader is locked.

## The chain

1. **BootROM** — code burned into the chipset. It cannot be changed. It loads the primary bootloader from storage and enforces the first signature check on secure devices.
2. **Bootloader / ABL** — decides whether to boot normally, boot recovery, or enter Fastboot. It reads the slot metadata and checks the boot image signature.
3. **Boot image** — the Linux kernel plus a small ramdisk. On devices launched with Android 13 or later the ramdisk may live in a separate `init_boot` partition.
4. **System and vendor** — the read-only Android framework and hardware abstraction layers.
5. **User data** — `/data`, decrypted during boot with keys tied to the user's lock screen and the hardware keystore.

A failure at step 2 looks very different from a failure at step 4. If Fastboot responds, the bootloader is alive. If the screen stays black and Windows never sees a USB device, the problem is earlier and much more serious.

## A/B slots

Most phones sold since 2017 use two bootable slots, `a` and `b`. An update writes the inactive slot, verifies it, then switches the active slot on the next boot. If the new slot fails to boot, the bootloader can fall back.

This is good for safety but it changes your flash commands:

```text
fastboot getvar current-slot
fastboot flash boot_a boot.img
fastboot --set-active=a
```

Writing the wrong slot, or flashing a single-slot package onto an A/B device, is a common cause of avoidable bootloops.

## Verified boot

When the bootloader is locked, each stage is checked against a key stored in hardware. Any modification to the boot image breaks the chain and the device refuses to start normally. Unlocking the bootloader relaxes that check, which is exactly why unlocking is both useful and risky.

> A locked bootloader is a safety feature, not an obstacle to bypass. Work with the vendor's official unlock process or not at all.

## What to record before touching anything

- Exact model code, not just the marketing name.
- Current build number and security patch level.
- Active slot and bootloader lock state.
- Whether the device still enters Fastboot and recovery.

With those four facts you can choose the correct firmware and predict how the phone will behave if a flash fails. Without them, every command is a guess.

## Key takeaway

Flashing repairs the **contents** of partitions. It cannot repair BootROM, a dead eMMC, or a failed power rail. Knowing where the chain stops tells you whether software work has any chance of helping.
