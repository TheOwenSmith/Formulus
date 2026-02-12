export const RUNNER_JS_BATCHED_FROM_FILENAMES = (filenames: string[]) => `
process.stdout.write('compiled\\n');
const implementations = ${JSON.stringify(filenames)}.map((filename) =>
  require(\`/sandbox/\${filename}\`),
);

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin });

rl.on('line', async (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch (e) {
    process.stdout.write(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.stack : String(e) }) + '\\n',
    );
    return;
  }

  try {
    const paramsByIndex = msg.args[0];
    const numImplementations = Object.keys(msg.args[0]).length;
    const result =
      numImplementations === 0
        ? {}
        : await new Promise((resolve, reject) => {
            const resultByIndex = {};
            let notResolvedCount = numImplementations;
            for (const index in paramsByIndex) {
              const indexAsNum = Number(index);
              const params = paramsByIndex[indexAsNum];
              Promise.resolve(implementations[indexAsNum](...params))
                .then((result) => {
                  resultByIndex[indexAsNum] = result;
                  if (--notResolvedCount === 0) resolve(resultByIndex);
                })
                .catch(reject);
            }
          });
    process.stdout.write(JSON.stringify({ ok: true, result }) + '\\n');
  } catch (e) {
    process.stdout.write(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.stack : String(e) }) + '\\n',
    );
  }
});
`;

export const UTILS_JS_CODE = `
const Action = Object.freeze({
  BUY: 0,
  SELL: 1,
  HOLD: 2,
});

const Direction = Object.freeze({
  UP: 0,
  DOWN: 1,
});

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function dayOfWeek(timestamp) {
  const date = new Date(timestamp);
  return DAYS_OF_WEEK[date.getDay()];
}

module.exports = { Action, Direction, dayOfWeek };
`;
