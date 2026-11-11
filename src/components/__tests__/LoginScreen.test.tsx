import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import LoginScreen from "../auth/LoginScreen";

const realTimeout = AbortSignal.timeout;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Object.defineProperty(AbortSignal, "timeout", { value: realTimeout, configurable: true, writable: true });
});

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

describe("LoginScreen", () => {
  it("offers Use offline from the first render, before /health answers", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(<LoginScreen onSuccess={() => {}} />);
    expect(screen.getByRole("button", { name: "Use offline" })).toBeTruthy();
    expect(screen.getByText("Checking the sync server…")).toBeTruthy();
  });

  it("gives up on a /health that never answers", async () => {
    vi.useFakeTimers();
    // timeoutSignal's own fallback (as on iOS 15) runs on the fake clock; AbortSignal.timeout doesn't
    Object.defineProperty(AbortSignal, "timeout", { value: undefined, configurable: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("timed out", "AbortError")));
          }),
      ),
    );
    render(<LoginScreen onSuccess={() => {}} />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8100);
    });
    expect(screen.getByText(/Could not reach the server/)).toBeTruthy();
  });

  it("shows the server's wait after too many failed sign-ins, and counts it down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.endsWith("/health")
            ? json(200, { ok: true, loginEnabled: true, syncEnabled: true })
            : json(429, { error: "Too many", retryAfter: 30 }, { "Retry-After": "30" }),
        ),
      ),
    );
    render(<LoginScreen onSuccess={() => {}} />);
    fireEvent.change(await screen.findByLabelText("Username"), { target: { value: "ash" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "pikachu" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/Try again in 30 seconds/);
    const button = screen.getByRole("button", { name: /Try again in \d+ s/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("names placeholder settings instead of offering a login that can't work", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(json(200, { ok: true, loginEnabled: false, syncEnabled: false, placeholders: ["SYNC_TOKEN"] })),
      ),
    );
    render(<LoginScreen onSuccess={() => {}} />);
    expect(await screen.findByText(/example value for SYNC_TOKEN/)).toBeTruthy();
  });
});
