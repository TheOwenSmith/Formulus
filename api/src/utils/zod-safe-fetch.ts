import type { ZodType } from 'zod';

export async function zodSafeFetch<T>({
  url,
  method = 'GET',
  body,
  schema,
}: {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: string;
  schema: ZodType<T>;
}): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    ...(body ? { body } : {}),
  });

  const json = await response.json();
  return schema.parse(json);
}
