import type { Bar } from '@shared/constants/trading';
import { badRequest, type AppError } from '@shared/utils/error-handling';
import { err, ok, Result } from 'neverthrow';
import { computeATR } from './atr';
import type { IndicatorMetadata } from './indicator-metadata';

declare module './indicator-metadata' {
  export interface IndicatorMetadataParts {
    superTrend?: Record<
      string,
      {
        superTrend: ({ superTrendValue: number; direction: Direction } | null)[];
        timestamp: string;
      }
    >;
  }
}

declare module './indicator' {
  export interface IndicatorResultByIndicator {
    [x: `SuperTrend(${number},${number})`]: ({
      superTrendValue: number;
      direction: Direction;
    } | null)[];
  }
}
export const superTrendIndicatorResultStringified = `
[x: \`SuperTrend(\${number},\${number})\`]: ({
  superTrendValue: number;
  direction: Direction;
} | null)[];
`;

export const enum Direction {
  UP = 0,
  DOWN = 1,
}

export function computeSuperTrend({
  bars,
  period = 10,
  multiplier = 3,
  metadata,
}: {
  bars: Bar[];
  period?: number;
  multiplier?: number;
  metadata: IndicatorMetadata;
}): Result<({ superTrendValue: number; direction: Direction } | null)[], AppError> {
  if (period < 1) {
    return err(badRequest('Period must be at least 1 to compute SuperTrend'));
  }
  if (bars.length < period + 1) {
    return err(
      badRequest(
        `Must have context length of at least ${period + 1} to compute SuperTrend(${period},${multiplier})`,
      ),
    );
  }

  // Compute ATR
  const computeAtrResult = computeATR({ bars, period, metadata });
  if (computeAtrResult.isErr()) {
    return err(computeAtrResult.error);
  }
  const atrs: (number | null)[] = computeAtrResult.value;

  const timestamp = bars.at(-1)![0];
  const key = `${period},${multiplier}`;
  const superTrendMetadata = metadata.superTrend?.[key];

  if (superTrendMetadata == undefined) {
    const superTrend: ({ superTrendValue: number; direction: Direction } | null)[] = Array(
      bars.length,
    ).fill(null);

    for (let i = period; i < bars.length; i++) {
      const atr = atrs[i];
      if (atr == null) {
        continue;
      }

      const high = bars[i][2];
      const low = bars[i][3];
      const close = bars[i][4];
      const hl2 = (high + low) / 2;

      const upperBand = hl2 + multiplier * atr;
      const lowerBand = hl2 - multiplier * atr;

      let superTrendValue: number;
      let direction: Direction;

      const prev = superTrend[i - 1];
      if (prev == null) {
        if (close <= upperBand) {
          superTrendValue = lowerBand;
          direction = Direction.UP;
        } else {
          superTrendValue = upperBand;
          direction = Direction.DOWN;
        }
      } else {
        if (prev.direction == Direction.UP) {
          superTrendValue = Math.max(lowerBand, prev.superTrendValue);
          direction = close < superTrendValue ? Direction.DOWN : Direction.UP;
        } else {
          superTrendValue = Math.min(upperBand, prev.superTrendValue);
          direction = close > superTrendValue ? Direction.UP : Direction.DOWN;
        }
      }
      superTrend[i] = { superTrendValue, direction };
    }

    if (!('superTrend' in metadata)) {
      metadata.superTrend = {};
    }
    metadata.superTrend![key] = {
      superTrend,
      timestamp,
    };
    return ok(superTrend);
  } else {
    const superTrend = superTrendMetadata.superTrend;
    const lastUpdateTimestamp = superTrendMetadata.timestamp;

    // If the timestamp is the same as the last update, return cached result
    if (timestamp === lastUpdateTimestamp) {
      return ok(superTrend);
    }

    const high = bars.at(-1)![2];
    const low = bars.at(-1)![3];
    const close = bars.at(-1)![4];
    const hl2 = (high + low) / 2;

    const atr = atrs.at(-1)!;
    const upperBand = hl2 + multiplier * atr;
    const lowerBand = hl2 - multiplier * atr;

    // Compute next super trend
    let superTrendValue: number;
    let direction: Direction;

    const prev = superTrend.at(-1)!;
    if (prev.direction == Direction.UP) {
      superTrendValue = Math.max(lowerBand, prev.superTrendValue);
      direction = close < superTrendValue ? Direction.DOWN : Direction.UP;
    } else {
      superTrendValue = Math.min(upperBand, prev.superTrendValue);
      direction = close > superTrendValue ? Direction.UP : Direction.DOWN;
    }

    superTrend.shift();
    superTrend.push({ superTrendValue, direction });

    superTrendMetadata.timestamp = timestamp;
    return ok(superTrend);
  }
}
