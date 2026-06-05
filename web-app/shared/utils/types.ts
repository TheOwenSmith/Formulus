export function completeUnionArray<T>() {
  return <U extends T[]>(
    arr: U & ([T] extends [U[number]] ? unknown : 'Missing elements from union'),
  ) => arr;
}
