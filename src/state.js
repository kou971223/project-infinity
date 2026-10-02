export const state = {
  version: "0.1.0",
  startedAt: new Date().toISOString(),
  cycles: 0,
  candidates: [],
  decisions: [],
  capabilities: {
    chat_api: "active",
    autonomous_research_cycle: "active_when_scheduler_runs",
    source_self_apply: "git_ci_required",
    foundation_weight_training: "training_compute_not_connected",
    independent_validation: "bounded_scaffold"
  }
};

export function snapshot() {
  return JSON.parse(JSON.stringify(state));
}
