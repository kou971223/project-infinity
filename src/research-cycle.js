import { state } from "./state.js";
import crypto from "node:crypto";

export function runResearchCycle(trigger="scheduled") {
  const cycle = {
    id: "EXP-" + crypto.randomUUID(),
    trigger,
    startedAt: new Date().toISOString(),
    hypothesis: "A bounded research cycle can detect actionable system gaps without self-certifying improvement.",
    observations: [],
    decision: "DEFER"
  };
  if (state.capabilities.foundation_weight_training !== "active") {
    cycle.observations.push("Training compute/model-weight write path is not connected.");
  }
  if (state.capabilities.source_self_apply !== "active") {
    cycle.observations.push("Full-source auto-apply requires Git/CI promotion authority.");
  }
  cycle.observations.push("No candidate is promoted without an externalized validation gate.");
  state.cycles += 1;
  state.decisions.push(cycle);
  return cycle;
}

if (process.argv[1] && process.argv[1].endsWith("research-cycle.js")) {
  console.log(JSON.stringify(runResearchCycle("cron"), null, 2));
}
