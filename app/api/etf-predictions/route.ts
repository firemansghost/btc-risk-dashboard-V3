import { NextResponse } from 'next/server';
import { promises as fs } from 'node:fs';
import path from 'node:path';

type EtfRow = {
  date: string;
  symbol: string;
  day_flow_usd: number;
  sum21_usd: number;
  cumulative_usd: number;
};

type Trend = 'up' | 'down' | 'stable';

type FundOutlook = {
  symbol: string;
  name: string;
  latestFlow: number;
  scenarioFlow: number;
  trend: Trend;
  marketShare: number;
  sum21: number;
  cumulativeFlow: number;
};

function toMillions(usd: number): number {
  return Math.round((usd / 1_000_000) * 100) / 100;
}

function classifyTrend(changeRatio: number): Trend {
  if (changeRatio > 0.05) return 'up';
  if (changeRatio < -0.05) return 'down';
  return 'stable';
}

async function fetchRealEtfData() {
  try {
    const localPath = path.join(process.cwd(), 'public', 'signals', 'etf_by_fund.csv');
    const content = await fs.readFile(localPath, 'utf8');
    const lines = content.trim().split('\n');
    const data: EtfRow[] = lines.slice(1).map((line) => {
      const values = line.split(',');
      return {
        date: values[0],
        symbol: values[1],
        day_flow_usd: parseFloat(values[2]) || 0,
        sum21_usd: parseFloat(values[3]) || 0,
        cumulative_usd: parseFloat(values[4]) || 0,
      };
    });

    const latestData = data.reduce((acc, row) => {
      if (!acc[row.symbol] || new Date(row.date) > new Date(acc[row.symbol].date)) {
        acc[row.symbol] = row;
      }
      return acc;
    }, {} as Record<string, EtfRow>);

    return { data, latestData };
  } catch (error) {
    console.error('Error fetching ETF data:', error);
    return { data: [] as EtfRow[], latestData: {} as Record<string, EtfRow> };
  }
}

function generateTrendScenarios(etfData: { data: EtfRow[]; latestData: Record<string, EtfRow> }) {
  const { data, latestData } = etfData;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  let recentData = data.filter((row) => new Date(row.date) >= weekAgo);

  if (recentData.length === 0) {
    recentData = Object.values(latestData);
  }

  const etfGroups = recentData.reduce((acc, row) => {
    if (!acc[row.symbol]) acc[row.symbol] = [];
    acc[row.symbol].push(row);
    return acc;
  }, {} as Record<string, EtfRow[]>);

  const individual: FundOutlook[] = Object.entries(etfGroups).map(([symbol, flows]) => {
    const sortedFlows = [...flows].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const latest = sortedFlows[0];
    const previous = sortedFlows[1];
    const latestRow = latestData[symbol] || latest;

    const changeRatio = previous
      ? (latest.day_flow_usd - previous.day_flow_usd) / Math.abs(previous.day_flow_usd || 1)
      : 0;
    const scenarioUsd = latest.day_flow_usd * (1 + changeRatio * 0.1);

    return {
      symbol,
      name: getEtfName(symbol),
      latestFlow: toMillions(latest.day_flow_usd),
      scenarioFlow: toMillions(scenarioUsd),
      trend: classifyTrend(changeRatio),
      marketShare: 0,
      sum21: toMillions(latestRow.sum21_usd),
      cumulativeFlow: toMillions(latestRow.cumulative_usd),
    };
  });

  const totalLatest = individual.reduce((sum, etf) => sum + etf.latestFlow, 0);
  individual.forEach((etf) => {
    etf.marketShare =
      totalLatest === 0 ? 0 : Math.round((etf.latestFlow / totalLatest) * 100 * 10) / 10;
  });

  const daily = [];
  const today = new Date();
  for (let i = 1; i <= 7; i++) {
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + i);

    const totalScenario = individual.reduce((sum, etf) => {
      const trendFactor = etf.trend === 'up' ? 1.02 : etf.trend === 'down' ? 0.98 : 1.0;
      return sum + etf.scenarioFlow * Math.pow(trendFactor, i);
    }, 0);

    daily.push({
      date: futureDate.toISOString().split('T')[0],
      scenarioFlow: Math.round(totalScenario * 100) / 100,
      trend: (totalScenario > totalLatest ? 'up' : totalScenario < totalLatest ? 'down' : 'stable') as Trend,
    });
  }

  const trendScenario7d = Math.round(daily.reduce((sum, day) => sum + day.scenarioFlow, 0) * 100) / 100;
  const flatRunRate7d = Math.round(totalLatest * 7 * 100) / 100;

  return {
    individual,
    daily,
    summary: {
      latestAggregateFlow: Math.round(totalLatest * 100) / 100,
      flatRunRate7d,
      trendScenario7d,
    },
  };
}

function getEtfName(symbol: string): string {
  const names: Record<string, string> = {
    IBIT: 'iShares Bitcoin Trust',
    FBTC: 'Fidelity Wise Origin Bitcoin Fund',
    BITB: 'Bitwise Bitcoin ETF',
    ARKB: 'ARK 21Shares Bitcoin ETF',
    BTCO: 'Invesco Galaxy Bitcoin ETF',
    HODL: 'VanEck Bitcoin Trust',
    EZBC: 'Franklin Bitcoin ETF',
    BRRR: 'Valkyrie Bitcoin Fund',
  };
  return names[symbol] || `${symbol} Bitcoin ETF`;
}

function describeOutlook(outlook: ReturnType<typeof generateTrendScenarios>): string[] {
  const notes: string[] = [];
  const { individual, summary } = outlook;
  const upCount = individual.filter((etf) => etf.trend === 'up').length;
  const downCount = individual.filter((etf) => etf.trend === 'down').length;
  const fundCount = individual.length;

  if (upCount > downCount) {
    notes.push(`Recent flow direction is positive for ${upCount} of ${fundCount} funds.`);
  } else if (downCount > upCount) {
    notes.push(`Recent flow direction is negative for ${downCount} of ${fundCount} funds.`);
  } else if (fundCount > 0) {
    notes.push('Recent flow direction is mixed across tracked funds.');
  }

  if (summary.trendScenario7d > summary.flatRunRate7d) {
    notes.push('The heuristic 7-day scenario is above the flat run-rate.');
  } else if (summary.trendScenario7d < summary.flatRunRate7d) {
    notes.push('The heuristic 7-day scenario is below the flat run-rate.');
  } else if (fundCount > 0) {
    notes.push('The heuristic 7-day scenario matches the flat run-rate.');
  }

  return notes;
}

export async function GET() {
  try {
    const etfData = await fetchRealEtfData();
    const outlook = generateTrendScenarios(etfData);

    return NextResponse.json({
      individual: outlook.individual,
      daily: outlook.daily,
      summary: outlook.summary,
      methodology: {
        type: 'heuristic',
        validated: false,
        description:
          'Recent-flow trend continuation. This is a descriptive heuristic, not a statistically validated forecast, probability estimate, or machine-learning model output. It is not part of the G-Score methodology.',
      },
      notes: describeOutlook(outlook),
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('ETF Flow Outlook API Error:', error);
    return NextResponse.json(
      { error: 'Failed to load ETF flow outlook' },
      { status: 500 }
    );
  }
}
