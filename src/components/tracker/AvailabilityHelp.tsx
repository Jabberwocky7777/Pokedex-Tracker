// Plain-language description of the availability filter. Keep this in step with
// computeAvailability() and the needs-attention block in hooks/usePokemonFilter.ts,
// and with lib/available-now.ts and data/weekly-events.ts for "Right now".

const MODES: { name: string; body: string }[] = [
  {
    name: "All",
    body: "Every Pokémon in the Pokédex you're viewing, at full brightness. Your game selection doesn't dim anything.",
  },
  {
    name: "Obtainable",
    body:
      "Bright if you can get it using only the selected games (all games of the generation when none are selected): " +
      "wild encounters of any kind, gifts, fossils and one-off static encounters; in-game NPC trades; " +
      "evolving something obtainable — by any method, including trade evolutions; and baby Pokémon you can breed " +
      "from an obtainable evolution. Everything else is dimmed.",
  },
  {
    name: "Catchable",
    body:
      "Stricter: bright only if the Pokémon itself has an encounter in the selected games — wild (grass, surfing, " +
      "fishing, headbutt, outbreaks, Poké Radar, Slot 2 and so on), a gift, a fossil or a static encounter. " +
      "NPC trades, evolutions and breeding don't count.",
  },
  {
    name: "Right now",
    body:
      "Catchable, narrowed to this moment by this device's clock: Generation IV encounters that only " +
      "appear in the morning (4:00–9:59), day (10:00–19:59) or night (20:00–3:59) count only at that time, and " +
      "weekday events count only on their day — Drifloon at the Valley Windworks and Lapras in Union Cave on Fridays, " +
      "the Bug-Catching Contest's Pokémon on Tuesdays, Thursdays and Saturdays. It assumes the game's clock matches this one.",
  },
  {
    name: "Needs attention",
    body:
      "Hides everything except Pokémon with something left to do: ones you've caught that still have an uncaught " +
      "evolution; uncaught trade evolutions of something you've caught; uncaught baby Pokémon (breeding); and, with " +
      "two or more games selected, uncaught version exclusives.",
  },
];

export default function AvailabilityHelp() {
  return (
    <div className="flex flex-col gap-2.5 text-xs text-gray-300 leading-relaxed">
      {MODES.map((m) => (
        <p key={m.name}>
          <span className="font-semibold text-gray-100">{m.name}.</span> {m.body}
        </p>
      ))}
      <p className="text-gray-400">
        A ★ marks a version exclusive: with two or more games selected, it has an encounter in exactly one of them.
      </p>
    </div>
  );
}
