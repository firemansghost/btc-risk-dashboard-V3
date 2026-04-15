#!/usr/bin/env node
/**
 * GhostGauge official monthly strategy comparison (SSOT v2)
 *
 * Baseline DCA vs Risk-Based DCA:
 * - Monthly execution: first row in history.csv within each calendar month (sorted asc ≈ first on/after the 1st).
 * - Months with no rows are skipped for BOTH strategies.
 * - Risk band: numeric score → band via config/dashboard-config.json inclusive ranges; CSV band string fallback only.
 * - Multipliers: docs/strategy-analysis/SSOT_PRODUCT_DECISIONS.md
 *
 * Value averaging: computed with the same monthly execution dates; stored under exploratory.* only (not official headline).
 *
 * Legacy: pre-SSOT four-bucket engine removed from canonical output.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

const METHODOLOGY_VERSION = '2.0.0';
const ARTIFACT_TYPE = 'strategy_comparison_monthly_ssot';

/** Official six-band multipliers (SSOT product decision) */
const OFFICIAL_MULTIPLIERS = {
  'Aggressive Buying': 1.5,
  'Regular DCA Buying': 1.0,
  'Moderate Buying': 0.75,
  'Hold & Wait': 0.5,
  'Reduce Risk': 0.25,
  'High Risk': 0
};

/**
 * Same idea as weekly-backtesting.mjs — map CSV label to canonical six when score fallback needed
 */
function mapLegacyCsvBandToCanonical(originalBand) {
  const mapping = {
    'Aggressive Buying': 'Aggressive Buying',
    'Regular DCA Buying': 'Regular DCA Buying',
    'Moderate Buying': 'Moderate Buying',
    'Hold & Wait': 'Hold & Wait',
    'Reduce Risk': 'Reduce Risk',
    'High Risk': 'High Risk',
    'Begin Scaling In': 'Aggressive Buying',
    'Hold/Neutral': 'Hold & Wait',
    'Begin Scaling Out': 'Reduce Risk',
    'Increase Selling': 'High Risk',
    'Maximum Selling': 'High Risk'
  };
  return mapping[originalBand] || 'Hold & Wait';
}

function loadDashboardBands() {
  const configPath = path.join(REPO_ROOT, 'config', 'dashboard-config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  return config.bands || [];
}

/**
 * Inclusive boundaries — matches lib/riskConfig.client.ts getBandForScore
 */
function getBandLabelFromScore(score, bands) {
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  const band = bands.find((b) => score >= b.range[0] && score <= b.range[1]);
  return band ? band.label : null;
}

function resolveBandForRow(row, bands) {
  const fromScore = getBandLabelFromScore(row.gScore, bands);
  if (fromScore) {
    return { label: fromScore, source: 'score_ssot' };
  }
  const label = mapLegacyCsvBandToCanonical(row.band || 'Unknown');
  return { label, source: 'legacy_csv' };
}

function loadHistoricalData() {
  const historyPath = path.join(REPO_ROOT, 'public', 'data', 'history.csv');

  if (!fs.existsSync(historyPath)) {
    return { success: false, error: 'Historical data not found', data: [] };
  }

  const content = fs.readFileSync(historyPath, 'utf8');
  const lines = content.trim().split('\n');

  if (lines.length <= 1) {
    return { success: false, error: 'No historical data available', data: [] };
  }

  const historicalData = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length >= 4) {
      historicalData.push({
        date: parts[0],
        gScore: parseFloat(parts[1]),
        band: parts[2] || 'Unknown',
        price: parseFloat(parts[3]) || 0
      });
    }
  }

  return {
    success: true,
    data: historicalData.sort((a, b) => new Date(a.date) - new Date(b.date))
  };
}

/**
 * First row in each calendar month (data sorted ascending → earliest day in month).
 * Equivalent to first row on/after the 1st within that month; months absent from data skipped.
 */
