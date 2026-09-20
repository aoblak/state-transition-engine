import assert from "node:assert/strict";
import test from "node:test";

import { StateTransitionEngine } from "../src/index.js";
import type {
  State,
  TransitionInvariant,
  TransitionRule,
} from "../src/index.js";

interface DoorData {
  locked: boolean;
}

type DoorSignal = "unlock" | "open";

const rules: readonly TransitionRule<DoorData, DoorSignal>[] = [
  {
    name: "unlock-door",
    from: "closed",
    when: ({ state, tension }) => state.data.locked && tension.type === "unlock",
    apply: ({ state }) => ({
      ...state,
      data: { ...state.data, locked: false },
    }),
    reason: "Unlock signal accepted for a locked door.",
  },
  {
    name: "open-door",
    from: "closed",
    when: ({ state, tension }) => !state.data.locked && tension.type === "open",
    apply: ({ state }) => ({
      id: "open",
      data: state.data,
    }),
  },
];

test("applies the first matching transition with provenance", () => {
  const engine = new StateTransitionEngine(rules);
  const initial: State<DoorData> = { id: "closed", data: { locked: true } };

  const outcome = engine.transition(initial, { type: "unlock", payload: "unlock" });

  assert.equal(outcome.transition, "unlock-door");
  assert.equal(outcome.next.id, "closed");
  assert.equal(outcome.next.data.locked, false);
  assert.equal(outcome.changed, true);
  assert.equal(outcome.status, "applied");
  assert.equal(outcome.reason, "Unlock signal accepted for a locked door.");
  assert.deepEqual(outcome.provenance, {
    status: "applied",
    rule: "unlock-door",
    sourceState: "closed",
    candidateState: "closed",
    tensionType: "unlock",
    decisionTrace: [
      {
        rule: "unlock-door",
        ruleIndex: 0,
        status: "selected",
      },
    ],
    invariantResults: [],
  });
});

test("returns an explainable unchanged outcome when no rule matches", () => {
  const engine = new StateTransitionEngine(rules);
  const initial: State<DoorData> = { id: "closed", data: { locked: true } };

  const outcome = engine.transition(initial, { type: "open", payload: "open" });

  assert.equal(outcome.transition, null);
  assert.equal(outcome.next, initial);
  assert.equal(outcome.changed, false);
  assert.equal(outcome.status, "no-match");
  assert.equal(outcome.reason, "No transition rule matched the current state and tension.");
  assert.equal(outcome.provenance.rule, null);
  assert.equal(outcome.provenance.candidateState, null);
  assert.deepEqual(outcome.provenance.decisionTrace, [
    {
      rule: "unlock-door",
      ruleIndex: 0,
      status: "condition-false",
    },
    {
      rule: "open-door",
      ruleIndex: 1,
      status: "condition-false",
    },
  ]);
});

test("rejects a candidate state when an invariant fails", () => {
  const invariants: readonly TransitionInvariant<DoorData, DoorSignal>[] = [
    {
      name: "maintenance-lockout",
      check: ({ candidate }) => candidate.id !== "open",
      reason: ({ candidate }) =>
        `State "${candidate.id}" is blocked while maintenance lockout is active.`,
    },
  ];

  const engine = new StateTransitionEngine(rules, { invariants });
  const initial: State<DoorData> = { id: "closed", data: { locked: false } };

  const outcome = engine.transition(initial, { type: "open", payload: "open" });

  assert.equal(outcome.status, "rejected");
  assert.equal(outcome.transition, "open-door");
  assert.equal(outcome.next, initial);
  assert.equal(outcome.changed, false);
  assert.equal(
    outcome.reason,
    'State "open" is blocked while maintenance lockout is active.',
  );
  assert.equal(outcome.provenance.sourceState, "closed");
  assert.equal(outcome.provenance.candidateState, "open");
  assert.deepEqual(outcome.provenance.decisionTrace, [
    {
      rule: "unlock-door",
      ruleIndex: 0,
      status: "condition-false",
    },
    {
      rule: "open-door",
      ruleIndex: 1,
      status: "selected",
    },
  ]);
  assert.deepEqual(outcome.provenance.invariantResults, [
    {
      name: "maintenance-lockout",
      passed: false,
      reason: 'State "open" is blocked while maintenance lockout is active.',
    },
  ]);
});

test("records all invariant checks in deterministic order", () => {
  const invariants: readonly TransitionInvariant<DoorData, DoorSignal>[] = [
    {
      name: "must-be-unlocked",
      check: ({ candidate }) => !candidate.data.locked,
    },
    {
      name: "state-id-policy",
      check: ({ candidate }) => candidate.id !== "open",
      reason: "Opening is disabled by policy.",
    },
  ];

  const engine = new StateTransitionEngine(rules, { invariants });
  const initial: State<DoorData> = { id: "closed", data: { locked: false } };

  const outcome = engine.transition(initial, { type: "open", payload: "open" });

  assert.equal(outcome.status, "rejected");
  assert.deepEqual(outcome.provenance.invariantResults, [
    {
      name: "must-be-unlocked",
      passed: true,
      reason: null,
    },
    {
      name: "state-id-policy",
      passed: false,
      reason: "Opening is disabled by policy.",
    },
  ]);
});

test("records source mismatches and stops tracing after first match", () => {
  let evaluatedAfterSelection = false;

  const traceRules: readonly TransitionRule<DoorData, DoorSignal>[] = [
    {
      name: "wrong-source",
      from: "open",
      when: () => {
        throw new Error("source-mismatched guard must not be evaluated");
      },
      apply: ({ state }) => state,
    },
    {
      name: "guard-rejected",
      from: "*",
      when: () => false,
      apply: ({ state }) => state,
    },
    {
      name: "selected-rule",
      from: "closed",
      when: () => true,
      apply: ({ state }) => ({
        ...state,
        data: { ...state.data, locked: false },
      }),
    },
    {
      name: "after-selection",
      from: "*",
      when: () => {
        evaluatedAfterSelection = true;
        return true;
      },
      apply: ({ state }) => state,
    },
  ];

  const engine = new StateTransitionEngine(traceRules);
  const initial: State<DoorData> = { id: "closed", data: { locked: true } };

  const outcome = engine.transition(initial, { type: "unlock", payload: "unlock" });

  assert.equal(outcome.transition, "selected-rule");
  assert.equal(evaluatedAfterSelection, false);
  assert.deepEqual(outcome.provenance.decisionTrace, [
    {
      rule: "wrong-source",
      ruleIndex: 0,
      status: "source-mismatch",
    },
    {
      rule: "guard-rejected",
      ruleIndex: 1,
      status: "condition-false",
    },
    {
      rule: "selected-rule",
      ruleIndex: 2,
      status: "selected",
    },
  ]);
});

test("throws when a transition produces an empty state id", () => {
  const invalidRules: readonly TransitionRule<DoorData, DoorSignal>[] = [
    {
      name: "invalid-transition",
      from: "*",
      when: () => true,
      apply: ({ state }) => ({ ...state, id: "" }),
    },
  ];

  const engine = new StateTransitionEngine(invalidRules);
  const initial: State<DoorData> = { id: "closed", data: { locked: true } };

  assert.throws(
    () => engine.transition(initial, { type: "unlock", payload: "unlock" }),
    /produced a state with an empty id/,
  );
});
