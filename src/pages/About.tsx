import { Database, Brain, BarChart3, Shield, FileText, Cpu } from "lucide-react";

const PIPELINE = [
  { icon: Database, title: "Data Collection", desc: "Labeled social media datasets from Twitter/Kaggle containing bullying and non-bullying messages." },
  { icon: FileText, title: "Data Preprocessing", desc: "Text cleaning: lowercasing, punctuation removal, stopword removal, tokenization, and lemmatization." },
  { icon: Cpu, title: "Feature Extraction", desc: "TF-IDF vectorization converts cleaned text into numerical feature vectors for model training." },
  { icon: Brain, title: "Model Training", desc: "Multiple ML algorithms (SVM, Random Forest, Naïve Bayes, KNN, Logistic Regression) trained on 80% data." },
  { icon: Shield, title: "Classification", desc: "Trained model classifies input messages as Bullying or Non-Bullying with confidence scores." },
  { icon: BarChart3, title: "Evaluation", desc: "Model performance measured using Accuracy, Precision, Recall, and F1-Score on 20% test data." },
];

const ALGORITHMS = [
  { name: "Naïve Bayes", desc: "Probabilistic classifier based on Bayes' theorem with strong independence assumptions." },
  { name: "Support Vector Machine (SVM)", desc: "Finds optimal hyperplane to separate bullying and non-bullying classes in feature space." },
  { name: "Random Forest", desc: "Ensemble of decision trees with majority voting for robust classification." },
  { name: "Logistic Regression", desc: "Statistical model using logistic function for binary classification tasks." },
  { name: "K-Nearest Neighbors (KNN)", desc: "Instance-based learning that classifies based on majority vote of k nearest neighbors." },
  { name: "Decision Tree", desc: "Tree-structured model that splits data based on feature thresholds for classification." },
];

const About = () => (
  <div className="min-h-screen pt-16">
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">About the Project</h1>
      <p className="text-muted-foreground text-sm mb-12">
        Cyberbullying Detection on Social Networks Using Machine Learning — Final Year Major Project
      </p>

      {/* Problem Statement */}
      <div className="gradient-card border border-border rounded-xl p-6 shadow-card mb-8">
        <h2 className="text-lg font-semibold mb-3">Problem Statement</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Social networking platforms allow users to freely communicate, but are also used for abusive activities 
          such as hate speech, harassment, and offensive language. Manual moderation is inefficient and time-consuming. 
          This project develops an automated system that detects cyberbullying messages in real time using 
          machine learning and NLP techniques.
        </p>
      </div>

      {/* Pipeline */}
      <h2 className="text-xl font-semibold mb-6">System Pipeline</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        {PIPELINE.map((p, i) => (
          <div key={p.title} className="gradient-card border border-border rounded-xl p-5 shadow-card hover:border-primary/30 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 gradient-primary rounded-lg flex items-center justify-center shrink-0">
                <p.icon className="h-4 w-4 text-primary-foreground" />
              </div>
              <div>
                <span className="text-xs text-primary font-mono">Step {String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-semibold text-sm">{p.title}</h3>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>

      {/* Algorithms */}
      <h2 className="text-xl font-semibold mb-6">ML Algorithms Used</h2>
      <div className="space-y-3 mb-12">
        {ALGORITHMS.map((a) => (
          <div key={a.name} className="gradient-card border border-border rounded-xl px-5 py-4 shadow-card">
            <h3 className="font-semibold text-sm mb-1">{a.name}</h3>
            <p className="text-xs text-muted-foreground">{a.desc}</p>
          </div>
        ))}
      </div>

      {/* Tech stack */}
      <div className="gradient-card border border-border rounded-xl p-6 shadow-card mb-8">
        <h2 className="text-lg font-semibold mb-4">Technology Stack</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {["Python", "Scikit-learn", "Pandas", "NumPy", "NLTK", "TF-IDF", "Matplotlib", "Seaborn", "React (Frontend)"].map((t) => (
            <div key={t} className="bg-background/50 border border-border rounded-lg px-3 py-2 text-xs font-mono text-center">
              {t}
            </div>
          ))}
        </div>
      </div>

      {/* Future scope */}
      <div className="gradient-card border border-border rounded-xl p-6 shadow-card">
        <h2 className="text-lg font-semibold mb-3">Future Enhancements</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2"><span className="text-primary mt-0.5">▸</span> Deep Learning models (LSTM, BERT, CNN) for improved accuracy</li>
          <li className="flex items-start gap-2"><span className="text-primary mt-0.5">▸</span> Image and video-based cyberbullying detection</li>
          <li className="flex items-start gap-2"><span className="text-primary mt-0.5">▸</span> Multilingual support for global platforms</li>
          <li className="flex items-start gap-2"><span className="text-primary mt-0.5">▸</span> Real-time social media API integration</li>
        </ul>
      </div>
    </div>
  </div>
);

export default About;
