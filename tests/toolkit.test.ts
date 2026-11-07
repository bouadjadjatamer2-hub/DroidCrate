import { describe, expect, it } from "vitest";
import {
  commandDisplay,
  isSafePackageName,
  isSafePartition,
  isSafeRemotePath,
  parseFlashStage,
  parsePackageList,
  parsePmPath,
  parseTransferPercent,
  toSdcardRelative,
} from "../src/shared/toolkit";

describe("package list parsing", () => {
  it("keeps user packages and their apk paths", () => {
    const output = [
      "package:/data/app/~~abc==/com.example.app-xyz==/base.apk=com.example.app",
      "package:/data/app/~~def==/com.other.tool-xyz==/base.apk=com.other.tool",
    ].join("\n");

    expect(parsePackageList(output, false)).toEqual([
      {
        name: "com.example.app",
        apkPath: "/data/app/~~abc==/com.example.app-xyz==/base.apk",
        system: false,
      },
      {
        name: "com.other.tool",
        apkPath: "/data/app/~~def==/com.other.tool-xyz==/base.apk",
        system: false,
      },
    ]);
  });

  it("ignores daemon noise and duplicate packages", () => {
    const output = [
      "package:com.example.app",
      "package:com.example.app",
      "error: closed",
      "package:not a package",
    ].join("\n");

    expect(parsePackageList(output, true)).toEqual([
      { name: "com.example.app", apkPath: null, system: true },
    ]);
  });
});

describe("transfer progress", () => {
  it("reads the last percentage printed by adb", () => {
    expect(parseTransferPercent("[ 12%] /sdcard/a.zip")).toBe(12);
    expect(parseTransferPercent("[ 12%] a\n[ 87%] b")).toBe(87);
  });

  it("returns null when adb prints no percentage", () => {
    expect(parseTransferPercent("adb: error: failed")).toBeNull();
  });
});

describe("pm path parsing", () => {
  it("returns the first absolute apk path", () => {
    expect(parsePmPath("package:/data/app/x/base.apk\n")).toBe(
      "/data/app/x/base.apk",
    );
    expect(parsePmPath("error: not found")).toBeNull();
  });
});

describe("input validation", () => {
  it("accepts normal serials and package names", () => {
    expect(isSafePackageName("com.example.app")).toBe(true);
    expect(isSafePackageName("com.example_app")).toBe(true);
    expect(isSafePartition("boot")).toBe(true);
    expect(isSafePartition("vbmeta_system")).toBe(true);
  });

  it("rejects traversal and shell-hostile values", () => {
    expect(isSafePackageName("com.example; rm -rf /")).toBe(false);
    expect(isSafePartition("boot;rm")).toBe(false);
    expect(isSafeRemotePath("/sdcard/../data")).toBe(false);
    expect(isSafeRemotePath("sdcard/Download")).toBe(false);
    expect(isSafeRemotePath("/sdcard/Download")).toBe(true);
    expect(toSdcardRelative("/sdcard/DCIM/")).toBe("DCIM");
    expect(toSdcardRelative("/data/local/tmp")).toBeNull();
  });
});

describe("fastboot output", () => {
  it("maps the flash stages", () => {
    expect(parseFlashStage("Sending 'boot' (65536 KB)...")).toEqual({
      stage: "sending",
      percent: 45,
    });
    expect(parseFlashStage("Writing 'boot'...")).toEqual({
      stage: "writing",
      percent: 90,
    });
    expect(parseFlashStage("Finished. Total time: 2.1s")).toEqual({
      stage: "finished",
      percent: 100,
    });
  });

  it("prints a readable command line", () => {
    expect(commandDisplay("adb", ["shell", "getprop"], "ABC123")).toBe(
      "adb -s ABC123 shell getprop",
    );
    expect(commandDisplay("fastboot", ["devices"], null)).toBe(
      "fastboot devices",
    );
  });
});
