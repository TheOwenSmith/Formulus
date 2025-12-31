const INTERACTIVE_BROKERS_FEE_PER_SHARE = 0.0035;
export function interactiveBrokersSlippageFunction(marketSlippage: number, price: number): number {
  const interactiveBrokersFeeInBps = (INTERACTIVE_BROKERS_FEE_PER_SHARE / price) * 10_000;
  return marketSlippage + interactiveBrokersFeeInBps;
}
