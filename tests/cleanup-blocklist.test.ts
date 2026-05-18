import { describe, expect, it } from "vitest";
import {
  BLOCKLIST_VERSION,
  evaluatePath,
  isCategoryRootAllowed,
  normalizePath
} from "../src/main/cleanup/blocklist";

const HOME = "C:\\Users\\Ryan";

describe("normalizePath", () => {
  it("collapses separators and lowercases the path", () => {
    expect(normalizePath("C:/Users//Ryan\\AppData")).toBe("c:\\users\\ryan\\appdata");
  });

  it("strips long-path prefix and trailing separator", () => {
    expect(normalizePath("\\\\?\\C:\\Temp\\")).toBe("c:\\temp");
  });

  it("preserves drive root separator", () => {
    expect(normalizePath("C:\\")).toBe("c:\\");
  });

  it("preserves UNC double-backslash prefix", () => {
    expect(normalizePath("\\\\server\\share\\folder\\")).toBe("\\\\server\\share\\folder");
  });

  it("returns empty for empty / whitespace input", () => {
    expect(normalizePath("")).toBe("");
    expect(normalizePath("   ")).toBe("");
  });
});

describe("evaluatePath — whitelist enforcement", () => {
  it("rejects paths outside any allowed root even if name looks safe", () => {
    const result = evaluatePath("C:\\Users\\Ryan\\Documents\\report.txt", {
      allowRoots: ["C:\\Temp"],
      home: HOME
    });
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toBe("not-under-allowed-root");
  });

  it("rejects when no allowed roots are provided", () => {
    const result = evaluatePath("C:\\Temp\\foo.log", { allowRoots: [], home: HOME });
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toBe("no-allow-root");
  });

  it("accepts a path inside its allowed root with no blocklist match", () => {
    const result = evaluatePath("C:\\Users\\Ryan\\AppData\\Local\\Temp\\old.tmp", {
      allowRoots: ["C:\\Users\\Ryan\\AppData\\Local\\Temp"],
      home: HOME
    });
    expect(result.allowed).toBe(true);
    expect(result.blockedBy).toBeUndefined();
  });
});

describe("evaluatePath — system blocklist", () => {
  it.each([
    "C:\\Windows\\System32\\drivers\\etc\\hosts",
    "C:\\Windows\\SysWOW64\\cmd.exe",
    "C:\\Program Files\\Microsoft Office\\foo.dll",
    "C:\\Program Files (x86)\\Steam\\steam.exe",
    "C:\\Windows\\Boot\\BCD",
    "C:\\Windows\\Fonts\\arial.ttf",
    "C:\\ProgramData\\Microsoft\\Windows Defender\\Definition Updates\\sig.vdm",
    "C:\\Recovery\\WindowsRE\\Winre.wim",
    "C:\\pagefile.sys",
    "C:\\hiberfil.sys",
    "C:\\Windows\\System32\\config\\SAM"
  ])("blocks system path %s", (path) => {
    const result = evaluatePath(path, { allowRoots: ["C:\\"], home: HOME });
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toBeTruthy();
  });

  it("blocks bare certificate files outside an explicit cache folder", () => {
    const result = evaluatePath("C:\\Temp\\client.pfx", {
      allowRoots: ["C:\\Temp"],
      home: HOME
    });
    expect(result.allowed).toBe(false);
  });

  it("blocks Outlook PST/OST", () => {
    expect(
      evaluatePath("C:\\Users\\Ryan\\Documents\\Outlook Files\\archive.pst", {
        allowRoots: ["C:\\Users\\Ryan\\Documents"],
        home: HOME
      }).allowed
    ).toBe(false);
  });
});

describe("evaluatePath — user-scoped blocklist", () => {
  it.each([
    "C:\\Users\\Ryan\\.ssh\\id_rsa",
    "C:\\Users\\Ryan\\.gnupg\\trustdb.gpg",
    "C:\\Users\\Ryan\\.aws\\credentials",
    "C:\\Users\\Ryan\\AppData\\LocalLow\\NPKI\\yessign\\foo",
    "C:\\Users\\Ryan\\AppData\\Roaming\\NPKI\\bar",
    "C:\\Users\\Ryan\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Login Data",
    "C:\\Users\\Ryan\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cookies",
    "C:\\Users\\Ryan\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Web Data",
    "C:\\Users\\Ryan\\AppData\\Roaming\\KakaoTalk\\database.db",
    "C:\\Users\\Ryan\\AppData\\Local\\Kakao\\KakaoTalk\\cache",
    "C:\\Users\\Ryan\\OneDrive\\Documents\\report.docx",
    "C:\\Users\\Ryan\\Dropbox\\file.txt"
  ])("blocks sensitive user path %s", (path) => {
    const result = evaluatePath(path, { allowRoots: [HOME], home: HOME });
    expect(result.allowed).toBe(false);
    expect(result.blockedBy).toBeTruthy();
  });

  it("does not falsely block a sibling AppData path that is not a credential store", () => {
    const result = evaluatePath(
      "C:\\Users\\Ryan\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache\\data_0",
      {
        allowRoots: ["C:\\Users\\Ryan\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache"],
        home: HOME
      }
    );
    expect(result.allowed).toBe(true);
  });
});

describe("BLOCKLIST_VERSION", () => {
  it("starts at v1 and is a positive integer (planner stamps this into plans)", () => {
    expect(BLOCKLIST_VERSION).toBe(1);
  });
});

describe("isCategoryRootAllowed", () => {
  it("allows %TEMP%-shaped roots", () => {
    expect(
      isCategoryRootAllowed("temp-user", "C:\\Users\\Ryan\\AppData\\Local\\Temp", HOME)
    ).toBe(true);
  });

  it("rejects roots that already match a blocklist rule", () => {
    expect(isCategoryRootAllowed("temp-windows", "C:\\Windows\\System32", HOME)).toBe(false);
    expect(
      isCategoryRootAllowed(
        "browser-cache",
        "C:\\Users\\Ryan\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Login Data",
        HOME
      )
    ).toBe(false);
  });
});
