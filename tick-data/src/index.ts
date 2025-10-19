import { backtestAlgorithm } from '@/algorithms/backtest-algorithm';
import { prevTickAlgoirthm } from '@/algorithms/prev-tick';

const finalBalance = await backtestAlgorithm(
  'C:/Users/owens/Desktop/PheonixTrader/tick-data/data/SPY_1DAY_2020-10-17_to_2025-10-17.csv',
  prevTickAlgoirthm,
);
console.log(`Final balance: $${finalBalance.toFixed(2)}`);
