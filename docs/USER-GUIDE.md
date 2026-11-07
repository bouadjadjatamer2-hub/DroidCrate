# DroidCrate user guide

This guide walks through DroidCrate from the first install to flashing and the terminal. Everything
runs inside the app: you never install adb or fastboot by hand, and you never open a download site.

---

## 1. Before you start

| Item | Detail |
| --- | --- |
| System | Windows 10 or 11, 64-bit |
| Cable | A USB cable that carries data (not a charge-only cable) |
| Phone | Any Android phone, with USB debugging enabled |
| Disk space | About 200 MB for the app + 8 MB for Platform Tools |
| Internet | Needed once, only to download Platform Tools |

No account, no sign-up, no administrator rights.

---

## 2. Install

1. Download `DroidCrate-0.2.0-Setup.exe` from the releases page.
2. Run it. If SmartScreen warns you, choose **More info → Run anyway** (the installer is unsigned).
3. Pick an install folder and finish. The installer creates a desktop shortcut.

---

## 3. First launch

1. Open DroidCrate.
2. Read the notice, tick the ownership confirmations, and click **Enter the workbench**.
3. If Platform Tools are missing, a card appears at the top:
   - Click **Install**.
   - The app downloads Platform Tools 37.0.1 (about 8 MB) from `dl.google.com`.
   - It verifies the SHA-256 before extracting.
   - After that, everything works offline.
4. If the download fails, check your connection and retry. There is no mirror or alternate link.

> After install, adb and fastboot live in `%APPDATA%\droidcrate\platform-tools\current`.

---

## 4. Connect the phone

1. On the phone: **Settings → About phone → Build number**, tap it 7 times to unlock developer options.
2. **Settings → Developer options → USB debugging**, turn it on.
3. Plug the cable into the computer.
4. The phone shows an "Allow USB debugging" prompt: tap **Allow** (tick "Always allow" if you like).
5. In DroidCrate, open the **Workbench**: the phone appears under **Connected devices**. If more than
   one device is listed, click the one you want.

Possible states:

- **device**: ready, every tab works.
- **unauthorized**: the key was not accepted on the phone. Unlock it and accept the prompt.
- **offline**: unplug and replug the cable, or click **Refresh**.
- No device at all: try another USB port, another cable, or check the Windows drivers.

---

## 5. The workbench: six tabs

The workbench has a single device picker at the top, and six tabs that unlock once the phone is
authorized.

### 5.1 Overview

Read phone information and restart it.

- **Read again**: refreshes the details.
- Details: model, Android and API level, build, security patch, chipset, architecture, bootloader state.
- **Restart**:
  - System / Bootloader / Recovery / Fastbootd / Power off.
  - Each button asks for a second click (so a stray click cannot interrupt an operation).
- Shortcuts: app manager, files and backup, screen tools, terminal.

### 5.2 Apps

| Action | How |
| --- | --- |
| Install APK | Click **Install APK** and pick a file, or drag and drop an `.apk` onto the window |
| Export APK | Click **Export** next to an app → saved to `Documents\DroidCrate\exports` |
| Freeze | **Freeze**: disables the package without deleting it (`pm disable-user`) |
| Unfreeze | **Unfreeze** |
| Clear data | **Clear data** (after confirmation) |
| Uninstall | **Uninstall** (after confirmation) |
| System apps | Tick **Show system apps** |
| Search | Type a package name in the search box |

Notes:

- Install uses `adb install -r`, so it upgrades an app and keeps its data.
- If an app is part of the system image, a normal uninstall fails; use **Freeze** instead.
- Some protected apps need higher privileges; the app shows the exact error.

### 5.3 Files

Three sections:

**Send a file to the phone (PC → Phone)**

1. Click **Choose file** and pick any file from the computer.
2. Adjust the destination path if needed (default `/sdcard/Download/<file name>`).
3. Click **Send to phone**.
4. A progress bar appears, then a success message.

**Pull from the phone (Phone → PC)**

1. Type the phone path, for example `/sdcard/DCIM/Camera`, or use a shortcut button
   (DCIM, Pictures, Download, WhatsApp, Documents).
2. Click **Pull to PC** and choose the destination folder.
3. The file or folder lands under the same name.

**Full backup and restore**

1. Pick folders: DCIM, Pictures, Download, Documents, Movies, Music, WhatsApp.
2. Click **Choose folder** and select a backup folder on the computer.
3. **Back up to PC**: copies the selected folders in one pass.
4. To restore: same folder, then **Restore to phone** (asks for confirmation).

> Paths must start with `/` and must not contain `..`. This guards against writing outside the phone
> storage.

### 5.4 Screen

**Screenshot**

1. Click **Take screenshot**.
2. The image is saved to `Pictures\DroidCrate` and shown inside the app.
3. **Open folder** reveals the file in Windows.

**Screen recording**

1. Click **Start recording** (up to 3 minutes, 8 Mbps).
2. Click **Stop and save**.
3. The file is saved to `Videos\DroidCrate`.

**Live view**

1. Click **Start view**.
2. The phone screen appears in the window and refreshes about once per second.
3. Click the image to send a tap at that spot.
4. Buttons: **Back**, **Home**, **Recents**, **Power**.
5. **Stop view** ends the refresh loop.

> Live view is for inspection and tapping, not for watching video. Use recording when you need smooth
> motion.

