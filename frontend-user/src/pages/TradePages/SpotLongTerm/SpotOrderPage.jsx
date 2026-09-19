import SpotTradingPage from "../../SpotTradingPage";
import TradeSectionLayout from "../TradeSectionLayout";

export default function SpotOrderPage() {
  return (
    <TradeSectionLayout title="Spot Order" subtitle="Live market buy / sell execution" mode="spot">
      <SpotTradingPage />
    </TradeSectionLayout>
  );
}
