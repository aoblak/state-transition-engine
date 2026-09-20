# Agent Instructions

These repository instructions apply to repo-aware AI agents and human-assisted automation.

## Core execution loop

After every consequential step, run:

`STOP → VERIFY STATE → RETHINK → REROUTE → ACT → VERIFY RESULT → RECORD → STOP`

- Stop blind continuation after each meaningful step.
- Verify the actual repository/runtime state and relevant evidence.
- Rethink the next bounded action from the updated state.
- Re-select the minimum sufficient available model/tool/resource tier for that next step.
- Escalate when security impact, architectural impact, production impact, uncertainty, context size, repeated failure, or verification burden increases.
- De-escalate when the harder portion is complete.
- Re-routing does not require changing models if the current model remains the minimum sufficient tier.
- Resource optimization never overrides authorization, privacy, evidence, rollback, postcondition, or production gates.
- A stronger model does not turn missing evidence, failed verification, or `UNKNOWN` state into permission to proceed.

## General safeguards

Verify repository identity and target branch before writes. Preserve unrelated changes and Git history. Do not commit credentials or secrets. Do not claim implementation, tests, deployment, or success without direct evidence. Use `UNKNOWN` when a material fact cannot be verified.
