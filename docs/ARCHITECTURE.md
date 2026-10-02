# Core 0.2 architecture

The initial four-plane specification remains a research objective, not an acceptance claim.

Implemented path: trusted contract + development examples -> program synthesis -> frozen program hash -> capability-free bounded interpreter in a Worker -> independent handwritten reference implementation -> fresh synthetic confirmatory fixtures -> fresh synthetic replication fixtures -> bounded registry adoption -> runtime contract guard -> rollback.

`src/program.js` is the replaceable bootstrap language runtime, not an assertion that the language is a final intelligence substrate. No candidate can modify it, the evaluator, the acceptance threshold, or a workflow in its own evaluation cycle.

The current writable capability is one response-text extraction program. New module contracts, evaluator changes, arbitrary source changes, and training processes require separate CHG/EXP records. Full-app auto-redeployment by a generated program is not implemented. GitHub-to-Render redeployment is an existing hosting integration; it does not certify intelligence improvement.

Isolation profile: candidate receives checked JSON program + input value only; expected answer remains in evaluator host. Separate Worker resource caps provide another bound. The interpreter has no host-code evaluation, dynamic module loading, filesystem or network instructions. The trusted application still needs conventional service hardening and persistence before production use.

Evidence state changes propagate conservatively over recorded dependency edges. Adoption history remains append-only within the application. File tampering checks detect changes relative to the current hash chain; complete administrator rewriting requires an external anchor to detect.
