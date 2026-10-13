import { describe, expect, it } from "vitest";
import { buildTradeSession, type TradeSide } from "../trade-session";
import type { Pokemon } from "../../types";
import type { SlimMon } from "../save/types";

// Loaded through a non-literal specifier so the app's type-check doesn't need Node's types
const nodeFs = "node:fs";
const fs = (await import(/* @vite-ignore */ nodeFs)) as { readFileSync: (path: string) => Uint8Array };
const allPokemon = JSON.parse(new TextDecoder().decode(fs.readFileSync("public/data/pokemon.json"))) as Pokemon[];
const id = (name: string) => allPokemon.find((p) => p.name === name)!.id;
const name = (species: number) => allPokemon.find((p) => p.id === species)!.name;

const game = (version: string): TradeSide => ({ key: `game:${version}`, label: version, games: [version as never], mons: null });
const save = (label: string, version: string, ...species: string[]): TradeSide => ({
  key: label, label, games: [version as never],
  mons: species.map((s, i): SlimMon => ({ box: 0, slot: i, species: id(s.replace(/^egg:/, "")), form: 0, shiny: false, level: 5, isEgg: s.startsWith("egg:") })),
});
const session = (a: TradeSide, b: TradeSide, caught: string[] = []) =>
  buildTradeSession([a, b], { pokemon: allPokemon, maxSpecies: 493, caught: new Set(caught.map(id)) })
    .map((item) => `${item.from}:${item.kind}:${name(item.species)}${item.evolvesInto ? `>${name(item.evolvesInto)}` : ""}${item.heldItem ? `[${item.heldItem}]` : ""}`);

describe("two games", () => {
  const list = session(game("diamond"), game("pearl"));

  it("lists each side's version exclusives, one per line", () => {
    // Diamond has Murkrow and Cranidos; Pearl has Misdreavus and Shieldon
    expect(list).toContain("0:exclusive:murkrow");
    expect(list).toContain("0:exclusive:cranidos");
    expect(list).toContain("1:exclusive:misdreavus");
    expect(list).toContain("1:exclusive:shieldon");
    // The evolved forms come from evolving what was sent
    expect(list).not.toContain("0:exclusive:honchkrow");
    expect(list).not.toContain("0:exclusive:rampardos");
    // Nothing both games have
    expect(list.some((l) => /exclusive:(starly|bidoof|geodude)$/.test(l))).toBe(false);
  });

  it("lists every trade evolution once, with the item to hold", () => {
    const evolutions = list.filter((l) => l.includes("trade-evolution"));
    expect(evolutions).toContain("0:trade-evolution:kadabra>alakazam");
    expect(evolutions).toContain("0:trade-evolution:onix>steelix[Metal Coat]");
    expect(evolutions.filter((l) => l.includes("kadabra>alakazam"))).toHaveLength(1);
    expect(list.some((l) => l.includes(":spare:"))).toBe(false);
  });

  it("skips trade evolutions the tracker already has", () => {
    const withAlakazam = session(game("diamond"), game("pearl"), ["alakazam"]);
    expect(withAlakazam.some((l) => l.includes("kadabra>alakazam"))).toBe(false);
    expect(withAlakazam).toContain("0:trade-evolution:machoke>machamp");
  });

  it("orders by direction, then exclusives, then trade evolutions", () => {
    const kinds = list.map((l) => l.split(":").slice(0, 2).join(":"));
    // (Pearl's side has trade evolutions of its own exclusives: Slowpoke into Slowking)
    expect([...new Set(kinds)]).toEqual(["0:exclusive", "0:trade-evolution", "1:exclusive", "1:trade-evolution"]);
    expect(list).toContain("1:trade-evolution:slowpoke>slowking[King's Rock]");
  });
});

describe("two saves", () => {
  const diamond = save("My Diamond", "diamond", "murkrow", "starly", "starly", "kadabra", "bidoof", "egg:cranidos");
  const pearl = save("Her Pearl", "pearl", "misdreavus", "bidoof", "bidoof", "machoke", "machamp", "glameow", "glameow");
  const list = session(diamond, pearl);

  it("sends exclusives only when the sender has one and the receiver doesn't", () => {
    expect(list).toContain("0:exclusive:murkrow");
    expect(list).toContain("1:exclusive:misdreavus");
    // An egg is not something to send; Cranidos isn't owned otherwise
    expect(list).not.toContain("0:exclusive:cranidos");
    // Glameow is Pearl-only: sent as an exclusive, not as a spare
    expect(list).toContain("1:exclusive:glameow");
    expect(list).not.toContain("1:spare:glameow");
  });

  it("offers spares the other save lacks", () => {
    expect(list).toContain("0:spare:starly");
    // Pearl has two Bidoof but Diamond already has one
    expect(list).not.toContain("1:spare:bidoof");
  });

  it("lists trade evolutions for what each save actually holds", () => {
    expect(list).toContain("0:trade-evolution:kadabra>alakazam");
    // She already has a Machamp
    expect(list.some((l) => l.includes("machoke>machamp"))).toBe(false);
    expect(list.some((l) => l.includes("onix>steelix"))).toBe(false);
  });
});

describe("a save and a game", () => {
  it("uses what the save holds on its side and the game's catalogue on the other", () => {
    const list = session(save("My Diamond", "diamond", "murkrow", "kadabra"), game("pearl"));
    expect(list).toContain("0:exclusive:murkrow");
    expect(list).not.toContain("0:exclusive:cranidos");
    expect(list).toContain("1:exclusive:misdreavus");
    expect(list).toContain("0:trade-evolution:kadabra>alakazam");
    expect(list.some((l) => l.includes(":spare:"))).toBe(false);
  });

  it("has nothing to say for the same game on both sides", () => {
    expect(session(game("platinum"), game("platinum")).filter((l) => l.includes("exclusive"))).toEqual([]);
  });
});
