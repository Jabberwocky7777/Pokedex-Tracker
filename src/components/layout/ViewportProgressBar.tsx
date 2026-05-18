interface Props {
  percentage: number; // 0–100
}

export default function ViewportProgressBar({ percentage }: Props) {
  return (
    <div className="hidden md:block fixed top-0 left-0 right-0 h-[3px] z-50 bg-gray-800">
      <div
        className="h-full bg-emerald-500 transition-[width] duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      />
    </div>
  );
}
