import inquirer from 'inquirer';

export function formatTable(rows: [string, string][]): string {
  let output = '';
  const firstColumnWidth = rows.reduce((acc, [key, _]) => Math.max(acc, key.length + 1), 0);
  for (const [key, value] of rows) {
    output += (key + ':').padEnd(firstColumnWidth, ' ') + ' ' + value + '\n';
  }
  return output;
}

export type SelectionOption<T> = { name: string; value: T };

export async function getUserSelectionInput<T>(
  options: { name: string; value: T }[],
  message: string,
  quitMessage = 'Quit',
): Promise<T | null> {
  const { chosen } = await inquirer.prompt([
    {
      type: 'list',
      name: 'chosen',
      message,
      choices: [...options, new inquirer.Separator(), { name: quitMessage, value: null }],
      default: options[0].value,
    },
  ]);
  console.clear();
  return chosen;
}
