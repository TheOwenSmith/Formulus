import fs from 'fs';
import readline from 'readline';

const lines = readline.createInterface({
  input: fs.createReadStream('./data/smth.jsonl'),
  crlfDelay: Infinity,
});

for await (const line of lines) {
  console.log('{', line, '}');
}
