import type {
  DecisionTraceEntry,
  EngineOptions,
  InvariantResult,
  Outcome,
  State,
  StateId,
  Tension,
  TransitionContext,
  TransitionExecutionFailureDetails,
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

export class TransitionExecutionError extends Error {
  readonly details: TransitionExecutionFailureDetails;

  constructor(
    message: string,
    details: TransitionExecutionFailureDetails,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "TransitionExecutionError";
    this.details = details;
  }
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
    let selectedRuleIndex = -1;

    for (const [ruleIndex, candidateRule] of this.#rules.entries()) {
      if (!matchesFrom(candidateRule.from, state.id)) {
        decisionTrace.push({
          rule: candidateRule.name,
          ruleIndex,
          status: "source-mismatch",
        });
        continue;
      }

      let conditionMatched: boolean;

      try {
        conditionMatched = candidateRule.when(context);
      } catch (error) {
        decisionTrace.push({
          rule: candidateRule.name,
          ruleIndex,
          status: "condition-error",
        });

        throw new TransitionExecutionError(
          `Transition rule "${candidateRule.name}" failed while evaluating its condition.`,
          {
            phase: "condition",
            rule: candidateRule.name,
            ruleIndex,
            invariant: null,
            sourceState: state.id,
            candidateState: null,
            tensionType: tension.type,
            decisionTrace: [...decisionTrace],
            invariantResults: [],
          },
          error,
        );
      }

      if (!conditionMatched) {
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
      selectedRuleIndex = ruleIndex;
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

    let candidate: State<TData>;

    try {
      candidate = rule.apply(context);
    } catch (error) {
      throw new TransitionExecutionError(
        `Transition "${rule.name}" failed while applying its state change.`,
        {
          phase: "apply",
          rule: rule.name,
          ruleIndex: selectedRuleIndex,
          invariant: null,
          sourceState: state.id,
          candidateState: null,
          tensionType: tension.type,
          decisionTrace: [...decisionTrace],
          invariantResults: [],
        },
        error,
      );
    }

    if (!candidate.id) {
      throw new TransitionExecutionError(
        `Transition "${rule.name}" produced a state with an empty id.`,
        {
          phase: "apply",
          rule: rule.name,
          ruleIndex: selectedRuleIndex,
          invariant: null,
          sourceState: state.id,
          candidateState: candidate.id,
          tensionType: tension.type,
          decisionTrace: [...decisionTrace],
          invariantResults: [],
        },
      );
    }

    const invariantContext: TransitionInvariantContext<TData, TPayload> = {
      previous: state,
      candidate,
      tension,
      transition: rule.name,
    };

    const invariantResults: InvariantResult[] = [];

    for (const invariant of this.#invariants) {
      try {
        invariantResults.push(evaluateInvariant(invariant, invariantContext));
      } catch (error) {
        throw new TransitionExecutionError(
          `Invariant "${invariant.name}" failed while validating transition "${rule.name}".`,
          {
            phase: "invariant",
            rule: rule.name,
            ruleIndex: selectedRuleIndex,
            invariant: invariant.name,
            sourceState: state.id,
            candidateState: candidate.id,
            tensionType: tension.type,
            decisionTrace: [...decisionTrace],
            invariantResults: [...invariantResults],
          },
          error,
        );
      }
    }

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
