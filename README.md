# state-transition-engine

A generic state transition framework for modeling states, tensions, transitions, and possible outcomes.

## Core model

- **State** — the current configuration of the system.
- **Tension** — a pressure, constraint, or unresolved difference acting on the state.
- **Transition** — a rule-governed change from one state to another.
- **Outcome** — the result of applying a transition rule, including previous and next state.

The engine keeps domain logic separate from transition mechanics so the same model can be reused across different problem domains.

## Minimal example

```ts
import { StateTransitionEngine } from "state-transition-engine";

const engine = new StateTransitionEngine([
  {
    name: "activate",
    from: "idle",
    when: ({ tension }) => tension.type === "start",
    apply: ({ state }) => ({ ...state, id: "active" }),
  },
]);

const result = engine.transition(
  { id: "idle", data: {} },
  { type: "start", payload: null },
);

console.log(result.next.id); // active
```

## Development

```bash
npm install
npm test
```
