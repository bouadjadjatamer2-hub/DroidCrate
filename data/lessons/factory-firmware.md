Factory firmware is the most reliable repair tool available, and also the fastest way to make a phone worse. The difference is matching and verification.

## Match the exact variant

Firmware packages are built for a specific combination of:

- model code,
- region or carrier,
- chipset and modem,
- bootloader version.

A package for the same marketing name but a different region can fail at the modem stage, leave the SIM undetected, or refuse to boot because the signature chain does not match. Check the package name against the build string you recorded earlier.

## Use the official source

Download from the vendor's support site or firmware page. Prefer packages that include checksums. If the vendor does not publish checksums, at least confirm the file size and that the download came over HTTPS from the vendor domain.

Avoid:

- mirrored archives with no provenance,
- "unlocked" or "modified" firmware advertised as faster,
- packages that require disabling antivirus to extract,
- tools that ask for payment to unlock a download.

## Know which flasher you need

| Situation | Tool |
| --- | --- |
| Bootloader reachable, Fastboot available | Fastboot with the vendor package |
| Samsung download mode | Odin or the vendor's official tool |
| Qualcomm emergency download | Vendor tool, only with the correct firehose package |
| MediaTek preloader mode | SP Flash Tool with the matching scatter file |

Never use a flasher just because it is popular. Use the one the vendor documents for that model.

## Flash order and slots

A typical Fastboot package contains a bootloader, radio/modem, boot, system, vendor, and a metadata or vbmeta image. Vendors publish a script that flashes them in the correct order. Use it, or follow the published order exactly.

On A/B devices, remember:

```text
fastboot getvar current-slot
fastboot --set-active=a
```

Wipe data only when the repair plan calls for it. A "clean flash" is not automatically better: it destroys the owner's data and can remove evidence you still need.

## Verify before and after

Before flashing:

- battery above 50%,
- stable USB connection and a known-good cable,
- correct package and checksum,
- ownership confirmed.

After flashing:

- the phone boots to setup,
- the build string matches the package,
- SIM/IMEI and Wi-Fi are present,
- charging and sensors work.

## If a flash fails halfway

Do not repeat the same command on a different package. Note the exact error, check the cable and port, confirm the target slot, and re-read the vendor instructions. A failed write is recoverable more often than a wrong write.

> The goal is not "flash something". The goal is to restore a known-good, correctly matched build and prove it works.
