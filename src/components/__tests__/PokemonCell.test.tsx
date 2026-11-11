import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PokemonCell from "../box-view/PokemonCell";
import { useSettingsStore } from "../../store/useSettingsStore";
import type { FilteredPokemon } from "../../hooks/usePokemonFilter";

const gengar = {
  id: 94,
  displayNumber: 94,
  displayName: "Gengar",
  types: ["ghost", "poison"],
  spriteUrl: "",
  genSprite: "",
  shinySprite: "",
  isHighlighted: true,
  isVersionExclusive: false,
} as unknown as FilteredPokemon;

const cell = (props: Partial<Parameters<typeof PokemonCell>[0]> = {}) =>
  render(
    <PokemonCell
      pokemon={gengar}
      isCaught={false}
      isPending={false}
      isSelected={false}
      isShiny={false}
      quickMark={false}
      onClick={() => {}}
      onToggleCaught={() => {}}
      onTogglePending={() => {}}
      {...props}
    />,
  );

describe("PokemonCell", () => {
  it("tells a screen reader its name, number and state", () => {
    cell({ isCaught: true, isShiny: true });
    expect(screen.getByRole("button", { name: "Gengar, #094, caught, shiny" })).toBeTruthy();
  });

  it("says pending and not caught in words", () => {
    cell({ isPending: true });
    expect(screen.getByRole("button", { name: "Gengar, #094, pending" })).toBeTruthy();
  });

  it("is a toggle button with Quick mark on", () => {
    cell({ quickMark: true, isCaught: true });
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("true");
  });

  it("prints the name under the sprite when asked", () => {
    useSettingsStore.setState({ cellLabel: "name" });
    cell();
    expect(screen.getByText("Gengar")).toBeTruthy();
    useSettingsStore.setState({ cellLabel: "none" });
  });
});
