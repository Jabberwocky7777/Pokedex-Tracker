import { Fragment, useMemo } from "react";
import type { Pokemon } from "../../types";
import { breedingAdvice, EGG_GROUP_NAMES, genderLabel } from "../../lib/breeding";
import { generationMaxId } from "../../lib/generation";
import { PokemonLink } from "./links";

interface Props {
  pokemon: Pokemon;
  allPokemon: readonly Pokemon[];
  /** Caught ids for the generation being viewed */
  caughtIds: readonly number[];
  generation: number;
  /** Where the Pokémon named here open: the tracker's panel, or the Pokédex */
  linkTo: "tracker" | "pokedex";
}

/**
 * "Can I breed this from something I've caught, and with what?" — egg groups,
 * gender ratio, what the egg hatches into, and whether the caught Pokémon are
 * enough to do it now.
 */
export default function BreedingCard({ pokemon, allPokemon, caughtIds, generation, linkTo }: Props) {
  const advice = useMemo(() => {
    // The Pokédex can show a species from outside the generation being viewed; then nothing is left out
    const maxId = pokemon.id > generationMaxId(generation) ? Infinity : generationMaxId(generation);
    return breedingAdvice(pokemon, allPokemon.filter((p) => p.id <= maxId), new Set(caughtIds), generation);
  }, [pokemon, allPokemon, caughtIds, generation]);

  const link = (p: Pokemon) => <PokemonLink id={p.id} to={linkTo}>{p.displayName}</PokemonLink>;
  const list = (items: Pokemon[], limit = 6) => (
    <>
      {items.slice(0, limit).map((p, i) => <Fragment key={p.id}>{i > 0 && ", "}{link(p)}</Fragment>)}
      {items.length > limit && ` and ${items.length - limit} more`}
    </>
  );
  const groups = pokemon.eggGroups.map((g) => EGG_GROUP_NAMES[g] ?? g).join(" · ");

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg bg-pink-900/10 border border-pink-800/30 text-xs text-gray-300" data-testid="breeding-card">
      <div className="text-xs text-pink-300 font-medium uppercase tracking-wider">Breeding</div>
      <div className="text-gray-400">
        Egg group: <span className="text-gray-200">{groups}</span> · {genderLabel(pokemon.genderRate)}
      </div>

      {!advice.possible ? (
        <div>{pokemon.name === "ditto" ? "Ditto breeds with almost anything, but there is no Ditto egg." : "Can't be bred: nothing in its line can produce an egg."}</div>
      ) : (
        <>
          <div>
            An egg hatches into {advice.hatches.id === pokemon.id ? <span className="text-gray-100">{pokemon.displayName}</span> : link(advice.hatches)}
            {advice.needsEvolving && <>, which then has to be evolved into {pokemon.displayName}</>}.
            {advice.incense && (
              <> Only when a parent holds a <span className="text-gray-100">{advice.incense}</span>
                {advice.withoutIncense && <> — without it the egg is {link(advice.withoutIncense)}</>}.</>
            )}
          </div>
          <div>
            Parent: {list(advice.parents)}
            {advice.dittoOnly
              ? <>, and only with <PokemonLink id={132} to={linkTo}>Ditto</PokemonLink> (it has no female to pair with a male).</>
              : <> — a female with a male from the same egg group, or either with <PokemonLink id={132} to={linkTo}>Ditto</PokemonLink>.</>}
          </div>
          <div className={advice.ready ? "text-emerald-300" : "text-gray-400"}>
            {advice.ready ? (
              <>
                ✓ You can breed this now: you have {list(advice.caughtParents, 3)}
                {advice.dittoCaught
                  ? <> and a Ditto.</>
                  : advice.caughtPartners.length > 0
                    ? <>, and {list(advice.caughtPartners, 4)} can be the other parent.</>
                    : <> — a male and a female of it will do.</>}
              </>
            ) : advice.caughtParents.length === 0 ? (
              <>You haven&apos;t caught anything in its line that can breed yet.</>
            ) : (
              <>You have {list(advice.caughtParents, 3)}, but no partner yet: {advice.dittoOnly ? "catch a Ditto" : "catch a Ditto or a male from the same egg group"}.</>
            )}
          </div>
        </>
      )}
    </div>
  );
}
