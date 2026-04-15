import type { IvSession } from "../../store/useIvStore";

interface Props {
  savedSessions: IvSession[];
  onLoad: (session: IvSession) => void;
  onDelete: (id: string) => void;
}

export function PcBoxPanel({ savedSessions, onLoad, onDelete }: Props) {
  return (
    <div className="absolute right-0 top-full mt-1 z-30 w-72 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-800 text-xs font-medium text-gray-400 uppercase tracking-wider">
        Saved Sessions
      </div>
      {savedSessions.length === 0 ? (
        <div className="px-3 py-4 text-sm text-gray-600 text-center">No saves yet</div>
      ) : (
        <div className="max-h-64 overflow-y-auto divide-y divide-gray-800">
          {savedSessions.map((s) => (
            <div key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-800 transition-colors">
              <img
                src={s.pokemonSprite}
                alt={s.pokemonName}
                className="w-8 h-8 object-contain shrink-0"
                style={{ imageRendering: "pixelated" }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 truncate">{s.name}</div>
                <div className="text-xs text-gray-500">{s.natureName}</div>
              </div>
              <button
                onClick={() => onLoad(s)}
                className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-900/30 transition-colors shrink-0"
              >
                Load
              </button>
              <button
                onClick={() => onDelete(s.id)}
                className="text-gray-600 hover:text-red-400 hover:bg-red-900/30 rounded px-1 py-1 transition-colors shrink-0 text-sm leading-none"
                title="Delete"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
