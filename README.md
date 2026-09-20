# state-transition-engine

A generic state transition framework for modeling states, tensions, transitions, validation, and auditable outcomes.

## Core model

- **State** — the current configuration of the system.
- **Tension** — a pressure, constraint, or unresolved difference acting on the state.
- **Transition** — a rule-governed change from one state to another.
- **Invariant** — a condition that must remain true before a candidate state may be committed.
- **Outcome** — the complete result of an attempted transition, including status, reason, provenance, and decision trace.

The engine keeps domain logic separate from transition mechanics so the same model can be reused across different problem domains.

## Execution model

```
State + Tension
      |
      v
scan rules in declaration order
      |
      +--> source mismatch
      |
      +--> condition false
      |
      v
first matching rule
      |
      v
produce candidate state
      |
      v
evaluate invariants
   /         \
pass        fail
 |            |
 v            v
commit      reject
```

Rule evaluation stops immediately after the first selected rule. Later guards are not evaluated.

A rejected transition never commits its candidate state.

## Minimal example

```ts
import { StateTransitionEngine } from "state-transition-engine";

const engine = new StateTransitionEngine(
  [
    {
      name: "activate",
      from: "idle",
      when: ({ tension }) => tension.type === "start",
      apply: ({ state }) => ({ ...state, id: "active" }),
      reason: "A start signal activates the system.",
    },
  ],
  {
    invariants: [
      {
        name: "known-state",
        check: ({ candidate }) => ["idle", "active"].includes(candidate.id),
        reason: "Candidate state is outside the allowed state set.",
      },
    ],
  },
);

const result = engine.transition(
  { id: "idle", data: {} },
  { type: "start", payload: null },
);

console.log(result.status); // applied
console.log(result.next.id); // active
console.log(result.reason); // A start signal activates the system.
console.log(result.provenance.rule); // activate
console.log(result.provenance.decisionTrace);
// [{ rule: "activate", ruleIndex: 0, status: "selected" }]
```

## Outcome statuses

- `applied` — a rule matched, all invariants passed, and the candidate state was committed.
- `no-match` — no transition rule matched the current state and tension.
- `rejected` — a rule matched and produced a candidate state, but one or more invariants failed.

## Decision trace

Every attempted transition records the rules that were actually considered, in declaration order.

Each decision-trace entry contains:

- `rule` — rule name,
- `ruleIndex` — zero-based declaration position,
- `status` — one of:
  - `source-mismatch` — the rule's `from` constraint did not match the current state,
  - `condition-false` — the source matched but the rule guard returned false,
  - `condition-error` — the source matched but the rule guard threw,
  - `selected` — the rule was the first complete match.

Rules after a `selected` entry are intentionally absent because first-match execution stops at that point. This preserves deterministic short-circuit semantics and avoids evaluating later guards merely for observability.

## Execution failures

Programming/runtime failures are not converted into normal outcomes.

If a rule condition, rule application, or invariant throws, the engine throws `TransitionExecutionError`. The error preserves:

- failure phase: `condition`, `apply`, or `invariant`,
- rule name and declaration index,
- invariant name when applicable,
- source and candidate state identifiers when available,
- tension type,
- decision trace collected up to the failure,
- invariant results completed before the failure,
- the original exception as `cause`.

This keeps failures distinguishable from legitimate `no-match` and `rejected` outcomes without hiding programmer errors.

## Provenance

Each normal outcome includes deterministic provenance:

- selected rule,
- source state,
- candidate state,
- tension type,
- ordered decision trace,
- invariant results,
- human-readable reason.

This allows a caller to distinguish:

```
"What happened?"
from
"Why was this transition selected or rejected?"
```

without coupling the engine to a specific application domain.

## Design guarantees

- Deterministic first-match rule selection.
- Rule guards are evaluated only when their source constraint matches.
- Rule evaluation stops after the first selected rule.
- Domain-neutral transition mechanics.
- Candidate states are validated before commit.
- Rejected candidates do not mutate the current state.
- Decision-trace entries preserve declaration order.
- Invariant checks are recorded in declaration order.
- Execution failures preserve partial audit context and original causes.
- Existing engine construction remains supported.

## Development

```bash
npm install
npm test
```

Requires Node.js 20 or newer.
