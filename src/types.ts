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
}

export interface Outcome<TData = unknown> {
  previous: State<TData>;
  next: State<TData>;
  transition: string | null;
  changed: boolean;
}
