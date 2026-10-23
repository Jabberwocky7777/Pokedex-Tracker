import { genderBar, genderText } from "../../lib/gender";
import { cuteCharmInfo, hex, MALE_LEAD_PIDS } from "../../lib/cute-charm";

interface Props {
  genderRate: number;
  /** Show the Cute Charm glitch note — Diamond, Pearl, Platinum, HeartGold and SoulSilver only */
  showCuteCharm: boolean;
}

/** The species' gender ratio as text and a two-part bar, with the Gen IV Cute Charm note. */
export default function GenderLine({ genderRate, showCuteCharm }: Props) {
  const bar = genderBar(genderRate);
  const cuteCharm = cuteCharmInfo(genderRate);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
        <span>Gender: <span className="text-gray-200 font-medium">{genderText(genderRate)}</span></span>
        {bar && (
          <span
            className="flex h-1.5 w-28 rounded-full overflow-hidden bg-gray-800"
            role="img"
            aria-label={genderText(genderRate)}
          >
            {bar.male > 0 && <span className="h-full bg-indigo-400" style={{ width: `${bar.male}%` }} />}
            {bar.female > 0 && <span className="h-full bg-pink-400" style={{ width: `${bar.female}%` }} />}
          </span>
        )}
      </div>
      {showCuteCharm && (
        <p className="text-xs text-gray-400 max-w-prose" data-testid="cute-charm-note">
          <span className="font-semibold text-gray-300">Cute Charm glitch: </span>
          {!cuteCharm.affected
            ? "Can't be affected by Cute Charm, so the Cute Charm glitch won't work."
            : <>
                a male Cute Charm lead gives a female from the shared table (PIDs {hex(MALE_LEAD_PIDS[0])}–{hex(MALE_LEAD_PIDS[1])}), so a save
                set up for it works for every species that can be both genders. A female lead gives a male from the {cuteCharm.ratioLabel} table
                (PIDs {hex(cuteCharm.femaleLeadPids[0])}–{hex(cuteCharm.femaleLeadPids[1])}), which needs a save set up for this ratio.
              </>}
        </p>
      )}
    </div>
  );
}
