import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || "Unexpected administration interface error." };
  }

  componentDidCatch(error, info) {
    // Keep diagnostics local to the browser; do not expose tokens or credentials.
    console.error("VexaTrade Super Admin runtime error", error, info);
  }

  reset = () => this.setState({ hasError: false, message: "" });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="mx-auto flex min-h-[55vh] max-w-2xl items-center justify-center p-5">
        <section className="w-full rounded-[28px] border border-red-500/20 bg-[#0a0e1a] p-6 text-center shadow-2xl">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-red-400/20 bg-red-500/10">
            <AlertTriangle size={22} className="text-red-300" />
          </div>
          <h1 className="mt-4 text-lg font-bold text-white">Admin workspace recovered</h1>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-5 text-slate-400">
            This control page encountered a runtime error. Your authenticated session is left untouched. Retry the workspace or return to the Control Center.
          </p>
          <div className="mt-3 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-left text-[10px] text-slate-500">
            {this.state.message}
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={this.reset} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/15">
              <RefreshCw size={14} /> Retry
            </button>
            <button type="button" onClick={() => { window.location.assign("/admin/control-center"); }} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/[0.08]">
              Control Center
            </button>
          </div>
        </section>
      </div>
    );
  }
}
