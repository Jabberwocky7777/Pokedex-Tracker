import { useMemo, useRef, useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, ChevronDown, GripVertical, Link2, Trash2, X } from "lucide-react";
import type { Pokemon } from "../../types";
import { useWorkingOnStore, WORK_TEXT_MAX_LENGTH, type WorkLink } from "../../store/useWorkingOnStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { addItem, clearDone, cycleStatus, deleteItem, moveItem, orderedItems, STATUS_LABELS, updateItem, type LiveItem } from "../../lib/working-on";
import { getGenSprite } from "../../lib/pokemon-display";
import { PokemonLink, RouteLink } from "../shared/links";
import { GameChip } from "../shared/GameChip";
import LinkPicker from "./LinkPicker";

interface Props {
  allPokemon: Pokemon[];
}

// A mouse can drag rows by the handle; move up / down buttons are there for touch and the keyboard
const COARSE = typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;

const day = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
function when(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} h ago`;
  return day.format(ms);
}

/** The "Working on" list: quick add, status taps, inline edits, manual order, done items folded away. */
export default function WorkingOnPanel({ allPokemon }: Props) {
  const entries = useWorkingOnStore((s) => s.entries);
  const items = useMemo(() => orderedItems(entries), [entries]);
  const open = items.filter((i) => i.status !== "done");
  const done = items.filter((i) => i.status === "done");
  const pokemonById = useMemo(() => new Map(allPokemon.map((p) => [p.id, p])), [allPokemon]);

  const [draft, setDraft] = useState("");
  const [draftLink, setDraftLink] = useState<WorkLink | undefined>();
  const [linking, setLinking] = useState<string | "new" | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  function submit() {
    if (addItem(draft, draftLink)) {
      setDraft("");
      setDraftLink(undefined);
      setLinking(null);
    }
  }

  function onDragOver(e: DragEvent, index: number) {
    if (!dragId) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropIndex(e.clientY < rect.top + rect.height / 2 ? index : index + 1);
  }
  function onDrop() {
    if (dragId && dropIndex !== null) {
      // The index among the others: positions after the dragged row shift up by one
      const from = open.findIndex((i) => i.id === dragId);
      moveItem(dragId, dropIndex > from ? dropIndex - 1 : dropIndex, open);
    }
    setDragId(null);
    setDropIndex(null);
  }

  const linkLabel = (link: WorkLink) => <LinkChip link={link} pokemonById={pokemonById} />;

  return (
    <section className="flex flex-col gap-4" aria-label="Working on">
      {/* ── Add ── */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
            maxLength={WORK_TEXT_MAX_LENGTH}
            placeholder="Add an item and press Enter"
            aria-label="New Working on item"
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-gray-900 border border-gray-700 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => setLinking(linking === "new" ? null : "new")}
            aria-expanded={linking === "new"}
            title="Link it to a Pokémon, a route or a game"
            className="flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-sm text-gray-300"
          >
            <Link2 size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Link</span>
          </button>
          <button
            onClick={submit}
            disabled={!draft.trim()}
            className="px-4 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium"
          >
            Add
          </button>
        </div>
        {draftLink && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            Linked to {linkLabel(draftLink)}
            <button onClick={() => setDraftLink(undefined)} aria-label="Remove link" className="p-1 rounded text-gray-400 hover:text-gray-100"><X size={14} /></button>
          </div>
        )}
        {linking === "new" && (
          <LinkPicker allPokemon={allPokemon} onPick={(link) => { setDraftLink(link); setLinking(null); }} onClose={() => setLinking(null)} />
        )}
      </div>

      {/* ── Open items ── */}
      {open.length === 0 ? (
        <div className="px-4 py-5 rounded-xl border border-dashed border-gray-700 text-sm text-gray-400" data-testid="working-empty">
          <p>Keep track of what you're doing in your games right now — catches, breeding, trades, evolutions.</p>
          <p className="mt-2 text-gray-500">For example: <span className="text-gray-300">“Fish for Feebas under the Route 119 bridge”</span>, linked to Feebas.</p>
        </div>
      ) : (
        <ol className="flex flex-col gap-1.5" onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropIndex(null); }}>
          {open.map((item, index) => (
            <li
              key={item.id}
              onDragOver={(e) => onDragOver(e, index)}
              onDrop={onDrop}
              className={`relative ${dragId === item.id ? "opacity-50" : ""}`}
            >
              {dropIndex === index && <div className="absolute -top-1 inset-x-0 h-0.5 rounded bg-indigo-500" />}
              {dropIndex === index + 1 && index === open.length - 1 && <div className="absolute -bottom-1 inset-x-0 h-0.5 rounded bg-indigo-500" />}
              <ItemRow
                item={item}
                linkChip={item.link ? linkLabel(item.link) : null}
                canMoveUp={index > 0}
                canMoveDown={index < open.length - 1}
                onMove={(delta) => moveItem(item.id, index + delta, open)}
                onDragStart={() => setDragId(item.id)}
                onDragEnd={() => { setDragId(null); setDropIndex(null); }}
                onLink={() => setLinking(linking === item.id ? null : item.id)}
              />
              {linking === item.id && (
                <div className="mt-1.5">
                  <LinkPicker allPokemon={allPokemon} onPick={(link) => { updateItem(item.id, { link }); setLinking(null); }} onClose={() => setLinking(null)} />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {/* ── Done ── */}
      {done.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              onClick={() => setShowDone((v) => !v)}
              aria-expanded={showDone}
              className="flex items-center gap-1.5 px-2 py-2 -ml-2 rounded-md text-sm font-semibold text-gray-300 hover:text-gray-100"
            >
              <ChevronDown size={16} className={`transition-transform ${showDone ? "" : "-rotate-90"}`} aria-hidden="true" />
              Done ({done.length})
            </button>
            {!confirmClear ? (
              <button onClick={() => setConfirmClear(true)} className="px-3 py-2 rounded-md text-xs text-gray-400 hover:text-gray-100 hover:bg-gray-800">
                Clear done…
              </button>
            ) : (
              <div className="flex items-center gap-2" role="alertdialog" aria-label="Confirm clearing done items">
                <span className="text-xs text-gray-300">Remove {done.length} done item{done.length === 1 ? "" : "s"}?</span>
                <button onClick={() => { clearDone(); setConfirmClear(false); }} className="px-3 py-1.5 rounded-md bg-red-700 hover:bg-red-600 text-xs text-white font-medium">Clear</button>
                <button onClick={() => setConfirmClear(false)} className="px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-xs text-gray-200">Cancel</button>
              </div>
            )}
          </div>
          {showDone && (
            <ol className="flex flex-col gap-1.5">
              {done.map((item) => (
                <li key={item.id}>
                  <ItemRow item={item} linkChip={item.link ? linkLabel(item.link) : null} />
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}

function ItemRow({ item, linkChip, canMoveUp, canMoveDown, onMove, onDragStart, onDragEnd, onLink }: {
  item: LiveItem;
  linkChip: React.ReactNode;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMove?: (delta: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onLink?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);
  const cancelled = useRef(false);
  const isDone = item.status === "done";
  const movable = !!onMove;

  function save() {
    if (cancelled.current) { cancelled.current = false; return; }
    const trimmed = text.trim();
    if (trimmed && trimmed !== item.text) updateItem(item.id, { text: trimmed });
    else setText(item.text);
    setEditing(false);
  }

  return (
    <div
      draggable={movable && !COARSE && !editing}
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", item.id); onDragStart?.(); }}
      onDragEnd={onDragEnd}
      className="group flex flex-wrap items-start gap-x-2 gap-y-1 px-2 py-2 rounded-xl bg-gray-900 border border-gray-800"
    >
      {movable && !COARSE && (
        <span className="mt-2 text-gray-600 cursor-grab active:cursor-grabbing" aria-hidden="true" title="Drag to reorder">
          <GripVertical size={16} />
        </span>
      )}

      <button
        onClick={() => cycleStatus(item.id)}
        title="Tap to change: To do → Doing → Done"
        aria-label={`Status: ${STATUS_LABELS[item.status]}. Change status`}
        className={`flex-shrink-0 min-w-[4.5rem] min-h-[36px] px-2 rounded-lg text-xs font-semibold border transition-colors ${
          item.status === "doing" ? "bg-indigo-600/20 text-indigo-300 border-indigo-500/50"
          : isDone ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40"
          : "bg-gray-800 text-gray-300 border-gray-700"
        }`}
      >
        {STATUS_LABELS[item.status]}
      </button>

      <div className="flex-1 min-w-[11rem] pt-1.5">
        {editing ? (
          <input
            autoFocus
            value={text}
            maxLength={WORK_TEXT_MAX_LENGTH}
            onChange={(e) => setText(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") { cancelled.current = true; setText(item.text); setEditing(false); }
            }}
            aria-label="Edit item"
            className="w-full -my-1 px-2 py-1 rounded-md bg-gray-800 border border-indigo-500 text-sm text-gray-100 focus:outline-none"
          />
        ) : (
          <button
            onClick={() => { setText(item.text); setEditing(true); }}
            title="Edit"
            className={`block w-full text-left text-sm break-words ${isDone ? "text-gray-500 line-through" : "text-gray-100"}`}
          >
            {item.text}
          </button>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          {linkChip}
          <span title={`Added ${new Date(item.createdAt).toLocaleString()}`}>
            Added {when(item.createdAt)}{item.at - item.createdAt > 60_000 ? ` · edited ${when(item.at)}` : ""}
          </span>
        </div>
      </div>

      <div className={`ml-auto flex items-center gap-0.5 flex-shrink-0 ${COARSE ? "" : "opacity-60 group-hover:opacity-100 group-focus-within:opacity-100"}`}>
        {movable && (
          <>
            <IconButton label="Move up" disabled={!canMoveUp} onClick={() => onMove!(-1)}><ArrowUp size={16} /></IconButton>
            <IconButton label="Move down" disabled={!canMoveDown} onClick={() => onMove!(1)}><ArrowDown size={16} /></IconButton>
          </>
        )}
        {onLink && <IconButton label={item.link ? "Change link" : "Link to a Pokémon, route or game"} onClick={onLink}><Link2 size={16} /></IconButton>}
        <IconButton label="Delete" onClick={() => deleteItem(item.id)}><Trash2 size={16} /></IconButton>
      </div>
    </div>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-100 hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent ${COARSE ? "w-10 h-10" : "w-8 h-8"}`}
    >
      {children}
    </button>
  );
}

/** What an item points at: a Pokémon (sprite + name, opens the tracker), a route (opens Routes) or a game. */
function LinkChip({ link, pokemonById }: { link: WorkLink; pokemonById: Map<number, Pokemon> }) {
  const activeGeneration = useSettingsStore((s) => s.activeGeneration);
  if (link.kind === "pokemon") {
    const pokemon = pokemonById.get(link.id);
    if (!pokemon) return null;
    const generation = link.generation ?? activeGeneration;
    return (
      <span className="inline-flex items-center gap-1 text-gray-300 whitespace-nowrap">
        <img src={getGenSprite(pokemon, generation)} alt="" width={24} height={24} className="w-6 h-6 -my-1 object-contain pixelated" />
        <PokemonLink id={pokemon.id} to="tracker" generation={link.generation}>{pokemon.displayName}</PokemonLink>
        {link.generation && <span className="text-gray-500 whitespace-nowrap">· Gen {link.generation}</span>}
      </span>
    );
  }
  if (link.kind === "route") return <RouteLink slug={link.slug} className="text-gray-300">{link.name}</RouteLink>;
  return <GameChip game={link.game} size="sm" />;
}
