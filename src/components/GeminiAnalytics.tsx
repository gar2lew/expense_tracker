import { useState, useEffect } from 'react';
import { Expense } from '../lib/db';
import { analyzeExpenses, ExpenseAnalysisResult } from '../lib/gemini';
import { 
  Sparkles, 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Info, 
  Repeat, 
  CheckCircle2, 
  Lightbulb, 
  Zap, 
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Clock,
  Leaf,
  Shield
} from 'lucide-react';

interface GeminiAnalyticsProps {
  expenses: Expense[];
  isOnline: boolean;
}

export default function GeminiAnalytics({ expenses, isOnline }: GeminiAnalyticsProps) {
  const [analysis, setAnalysis] = useState<ExpenseAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAnalyzedCount, setLastAnalyzedCount] = useState<number>(0);

  const fetchAnalysis = async () => {
    if (expenses.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeExpenses(expenses);
      setAnalysis(result);
      setLastAnalyzedCount(expenses.length);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Gemini analysis failed:', message);
      setError(message || 'Failed to analyze spending patterns. Please check your network and Gemini API keys.');
    } finally {
      setLoading(false);
    }
  };

  // Perform initial load if there is data, or let them trigger it manually
  useEffect(() => {
    if (expenses.length >= 2 && !analysis && !loading && isOnline) {
      fetchAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses.length, isOnline]);

  const renderIcon = (iconType: string) => {
    switch (iconType) {
      case 'trend-up':
        return <TrendingUp className="w-4 h-4 text-rose-500" />;
      case 'trend-down':
        return <TrendingDown className="w-4 h-4 text-emerald-500" />;
      case 'caution':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'repeating':
        return <Repeat className="w-4 h-4 text-indigo-500" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getConfidenceColor = (conf: string) => {
    switch (conf?.toLowerCase()) {
      case 'high':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100/80 ring-emerald-600/10';
      case 'medium':
        return 'bg-amber-50 text-amber-700 border-amber-100/80 ring-amber-600/10';
      case 'low':
      default:
        return 'bg-slate-50 text-slate-700 border-slate-100/80 ring-slate-600/10';
    }
  };

  if (!isOnline) {
    return (
      <div id="ai-analytics-offline" className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-premium text-center space-y-4">
        <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto border border-slate-100">
          <Brain className="w-6 h-6 text-slate-400 animate-float" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-850 font-heading">Advanced Expense Pattern Learning</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-normal">
            Connect to the internet to trigger advanced cognitive analytics. Gemini scans historical claims, models budget cycles, and flags billing anomalies.
          </p>
        </div>
      </div>
    );
  }

  if (expenses.length < 2) {
    return (
      <div id="ai-analytics-insufficient" className="bg-white rounded-2xl border border-slate-200/60 p-6 shadow-premium text-center space-y-3.5">
        <div className="w-12 h-12 bg-indigo-50/50 text-indigo-600 rounded-full flex items-center justify-center mx-auto border border-indigo-150 animate-float">
          <Sparkles className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-850 font-heading">AI cognitive learning pending</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-normal">
            Register at least 2 expense entries for Gemini to run predictive forecasting, category balances, and double-billing audits.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      id="ai-pattern-analytics" 
      className={`bg-gradient-to-br from-indigo-50/15 via-violet-50/5 to-indigo-50/15 rounded-2xl border transition-all duration-500 p-6 space-y-6 ${
        analysis ? 'border-indigo-500/20 shadow-glow-indigo animate-pulse-glow' : 'border-slate-200/60 shadow-premium'
      }`}
    >
      
      {/* Header and Sync indicator */}
      <div className="flex items-center justify-between border-b border-indigo-50/20 pb-4 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-xl flex items-center justify-center shadow-md shadow-indigo-200">
            <Brain className="w-4.5 h-4.5 animate-float" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 font-heading tracking-tight sm:text-base">
              Gemini Intelligent Ledger
              <span className="text-[9px] font-black tracking-widest bg-indigo-100 text-indigo-700 px-1.8 py-0.5 rounded border border-indigo-200/50">COGNITION</span>
            </h3>
            <p className="text-[11px] text-slate-400">Deep spending pattern mapping & cross-currency analytics</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {expenses.length !== lastAnalyzedCount && lastAnalyzedCount > 0 && (
            <span className="text-[9.5px] bg-amber-50 text-amber-700 font-bold px-2 py-1 rounded-lg border border-amber-150 animate-pulse">
              Ledger altered (Sync available)
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchAnalysis()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 text-[11px] font-bold rounded-xl border border-slate-200 shadow-2xs transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            Run Audit Analysis
          </button>
        </div>
      </div>

      {loading && (
        <div className="py-8 space-y-6">
          <div className="flex items-center gap-3.5 mb-2 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-200 bg-shimmer"></div>
            <div className="space-y-1.5 flex-1">
              <div className="h-4 bg-slate-200 bg-shimmer rounded-md w-1/4"></div>
              <div className="h-3 bg-slate-200 bg-shimmer rounded-md w-2/3"></div>
            </div>
          </div>
          
          {/* Shimmering Skeleton Loader instead of simple spinner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/80 border border-slate-100 p-4.5 rounded-xl space-y-3.5 shadow-2xs">
              <div className="h-3 bg-slate-200 bg-shimmer rounded-md w-1/2"></div>
              <div className="h-6 bg-slate-200 bg-shimmer rounded-md w-3/4"></div>
              <div className="h-2.5 bg-slate-200 bg-shimmer rounded-md w-1/3"></div>
            </div>
            <div className="bg-white/80 border border-slate-100 p-4.5 rounded-xl space-y-3.5 shadow-2xs">
              <div className="h-3 bg-slate-200 bg-shimmer rounded-md w-2/3"></div>
              <div className="h-6 bg-slate-200 bg-shimmer rounded-md w-5/6"></div>
              <div className="h-2.5 bg-slate-200 bg-shimmer rounded-md w-1/2"></div>
            </div>
            <div className="bg-white/80 border border-slate-100 p-4.5 rounded-xl space-y-3.5 shadow-2xs">
              <div className="h-3 bg-slate-200 bg-shimmer rounded-md.w-1/3"></div>
              <div className="h-4 bg-slate-200 bg-shimmer rounded-full w-2/3"></div>
              <div className="h-2.5 bg-slate-200 bg-shimmer rounded-md w-2/5"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="space-y-3">
              <div className="h-3.5 bg-slate-200 bg-shimmer rounded-md w-1/3 mb-4"></div>
              <div className="p-3 bg-white/70 border border-slate-100 rounded-xl space-y-2">
                <div className="h-3 bg-slate-200 bg-shimmer rounded-md w-1/4"></div>
                <div className="h-3 bg-slate-200 bg-shimmer rounded-md w-5/6"></div>
              </div>
              <div className="p-3 bg-white/70 border border-slate-100 rounded-xl space-y-2">
                <div className="h-3 bg-slate-200 bg-shimmer rounded-md w-1/3"></div>
                <div className="h-3 bg-slate-200 bg-shimmer rounded-md w-2/3"></div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-3.5 bg-slate-200 bg-shimmer rounded-md w-1/4 mb-4"></div>
              <div className="p-4 bg-emerald-50/10 border border-emerald-100 rounded-xl space-y-2">
                <div className="h-3.5 bg-slate-200 bg-shimmer rounded-md w-1/2"></div>
                <div className="h-2.5 bg-slate-200 bg-shimmer rounded-md w-11/12"></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4.5 bg-rose-55/10 border border-rose-100 text-rose-900 rounded-2xl flex gap-3.5 text-xs animate-fade-in-up shadow-sm">
          <ShieldAlert className="w-4.5 h-4.5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Algorithmic analysis interrupted</p>
            <p className="text-rose-700 font-medium leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Main Analysis Output */}
      {!loading && !error && analysis && (
        <div className="space-y-6 animate-fade-in-up text-slate-800">
          
          {/* Executive Summary Card with Glassmorphism / subtle border */}
          <div className="bg-indigo-50/30 border border-indigo-100/60 p-4.5 rounded-2xl flex items-start gap-3.5 shadow-sm">
            <div className="p-2 bg-white text-indigo-600 rounded-xl shadow-xs border border-indigo-50 shrink-0 mt-0.5 animate-float">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="space-y-1">
              <span className="text-[9.5px] font-black text-indigo-700 uppercase tracking-widest block font-heading">Autonomous Strategic Summary</span>
              <p className="text-xs text-slate-700 font-medium leading-relaxed font-sans">{analysis.summary}</p>
            </div>
          </div>

          {/* AI Calculated Burn Rate Forecasting KPI Cards with Premium design */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white/80 border border-slate-200/50 p-4.5 rounded-xl space-y-1.5 shadow-premium hover:-translate-y-0.5 transition-transform duration-300">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Monthly Outflow</span>
              <span className="text-lg font-black text-slate-850 block font-mono tracking-tight">{analysis.burnRate.averageMonthly}</span>
              <span className="text-[9.5px] text-slate-400 block font-semibold flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" /> Historical baseline
              </span>
            </div>
            
            <div className="bg-white/80 border border-slate-200/50 p-4.5 rounded-xl space-y-1.5 shadow-premium hover:-translate-y-0.5 transition-transform duration-300 ring-1 ring-indigo-500/5">
              <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider block">Forecast Spending</span>
              <span className="text-lg font-black text-indigo-750 block font-mono tracking-tight">{analysis.burnRate.forecastNextMonth}</span>
              <span className="text-[9.5px] text-indigo-500 font-bold block flex items-center gap-1">
                <Zap className="w-3 h-3 text-indigo-500 animate-pulse" /> AI model burn projection
              </span>
            </div>

            <div className="bg-white/80 border border-slate-200/50 p-4.5 rounded-xl space-y-1.5 shadow-premium hover:-translate-y-0.5 transition-transform duration-300">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">AI Model Confidence</span>
              <div>
                <span className={`inline-flex items-center font-bold border rounded-full px-2.5 py-0.5 text-[10px] mt-0.5 ${getConfidenceColor(analysis.burnRate.confidence)}`}>
                  {analysis.burnRate.confidence} Confidence
                </span>
              </div>
              <span className="text-[9.5px] text-slate-400 block font-medium">Mapped from {expenses.length} points</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* Patterns Column */}
            <div className="space-y-3.5">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-0.5 font-heading">Observed Spends and Cycles</h4>
              <div className="space-y-3">
                {analysis.patterns.map((pt: ExpenseAnalysisResult['patterns'][number], idx: number) => (
                  <div key={idx} className="p-3.5 bg-white/70 border border-slate-200/50 rounded-xl flex items-start gap-3 hover:bg-white transition-all duration-300 shadow-2xs">
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded-lg shrink-0 mt-0.5">
                      {renderIcon(pt.iconType)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-slate-800 leading-tight">{pt.title}</span>
                        <span className="inline-flex items-center px-1.8 py-0.5 rounded-sm text-[9px] font-extrabold bg-indigo-55/10 text-indigo-700 border border-indigo-100/50 font-mono">
                          {pt.impact}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed">{pt.description}</p>
                    </div>
                  </div>
                ))}
                {analysis.patterns.length === 0 && (
                  <p className="text-xs text-slate-400 py-3 text-center">No clear category spend patterns discovered yet.</p>
                )}
              </div>
            </div>

            {/* Warnings & Anomalies Column formatted as glowing Red Shields */}
            <div className="space-y-3.5">
              <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-0.5 font-heading">Ledger Anomaly Scanner</h4>
              <div className="space-y-3">
                {analysis.anomalies.map((anom: ExpenseAnalysisResult['anomalies'][number], idx: number) => (
                  <div key={idx} className="p-3.5 border border-rose-100/60 bg-rose-50/15 rounded-xl flex items-start gap-3 shadow-2xs">
                    <div className="p-2 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg shrink-0 mt-0.5">
                      <Shield className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">{anom.title}</span>
                        <span className="text-[8px] uppercase tracking-wider font-extrabold bg-rose-50 border border-rose-100/80 text-rose-700 px-1.8 py-0.5 rounded-sm">
                          {anom.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed font-sans">{anom.description}</p>
                    </div>
                  </div>
                ))}

                {analysis.anomalies.length === 0 && (
                  <div className="p-4 border border-emerald-100/80 bg-emerald-50/10 rounded-xl flex items-center gap-3.5 shadow-2xs">
                    <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shrink-0 border border-emerald-100/50">
                      <CheckCircle2 className="w-4.5 h-4.5" />
                    </div>
                    <div className="space-y-0.5">
                      <h5 className="text-xs font-bold text-slate-850">Healthy Spend Ledger</h5>
                      <p className="text-[10.5px] text-slate-400 leading-normal">Our anomaly mapping engine spotted no double bills or duplicate entries.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Actionable Personal Recommendations styled as Glowing Green Chips */}
          <div className="border-t border-slate-100 pt-5 space-y-3.5">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-0.5 flex items-center gap-1.5 font-heading">
              <Lightbulb className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
              Tailored Optimizations & Saving Advice
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {analysis.recommendations.map((rec: string, idx: number) => (
                <div key={idx} className="p-4 bg-white/70 border border-slate-200/50 rounded-xl space-y-1 hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between shadow-2xs">
                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-100/50 px-1.8 py-0.5 rounded-sm font-heading">
                      <Leaf className="w-3 h-3 text-emerald-600 shrink-0" />
                      STEP {idx + 1} SAVINGS
                    </span>
                    <p className="text-[11.5px] text-slate-600 font-semibold leading-relaxed mt-1 font-sans">{rec}</p>
                  </div>
                  <span className="text-[10px] text-indigo-650 font-bold flex items-center gap-1 mt-3.5 group cursor-pointer inline-block">
                    Explore Strategy <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* CTA helper when first loaded without any analysis computed */}
      {!loading && !analysis && (
        <div className="py-6 text-center space-y-4">
          <p className="text-xs text-slate-450 max-w-xs mx-auto leading-normal">
            Authenticate the machine analyzer to search historical payments, detect anomalous variances, and plot burn rates.
          </p>
          <button
            type="button"
            onClick={() => fetchAnalysis()}
            className="inline-flex items-center gap-2 px-4.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition-all duration-300 cursor-pointer active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-indigo-200 animate-pulse" />
            Compute spend patterns with Gemini
          </button>
        </div>
      )}

    </div>
  );
}
