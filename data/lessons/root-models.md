Root is not one feature. It is a family of ways to run code with elevated privileges while trying to remain compatible with Android's security model. The three common approaches patch different layers, and that changes update behaviour and risk.

## Magisk: patched boot image

Magisk is the most common systemless root. It works by patching the ramdisk inside the boot image (or `init_boot` on devices where the ramdisk lives there). The patch starts Magisk's daemon early, then exposes root through a manager app and modules.

Typical flow:

1. Extract `boot.img` or `init_boot.img` from the exact firmware package.
2. Patch it with the Magisk app.
3. Flash the patched image to the matching partition and slot.
4. Install the Magisk app and confirm root.

Because it lives in the boot image, an OTA update writes a fresh image and removes root. Re-root after every update, using the new firmware's image.

## KernelSU: kernel-based

KernelSU integrates root at the kernel level. It needs a kernel built with KernelSU support, which means either a supported GKI kernel or a custom kernel from a trusted maintainer. The advantage is tighter integration; the cost is that kernel availability depends on the device.

## APatch: patch-based

APatch applies a kernel patch through a boot image patching workflow, combining ideas from both models. It is younger, so community support and device coverage are narrower. Treat it as an option when the device is supported and the maintainer is credible, not as a universal replacement.

## What root changes

- **Verified boot:** the boot image is no longer the signed original. On many devices this requires an unlocked bootloader.
- **Integrity APIs:** banking, payment, and some streaming apps may refuse to run or reduce quality.
- **Updates:** OTA installation often requires restoring the stock boot image first.
- **Security:** any app granted root can read data the sandbox would normally protect. Grant it deliberately.

## Safer practice

- Keep a copy of the stock boot image before patching.
- Match the image to the exact build and slot.
- Install modules from trusted sources only.
- Record which modules were installed, so a future failure can be diagnosed.
- Warn the owner about integrity-sensitive apps before taking payment for the job.

## Unrooting

Flash the stock boot image back, remove modules, and reboot. If the phone must be re-locked, restore the complete official firmware first; re-locking with a patched boot image usually results in a device that will not boot.

> Root is a deliberate trade of security guarantees for control. Make sure the owner is the one choosing that trade.
