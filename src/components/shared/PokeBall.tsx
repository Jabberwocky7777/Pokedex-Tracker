/** The CSS-only Poké Ball logo (no emoji, no image), in the sizes the app uses. */
const SIZES = {
  sm: { ball: "w-6 h-6 border-2", line: "h-[2px] -mt-[1px]", button: "w-2 h-2 border" },
  md: { ball: "w-10 h-10 border-2", line: "h-px", button: "w-3.5 h-3.5 border" },
  lg: { ball: "w-14 h-14 border-4 shadow-lg", line: "h-0.5", button: "w-4 h-4 border-2" },
} as const;

export default function PokeBall({ size = "sm", pulse = false }: { size?: keyof typeof SIZES; pulse?: boolean }) {
  const s = SIZES[size];
  return (
    <div
      aria-hidden="true"
      className={`${s.ball} rounded-full bg-red-500 relative overflow-hidden border-gray-300 flex-shrink-0 ${pulse ? "animate-pulse" : ""}`}
    >
      <div className={`absolute inset-x-0 top-1/2 ${s.line} bg-gray-300`} />
      <div
        className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${s.button} rounded-full bg-white border-gray-300`}
      />
    </div>
  );
}
