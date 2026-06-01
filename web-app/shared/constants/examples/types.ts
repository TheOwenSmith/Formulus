import type { SupportedLanguage } from '../trading';

export type AlgorithmExample = {
  id: string;
  name: string;
  description: string;
  /** 0 = Normal, 1 = Simple, 2 = Top-K */
  algorithmType: 0 | 1 | 2;
  indicators: string[];
  contextLength: number;
  aggregate: string;
  tickers?: string[];
  ticker?: string;
  k?: number;
  code: Record<SupportedLanguage, string>;
};
