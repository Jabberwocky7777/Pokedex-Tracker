import { Fragment, type MouseEvent, type ReactNode } from "react";
import type { Pokemon } from "../../types";
import { openMove, openMoveByName, openPokedex, openRoute, openRouteSearch, showInTracker } from "../../lib/navigate";
import { placeName, resolvePlace } from "../../lib/location-links";

// Inline links to another tab: a Pokémon, a route, a move or a free-text place.
// Each is a real <button> (keyboard and screen-reader reachable) that reads as
// text with a dotted underline — hover colour alone says nothing on a touch
// screen. They stop the click from reaching a clickable row they sit in.

const LINK_CLASS =
  "inline text-left underline decoration-dotted decoration-current/60 underline-offset-2 cursor-pointer " +
  "hover:decoration-solid hover:text-indigo-300 transition-colors rounded-sm " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400";

interface LinkButtonProps {
  onOpen: () => void;
  title?: string;
  className?: string;
  children: ReactNode;
}

function LinkButton({ onOpen, title, className = "", children }: LinkButtonProps) {
  function handleClick(e: MouseEvent) {
    // Inside a clickable row, a <label> or a tappable card: only the link acts
    e.stopPropagation();
    e.preventDefault();
    onOpen();
  }
  return (
    <button type="button" onClick={handleClick} title={title} className={`${LINK_CLASS} ${className}`}>
      {children}
    </button>
  );
}

interface CommonProps {
  className?: string;
  children: ReactNode;
}

/** A Pokémon's name (or sprite). Opens the Pokédex tab, or the tracker's detail panel with `to="tracker"`. */
export function PokemonLink({ id, to = "pokedex", generation, className, children }: CommonProps & {
  id: number;
  to?: "pokedex" | "tracker";
  /** With to="tracker": the generation whose marks to show (a save's, a game's) */
  generation?: number;
}) {
  return (
    <LinkButton
      onOpen={() => (to === "tracker" ? showInTracker(id, generation) : openPokedex(id))}
      title={to === "tracker" ? "Show in the tracker" : "Open in the Pokédex"}
      className={className}
    >
      {children}
    </LinkButton>
  );
}

/** An encounter area, by its locationAreaSlug. Opens it in the Routes tab. */
export function RouteLink({ slug, className, children }: CommonProps & { slug: string }) {
  return <LinkButton onOpen={() => openRoute(slug)} title="Open in Routes" className={className}>{children}</LinkButton>;
}

/** A move, by slug ("u-turn") or by name as written ("U-turn", "ThunderPunch"). Opens it in the Attackdex. */
export function MoveLink({ slug, name, className, children }: CommonProps & ({ slug: string; name?: undefined } | { name: string; slug?: undefined })) {
  return (
    <LinkButton
      onOpen={() => (slug !== undefined ? openMove(slug) : openMoveByName(name))}
      title="Open in the Attackdex"
      className={className}
    >
      {children}
    </LinkButton>
  );
}

interface LocationLinkProps {
  /** A place as written by hand: "Mt. Ember (found in cave)", "Silence Bridge / Pewter City Museum" */
  text: string;
  /** Only areas of these games are considered */
  games: readonly string[];
  allPokemon: readonly Pokemon[];
  className?: string;
}

/**
 * Free text naming a place. The place name becomes a link when it is an
 * encounter area in the given games — straight to the area, or to a Routes
 * search when it has several (a cave's floors). Anything else stays plain text.
 * Text naming two places ("A / B") links each on its own.
 */
export function LocationLink({ text, games, allPokemon, className }: LocationLinkProps) {
  const parts = text.split(" / ");
  return (
    <>
      {parts.map((part, i) => {
        const target = resolvePlace(part, games, allPokemon);
        const name = placeName(part);
        const start = part.indexOf(name);
        const linked = !target ? part : (
          <>
            {part.slice(0, start)}
            <LinkButton
              onOpen={() => (target.kind === "route" ? openRoute(target.slug) : openRouteSearch(target.text))}
              title={target.kind === "route" ? "Open in Routes" : "Search Routes for this place"}
              className={className}
            >
              {name}
            </LinkButton>
            {part.slice(start + name.length)}
          </>
        );
        return <Fragment key={i}>{i > 0 && " / "}{linked}</Fragment>;
      })}
    </>
  );
}

const isLetter = (char: string | undefined) => char !== undefined && /\p{L}/u.test(char);

/** Where `name` first stands as a name of its own — "Pidgeot" is not found inside "Pidgeotto". */
function findWholeName(text: string, name: string): number {
  if (!name) return -1;
  for (let at = text.indexOf(name); at !== -1; at = text.indexOf(name, at + 1)) {
    if (!isLetter(text[at - 1]) && !isLetter(text[at + name.length])) return at;
  }
  return -1;
}

/**
 * A ready-made sentence with the first mention of `name` turned into a link:
 *   <LinkMention text="Kakuna evolves into Beedrill at level 10." name="Beedrill">
 *     {(label) => <PokemonLink id={15}>{label}</PokemonLink>}
 *   </LinkMention>
 * For strings built elsewhere (describeEvolution(), the to-do steps). Plain
 * text when the name doesn't occur.
 */
export function LinkMention({ text, name, children }: { text: string; name: string; children: (label: string) => ReactNode }) {
  const at = findWholeName(text, name);
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      {children(name)}
      {text.slice(at + name.length)}
    </>
  );
}
