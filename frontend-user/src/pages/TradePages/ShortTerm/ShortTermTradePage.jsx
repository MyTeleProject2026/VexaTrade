import TradePage from "../../TradePage";
import TradeSectionLayout from "../TradeSectionLayout";

export default function ShortTermTradePage() {
  return (
    <TradeSectionLayout
      title="Short-Term Trade"
      subtitle="Live quote, timed order and server settlement"
      mode="short"
    >
      <TradePage embedded />
    </TradeSectionLayout>
  );
}
