export const RUNNER_PY_BATCHED_FROM_FILENAMES = (filenames: string[]) => `
print('compiled', flush=True)
import json
import sys
import importlib.util
import traceback
from concurrent.futures import ThreadPoolExecutor, as_completed

filenames = ${JSON.stringify(filenames)}
implementations = []
for filename in filenames:
    spec = importlib.util.spec_from_file_location("module", f"/sandbox/{filename}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    implementations.append(module)

for line in sys.stdin:
    try:
        msg = json.loads(line.strip())
    except Exception as e:
        print(json.dumps({"ok": False, "error": "".join(traceback.format_exception(type(e), e, e.__traceback__))}), flush=True)
        continue

    try:
        params_by_index = msg.get("args", [{}])[0]
        num_implementations = len(params_by_index)
        
        if num_implementations == 0:
            result = {}
        else:
            result_by_index = {}
            with ThreadPoolExecutor(max_workers=num_implementations) as executor:
                futures = {
                    executor.submit(implementations[int(index)].implementation, *params): index
                    for index, params in params_by_index.items()
                }
                for future in as_completed(futures):
                    index = futures[future]
                    try:
                        result_by_index[index] = future.result()
                    except Exception as e:
                        raise e
            result = result_by_index
        
        print(json.dumps({"ok": True, "result": result}), flush=True)
    except Exception as e:
        print(json.dumps({"ok": False, "error": "".join(traceback.format_exception(type(e), e, e.__traceback__))}), flush=True)
`;

export const UTILS_PY_CODE = `
from enum import IntEnum
from datetime import datetime

class Action(IntEnum):
    BUY = 0
    SELL = 1
    HOLD = 2

class Direction(IntEnum):
    UP = 0
    DOWN = 1

DAYS_OF_WEEK = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
]

def day_of_week(timestamp):
    dt = datetime.fromisoformat(timestamp)
    return DAYS_OF_WEEK[dt.weekday() + 1 if dt.weekday() < 6 else 0]
`;
