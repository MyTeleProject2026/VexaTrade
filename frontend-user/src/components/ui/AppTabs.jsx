export default function AppTabs({ tabs = [], activeTab, onChange }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#0a0e1a]/80 p-2 shadow-xl sm:p-3">
      <div className="grid gap-2 sm:gap-3" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`rounded-2xl px-3 py-3 text-sm font-semibold transition sm:px-4 ${
              activeTab === tab.key
                ? "bg-cyan-500 text-slate-950"
                : "border border-white/10 bg-slate-800 text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}