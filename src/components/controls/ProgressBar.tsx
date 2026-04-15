interface Props {
  caught: number;
  total: number;
  percentage: number;
}

export default function ProgressBar({ caught, total, percentage }: Props) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="text-sm text-gray-400 whitespace-nowrap">
        <span className="text-green-400 font-bold">{caught}</span>
        <span className="text-gray-500"> / </span>
        <span className="font-medium text-gray-300">{total}</span>
        <span className="text-gray-500 ml-1">({percentage}%)</span>
      </div>
      <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
