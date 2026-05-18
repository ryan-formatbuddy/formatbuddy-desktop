import { describe, it, expect } from "vitest";
import { friendlyErrorMessage } from "../src/shared/error-friendly";

describe("friendlyErrorMessage", () => {
  it("falls back when input is empty", () => {
    expect(friendlyErrorMessage(null)).toMatch(/알 수 없는 문제/);
    expect(friendlyErrorMessage(undefined)).toMatch(/알 수 없는 문제/);
    expect(friendlyErrorMessage("")).toMatch(/알 수 없는 문제/);
  });

  it("maps integrity violations", () => {
    expect(friendlyErrorMessage("integrity check failed (expected abc, got def)")).toMatch(
      /변조된 것 같아/
    );
    expect(friendlyErrorMessage("integrity manifest missing: /tmp/x")).toMatch(/확인 파일이 없어요/);
    expect(friendlyErrorMessage("refusing to spawn")).toMatch(/실행을 보류했어요/);
  });

  it("maps manifest-export failures", () => {
    expect(friendlyErrorMessage("Manifest file was not written or is empty.")).toMatch(/저장하지 못했어요/);
    expect(friendlyErrorMessage("Manifest file missing: ENOENT ...")).toMatch(/사라졌어요/);
  });

  it("maps cancellation / abort", () => {
    expect(friendlyErrorMessage("Scan cancelled")).toMatch(/중간에 그만뒀어요/);
    expect(friendlyErrorMessage({ name: "AbortError", message: "Manifest export cancelled" })).toMatch(
      /그만뒀어요/
    );
  });

  it("maps filesystem error codes", () => {
    expect(friendlyErrorMessage({ message: "ENOSPC: no space left on device", code: "ENOSPC" })).toMatch(
      /디스크 공간이 부족/
    );
    expect(friendlyErrorMessage({ message: "EACCES: permission denied", code: "EACCES" })).toMatch(
      /권한이 부족/
    );
    expect(friendlyErrorMessage({ message: "EPERM: operation not permitted", code: "EPERM" })).toMatch(
      /권한이 부족/
    );
    expect(friendlyErrorMessage({ message: "ENOENT: no such file", code: "ENOENT" })).toMatch(
      /필요한 파일을 찾지 못했/
    );
    expect(friendlyErrorMessage({ message: "EBUSY: resource busy", code: "EBUSY" })).toMatch(
      /다른 프로그램이/
    );
  });

  it("maps Windows command exits and access-denied", () => {
    expect(friendlyErrorMessage("PowerShell exited with code 1. stderr: ...")).toMatch(
      /Windows 작업이 코드 1로 멈췄어요/
    );
    expect(friendlyErrorMessage("PowerShell exited with code 1. stderr: access is denied")).toMatch(
      /관리자 권한으로/
    );
    expect(
      friendlyErrorMessage("PowerShell exited with code 1. stderr: cannot be loaded because running scripts is disabled")
    ).toMatch(/관리자 권한으로/);
  });

  it("maps JSON schema mismatches", () => {
    expect(friendlyErrorMessage("Diagnostic JSON did not match expected ScanReport schema.")).toMatch(
      /예상과 달라요/
    );
  });

  it("maps network-ish failures", () => {
    expect(friendlyErrorMessage({ code: "ENOTFOUND", message: "getaddrinfo ENOTFOUND" })).toMatch(
      /인터넷 연결이 잠시 끊긴/
    );
  });
});
