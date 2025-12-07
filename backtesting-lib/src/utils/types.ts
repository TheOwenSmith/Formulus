export function exhaustiveArray<T>() {
  return <const U extends readonly (keyof T)[]>(
    arr: U & ([keyof T] extends [U[number]] ? unknown : 'Missing keys'),
  ) => arr;
}
