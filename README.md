# state-transition-engine

A generic state transition framework for modeling states, tensions, transitions, validation, and explainable outcomes.

## Core model

- **State** — the current configuration of the system.
- **Tension** — a pressure, constraint, or unresolved difference acting on the state.
- **Transition** — a rule-governed change from one state to another.
- **Invariant** — a condition that must remain true before a candidate state may be committed.
- **Outcome** — the complete result of an attempted transition, including status, reason, and provenance.

The engine keeps domain logic separate from transition mechanics so the same model can be reused across different problem domains.

## Execution model

```
State + Tension
      |
      v
match first rule
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
```

## Outcome statuses

- `applied` — a rule matched, all invariants passed, and the candidate state was committed.
- `no-match` — no transition rule matched the current state and tension.
- `rejected` — a rule matched and produced a candidate state, but one or more invariants failed.

Each outcome includes deterministic provenance:

- selected rule,
- source state,
- candidate state,
- tension type,
- invariant results,
- human-readable reason.

## Design guarantees

- Deterministic first-match rule selection.
- Domain-neutral transition mechanics.
- Candidate states are validated before commit.
- Rejected candidates do not mutate the current state.
- Invariant checks are recorded in declaration order.
- Existing one-argument engine construction remains supported.

## Development

```bash
npm install
npm test
```

Requires Node.js 20 or newer.