### 5.5 Flash

**Before flashing**

- Unlock the bootloader if it is locked (some vendors wipe data during this step).
- Take a backup.
- Make sure the image matches your exact phone model. The wrong image can brick the device.

**Enter fastboot**

- From **Overview**, click **Bootloader**, or from **Flash** click **To bootloader**.
- Or power the phone off and use its own button combination (it varies by vendor).

**Check devices**

1. Open the **Flash** tab.
2. Click **Scan**.
3. The phone appears under "fastboot devices". If it does not, recheck the cable and the mode.

**Flash a partition**

1. Pick a partition from the buttons (boot, recovery, init_boot, vendor_boot, dtbo, vbmeta,
   vbmeta_system, super, system, vendor, product, userdata, cache, modem, radio, abl, xbl, tz).
2. Or type a custom partition name.
3. Click **Choose image** and pick an `.img` file from the computer.
4. Tick the confirmation box: "I understand this writes to the phone…".
5. Click **Flash <partition>**.

**Erase a partition**

- Click **Erase partition** and confirm. This wipes the content (userdata = all data gone).

**Sideload**

1. Boot the phone into recovery or fastbootd and choose "Apply update from ADB" if asked.
2. Click **Sideload update ZIP** and pick a `.zip` file from the computer.
3. The file streams to the phone; nothing is downloaded from the internet.

**Unlock / lock the bootloader**

- **Unlock bootloader** / **Lock bootloader**: each asks for confirmation.
- Some vendors need extra steps (vendor account, 7-day wait…). The app only sends the command.

**Fastboot variables**

- **Read fastboot variables** shows `getvar all` (state, version, partitions…).

### 5.6 Terminal

**Run an adb or fastboot command**

1. Pick `adb` or `fastboot` with the switch at the top.
2. Type the command without the tool name, for example:
   - `shell getprop`
   - `shell dumpsys battery`
   - `shell pm list packages -3`
   - `devices -l`
   - `shell df -h`
3. Click **Run** or press Enter.
4. You see the command, its output, the success/failure state, and the duration.

Notes:

- Commands are split on spaces; quoting (`"..."`) inside a command is not supported.
- Every command is written to the local history.
- If no device is selected, a notice appears.

**Logcat**

1. Click **Start logcat**.
2. The log streams into the window (the last 2000 lines are kept in the UI).
3. Type in the **Filter log** box to narrow it down (plain text search).
4. **Clear** empties the view and clears the buffer on the phone.
5. **Stop logcat** ends the stream.

---

## 6. Where files are saved

| File | Location |
| --- | --- |
| Screenshots | `Pictures\DroidCrate` |
| Screen recordings | `Videos\DroidCrate` |
| Exported APKs | `Documents\DroidCrate\exports` |
| Backups | The folder you choose |
| Operation history | `%APPDATA%\droidcrate\droidcrate.db` |
| Platform Tools | `%APPDATA%\droidcrate\platform-tools\current` |

---

## 7. Safety notes

- Use the app only on devices you own or are authorized to service.
- There is no screen-lock bypass, no FRP bypass, and no account bypass. That is out of scope.
- Before any flash: backup, battery above 50%, and an image that matches the phone.
- Do not flash `userdata` unless you understand it wipes everything.
- Do not re-lock the bootloader with a modified system unless you are sure; locking over a bad image
  can stop the phone from booting.
- Write down partition names and image files before you start, so you know what you did.

---

## 8. Troubleshooting

| Problem | Fix |
| --- | --- |
| Phone does not appear | Data cable, another USB port, enable USB debugging, replug, **Refresh** |
| unauthorized | Unlock the phone and accept "Allow USB debugging" |
| Platform Tools missing | Click **Install** on the top card and check the internet |
| adb returns an error | Close any other program using adb (Android Studio, scrcpy…), then retry |
| fastboot finds no device | Confirm the phone is in the bootloader, try another cable/port, click **Scan** |
| Install fails | Some apps need `INSTALL_FAILED_...`; read the error and try a compatible APK |
| Backup is slow | Large folders (DCIM) take time; keep the window open |
| Live view is slow | Expected: one screenshot per second. Use recording for video |
| SmartScreen warns | The installer is unsigned: More info → Run anyway, or verify the SHA-256 |

---

## 9. Known limits

- Windows x64 only.
- The installer is unsigned.
- Live view is about one frame per second, not a video stream.
- Recording is capped at 3 minutes per file.
- Wireless ADB is not supported yet.
- Lessons and checklist steps are written in English (the UI itself is fully bilingual).
- Flashing remains a risky operation: the app makes it reachable, it does not guarantee the outcome.

---

## 10. Quick FAQ

**Do I need Android Studio?** No. Platform Tools alone are enough, and the app installs them.

**Does it download ROMs?** No. You pick the image or ZIP from your own machine.

**Does it work offline?** Yes, after Platform Tools are installed. Only the optional content update
needs a network.

**Does it collect data?** No. No account, no tracking. History is local.

**How do I change the language?** Settings → Language: English / العربية. The UI flips to full RTL.

**How do I clear the history?** Settings → History → Clear (or from the history page).

---

More: [Arabic guide](USER-GUIDE.ar.md) · [README](README.md) · [Releases](https://github.com/bouadjadjatamer2-hub/DroidCrate/releases)
