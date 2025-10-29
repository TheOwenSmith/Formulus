import fs from 'fs';
import readline from 'readline';

export async function countLinesInFile(filename: string): Promise<number> {
  let count = 0;
  const lines = readline.createInterface({
    input: fs.createReadStream(filename),
    crlfDelay: Infinity,
  });
  for await (const _ of lines) {
    count++;
  }
  return count;
}
