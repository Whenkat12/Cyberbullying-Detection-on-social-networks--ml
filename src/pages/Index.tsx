import { Link } from "react-router-dom";
import { Shield, Search, BarChart3, Brain, ArrowRight, AlertTriangle, CheckCircle } from "lucide-react";

const FEATURES = [
  {
    icon: Search,
    title: "Text Analysis",
    desc: "Analyze social media messages using NLP-based feature extraction and pattern recognition.",
  },
  {
    icon: Brain,
    title: "ML Classification",
    desc: "Multiple ML algorithms including SVM, Random Forest, and Naïve Bayes for accurate detection.",
  },
  {
    icon: BarChart3,
    title: "Performance Metrics",
    desc: "Comprehensive evaluation with Accuracy, Precision, Recall, and F1-Score dashboards.",
  },
];

const STATS = [
  { value: "94.2%", label: "Accuracy" },
  { value: "92.8%", label: "Precision" },
  { value: "91.5%", label: "Recall" },
  { value: "92.1%", label: "F1-Score" },
];

const Index = () => {
  return (
    <div className="min-h-screen pt-16">
      {/* Hero */}
      <section className="relative overflow-hidden py-24 md:py-32">
        {/* Background effects */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-sm font-medium mb-8">
              <Shield className="h-4 w-4" />
              Machine Learning Powered Detection
            </div>

            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 leading-tight">
              Cyberbullying Detection{" "}
              <span className="text-gradient">on Social Networks</span>
            </h1>

            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              An automated system using Machine Learning and Natural Language Processing 
              to classify social media text messages as bullying or non-bullying in real time.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/detect"
                className="inline-flex items-center justify-center gap-2 gradient-primary text-primary-foreground px-8 py-3.5 rounded-lg font-semibold text-sm shadow-glow hover:opacity-90 transition-opacity"
              >
                Start Detection
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-8 py-3.5 rounded-lg font-semibold text-sm hover:bg-secondary/80 transition-colors"
              >
                View Dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-card/50">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <p className="text-3xl md:text-4xl font-bold text-gradient">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">System Architecture</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Built on a robust pipeline: Data Collection → Preprocessing → Feature Extraction → ML Model → Classification
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="gradient-card border border-border rounded-xl p-6 hover:border-primary/30 transition-colors shadow-card"
              >
                <div className="w-12 h-12 gradient-primary rounded-lg flex items-center justify-center mb-4">
                  <f.icon className="h-6 w-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">How It Works</h2>
          <div className="max-w-2xl mx-auto space-y-6">
            {[
              { step: "01", title: "Input Text", desc: "Enter or paste a social media message for analysis." },
              { step: "02", title: "NLP Preprocessing", desc: "Text is cleaned: lowercasing, stopword removal, tokenization, lemmatization." },
              { step: "03", title: "Feature Extraction", desc: "TF-IDF vectorization converts text into numerical features." },
              { step: "04", title: "ML Classification", desc: "Trained model classifies the message as Bullying or Non-Bullying." },
            ].map((item) => (
              <div key={item.step} className="flex gap-5 items-start">
                <span className="text-2xl font-bold text-primary font-mono shrink-0">{item.step}</span>
                <div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo preview */}
      <section className="py-24 border-t border-border">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Live Detection Preview</h2>
          <div className="max-w-lg mx-auto space-y-3">
            <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <span className="text-left">"You're such a loser, nobody likes you!"</span>
              <span className="ml-auto text-destructive font-semibold text-xs shrink-0">Bullying</span>
            </div>
            <div className="flex items-center gap-3 bg-success/10 border border-success/30 rounded-lg px-4 py-3 text-sm">
              <CheckCircle className="h-5 w-5 text-success shrink-0" />
              <span className="text-left">"Great work on the presentation today!"</span>
              <span className="ml-auto text-success font-semibold text-xs shrink-0">Safe</span>
            </div>
          </div>
          <Link
            to="/detect"
            className="inline-flex items-center gap-2 mt-8 text-primary hover:underline text-sm font-medium"
          >
            Try it yourself <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Cyberbullying Detection System — Final Year Major Project</p>
          <p className="mt-1">Built with Machine Learning & NLP Techniques</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
