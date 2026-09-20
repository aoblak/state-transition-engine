export type StateId = string;

export interface State<TData = unknown> {
  id: StateId;
  data: TData;
}

export interface Tension<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

export interface TransitionContext<TData = unknown, TPayload = unknown> {
  state: State<TData>;
  tension: Tension<TPayload>;
}

export interface TransitionRule<TData = unknown, TPayload = unknown> {
  name: string;
  from: StateId | readonly StateId[] | "*";
  when(context: TransitionContext<TData, TPayload>): boolean;
  apply(context: TransitionContext<TData, TPayload>): State<TData>;
  reason?: string | ((context: TransitionContext<TData, TPayload>) => string);
}

export interface TransitionInvariantContext<TData = unknown, TPayload = unknown> {
  previous: State<TData>;
  candidate: State<TData>;
  tension: Tension<TPayload>;
  transition: string;
}

export interface TransitionInvariant<TData = unknown, TPayload = unknown> {
  name: string;
  check(context: TransitionInvariantContext<TData, TPayload>): boolean;
  reason?:
    | string
    | ((context: TransitionInvariantContext<TData, TPayload>) => string);
}

export interface EngineOptions<TData = unknown, TPayload = unknown> {
  invariants?: readonly TransitionInvariant<TData, TPayload>[];
}

export type TransitionStatus = "applied" | "no-match" | "rejected";

export interface InvariantResult {
  name: string;
  passed: boolean;
  reason: string | null;
}

export interface TransitionProvenance {
  status: TransitionStatus;
  rule: string | null;
  sourceState: StateId;
  candidateState: StateId | null;
  tensionType: string;
  invariantResults: readonly InvariantResult[];
}

export interface Outcome<TData = unknown> {
  previous: State<TData>;
  next: State<TData>;
  transition: string | null;
  changed: boolean;
  status: TransitionStatus;
  reason: string;
  provenance: TransitionProvenance;
}
