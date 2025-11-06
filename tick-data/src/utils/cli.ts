import inquirer from 'inquirer';
import { tryAsync } from './errorHandling';

export function formatTable(rows: [string, string][]): string {
  let output = '';
  const firstColumnWidth = rows.reduce((acc, [key, _]) => Math.max(acc, key.length + 1), 0);
  for (const [key, value] of rows) {
    output += (key + ':').padEnd(firstColumnWidth, ' ') + ' ' + value + '\n';
  }
  return output;
}

function softClear() {
  const rows = process.stdout.rows || 24;
  process.stdout.write('\n'.repeat(rows));
  process.stdout.write('\x1b[H');
}

export type SelectionOption<T> = { name: string; value: T };

export class UserExitEarlyError extends Error {
  constructor(message?: string) {
    super(message ?? 'User exited early');
  }
}

export async function getUserSelectionInput<T>(input: {
  header?: string;
  options: SelectionOption<T>[];
  message: string;
  quitMessage?: string;
}): Promise<T | null>;

export async function getUserSelectionInput<T>(input: {
  header?: string;
  options: SelectionOption<T>[];
  message: string;
  quitMessage?: string;
  allMessage: string;
}): Promise<T | 'all' | null>;

export async function getUserSelectionInput<T>({
  header,
  options,
  message,
  quitMessage = 'Quit',
  allMessage,
}: {
  header?: string;
  options: SelectionOption<T>[];
  message: string;
  quitMessage?: string;
  allMessage?: string;
}): Promise<T | 'all' | null> {
  softClear();
  if (header != undefined) console.log(header);

  const promptResponse = await tryAsync(() =>
    inquirer.prompt([
      {
        type: 'list',
        name: 'chosen',
        message,
        choices: [
          ...options,
          ...(allMessage != undefined ? [{ name: allMessage, value: 'all' }] : []),
          { name: quitMessage, value: null },
          new inquirer.Separator(),
        ],
        default: options[0].value,
      },
    ]),
  );
  if (!promptResponse.ok) {
    throw new UserExitEarlyError();
  }
  const { chosen } = promptResponse.data;

  console.clear();
  return chosen;
}
