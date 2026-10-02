# Project ∞

Evidence-driven, open-ended AI research infrastructure.

## Current architecture
- Chat/API surface
- Continuous research cycle
- Candidate changes are never promoted by self-assertion
- Validation gate + rollback-ready lineage
- Runtime capability registry
- Source changes go through Git/CI rather than direct production mutation
- Model-training lane is an interface until training compute/model weights are connected

## Important boundary
Open-ended means the research/search space is not artificially frozen. It does **not** mean infinite compute, guaranteed improvement, zero errors, unrestricted operation, or perpetual availability.

## Run
```bash
npm install
npm start
npm test
npm run research
```

## Environment
- `PORT` supplied by hosting
- `OPENAI_API_KEY` optional; when absent the service remains operational in degraded research mode
- `DATABASE_URL` optional future persistent evidence store

## Promotion invariant
Candidate -> frozen -> sandbox/test -> validation -> promotion/branch/reject -> monitor -> rollback.
A candidate cannot promote itself.
