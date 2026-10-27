# Security policy

DroidCrate runs locally, does not require an account, and does not upload device
data. The most important security boundary is the command runner: only reviewed
ADB and Fastboot operations should be exposed to the renderer.

## Reporting

Please report security issues privately through GitHub Security Advisories:

<https://github.com/bouadjadjatamer2-hub/DroidCrate/security/advisories/new>

Do not open a public issue for a vulnerability. Include the version, Windows
build, steps, and any relevant log lines with serial numbers removed.

## Out of scope

- Vulnerabilities in vendor tools linked from the library. Report those to the
  vendor.
- Attempts to bypass locks, accounts, or ownership protections. Those are not
  supported uses of this project.
- Firmware or device-specific exploits.

## Supported versions

Only the latest release receives fixes while the project is in its first year.
