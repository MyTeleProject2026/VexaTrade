import TradePage from "../../TradePage";
import TradeSectionLayout from "../TradeSectionLayout";

export default function ShortTermTradePage() {
  return (
    <TradeSectionLayout title="Short-Term Trade" subtitle="Live timed BUY / SELL terminal" mode="short">
      <TradePage embedded />
    </TradeSectionLayout>
  );
}
