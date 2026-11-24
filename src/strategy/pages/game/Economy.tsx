import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RequirePlayer, historySeries, yearLabel } from './common';
import { Button, Panel, Slider, Stat } from '../../components/ui';
import { BarList, LineChart } from '../../components/ui/Charts';
import { fmtNum } from '../../engine/util';
import { computeCalc } from '../../engine/systems';
import { useGame } from '../../store/game';
import type { Budget, BudgetKey } from '../../types/game';

const LABELS: Record<BudgetKey, string> = { military: 'Military upkeep', infrastructure: 'Infrastructure', research: 'Research & education', health: 'Healthcare', agriculture: 'Agriculture', administration: 'Administration' };

export default function EconomyPage() {
  const dispatch = useGame((s) => s.dispatch);
  return (
    <RequirePlayer>{(c, w) => <Inner c={c} w={w} dispatch={dispatch} />}</RequirePlayer>
  );
}
function Inner({ c, w, dispatch }: { c: import('../../types/game').Country; w: import('../../types/game').World; dispatch: ReturnType<typeof useGame.getState>['dispatch'] }) {
  const [tax, setTax] = useState(c.economy.taxRate);
  const [budget, setBudget] = useState<Budget>(c.economy.budget);
  const [rate, setRate] = useState(c.economy.spendingRate);
  const [loan, setLoan] = useState(0);
  useEffect(() => { setTax(c.economy.taxRate); setBudget(c.economy.budget); setRate(c.economy.spendingRate); }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const e = c.economy;
  const calc = computeCalc(w, c);
  const sum = Object.values(budget).reduce((a, b) => a + b, 0) || 1;
  const maxLoan = Math.max(0, e.income * 24 - e.debt);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Treasury" value={fmtNum(e.treasury)} />
        <Stat label="Monthly balance" value={`${e.lastBalance >= 0 ? '+' : ''}${fmtNum(e.lastBalance)}`} tone={e.lastBalance >= 0 ? 'good' : 'bad'} />
        <Stat label="Debt" value={fmtNum(e.debt)} sub={`${(e.interestRate * 100).toFixed(1)}% interest`} tone={e.debt > e.income * 24 ? 'bad' : 'neutral'} />
        <Stat label="Inflation" value={`${(e.inflation * 100).toFixed(1)}%`} tone={e.inflation > 0.05 ? 'bad' : 'neutral'} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Income & expenses (monthly)">
          <BarList items={[
            { label: 'Tax revenue', value: e.income - e.tradeIncome, color: '#d9b65c' },
            { label: 'Trade income', value: e.tradeIncome, color: '#4fa08b' },
            ...Object.entries(calc.spend).map(([k, v]) => ({ label: LABELS[k as BudgetKey], value: -v, color: '#a3362c' })),
            { label: 'Debt interest', value: -(e.debt * e.interestRate) / 12, color: '#7c271f' },
          ]} format={fmtNum} />
          <p className="mt-3 text-[11px] text-parchment-300/60">Tax efficiency {(calc.taxEff * 100).toFixed(0)}% (administration budget, stability, ruler, inflation). GDP {fmtNum(e.gdp)}/yr. Trade partners: {calc.tradePartners}.</p>
        </Panel>
        <Panel title="Taxation">
          <Slider value={tax} min={0} max={0.6} step={0.01} onChange={setTax} format={(v) => `${Math.round(v * 100)}%`} />
          <p className="mt-2 text-xs text-parchment-300/70">Every point above 12% lowers satisfaction and raises unrest. Projected tax: {fmtNum((e.gdp / 12) * tax * calc.taxEff)}/month.</p>
          <Button variant="gold" className="mt-3" disabled={Math.abs(tax - e.taxRate) < 0.001} onClick={() => void dispatch({ type: 'setTax', country: c.id, rate: tax })}>Apply tax rate</Button>
          <div className="divider-gold my-4" />
          <div className="label">Loans</div>
          <Slider value={loan} min={0} max={Math.max(1, maxLoan)} step={Math.max(1, Math.round(maxLoan / 100))} onChange={setLoan} format={fmtNum} />
          <div className="mt-2 flex gap-2"><Button size="sm" disabled={loan <= 0} onClick={() => void dispatch({ type: 'loan', country: c.id, amount: loan })}>Borrow</Button><Button size="sm" disabled={e.debt <= 0} onClick={() => void dispatch({ type: 'repay', country: c.id, amount: Math.min(e.debt, e.treasury) })}>Repay what we can</Button></div>
        </Panel>
      </div>
      <Panel title="State budget" subtitle="Shares of spending. Each category's effect scales with spending relative to the economy (diminishing returns).">
        <div className="grid gap-3 md:grid-cols-2">
          {(Object.keys(LABELS) as BudgetKey[]).map((k) => (
            <div key={k}>
              <div className="mb-1 flex justify-between text-xs"><span className="text-parchment-100">{LABELS[k]}</span><span className="stat-num text-gold-200">{Math.round((budget[k] / sum) * 100)}% · effect ×{calc.mult[k].toFixed(2)}</span></div>
              <Slider value={budget[k]} min={0} max={1} step={0.01} onChange={(v) => setBudget({ ...budget, [k]: v })} />
            </div>
          ))}
        </div>
        <div className="mt-4"><div className="mb-1 flex justify-between text-xs"><span>Total spending as share of income</span><span className="stat-num text-gold-200">{Math.round(rate * 100)}%</span></div><Slider value={rate} min={0.3} max={1.5} step={0.01} onChange={setRate} /></div>
        <p className="mt-2 text-xs text-parchment-300/70">Military upkeep needed: {fmtNum(calc.upkeep)}/mo; currently funded {fmtNum(calc.spend.military)}. Under-funding causes desertion and falling morale. Spending above 100% creates debt and inflation.</p>
        <Button variant="gold" className="mt-3" onClick={() => void dispatch({ type: 'setBudget', country: c.id, budget, spendingRate: rate })}>Apply budget</Button>
      </Panel>
      <Panel title="Economic development" actions={<Link className="text-xs text-gold-300 hover:underline" to="/game/historian">Ask the historian about the economy →</Link>}>
        <LineChart xLabel={yearLabel} series={[{ name: 'GDP', color: '#e8d08a', points: historySeries(w, c.id, 'gdp') }, { name: 'Treasury', color: '#4fa08b', points: historySeries(w, c.id, 'treasury') }]} />
      </Panel>
    </div>
  );
}
