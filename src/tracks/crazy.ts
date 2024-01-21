import { Patch } from "immer";
import { Either } from "../utils/either";

export class StateMonad<S, A> {
  constructor(public runState: (s: S) => { s: S; a: A }) {}

  static return_<S, A>(a: A): StateMonad<S, A> {
    return new StateMonad((s) => ({ s, a }));
  }

  bind<B>(func: (a: A) => StateMonad<S, B>): StateMonad<S, B> {
    return new StateMonad<S, B>((s: S) => {
      const { s: s_, a } = this.runState(s);
      return func(a).runState(s_);
    });
  }
}

class StateErrorMonad<S, A, E> {
  constructor(public runState: (s: S) => { s: S; a: Either<E, A> }) {}

  static return_<S, A, E>(a: Either<E, A>): StateErrorMonad<S, A, E> {
    return new StateErrorMonad((s) => ({ s, a }));
  }

  bind<B>(func: (a: A) => StateErrorMonad<S, B, E>): StateErrorMonad<S, B, E> {
    return new StateErrorMonad<S, B, E>((s: S) => {
      const { s: s_, a } = this.runState(s);
      if (a.isLeft()) {
        return { s, a };
      }
      return func(a.value).runState(s_);
    });
  }
}

export type WithPatches<T> = {
  val: T;
  patches: Patch[];
  inversePatches: Patch[];
};

export type Lens<A, B, Err> = {
  project(a: A): Either<Err, B>;
  merge(a: A, b: B): Either<Err, A>;
};

// function compose<A, B, T, Err>(fst: Lens<A, B, Err>, snd: Lens<B, T, Err>): Lens<A, T, Err> {
//   return {
//     project(a) {
//       return flatMap(fst.project(a), (b) => snd.project(b));
//     },
//     merge(a, b) {

//     },
//   }
// }

//(progress) => `[[progress-track-${progress}.svg]]`

export function projecting<S1, S2, A, Err>(
  lens: Lens<S1, S2, Err>,
): (monad: StateErrorMonad<S2, A, Err>) => StateErrorMonad<S1, A, Err> {
  return (monad) => {
    return new StateErrorMonad<S1, A, Err>((state) => {
      const projectedState = lens.project(state);
      if (projectedState.isLeft()) {
        return { s: state, a: projectedState };
      }
      const { s: s_, a } = monad.runState(projectedState.value);
      const merged = lens.merge(state, s_);
      if (merged.isLeft()) {
        return { s: state, a: merged };
      }
      return { s: merged.value, a };
    });
  };
}
