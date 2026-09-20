import type {
  DecisionTraceEntry,
  EngineOptions,
  InvariantResult,
  Outcome,
  State,
  StateId,
  Tension,
  TransitionContext,
  TransitionInvariant,
  TransitionInvariantContext,
  TransitionRule,
} from "./types.js";

function matchesFrom(from: StateId | readonly StateId[] | "*", stateId: StateId): boolean {
  if (from === "*") {
    return true;
  }

  return Array.isArray(from) ? from.includes(stateId) : from === stateId;
}

function resolveRuleReason<TData, TPayload>(
  rule: TransitionRule<TData, TPayload>,
  context: TransitionContext<TData, TPayload>,
): string {
  if (typeof rule.reason === "function") {
    return rule.reason(context);
  }

  return rule.reason ?? `Applied transition "${rule.name}".`;
}

function evaluateInvariant<TData, TPayload>(
  invariant: TransitionInvariant<TData, TPayload>,
  context: TransitionInvariantContext<TData, TPayload>,
): InvariantResult {
  const passed = invariant.check(context);

  if (passed) {
    return {
      name: invariant.name,
      passed: true,
      reason: null,
    };
  }

  const reason =
    typeof invariant.reason === "function"
      ? invariant.reason(context)
      : invariant.reason ?? `Invariant "${invariant.name}" rejected the transition.`;

  return {
    name: invariant.name,
    passed: false,
    reason,
  };
}

export class StateTransitionEngine<TData = unknown, TPayload = unknown> {
  readonly #rules: readonly TransitionRule<TData, TPayload>[];
  readonly #invariants: readonly TransitionInvariant<TData, TPayload>[];

  constructor(
    rules: readonly TransitionRule<TData, TPayload>[],
    options: EngineOptions<TData, TPayload> = {},
  ) {
    this.#rules = [...rules];
    this.#invariants = [...(options.invariants ?? [])];
  }

  transition(state: State<TData>, tension: Tension<TPayload>): Outcome<TData> {
    const context: TransitionContext<TData, TPayload> = { state, tension };
    const decisionTrace: DecisionTraceEntry[] = [];

    let rule: TransitionRule<TData, TPayload> | undefined;

    for (const [ruleIndex, candidateRule] of this.#rules.entries()) {
      if (!matchesFrom(candidateRule.from, state.id)) {
        decisionTrace.push({
          rule: candidateRule.name,
          ruleIndex,
          status: "source-mismatch",
        });
        continue;
      }

      if (!candidateRule.when(context)) {
        decisionTrace.push({
          rule: candidateRule.name,
          ruleIndex,
          status: "condition-false",
        });
        continue;
      }

      decisionTrace.push({
        rule: candidateRule.name,
        ruleIndex,
        status: "selected",
      });
      rule = candidateRule;
      break;
    }

    if (!rule) {
      const reason = "No transition rule matched the current state and tension.";

      return {
        previous: state,
        next: state,
        transition: null,
        changed: false,
        status: "no-match",
        reason,
        provenance: {
          status: "no-match",
          rule: null,
          sourceState: state.id,
          candidateState: null,
          tensionType: tension.type,
          decisionTrace,
          invariantResults: [],
        },
      };
    }

    const candidate = rule.apply(context);

    if (!candidate.id) {
      throw new Error(`Transition "${rule.name}" produced a state with an empty id.`);
    }

    const invariantContext: TransitionInvariantContext<TData, TPayload> = {
      previous: state,
      candidate,
      tension,
      transition: rule.name,
    };

    const invariantResults = this.#invariants.map((invariant) =>
      evaluateInvariant(invariant, invariantContext),
    );
    const failedInvariants = invariantResults.filter((result) => !result.passed);

    if (failedInvariants.length > 0) {
      const reason = failedInvariants
        .map((result) => result.reason)
        .filter((item): item is string => item !== null)
        .join("; ");

      return {
        previous: state,
        next: state,
        transition: rule.name,
        changed: false,
        status: "rejected",
        reason,
        provenance: {
          status: "rejected",
          rule: rule.name,
          sourceState: state.id,
          candidateState: candidate.id,
          tensionType: tension.type,
          decisionTrace,
          invariantResults,
        },
      };
    }

    return {
      previous: state,
      next: candidate,
      transition: rule.name,
      changed: candidate !== state || candidate.id !== state.id,
      status: "applied",
      reason: resolveRuleReason(rule, context),
      provenance: {
        status: "applied",
        rule: rule.name,
        sourceState: state.id,
        candidateState: candidate.id,
        tensionType: tension.type,
        decisionTrace,
        invariantResults,
      },
    };
  }
}
