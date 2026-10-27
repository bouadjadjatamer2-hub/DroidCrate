A flash that completes is not a repair. The phone must boot, connect, and pass the hardware checks the owner actually depends on. A repeatable end-of-job routine catches most comeback cases before the phone leaves the bench.

## Boot and identity

- The phone boots to setup without a bootloop.
- The build string matches the package you intended to install.
- The security patch level is plausible for that build.
- The bootloader state matches what you promised the owner.

## Radio and connectivity

- SIM detected, network registered, calls and SMS work.
- Mobile data works, including the correct APN if the carrier requires it.
- Wi-Fi scans and connects.
- Bluetooth pairs with a known device.
- NFC, if the model has it, toggles without error.

A missing SIM after a flash is a red flag for a firmware or modem mismatch. Do not hand the phone back until it is explained.

## Hardware sweep

- Front and rear cameras open and save a photo.
- Speakers, earpiece, and microphone work on a real call.
- Proximity and light sensors respond.
- Fingerprint or face unlock is enrolled and works.
- Charging reaches the expected rate, and the battery reports a sane temperature.
- Buttons, vibration, and the screen touch layer behave normally.

## Data and accounts

- The owner's backup is restored, or the phone is intentionally clean and they know it.
- Google or vendor account sign-in works, and no old account is left locked on the device.
- Encryption is active and the lock screen credential is set.
- The owner can update apps and install from the store.

## Service record

Write down:

```text
Device:        model / serial
Original:      build, patch, symptoms
Work done:     package, commands, unlock state
Result:        build after repair, tests passed
Date / tech:   when and who
```

This record is useful for the owner and essential if the same phone returns. It also demonstrates that the repair followed a documented process.

## Handover

Explain in plain language:

- what was changed,
- what was erased,
- whether the bootloader is locked,
- which updates are safe,
- what to do if the phone misbehaves.

Do not hide an unlocked bootloader or a root install. The owner will discover it at the worst possible moment, usually during a banking or payment attempt.

> A repair ends when the owner understands the device's new state, not when the progress bar reaches 100%.
