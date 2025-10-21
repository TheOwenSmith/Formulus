export function formatTable(rows: [string, string][]): string {
  let output = '';
  const firstColumnWidth = rows.reduce((acc, [key, _]) => Math.max(acc, key.length + 1), 0);
  for (const [key, value] of rows) {
    output += (key + ':').padEnd(firstColumnWidth, ' ') + ' ' + value + '\n';
  }
  return output;
}