function getMonthlyExecutionRows(historicalData) {
  const seen = new Set();
  const out = [];
  for (const row of historicalData) {
    const d = new Date(row.date + 'T12:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}

function calculateBaselineDCA(executionRows, monthlyAmount = 1000) {
  const dcaResults = {
    monthlyAmount,
    totalInvested: 0,
    totalBTC: 0,
    finalValue: 0,
    totalReturn: 0,
    trades: []
  };

  for (const row of executionRows) {
    const btcPurchased = monthlyAmount / row.price;
    dcaResults.totalInvested += monthlyAmount;
    dcaResults.totalBTC += btcPurchased;
    dcaResults.trades.push({
      date: row.date,
      price: row.price,
      amount: monthlyAmount,
      btcPurchased,
      totalBTC: dcaResults.totalBTC,
      totalInvested: dcaResults.totalInvested
    });
  }

  return dcaResults;
}

function calculateRiskBasedDCA(executionRows, bands, baseMonthlyAmount = 1000) {
  const riskDCA = {
    baseMonthlyAmount,
    totalInvested: 0,
    totalBTC: 0,
    finalValue: 0,
    totalReturn: 0,
    trades: []
  };

  for (const row of executionRows) {
    const { label: bandLabel, source: bandSource } = resolveBandForRow(row, bands);
    const multiplier = OFFICIAL_MULTIPLIERS[bandLabel] ?? 0.5;
    const investmentAmount = baseMonthlyAmount * multiplier;

    if (investmentAmount > 0) {
      const btcPurchased = investmentAmount / row.price;
      riskDCA.totalInvested += investmentAmount;
      riskDCA.totalBTC += btcPurchased;
      riskDCA.trades.push({
        date: row.date,
        price: row.price,
        band: row.band,
        derivedBand: bandLabel,
        bandSource,
        multiplier,
        amount: investmentAmount,
        btcPurchased,
        totalBTC: riskDCA.totalBTC,
        totalInvested: riskDCA.totalInvested
      });
    }
  }

  return riskDCA;
}

/** Value averaging on the same monthly execution dates (exploratory only). */
function calculateValueAveraging(executionRows, targetValue = 1000) {
  const valueAvg = {
    targetValue,
    totalInvested: 0,
    totalBTC: 0,
    finalValue: 0,
    totalReturn: 0,
    trades: []
  };

  for (const row of executionRows) {
    const currentPortfolioValue = valueAvg.totalBTC * row.price;
    const targetPortfolioValue = targetValue * (valueAvg.trades.length + 1);
    const investmentNeeded = targetPortfolioValue - currentPortfolioValue;

    if (investmentNeeded > 0) {
      const btcPurchased = investmentNeeded / row.price;
      valueAvg.totalInvested += investmentNeeded;
      valueAvg.totalBTC += btcPurchased;
      valueAvg.trades.push({
        date: row.date,
        price: row.price,
        amount: investmentNeeded,
        btcPurchased,
        totalBTC: valueAvg.totalBTC,
        totalInvested: valueAvg.totalInvested,
        portfolioValue: valueAvg.totalBTC * row.price
      });
    }
  }

  return valueAvg;
}

function finalizeStrategy(strategy, finalPrice) {
  strategy.finalValue = strategy.totalBTC * finalPrice;
  strategy.totalReturn =
    strategy.totalInvested > 0 ? (strategy.finalValue - strategy.totalInvested) / strategy.totalInvested : 0;
  return strategy;
}

function calculateStrategyVolatility(trades) {
  if (trades.length < 2) return 0;
  const returns = [];
  for (let i = 1; i < trades.length; i++) {
    const returnRate =
      (trades[i].totalBTC * trades[i].price - trades[i - 1].totalBTC * trades[i - 1].price) /
      (trades[i - 1].totalBTC * trades[i - 1].price);
    returns.push(returnRate);
  }
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  return Math.sqrt(variance) * 100;
}

function calculateMaxDrawdown(trades) {
  if (trades.length < 2) return 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const trade of trades) {
    const portfolioValue = trade.totalBTC * trade.price;
    if (portfolioValue > peak) peak = portfolioValue;
    const drawdown = (peak - portfolioValue) / peak;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  return maxDrawdown * 100;
}

function calculateSharpeRatio(trades) {
  if (trades.length < 2) return 0;
  const returns = [];
  for (let i = 1; i < trades.length; i++) {
    const returnRate =
      (trades[i].totalBTC * trades[i].price - trades[i - 1].totalBTC * trades[i - 1].price) /
      (trades[i - 1].totalBTC * trades[i - 1].price);
    returns.push(returnRate);
  }
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  return stdDev > 0 ? mean / stdDev : 0;
}

function buildMetrics(strategy) {
  return {
    totalReturn: strategy.totalReturn * 100,
    totalInvested: strategy.totalInvested,
    finalValue: strategy.finalValue,
    totalBTC: strategy.totalBTC,
    avgPrice: strategy.totalInvested > 0 ? strategy.totalInvested / strategy.totalBTC : 0,
    totalTrades: strategy.trades.length,
    volatility: calculateStrategyVolatility(strategy.trades),
    maxDrawdown: calculateMaxDrawdown(strategy.trades),
    sharpeRatio: calculateSharpeRatio(strategy.trades)
  };
}

function wrapStrategy(name, strategy) {
  return {
    ...strategy,
    metrics: buildMetrics(strategy)
  };
}

function buildOfficialComparison(baseline, riskBased) {
  const strategies = {
    'Baseline DCA': wrapStrategy('Baseline DCA', baseline),
    'Risk-Based DCA': wrapStrategy('Risk-Based DCA', riskBased)
  };

  const returnRankings = Object.entries(strategies)
    .sort(([, a], [, b]) => b.metrics.totalReturn - a.metrics.totalReturn)
    .map(([name, data], index) => ({
      rank: index + 1,
      strategy: name,
      return: data.metrics.totalReturn
    }));

  const sharpeRankings = Object.entries(strategies)
    .sort(([, a], [, b]) => b.metrics.sharpeRatio - a.metrics.sharpeRatio)
    .map(([name, data], index) => ({
      rank: index + 1,
      strategy: name,
      sharpeRatio: data.metrics.sharpeRatio
    }));

  const insights = [];
  const bRet = strategies['Baseline DCA'].metrics.totalReturn;
  const rRet = strategies['Risk-Based DCA'].metrics.totalReturn;
  insights.push({
    type: 'performance',
    message: `${returnRankings[0].strategy} had the higher total return at ${returnRankings[0].return.toFixed(2)}%`
  });
  insights.push({
    type: 'risk_adjusted',
    message: `${sharpeRankings[0].strategy} had the better Sharpe-like ratio (${sharpeRankings[0].sharpeRatio.toFixed(2)})`
  });
  const diff = rRet - bRet;
  insights.push({
    type: 'outperformance',
    message: `Risk-Based DCA vs Baseline DCA (total return spread): ${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%`
  });

  return {
    strategies,
    rankings: { byReturn: returnRankings, bySharpe: sharpeRankings },
    insights
  };
}

async function compareDCAvsRiskStrategies() {
  console.log('📊 GhostGauge SSOT monthly strategy comparison');
  console.log('==============================================');

  try {
    const bands = loadDashboardBands();
    const dataResult = loadHistoricalData();
    if (!dataResult.success) {
      console.log(`❌ ${dataResult.error}`);
      return { success: false, error: dataResult.error };
    }

    const historicalData = dataResult.data;
    const executionRows = getMonthlyExecutionRows(historicalData);
    const finalPrice = historicalData[historicalData.length - 1].price;

    console.log(`✅ Loaded ${historicalData.length} history rows; ${executionRows.length} monthly execution points`);
    console.log(`   Range: ${historicalData[0].date} → ${historicalData[historicalData.length - 1].date}`);

    const monthlyAmount = 1000;

    let baseline = calculateBaselineDCA(executionRows, monthlyAmount);
    baseline = finalizeStrategy(baseline, finalPrice);

    let riskBased = calculateRiskBasedDCA(executionRows, bands, monthlyAmount);
    riskBased = finalizeStrategy(riskBased, finalPrice);

    let valueAvg = calculateValueAveraging(executionRows, monthlyAmount);
    valueAvg = finalizeStrategy(valueAvg, finalPrice);

    const official = buildOfficialComparison(
      { ...baseline, monthlyAmount },
      { ...riskBased, baseMonthlyAmount: monthlyAmount }
    );

    const exploratoryVA = wrapStrategy('Value Averaging', { ...valueAvg, monthlyAmount });

    const generatedAt = new Date().toISOString();

    const report = {
      methodologyVersion: METHODOLOGY_VERSION,
      artifactType: ARTIFACT_TYPE,
      metadata: {
        generatedAt,
        dataSource: 'public/data/history.csv',
        schedule:
          'First row in each calendar month (sorted history ≈ first trading day on/after the 1st); months with no rows skipped for both strategies.',
        bandDerivation:
          'Primary: numeric score → band via config/dashboard-config.json inclusive ranges. Fallback: CSV band column mapped to canonical six labels.',
        bandConfigPath: 'config/dashboard-config.json',
        baseMonthlyUsd: monthlyAmount,
        officialStrategies: ['Baseline DCA', 'Risk-Based DCA'],
        exploratoryStrategies: ['Value Averaging (exploratory engine; not co-official headline)']
      },
      strategies: official.strategies,
      rankings: official.rankings,
      insights: official.insights,
      exploratory: {
        note: 'Value averaging uses the same monthly execution dates but different capital rules — not part of the official two-way SSOT comparison.',
        valueAveraging: exploratoryVA
      }
    };

    const reportPath = path.join(REPO_ROOT, 'public', 'data', 'dca_vs_risk_comparison.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    console.log('\n📋 Official (SSOT) results');
    for (const [name, s] of Object.entries(official.strategies)) {
      console.log(`   ${name}: ${s.metrics.totalReturn.toFixed(2)}% return, ${s.metrics.totalTrades} trades`);
    }
    console.log(`\n📊 Exploratory VA return: ${exploratoryVA.metrics.totalReturn.toFixed(2)}%`);
    console.log(`\n📄 Written: ${reportPath}`);

    return { success: true, report };
  } catch (error) {
    console.error('❌ Strategy comparison failed:', error);
    return { success: false, error: error.message };
  }
}

export { compareDCAvsRiskStrategies };

const invoked =
  process.argv[1] &&
  path.normalize(path.resolve(process.argv[1])) === path.normalize(__filename);
if (invoked) {
  compareDCAvsRiskStrategies().then((r) => process.exit(r.success ? 0 : 1));
}
