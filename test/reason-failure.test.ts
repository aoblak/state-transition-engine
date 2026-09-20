import assert from "node:assert/strict";
import test from "node:test";

import {
  StateTransitionEngine,
  TransitionExecutionError,
} from "../src/index.js";
import type { State, TransitionRule } from "../src/index.js";

interface Data {
  value: number;
}

type Signal = "go";

test("preserves audit context when a rule reason callback throws", () => {
  const reasonError = new Error("reason exploded");

  const rules: readonly TransitionRule<Data, Signal>[] = [
    {
      name: "advance",
      from: "idle",
      when: () => true,
      apply: ({ state }) => ({
        id: "active",
        data: { value: state.data.value + 1 },
      }),
      reason: () => {
        throw reasonError;
      },
    },
  ];

  const engine = new StateTransitionEngine(rules);
  const initial: State<Data> = { id: "idle", data: { value: 1 } };

  try {
    engine.transition(initial, { type: "go", payload: "go" });
    assert.fail("expected transition to throw");
  } catch (error) {
    assert.ok(error instanceof TransitionExecutionError);
    assert.equal(error.details.phase, "reason");
    assert.equal(error.details.rule, "advance");
    assert.equal(error.details.ruleIndex, 0);
    assert.equal(error.details.sourceState, "idle");
    assert.equal(error.details.candidateState, "active");
    assert.equal(error.details.tensionType, "go");
    assert.equal(error.cause, reasonError);
    assert.deepEqual(error.details.decisionTrace, [
      {
        rule: "advance",
        ruleIndex: 0,
        status: "selected",
      },
    ]);
    assert.deepEqual(error.details.invariantResults, []);
  }
});
