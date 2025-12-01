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

  count() {
    return this.n;
  }

  variance() {
    return this.n > 1 ? this.M2 / (this.n - 1) : 0;
  }

  stddev() {
    return Math.sqrt(this.variance());
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
    if (this.prevPrice !== null) {
      const r = (price - this.prevPrice) / this.prevPrice;
      this.returns.add(r);
    }
    this.prevPrice = price;
  }

  sharpe(yearsOfData: number) {
    const mean = this.returns.mean;
    const sd = this.returns.stddev();
    if (sd === 0) return 0;

    const freq = this.returns.count() / yearsOfData;
    const rfPerPeriod = Math.pow(1 + this.riskFreeRate, 1 / freq) - 1;

    const sharpePeriod = (mean - rfPerPeriod) / sd;
    return sharpePeriod * Math.sqrt(freq);
  }
}
