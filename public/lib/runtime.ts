import { Effect, Result } from 'effect';

/** Execute an Effect at a Promise API boundary while preserving its original failure. */
export const runEffect = <A, E>(program: Effect.Effect<A, E>): Promise<A> =>
  Effect.runPromise(Effect.result(program)).then(Result.match({
    onFailure: (error: unknown): never => { throw error; },
    onSuccess: (value: A): A => value,
  }));
