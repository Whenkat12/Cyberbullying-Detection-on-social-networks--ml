import { useEffect, useState } from "react";
import { evaluateModel, type EvaluationResult } from "@/lib/model-evaluator";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, Radar,
} from "recharts";
import { Activity, ShieldCheck, AlertTriangle, TrendingUp, Loader2, CheckCircle2, XCircle } from "lucide-react";

const COLORS = {
  primary: "hsl(174, 72%, 50%)",
  destructive: "hsl(0, 72%, 55%)",
  success: "hsl(152, 60%, 45%)",
  accent: "hsl(263, 60%, 58%)",
  warning: "hsl(38, 90%, 55%)",
  muted: "hsl(215, 15%, 55%)",
};

const pct = (v: number) => (v * 100).toFixed(1) + "%";

const Dashboard = () => {
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    evaluateModel(0.2, 500).then((r) => {
      setEvalResult(r);
      setLoading(false);
    });
  }, []);

  if (loading || !evalResult) {
    return (
      <div className="min-h-screen pt-16 flex flex-col items-center justify-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Evaluating model against test dataset…</p>
        <p className="text-muted-foreground text-xs">Running classifier on 500 samples</p>
      </div>
    );
  }

  const { confusionMatrix: cm } = evalResult;

  const pieData = [
    { name: "Bullying", value: evalResult.bullySamples },
    { name: "Non-Bullying", value: evalResult.safeSamples },
  ];

  const radarData = [
    { metric: "Accuracy", value: +(evalResult.accuracy * 100).toFixed(1) },
    { metric: "Precision", value: +(evalResult.precision * 100).toFixed(1) },
    { metric: "Recall", value: +(evalResult.recall * 100).toFixed(1) },
    { metric: "F1-Score", value: +(evalResult.f1Score * 100).toFixed(1) },
    { metric: "Specificity", value: +(evalResult.specificity * 100).toFixed(1) },
  ];

  const severityData = Object.entries(evalResult.perSeverity)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  const stats = [
    { icon: Activity, label: "Test Samples", value: evalResult.testSamples.toString(), color: "text-primary" },
    { icon: AlertTriangle, label: "True Positives", value: cm.tp.toString(), color: "text-destructive" },
    { icon: ShieldCheck, label: "True Negatives", value: cm.tn.toString(), color: "text-success" },
    { icon: TrendingUp, label: "Accuracy", value: pct(evalResult.accuracy), color: "text-primary" },
  ];

  // Misclassified samples for display
  const misclassified = evalResult.sampleResults.filter(s => !s.correct).slice(0, 10);
  const correctSamples = evalResult.sampleResults.filter(s => s.correct).slice(0, 10);

  return (
    <div className="min-h-screen pt-16">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <h1 className="text-3xl font-bold mb-2">Model Evaluation Dashboard</h1>
        <p className="text-muted-foreground text-sm mb-2">
          Real metrics from running the classifier against a 20% test split ({evalResult.testSamples} of {evalResult.totalSamples} samples)
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Evaluated on real dataset — not simulated
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((s) => (
            <div key={s.label} className="gradient-card border border-border rounded-xl p-5 shadow-card">
              <s.icon className={`h-5 w-5 ${s.color} mb-2`} />
              <p className="text-2xl font-bold font-mono">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Confusion Matrix + Radar */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Confusion Matrix */}
          <div className="gradient-card border border-border rounded-xl p-6 shadow-card">
            <h3 className="font-semibold text-sm mb-4">Confusion Matrix</h3>
            <div className="grid grid-cols-3 gap-1 max-w-xs mx-auto text-center text-xs">
              <div />
              <div className="py-2 font-medium text-muted-foreground">Pred. Bully</div>
              <div className="py-2 font-medium text-muted-foreground">Pred. Safe</div>

              <div className="py-4 font-medium text-muted-foreground flex items-center justify-end pr-2">Actual Bully</div>
              <div className="py-4 rounded-lg bg-primary/20 border border-primary/30 font-mono text-lg font-bold text-primary">{cm.tp}</div>
              <div className="py-4 rounded-lg bg-destructive/15 border border-destructive/25 font-mono text-lg font-bold text-destructive">{cm.fn}</div>

              <div className="py-4 font-medium text-muted-foreground flex items-center justify-end pr-2">Actual Safe</div>
              <div className="py-4 rounded-lg bg-destructive/15 border border-destructive/25 font-mono text-lg font-bold text-destructive">{cm.fp}</div>
              <div className="py-4 rounded-lg bg-primary/20 border border-primary/30 font-mono text-lg font-bold text-primary">{cm.tn}</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>TP (correct bully): <span className="text-foreground font-mono">{cm.tp}</span></div>
              <div>FP (false alarm): <span className="text-foreground font-mono">{cm.fp}</span></div>
              <div>FN (missed bully): <span className="text-foreground font-mono">{cm.fn}</span></div>
              <div>TN (correct safe): <span className="text-foreground font-mono">{cm.tn}</span></div>
            </div>
          </div>

          {/* Radar */}
          <div className="gradient-card border border-border rounded-xl p-6 shadow-card">
            <h3 className="font-semibold text-sm mb-4">Model Performance Metrics</h3>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(220, 18%, 18%)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} />
                <Radar dataKey="value" fill={COLORS.primary} fillOpacity={0.25} stroke={COLORS.primary} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie + Severity */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="gradient-card border border-border rounded-xl p-6 shadow-card">
            <h3 className="font-semibold text-sm mb-4">Test Set Distribution</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" stroke="none">
                  <Cell fill={COLORS.destructive} />
                  <Cell fill={COLORS.success} />
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(220, 22%, 10%)", border: "1px solid hsl(220, 18%, 18%)", borderRadius: "8px", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-destructive" /> Bullying ({evalResult.bullySamples})</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success" /> Safe ({evalResult.safeSamples})</span>
            </div>
          </div>

          <div className="gradient-card border border-border rounded-xl p-6 shadow-card">
            <h3 className="font-semibold text-sm mb-4">Severity Breakdown (Detected Bullying)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={severityData}>
                <XAxis dataKey="name" tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "hsl(215, 15%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(220, 22%, 10%)", border: "1px solid hsl(220, 18%, 18%)", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {severityData.map((entry) => (
                    <Cell key={entry.name} fill={
                      entry.name === "Critical" ? COLORS.destructive :
                      entry.name === "High" ? COLORS.warning :
                      entry.name === "Medium" ? COLORS.accent : COLORS.muted
                    } />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Metrics Table */}
        <div className="gradient-card border border-border rounded-xl p-6 shadow-card mb-8">
          <h3 className="font-semibold text-sm mb-4">Classification Metrics Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: "Accuracy", value: pct(evalResult.accuracy) },
              { label: "Precision", value: pct(evalResult.precision) },
              { label: "Recall", value: pct(evalResult.recall) },
              { label: "F1-Score", value: pct(evalResult.f1Score) },
              { label: "Specificity", value: pct(evalResult.specificity) },
            ].map((m) => (
              <div key={m.label} className="text-center p-4 rounded-lg bg-secondary/30 border border-border/50">
                <p className="text-2xl font-bold font-mono text-primary">{m.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sample predictions */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Misclassified */}
          <div className="gradient-card border border-border rounded-xl p-6 shadow-card">
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" /> Misclassified Samples
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Messages the model got wrong</p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {misclassified.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No misclassified samples in displayed results</p>
              ) : misclassified.map((s, i) => (
                <div key={i} className="p-3 rounded-lg bg-destructive/5 border border-destructive/15 text-xs">
                  <p className="text-foreground mb-1.5 line-clamp-2">"{s.text}"</p>
                  <div className="flex gap-3 text-muted-foreground">
                    <span>Actual: <span className="font-medium text-foreground">{s.actual}</span></span>
                    <span>Predicted: <span className="font-medium text-destructive">{s.predicted}</span></span>
                    <span className="font-mono">{(s.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Correct */}
          <div className="gradient-card border border-border rounded-xl p-6 shadow-card">
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" /> Correct Predictions
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Sample messages correctly classified</p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {correctSamples.map((s, i) => (
                <div key={i} className="p-3 rounded-lg bg-primary/5 border border-primary/15 text-xs">
                  <p className="text-foreground mb-1.5 line-clamp-2">"{s.text}"</p>
                  <div className="flex gap-3 text-muted-foreground">
                    <span>Label: <span className="font-medium text-foreground">{s.actual}</span></span>
                    <span className="font-mono">{(s.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
