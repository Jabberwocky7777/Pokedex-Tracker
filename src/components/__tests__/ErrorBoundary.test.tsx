import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../shared/ErrorBoundary";

describe("ErrorBoundary", () => {
  it("a crashing tab shows its own message, and Try again mounts it afresh", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let crash = true;
    function Flaky() {
      if (crash) throw new Error("bad slot");
      return <p>Routes work</p>;
    }
    render(
      <>
        <ErrorBoundary scope="tab" name="Routes">
          <Flaky />
        </ErrorBoundary>
        <p>Another tab</p>
      </>,
    );
    expect(screen.getByText("Routes couldn't be shown")).toBeTruthy();
    expect(screen.getByText("bad slot")).toBeTruthy();
    expect(screen.getByText("Another tab")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Download backup" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Open tracker" })).toBeTruthy();

    crash = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Routes work")).toBeTruthy();
  });

  it("logs the error", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    function Broken(): never {
      throw new Error("boom");
    }
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );
    expect(log.mock.calls.some((call) => String(call[0]).includes("crashed"))).toBe(true);
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
  });
});
