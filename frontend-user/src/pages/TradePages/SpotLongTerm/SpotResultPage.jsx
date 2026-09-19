import SpotTradingResultPage from "../../SpotTradingResultPage";
import TradeSectionLayout from "../TradeSectionLayout";

export default function SpotResultPage() {
  return (
    <TradeSectionLayout title="Spot Execution Result" subtitle="Filled order, asset ledger and live P/L" mode="spot">
      <SpotTradingResultPage />
    </TradeSectionLayout>
  );
}