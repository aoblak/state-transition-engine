import assert from "node:assert/strict";
import test from "node:test";

import { StateTransitionEngine } from "../src/index.js";
import type { State, TransitionRule } from "../src/index.js";

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

test("applies the first matching transition", () => {
  const engine = new StateTransitionEngine(rules);
  const initial: State<DoorData> = { id: "closed", data: { locked: true } };

  const outcome = engine.transition(initial, { type: "unlock", payload: "unlock" });

  assert.equal(outcome.transition, "unlock-door");
  assert.equal(outcome.next.id, "closed");
  assert.equal(outcome.next.data.locked, false);
  assert.equal(outcome.changed, true);
});

test("returns an unchanged outcome when no rule matches", () => {
  const engine = new StateTransitionEngine(rules);
  const initial: State<DoorData> = { id: "closed", data: { locked: true } };

  const outcome = engine.transition(initial, { type: "open", payload: "open" });

  assert.equal(outcome.transition, null);
  assert.equal(outcome.next, initial);
  assert.equal(outcome.changed, false);
});
