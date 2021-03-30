export function flatten<T>(arr: T[]) {
  return arr.reduce<T[]>((acc, val) => acc.concat(val), []);
}

type FlatMapCallbackFn<T, R> = (value: T) => R;

export function flatMap<T, R>(arr: T[], cb: FlatMapCallbackFn<T, R>) {
  return flatten(arr.map(cb));
}
