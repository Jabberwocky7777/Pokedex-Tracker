import { useEffect, useState } from "react";
import { NOTE_MAX_LENGTH, noteKey, useNotesStore } from "../../store/useNotesStore";

interface Props {
  pokemonId: number;
  displayName: string;
  generation: number;
}

/**
 * A free-text note for one Pokémon, kept per generation and synced. The text is
 * written to the store when the field loses focus (and when the Pokémon shown
 * changes), not on every keystroke — each write is a sync.
 */
export default function NoteField({ pokemonId, displayName, generation }: Props) {
  const key = noteKey(generation, pokemonId);
  const entry = useNotesStore((s) => s.entries[key]);
  const saved = entry && !entry.removed ? entry.text : "";
  const [draft, setDraft] = useState(saved);
  const [editing, setEditing] = useState(false);

  // Follow the store while not typing: another Pokémon, or a note arriving by sync
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors external (synced) state into the field
    if (!editing) setDraft(saved);
  }, [saved, editing, key]);

  function commit() {
    setEditing(false);
    const text = draft.trim();
    if (text === saved) return;
    const store = useNotesStore.getState();
    if (text) store.put(key, { text });
    else store.remove(key);
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Note</span>
      <textarea
        value={draft}
        onChange={(e) => { setEditing(true); setDraft(e.target.value.slice(0, NOTE_MAX_LENGTH)); }}
        onBlur={commit}
        rows={draft.split("\n").length > 2 || draft.length > 80 ? 4 : 2}
        placeholder={`Anything to remember about ${displayName}…`}
        aria-label={`Note for ${displayName}`}
        className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-indigo-500 resize-y"
      />
    </label>
  );
}
