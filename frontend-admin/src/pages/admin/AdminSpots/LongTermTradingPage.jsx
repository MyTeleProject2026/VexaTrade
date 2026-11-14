import AdminSpotTradePage from "../AdminSpotTradePage";

// Dedicated Spot / Long-Term admin trading-control surface.
// The existing control implementation remains the source of truth so legacy
// /admin/spot-trade stays fully compatible while the dedicated namespace is available.
export default function LongTermTradingPage() {
  return <AdminSpotTradePage />;
}
