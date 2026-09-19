# state-transition-engine

A generic state transition framework for modeling states, tensions, transitions, and possible outcomes.

## Core model

- **State** — the current configuration of the system.
- **Tension** — a pressure, constraint, or unresolved difference acting on the state.
- **Transition** — a rule-governed change from one state to another.
- **Outcome** — a resulting state or set of possible resulting states.

The engine is intended to keep domain logic separate from transition mechanics so the same model can be reused across different problem domains.
