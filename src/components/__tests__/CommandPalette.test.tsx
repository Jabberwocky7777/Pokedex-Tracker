import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CommandPalette from "../layout/CommandPalette";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { Pokemon } from "../../types";

vi.mock("../../lib/move-data", () => ({
  loadMovesFile: () => Promise.resolve({ moves: [{ slug: "shadow-ball" }] }),
}));
vi.mock("../../lib/move-names", () => ({ moveDisplayName: () => "Shadow Ball" }));

const mon = (id: number, displayName: string, location?: string) =>
  ({
    id,
    displayName,
    encounters: location
      ? [
          {
            locations: [{ locationAreaSlug: location.toLowerCase().replace(/ /g, "-"), locationDisplayName: location }],
          },
        ]
      : [],
  }) as unknown as Pokemon;

describe("CommandPalette", () => {
  const all = [mon(94, "Gengar"), mon(92, "Gastly", "Old Chateau"), mon(25, "Pikachu")];

  it("finds Pokémon, routes and tabs, and opens the first with Enter", () => {
    const onClose = vi.fn();
    render(<CommandPalette allPokemon={all} onClose={onClose} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "ga" } });
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options[0]).toContain("Gastly");
    expect(options.some((o) => o?.includes("Gengar"))).toBe(true);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useSettingsStore.getState().selectedPokemonId).toBe(92);
    expect(onClose).toHaveBeenCalled();
  });

  it("finds a route by name and a move once the moves load", async () => {
    render(<CommandPalette allPokemon={all} onClose={() => {}} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "chateau" } });
    expect(screen.getByRole("option").textContent).toContain("Old Chateau");
    fireEvent.change(input, { target: { value: "shadow" } });
    expect((await screen.findByRole("option")).textContent).toContain("Shadow Ball");
  });
});
