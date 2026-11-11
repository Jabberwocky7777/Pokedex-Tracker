import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import RestoreConfirm from "../settings/RestoreConfirm";
import { buildPayload } from "../../lib/sync";
import { useJournalStore } from "../../store/useJournalStore";

describe("RestoreConfirm", () => {
  it("lists what the restore removes and can be cancelled", () => {
    const backup = buildPayload();
    for (const id of ["a", "b", "c"])
      useJournalStore.getState().put(id, { date: "2026-11-09", game: "platinum", text: id, createdAt: 1 });
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<RestoreConfirm source="the backup from 3 Nov" data={backup} onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText(/3 journal entries on this device are removed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
