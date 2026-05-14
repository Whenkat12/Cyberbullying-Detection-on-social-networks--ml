import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { apiService } from "@/services/api";
import { detectCyberbullying, SAMPLE_MESSAGES, type DetectionResult } from "@/lib/detector";
import { loadDatasetModel, type DatasetModel } from "@/lib/dataset-loader";
import { getCategoryBadgeStyle } from "@/lib/utils";
import { Search, AlertTriangle, CheckCircle, Loader2, RotateCcw, Zap, Database, Brain, BarChart3 } from "lucide-react";

interface LineResult {
  text: string;
  result: DetectionResult;
}

const Detect = () => {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [lineResults, setLineResults] = useState<LineResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(true);
  const [modelInfo, setModelInfo] = useState<DatasetModel | null>(null);
  const [history, setHistory] = useState<LineResult[]>([]);

  useEffect(() => {
    loadDatasetModel()
      .then((model) => { setModelInfo(model); setModelLoading(false); })
      .catch(() => setModelLoading(false));
  }, []);

  const analyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    
    try {
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      
      if (!user) {
        // Fallback to client-side detection if not authenticated
        await new Promise((r) => setTimeout(r, 600));
        const results = lines.map(line => ({ 
          text: line, 
          result: detectCyberbullying(line)
        }));
        setLineResults(results);
        setHistory((prev) => [...results, ...prev].slice(0, 20));
        return;
      }

      // Use backend API for authenticated users
      const response = await apiService.batchDetect(lines, { platform: 'web', source: 'detect' }, false);
      const results: LineResult[] = lines.map((line, i) => ({
        text: line,
        result: response.results[i].result
      }));
      
      setLineResults(results);
      setHistory((prev) => [...results, ...prev].slice(0, 20));
    } catch (error) {
      console.error('Detection failed:', error);
      // Fallback to client-side detection on API failure
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      const results = lines.map(line => ({ 
        text: line, 
        result: detectCyberbullying(line)
      }));
      setLineResults(results);
      setHistory((prev) => [...results, ...prev].slice(0, 20));
    } finally {
      setLoading(false);
    }
  };

  const loadSample = (sample: string) => {
    setText(sample);
    setLineResults([]);
  };

  const severityColor: Record<string, string> = {
    Low: "text-success", Medium: "text-warning", High: "text-destructive", Critical: "text-destructive",
  };
  const severityBg: Record<string, string> = {
    Low: "bg-success/20 border-success/30", Medium: "bg-warning/20 border-warning/30",
    High: "bg-destructive/20 border-destructive/30", Critical: "bg-destructive/30 border-destructive/40",
  };

  // Highlight flagged words in a sentence
  const highlightText = (sentence: string, flaggedWords: string[]) => {
    if (flaggedWords.length === 0) return <span>{sentence}</span>;
    const pattern = new RegExp(`\\b(${flaggedWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})\\b`, "gi");
    const parts = sentence.split(pattern);
    return (
      <>
        {parts.map((part, i) => {
          const isFlagged = flaggedWords.some(w => w.toLowerCase() === part.toLowerCase());
          return (
            <span key={i} className={isFlagged ? "bg-destructive/20 px-1 rounded text-destructive font-medium" : ""}>
              {part}
            </span>
          );
        })}
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-8 pt-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 tracking-tight">Cyberbullying Detection</h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">Advanced AI-powered detection using machine learning and natural language processing to identify cyberbullying content.</p>
          </div>

          {/* Detection Input */}
          <div className="gradient-card border border-border rounded-xl p-6 shadow-card mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Search className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Enter Text to Analyze</h2>
            </div>
            <div className="space-y-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste text here to check for cyberbullying..."
                className="w-full min-h-[120px] p-4 rounded-lg border border-border bg-background/50 focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={analyze}
                  disabled={loading || !text.trim()}
                  className="flex-1 bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing...</>
                  ) : (
                    <><Search className="h-4 w-4" /> Analyze Text</>
                  )}
                </button>
                <button
                  onClick={() => { setText(""); setLineResults([]); }}
                  className="px-4 py-3 rounded-lg border border-border bg-background/50 hover:bg-secondary transition-colors"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Results */}
          {lineResults.length > 0 && (
            <div className="gradient-card border border-border rounded-xl p-6 shadow-card mb-6">
              <h2 className="font-semibold mb-4">Detection Results</h2>
              <div className="space-y-4">
                {lineResults.map((res, i) => (
                  <div key={i} className={`p-4 rounded-lg border transition-all ${severityBg[res.result.severity]}`}>
                    <div className="flex items-start gap-3">
                      {res.result.label === "Bullying" ? (
                        <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle className="h-5 w-5 text-success mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">Classification</span>
                          <span className="text-muted-foreground">:</span>
                          <span className={`font-semibold ${res.result.label === "Bullying" ? "text-destructive" : "text-success"}`}>
                            {res.result.label}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getCategoryBadgeStyle(res.result.detailedCategory).bg} ${getCategoryBadgeStyle(res.result.detailedCategory).text}`}>
                            {getCategoryBadgeStyle(res.result.detailedCategory).icon} {res.result.detailedCategory.replace(/_/g, " ")}
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className={`text-sm font-medium ${severityColor[res.result.severity]}`}>
                            {res.result.severity} Severity
                          </span>
                          <span className="text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground font-mono">
                            {(res.result.confidence * 100).toFixed(0)}% confidence
                          </span>
                        </div>
                        <p className="text-sm mb-3">{highlightText(res.text, res.result.flaggedWords)}</p>
                        {res.result.flaggedWords.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {res.result.flaggedWords.map((word, j) => (
                              <span key={j} className="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded">
                                {word}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Messages */}
          <div className="gradient-card border border-border rounded-xl p-6 shadow-card mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Sample Messages</h3>
            </div>
            <div className="grid gap-2">
              {SAMPLE_MESSAGES.slice(0, 8).map((s, i) => (
                <button key={i} onClick={() => loadSample(s.text)}
                  className="text-left text-sm px-4 py-2.5 rounded-lg bg-background/50 border border-border hover:border-primary/30 transition-colors truncate">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${s.expected === "Bullying" ? "bg-destructive" : "bg-success"}`} />
                  {s.text}
                </button>
              ))}
            </div>
          </div>

          {/* ML Pipeline Info */}
          {modelInfo && (
            <div className="gradient-card border border-border rounded-xl p-6 shadow-card mb-6">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">ML Pipeline Details</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-background/50 rounded-lg p-3 border border-border text-center">
                  <p className="text-2xl font-bold font-mono text-primary">{modelInfo.totalDocs.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Training Samples</p>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border border-border text-center">
                  <p className="text-2xl font-bold font-mono text-primary">{modelInfo.vocabSize.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Vocabulary Size</p>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border border-border text-center">
                  <p className="text-2xl font-bold font-mono text-destructive">{modelInfo.totalBully.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Bullying Samples</p>
                </div>
                <div className="bg-background/50 rounded-lg p-3 border border-border text-center">
                  <p className="text-2xl font-bold font-mono text-success">{modelInfo.totalNonBully.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Safe Samples</p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><span className="font-semibold text-foreground">Algorithm:</span> Multinomial Naive Bayes with TF-IDF weighting + Laplace smoothing</p>
                <p><span className="font-semibold text-foreground">Ensemble:</span> 60% ML model + 40% heuristic keyword analysis (combined scoring)</p>
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="gradient-card border border-border rounded-xl p-6 shadow-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-primary" />
                  Search History ({history.length})
                </h3>
                <button
                  onClick={() => setHistory([])}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear History
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {history.map((h, i) => {
                  const isBully = h.result.label === "Bullying";
                  return (
                    <div key={i} className={`flex items-start gap-3 text-sm rounded-lg px-4 py-3 border transition-colors cursor-pointer hover:bg-secondary/30 ${
                      isBully ? "bg-destructive/5 border-destructive/20" : "bg-success/5 border-success/20"
                    }`}
                      onClick={() => { setText(h.text); setLineResults([h]); }}
                      title="Click to re-analyze"
                    >
                      {isBully ? (
                        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-success mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{h.text}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                          <span className="uppercase tracking-wide">Classification:</span>
                          <span className={`font-semibold ${isBully ? "text-destructive" : "text-success"}`}>
                            {h.result.label}
                          </span>
                          <span>·</span>
                          <span className={`px-2 py-1 rounded-full font-medium text-xs ${getCategoryBadgeStyle(h.result.detailedCategory).bg} ${getCategoryBadgeStyle(h.result.detailedCategory).text}`}>
                            {getCategoryBadgeStyle(h.result.detailedCategory).icon} {h.result.detailedCategory.replace(/_/g, " ")}
                          </span>
                          <span>·</span>
                          <span className="font-mono">{(h.result.confidence * 100).toFixed(0)}%</span>
                          {isBully && h.result.flaggedWords.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-destructive">{h.result.flaggedWords.length} flagged word{h.result.flaggedWords.length > 1 ? "s" : ""}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Detect;