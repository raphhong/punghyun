import { readActualFunding, registerInitialFunding } from "@/app/ph-console-8f27x/(app)/customers/actual-funding-actions";
import { ActualFundingEditor } from "./ActualFundingEditor";
import { CollapsibleCard } from "./CollapsibleCard";

export async function ActualFundingPanel({ id }: { id: string }) {
  const state = await readActualFunding(id);
  return <CollapsibleCard title="실제 집행원장" desc="현금흐름에 반영되는 실제 집행 기록" open>
    <ActualFundingEditor id={id} state={state} action={registerInitialFunding} />
  </CollapsibleCard>;
}
