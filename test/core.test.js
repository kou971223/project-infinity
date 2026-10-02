import test from "node:test";
import assert from "node:assert/strict";
import { runResearchCycle } from "../src/research-cycle.js";
import { state } from "../src/state.js";

test("research cycle does not self-promote",()=>{
  const before=state.candidates.length;
  const r=runResearchCycle("test");
  assert.equal(r.decision,"DEFER");
  assert.equal(state.candidates.length,before);
});

test("capability boundaries are explicit",()=>{
  assert.equal(state.capabilities.foundation_weight_training,"training_compute_not_connected");
  assert.equal(state.capabilities.source_self_apply,"git_ci_required");
});
