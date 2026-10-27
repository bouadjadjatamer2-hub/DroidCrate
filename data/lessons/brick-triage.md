"Bricked" is used for everything from a bootloop to a phone that no longer vibrates. The first job is to classify the failure, because the recovery path is completely different.

## Soft brick

The phone still has a working low-level interface:

- it reaches the bootloader or Fastboot,
- or it reaches recovery,
- or Windows still enumerates a USB device in a known mode.

Common causes are a bad boot image, an interrupted flash, an incompatible module, or a failed OTA. These are usually recoverable with the correct official firmware and a stable cable.

## Hard brick

There is no bootloader, no recovery, no vibration, and often no USB enumeration at all. Possible causes include a corrupted bootloader, a wrong firehose or preloader package, a failed eMMC, or a power hardware fault.

Some hard bricks can be recovered through vendor service tools in EDL or BROM mode, but only with the correct signed files. Random "unbrick" packages from the internet frequently make it worse by writing an incompatible bootloader.

## Triage sequence

1. **Listen and look.** Does the phone vibrate, show a logo, or enumerate in Windows? Note the exact behaviour.
2. **Try the simplest interface.** Bootloader first, then recovery. Do not start by opening the phone.
3. **Identify the model precisely.** Use the sticker, the serial, or the last known build.
4. **Check the official recovery path.** Vendors publish firmware and service procedures for a reason.
5. **Stop if the path requires signing keys you do not have.** Test-point or EDL work without the correct package is how a recoverable device becomes scrap.

## What not to do

- Do not flash firmware for a different model or region to "see if it works".
- Do not run a paid "unbrick tool" that requires disabling antivirus.
- Do not repeatedly power-cycle a device that is mid-write.
- Do not promise a customer a fix before the failure class is known.

## When to refer

Send the device to an authorised service centre when:

- the bootloader is locked and no official recovery image exists,
- the device does not enumerate at all and the owner has no backup,
- the repair requires chip-level work or signing keys,
- the owner's data is critical and no verified backup exists.

> A clear "this is beyond safe software repair" is a professional answer. Guessing is not.
