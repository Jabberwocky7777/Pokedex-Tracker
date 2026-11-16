import { describe, expect, it } from "vitest";
import { webViewVersion } from "../android-window";

describe("webViewVersion", () => {
  it("reads the Chromium major version from a WebView user agent", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; AYN Thor Build/TKQ1; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/104.0.5112.97 Mobile Safari/537.36";
    expect(webViewVersion(ua)).toBe(104);
  });

  it("is null for a browser that isn't Chromium", () => {
    expect(webViewVersion("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15")).toBeNull();
  });
});
