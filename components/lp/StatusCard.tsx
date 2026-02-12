'use client';

interface StatusCardProps {
  icon: React.ReactNode;
  count: string;
  suffix: string;
  label: string;
  dotColor?: string;
}

export const StatusCard: React.FC<StatusCardProps> = ({ icon, count, suffix, label, dotColor }) => {
  return (
    <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-4 flex items-center gap-4 group hover:bg-white/10 transition-colors shadow-xl">
      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 group-hover:border-white/20 transition-colors">
        {icon}
      </div>
      <div className="flex flex-col">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-black text-white group-hover:text-yellow-400 transition-colors">{count}</span>
          <span className="text-sm font-bold text-rose-400">{suffix}</span>
          <span className="text-sm font-medium text-gray-400 ml-1">{label}</span>
        </div>
      </div>

      {dotColor && (
        <div className={`absolute top-[-4px] right-[-4px] w-2.5 h-2.5 ${dotColor} rounded-full shadow-[0_0_10px_rgba(52,211,153,0.5)] animate-pulse`} />
      )}
    </div>
  );
};
