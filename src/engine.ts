import type {
  Outcome,
  State,
  StateId,
  Tension,
  TransitionContext,
  TransitionRule,
} from "./types.js";

function matchesFrom(from: StateId | readonly StateId[] | "*", stateId: StateId): boolean {
  if (from === "*") {
    return true;
  }

  return Array.isArray(from) ? from.includes(stateId) : from === stateId;
}

export class StateTransitionEngine<TData = unknown, TPayload = unknown> {
  readonly #rules: readonly TransitionRule<TData, TPayload>[];

  constructor(rules: readonly TransitionRule<TData, TPayload>[]) {
    this.#rules = [...rules];
  }

  transition(state: State<TData>, tension: Tension<TPayload>): Outcome<TData> {
    const context: TransitionContext<TData, TPayload> = { state, tension };

    const rule = this.#rules.find(
      (candidate) => matchesFrom(candidate.from, state.id) && candidate.when(context),
    );

    if (!rule) {
      return {
        previous: state,
        next: state,
        transition: null,
        changed: false,
      };
    }

    const next = rule.apply(context);

    if (!next.id) {
      throw new Error(`Transition "${rule.name}" produced a state with an empty id.`);
    }

    return {
      previous: state,
      next,
      transition: rule.name,
      changed: next !== state || next.id !== state.id,
    };
  }
}
