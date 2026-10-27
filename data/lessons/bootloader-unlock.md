Unlocking the bootloader is the gateway to custom recovery, root, and some repair paths. It is also the point where a phone stops being a sealed, verified system. Understand the trade before you type the command.

## What unlocking actually changes

On a locked device, the bootloader verifies the signature of the boot image and refuses to start anything unsigned. Unlocking relaxes that check and allows Fastboot to write boot, recovery, and system partitions.

Consequences:

- **User data is erased.** Most vendors force a factory reset during unlock to prevent an attacker from reading data after a brief physical access.
- **Verified boot is weakened.** A modified boot image can now run, which is the point, but it also means malware persistence is easier.
- **Warranty and service policy may change.** Some vendors void warranty; others allow re-locking but keep a record.
- **Some apps refuse to run.** Banking, payment, and DRM apps may rely on hardware-backed integrity signals.

None of these are bugs. They are the cost of the capability.

## Vendor permission comes first

There is no universal unlock command that works on every phone.

- **Pixel and many AOSP-style devices:** enable **OEM unlocking** in Developer options, then `fastboot flashing unlock`.
- **Samsung:** uses its own download mode and, on many models, a regional unlock path. `fastboot` is not the tool.
- **Xiaomi:** requires a Mi account, waiting period, and the official unlock tool on many models.
- **Carrier-locked devices:** frequently block unlocking entirely, even when the hardware supports it.

If the OEM unlocking switch is greyed out, the device policy does not allow it. Do not look for a bypass. That is a different, unsafe category of work.

## The safe sequence

1. Confirm ownership and get explicit written consent.
2. Back up everything the owner needs. Unlocking wipes the phone.
3. Note the model, build, and current lock state.
4. Enable Developer options and **OEM unlocking** on the phone.
5. Reboot to the bootloader and confirm the target serial.
6. Run the vendor-documented unlock command.
7. Let the phone wipe and boot fully before installing anything.
8. Re-lock only with the vendor's documented procedure, and only when the installed images are official.

```text
fastboot devices
fastboot flashing unlock
```

On some devices the command is `fastboot oem unlock`. Use the exact form in the vendor documentation for that model.

## Re-locking is not always safe

A phone with a modified boot image will usually refuse to boot after re-locking, because the signature no longer matches. Re-lock only after restoring the complete official firmware. If you are unsure, leave it unlocked and explain the state to the owner.

> Ownership confirmation is not paperwork. Unlocking destroys data and changes the security model. Only proceed when the owner understands both.
