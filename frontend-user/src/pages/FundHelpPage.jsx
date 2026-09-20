import { Link } from "react-router-dom";
import { ArrowLeft, HelpCircle, ShieldCheck } from "lucide-react";

export default function FundHelpPage() {
  const steps = [
    ["1. Apply", "Choose an eligible plan and submit an amount within its configured limits."],
    ["2. Secure processing", "The Vexa Blockchain Ecosystem framework validates the plan, balance, authorization and transaction identity before locking the principal."],
    ["3. Active", "Your active Fund is synchronized through the Vexa Blockchain Ecosystem financial framework. The live screen is a continuously updated display projection; settlement records remain authoritative within the ecosystem framework."],
    ["4. Daily settlement", "Configured Blockchain Ecosystem settlement records actual profit and any compounded amount in the financial ledger."],
    ["5. Completion", "At maturity, the Vexa Blockchain Ecosystem settlement framework returns the applicable principal and records the completed Fund and transaction history."],
  ];

  return (
    <div className="min-h-screen bg-[#050812] p-3 pb-24 sm:p-5">
      <div className="mx-auto max-w-3xl">
        <Link to="/funds" className="mb-3 inline-flex items-center gap-1 text-xs text-slate-400">
          <ArrowLeft size={13} /> Funds Center
        </Link>
        <div className="rounded-2xl border border-white/10 bg-[#0a0e1a] p-4">
          <div className="flex items-center gap-2">
            <HelpCircle className="text-cyan-300" size={18} />
            <div>
              <h1 className="text-lg font-bold text-white">Funds Help</h1>
              <p className="text-[10px] text-slate-500">How the VexaTrade funding lifecycle works.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3 text-[11px] text-slate-300">
            {steps.map(([title, description]) => (
              <div key={title}>
                <b className="text-white">{title}</b>
                <p className="mt-1 text-slate-400">{description}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-[10px] text-emerald-300">
            <ShieldCheck size={12} className="mr-1 inline" />
            Live display does not independently credit funds or change balances.
          </div>
        </div>
      </div>
    </div>
  );
}