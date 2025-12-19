class OnlineStats {
  n = 0;
  mean = 0;
  M2 = 0;

  add(x: number) {
    this.n++;
    const delta = x - this.mean;
    this.mean += delta / this.n;
    const delta2 = x - this.mean;
    this.M2 += delta2 * delta;
  }

  count(): number {
    return this.n;
  }

  variance(): number | null {
    if (this.n > 1) {
      return this.M2 / (this.n - 1);
    }
    return null;
  }

  stddev(): number | null {
    const variance = this.variance();
    return variance != null ? Math.sqrt(variance) : null;
  }
}

export class SharpeRatioCalculator {
  private prevPrice: number | null = null;
  private returns = new OnlineStats();
  private riskFreeRate: number;

  constructor(riskFreeRate = 0) {
    this.riskFreeRate = riskFreeRate;
  }

  addPrice(price: number) {
    if (this.prevPrice != null) {
      const r = (price - this.prevPrice) / this.prevPrice;
      this.returns.add(r);
    }
    this.prevPrice = price;
  }

  volatility(): number | null {
    return this.returns.stddev();
  }

  sharpe(yearsOfData: number) {
    const mean = this.returns.mean;
    const volatility = this.volatility();
    if (volatility == null) {
      return null;
    }

    const freq = this.returns.count() / yearsOfData;
    const rfPerPeriod = Math.pow(1 + this.riskFreeRate, 1 / freq) - 1;

    const sharpePeriod = (mean - rfPerPeriod) / volatility;
    return sharpePeriod * Math.sqrt(freq);
  }
}
