export type Ok<T> = { readonly _tag: 'ok'; readonly value: T }
export type Err<E> = { readonly _tag: 'err'; readonly error: E }
export type Result<T, E> = Ok<T> | Err<E>

export const ok = <T>(value: T): Ok<T> => ({ _tag: 'ok', value })
export const err = <E>(error: E): Err<E> => ({ _tag: 'err', error })

export const isOk = <T, E>(r: Result<T, E>): r is Ok<T> => r._tag === 'ok'
export const isErr = <T, E>(r: Result<T, E>): r is Err<E> => r._tag === 'err'

export const map = <T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> =>
  isOk(r) ? ok(f(r.value)) : r

export const mapErr = <T, E, F>(r: Result<T, E>, f: (e: E) => F): Result<T, F> =>
  isErr(r) ? err(f(r.error)) : r

export const flatMap = <T, U, E>(r: Result<T, E>, f: (t: T) => Result<U, E>): Result<U, E> =>
  isOk(r) ? f(r.value) : r

export const unwrap = <T, E>(r: Result<T, E>): T => {
  if (isOk(r)) return r.value
  throw new Error(`unwrap on Err: ${JSON.stringify(r.error)}`)
}
