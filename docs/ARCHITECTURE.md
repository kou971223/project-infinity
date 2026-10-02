# Architecture

## Planes
1. Intelligence Plane
2. Research Plane
3. Meta-Research Plane
4. Independent Validation Plane

## Source evolution
Production is not edited in-place. Full-source changes must be proposed on a candidate branch, pass CI and validation, then be promoted through Git/deployment controls. Rollback keeps the previous known-good revision.

## Model-learning lane
The interface is reserved for training candidates (adapter/small-model first). No training claim is valid until compute, dataset provenance, frozen evaluation and independent validation are connected.

## Autonomous research
A scheduler invokes `npm run research`. The research process is budgeted and may return DEFER/UNKNOWN. It is not required to mutate the system every cycle.
