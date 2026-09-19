import SpotTradingReviewPage from "../../SpotTradingReviewPage";
import TradeSectionLayout from "../TradeSectionLayout";

export default function SpotReviewPage() {
  return (
    <TradeSectionLayout title="Spot Order Review" subtitle="Fresh quote and server-side execution checks" mode="spot">
      <SpotTradingReviewPage />
    </TradeSectionLayout>
  );
}
