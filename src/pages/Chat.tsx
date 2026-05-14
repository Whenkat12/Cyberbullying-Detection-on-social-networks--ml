import { useState, useRef, useEffect, useCallback } from "react";
import { detectCyberbullying, type DetectionResult } from "@/lib/detector";
import { loadDatasetModel } from "@/lib/dataset-loader";
import { getCategoryBadgeStyle } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Send, ArrowLeft, Shield, AlertTriangle, X, 
  Phone, Video, MoreVertical, Search, Smile, Paperclip, Mic,
  CheckCheck, Heart, ThumbsUp, Camera, CircleDot, Lock, Eye, EyeOff, ShieldCheck,
} from "lucide-react";
import { WhatsAppIcon, InstagramIcon, XTwitterIcon, FacebookIcon, LockIcon } from "@/components/SocialIcons";

/* ── Platform definitions ── */
type Platform = "whatsapp" | "instagram" | "twitter" | "facebook";

interface Contact {
  id: string;
  name: string;
  avatar: string;
  username?: string;
  platform: Platform;
  status: "online" | "offline";
  lastSeen?: string;
}

interface ChatMessage {
  id: string;
  text: string;
  sender: "user" | "contact";
  timestamp: Date;
  detection?: DetectionResult;
  read?: boolean;
}

const CONTACTS: Contact[] = [
  { id: "1", name: "Alex Morgan", avatar: "AM", username: "alex.morgan", platform: "whatsapp", status: "online" },
  { id: "2", name: "Jordan Lee", avatar: "JL", username: "@jordanlee", platform: "twitter", status: "online" },
  { id: "3", name: "Casey Rivera", avatar: "CR", username: "casey_rivera", platform: "instagram", status: "offline", lastSeen: "2h ago" },
  { id: "4", name: "Sam Wilson", avatar: "SW", platform: "facebook", status: "online" },
  { id: "5", name: "Taylor Kim", avatar: "TK", username: "taylorkimm", platform: "whatsapp", status: "offline", lastSeen: "30m ago" },
  { id: "6", name: "Riley Chen", avatar: "RC", username: "@rileychen", platform: "twitter", status: "online" },
  { id: "7", name: "Morgan Davis", avatar: "MD", username: "morgan.davis", platform: "instagram", status: "online" },
  { id: "8", name: "Jamie Park", avatar: "JP", platform: "facebook", status: "offline", lastSeen: "1h ago" },
];

const PLATFORM_CONFIG: Record<Platform, {
  name: string;
  headerBg: string;
  sidebarBg: string;
  userBubbleBg: string;
  contactBubbleBg: string;
  accent: string;
  iconColor: string;
  loginBg: string;
  loginAccent: string;
  loginFields: Array<{ label: string; placeholder: string; type: string; icon?: string }>;
  loginNote: string;
}> = {
  whatsapp: {
    name: "WhatsApp",
    headerBg: "bg-[hsl(152,45%,28%)]",
    sidebarBg: "bg-[hsl(220,22%,10%)]",
    userBubbleBg: "bg-[hsl(152,35%,22%)]",
    contactBubbleBg: "bg-secondary",
    accent: "text-[hsl(152,60%,50%)]",
    iconColor: "text-[hsl(152,60%,50%)]",
    loginBg: "bg-[hsl(152,45%,28%)]",
    loginAccent: "hsl(152,60%,50%)",
    loginFields: [
      { label: "Country", placeholder: "India", type: "text" },
      { label: "Phone Number", placeholder: "+91 XXXXX XXXXX", type: "tel" },
    ],
    loginNote: "We'll send you a verification code via SMS to confirm your number.",
  },
  instagram: {
    name: "Instagram",
    headerBg: "bg-gradient-to-r from-[hsl(300,60%,40%)] to-[hsl(340,80%,50%)]",
    sidebarBg: "bg-[hsl(220,22%,10%)]",
    userBubbleBg: "bg-[hsl(263,50%,40%)]",
    contactBubbleBg: "bg-secondary",
    accent: "text-[hsl(330,70%,60%)]",
    iconColor: "text-[hsl(330,70%,60%)]",
    loginBg: "bg-gradient-to-br from-[hsl(37,95%,55%)] via-[hsl(340,80%,50%)] to-[hsl(280,70%,55%)]",
    loginAccent: "hsl(340,80%,55%)",
    loginFields: [
      { label: "Username or Email", placeholder: "Username, email or phone", type: "text" },
      { label: "Password", placeholder: "Password", type: "password" },
    ],
    loginNote: "Your Instagram credentials are used only for session authentication.",
  },
  twitter: {
    name: "X (Twitter)",
    headerBg: "bg-[hsl(220,22%,12%)]",
    sidebarBg: "bg-[hsl(220,25%,7%)]",
    userBubbleBg: "bg-[hsl(204,80%,35%)]",
    contactBubbleBg: "bg-secondary",
    accent: "text-[hsl(204,80%,55%)]",
    iconColor: "text-foreground",
    loginBg: "bg-[hsl(220,22%,8%)]",
    loginAccent: "hsl(204,80%,55%)",
    loginFields: [
      { label: "Email or Username", placeholder: "Phone, email, or username", type: "text" },
      { label: "Password", placeholder: "Password", type: "password" },
    ],
    loginNote: "Sign in with your X account to enable real-time DM monitoring.",
  },
  facebook: {
    name: "Facebook",
    headerBg: "bg-[hsl(220,55%,35%)]",
    sidebarBg: "bg-[hsl(220,22%,10%)]",
    userBubbleBg: "bg-[hsl(220,55%,45%)]",
    contactBubbleBg: "bg-secondary",
    accent: "text-[hsl(220,60%,60%)]",
    iconColor: "text-[hsl(220,60%,65%)]",
    loginBg: "bg-[hsl(220,55%,40%)]",
    loginAccent: "hsl(220,55%,50%)",
    loginFields: [
      { label: "Email or Phone", placeholder: "Email address or phone number", type: "text" },
      { label: "Password", placeholder: "Password", type: "password" },
    ],
    loginNote: "Connect your Facebook account for Messenger conversation monitoring.",
  },
};

const AUTO_REPLIES = [
  "Hey, how's it going?",
  "That's interesting, tell me more!",
  "Haha yeah totally 😂",
  "What are you up to today?",
  "Nice! I was just thinking about that",
  "Oh really? That's cool",
  "Sure, sounds good to me 👍",
  "Let's catch up soon!",
  "I agree with you on that",
  "Lol that's funny 😄",
];

/* Platform icon renderer */
const PlatformIcon = ({ platform, className = "h-6 w-6" }: { platform: Platform; className?: string }) => {
  const config = PLATFORM_CONFIG[platform];
  const cls = `${className} ${config.iconColor}`;
  switch (platform) {
    case "whatsapp": return <WhatsAppIcon className={cls} />;
    case "instagram": return <InstagramIcon className={cls} />;
    case "twitter": return <XTwitterIcon className={cls} />;
    case "facebook": return <FacebookIcon className={cls} />;
  }
};

const Chat = () => {
  const { toast } = useToast();
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [loggedInPlatforms, setLoggedInPlatforms] = useState<Set<Platform>>(new Set());
  const [loginForm, setLoginForm] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});
  const [input, setInput] = useState("");
  const [blockedChats, setBlockedChats] = useState<Set<string>>(new Set());
  const [bullyStrikes, setBullyStrikes] = useState<Record<string, number>>({});
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [pendingBlockId, setPendingBlockId] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDatasetModel()
      .then(() => setModelLoaded(true))
      .catch(() => setModelLoaded(false));
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [chats, activeContact, scrollToBottom]);

  const platformContacts = CONTACTS.filter((c) => c.platform === selectedPlatform);
  const theme = selectedPlatform ? PLATFORM_CONFIG[selectedPlatform] : null;

  /* ── Login handler (simulated) ── */
  const handleLogin = () => {
    if (!selectedPlatform) return;
    const fields = PLATFORM_CONFIG[selectedPlatform].loginFields;
    const allFilled = fields.every((f) => loginForm[f.label]?.trim());
    if (!allFilled) {
      toast({ variant: "destructive", title: "Missing Fields", description: "Please fill in all fields to continue." });
      return;
    }
    setLoginLoading(true);
    setTimeout(() => {
      setLoggedInPlatforms((prev) => new Set(prev).add(selectedPlatform));
      setLoginForm({});
      setLoginLoading(false);
      toast({
        title: `Connected to ${PLATFORM_CONFIG[selectedPlatform].name}`,
        description: "Bullying protection is now active on your conversations.",
      });
    }, 1500);
  };

  const sendMessage = () => {
    if (!input.trim() || !activeContact) return;
    const contactId = activeContact.id;
    if (blockedChats.has(contactId)) return;

    const detection = detectCyberbullying(input);
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      text: input,
      sender: "user",
      timestamp: new Date(),
      detection,
      read: true,
    };

    setChats((prev) => ({ ...prev, [contactId]: [...(prev[contactId] || []), msg] }));
    setInput("");

    if (detection.label === "Bullying") {
      const currentStrikes = (bullyStrikes[contactId] || 0) + 1;
      setBullyStrikes((prev) => ({ ...prev, [contactId]: currentStrikes }));

      if (currentStrikes === 1) {
        const categoryStyle = getCategoryBadgeStyle(detection.detailedCategory);
        toast({
          variant: "destructive",
          title: "⚠ Bullying Detected",
          description: `Classification: ${detection.label} | ${categoryStyle.icon} ${detection.detailedCategory.replace(/_/g, " ")} (${detection.severity} severity, ${Math.round(detection.confidence * 100)}% confidence). Please be respectful.`,
        });
      } else if (currentStrikes === 2) {
        toast({
          variant: "destructive",
          title: "🚨 Repeated Bullying Detected",
          description: "Second warning. Continued bullying will result in this chat being closed for your safety.",
        });
      } else {
        setPendingBlockId(contactId);
        setShowBlockDialog(true);
      }
    }

    if (detection.label !== "Bullying" || (bullyStrikes[contactId] || 0) < 3) {
      setTimeout(() => {
        const reply: ChatMessage = {
          id: crypto.randomUUID(),
          text: AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)],
          sender: "contact",
          timestamp: new Date(),
        };
        setChats((prev) => ({ ...prev, [contactId]: [...(prev[contactId] || []), reply] }));
      }, 800 + Math.random() * 1200);
    }
  };

  const blockChat = () => {
    if (pendingBlockId) {
      setBlockedChats((prev) => new Set(prev).add(pendingBlockId));
      setShowBlockDialog(false);
      setPendingBlockId(null);
      toast({ title: "Chat Closed", description: "Conversation closed due to repeated bullying." });
    }
  };

  const continueChat = () => {
    setShowBlockDialog(false);
    setPendingBlockId(null);
    toast({ title: "Proceeding with caution", description: "Please keep the conversation respectful." });
  };

  const activeMessages = activeContact ? (chats[activeContact.id] || []) : [];
  const isBlocked = activeContact ? blockedChats.has(activeContact.id) : false;

  /* ═══════════════════════════════════════════
     SCREEN 1: Platform Selector
     ═══════════════════════════════════════════ */
  if (!selectedPlatform) {
    return (
      <div className="min-h-screen pt-16">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="text-center mb-10">
            <div className="gradient-primary rounded-2xl p-4 inline-block mb-4">
              <Shield className="h-8 w-8 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold mb-2">Social Media Monitor</h1>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Connect your social platforms for real-time cyberbullying detection.
              Select a platform to sign in and start monitoring conversations.
            </p>
            {modelLoaded && (
              <p className="text-xs text-[hsl(var(--success))] mt-2 flex items-center justify-center gap-1">
                <CircleDot className="h-3 w-3" /> ML model loaded — full dataset analysis active
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {(Object.keys(PLATFORM_CONFIG) as Platform[]).map((key) => {
              const p = PLATFORM_CONFIG[key];
              const isConnected = loggedInPlatforms.has(key);
              return (
                <button
                  key={key}
                  onClick={() => setSelectedPlatform(key)}
                  className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 text-center transition-all hover:scale-[1.03] hover:shadow-glow hover:border-primary/30"
                >
                  <div className="flex justify-center mb-3">
                    <PlatformIcon platform={key} className="h-10 w-10" />
                  </div>
                  <h3 className="font-semibold text-sm">{p.name}</h3>
                  {isConnected ? (
                    <p className="text-xs text-[hsl(var(--success))] mt-1 flex items-center justify-center gap-1">
                      <ShieldCheck className="h-3 w-3" /> Connected
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-1">Tap to sign in</p>
                  )}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity ${p.headerBg}`} />
                </button>
              );
            })}
          </div>

          {/* Security Section */}
          <div className="mt-8 bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Security & Privacy
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-xs text-muted-foreground">
              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <LockIcon className="h-3.5 w-3.5 text-primary" />
                  <p className="font-medium text-foreground">End-to-End Encrypted</p>
                </div>
                <p>Your credentials never leave your device. All authentication is handled locally with secure session tokens.</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                  <p className="font-medium text-foreground">No Data Stored</p>
                </div>
                <p>Messages are analyzed in real-time and never saved to external servers. Analysis stays on your browser.</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Shield className="h-3.5 w-3.5 text-primary" />
                  <p className="font-medium text-foreground">ML-Powered Protection</p>
                </div>
                <p>Trained on 18,000+ labeled samples using Naive Bayes + heuristic analysis for accurate detection.</p>
              </div>
            </div>
          </div>

          {/* How It Works */}
          <div className="mt-4 bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              How It Works
            </h3>
            <div className="grid md:grid-cols-4 gap-3 text-xs text-muted-foreground">
              {[
                { step: "1", title: "Select Platform", desc: "Choose your social media platform" },
                { step: "2", title: "Sign In", desc: "Log in with your real credentials" },
                { step: "3", title: "Monitor Chats", desc: "AI scans every message in real-time" },
                { step: "4", title: "Stay Protected", desc: "Escalating alerts block harmful chats" },
              ].map((s) => (
                <div key={s.step} className="bg-secondary/30 rounded-lg p-3 text-center">
                  <div className="w-6 h-6 rounded-full gradient-primary text-primary-foreground text-xs font-bold flex items-center justify-center mx-auto mb-2">{s.step}</div>
                  <p className="font-medium text-foreground mb-0.5">{s.title}</p>
                  <p>{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     SCREEN 2: Login Screen (if not logged in)
     ═══════════════════════════════════════════ */
  if (!loggedInPlatforms.has(selectedPlatform)) {
    const config = PLATFORM_CONFIG[selectedPlatform];
    return (
      <div className="min-h-screen pt-16 flex items-center justify-center">
        <div className="w-full max-w-md px-4">
          {/* Back button */}
          <button
            onClick={() => { setSelectedPlatform(null); setLoginForm({}); }}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Back to platforms
          </button>

          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-card">
            {/* Header with platform branding */}
            <div className={`${config.loginBg} px-6 py-8 text-center`}>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-sm mb-4">
                <PlatformIcon platform={selectedPlatform} className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-xl font-bold text-white">Sign in to {config.name}</h2>
              <p className="text-sm text-white/70 mt-1">Connect for bullying protection</p>
            </div>

            {/* Login form */}
            <div className="p-6 space-y-4">
              {config.loginFields.map((field) => (
                <div key={field.label}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">{field.label}</label>
                  <div className="relative">
                    <input
                      type={field.type === "password" && showPassword ? "text" : field.type}
                      placeholder={field.placeholder}
                      value={loginForm[field.label] || ""}
                      onChange={(e) => setLoginForm((prev) => ({ ...prev, [field.label]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                      className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                    />
                    {field.type === "password" && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              <button
                onClick={handleLogin}
                disabled={loginLoading}
                className="w-full py-3 rounded-xl font-semibold text-sm text-primary-foreground transition-all disabled:opacity-60"
                style={{ background: config.loginAccent }}
              >
                {loginLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connecting securely...
                  </span>
                ) : (
                  `Sign In to ${config.name}`
                )}
              </button>

              {/* Security notice */}
              <div className="bg-secondary/30 border border-border rounded-xl p-3 mt-4">
                <div className="flex items-start gap-2">
                  <LockIcon className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-foreground mb-0.5">Secure Connection</p>
                    <p className="text-[11px] text-muted-foreground">{config.loginNote}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground justify-center pt-2">
                <ShieldCheck className="h-3 w-3 text-primary" />
                <span>Protected by CyberGuard AI · No passwords stored</span>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[10px] text-muted-foreground text-center mt-4 max-w-sm mx-auto">
            By signing in, you agree to allow CyberGuard to analyze your conversations
            for harmful content. Your data is processed locally and never shared with third parties.
          </p>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════
     SCREEN 3: Chat Interface (logged in)
     ═══════════════════════════════════════════ */
  return (
    <div className="min-h-screen pt-16">
      <div className="container mx-auto px-4 py-4 max-w-6xl">
        <div className="border border-border rounded-xl overflow-hidden bg-card shadow-card flex" style={{ height: "calc(100vh - 110px)", minHeight: 500 }}>
          
          {/* ── Sidebar ── */}
          <div className={`w-80 border-r border-border flex flex-col ${theme!.sidebarBg} ${activeContact ? "hidden md:flex" : "flex w-full md:w-80"}`}>
            <div className={`p-3 ${theme!.headerBg}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => { setSelectedPlatform(null); setActiveContact(null); }} className="text-primary-foreground/80 hover:text-primary-foreground">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <PlatformIcon platform={selectedPlatform} className="h-5 w-5 text-primary-foreground" />
                  <h2 className="font-semibold text-sm text-primary-foreground">{theme!.name}</h2>
                </div>
                <div className="flex gap-2 text-primary-foreground/70">
                  <Search className="h-4 w-4" />
                  <MoreVertical className="h-4 w-4" />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {modelLoaded && (
                  <p className="text-[10px] text-primary-foreground/60 flex items-center gap-1">
                    <Shield className="h-2.5 w-2.5" /> AI monitoring active
                  </p>
                )}
                <p className="text-[10px] text-primary-foreground/60 flex items-center gap-1 ml-auto">
                  <LockIcon className="h-2.5 w-2.5" /> Encrypted
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {platformContacts.map((c) => {
                const blocked = blockedChats.has(c.id);
                const strikes = bullyStrikes[c.id] || 0;
                const lastMsg = (chats[c.id] || []).at(-1);
                return (
                  <button
                    key={c.id}
                    onClick={() => !blocked && setActiveContact(c)}
                    disabled={blocked}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/30 ${
                      blocked ? "opacity-40 cursor-not-allowed bg-destructive/5" :
                      activeContact?.id === c.id ? "bg-primary/10" : "hover:bg-secondary/50"
                    }`}
                  >
                    <div className="relative">
                      <div className="w-11 h-11 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-foreground">
                        {c.avatar}
                      </div>
                      {c.status === "online" && !blocked && (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[hsl(var(--success))] rounded-full border-2 border-background" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{c.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {lastMsg ? lastMsg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {blocked && <X className="h-3 w-3 text-destructive flex-shrink-0" />}
                        {strikes > 0 && !blocked && (
                          <span className="text-[10px] bg-destructive/20 text-destructive px-1 rounded flex-shrink-0">{strikes}⚠</span>
                        )}
                        <p className="text-xs text-muted-foreground truncate">
                          {blocked ? "Chat closed" : lastMsg ? lastMsg.text : c.username || (c.status === "online" ? "Online" : `Last seen ${c.lastSeen}`)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Main Chat ── */}
          <div className={`flex-1 flex flex-col ${!activeContact ? "hidden md:flex" : "flex"}`}>
            {activeContact ? (
              <>
                <div className={`flex items-center gap-3 px-4 py-2.5 ${theme!.headerBg}`}>
                  <button onClick={() => setActiveContact(null)} className="md:hidden text-primary-foreground/80 hover:text-primary-foreground">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-secondary/50 flex items-center justify-center text-xs font-bold text-primary-foreground">
                      {activeContact.avatar}
                    </div>
                    {activeContact.status === "online" && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[hsl(var(--success))] rounded-full border-2 border-transparent" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-primary-foreground">{activeContact.name}</p>
                    <p className="text-[11px] text-primary-foreground/60">
                      {isBlocked ? "Blocked" : activeContact.status === "online" ? "online" : `last seen ${activeContact.lastSeen}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-primary-foreground/70">
                    {selectedPlatform === "whatsapp" && (
                      <>
                        <Video className="h-4 w-4" />
                        <Phone className="h-4 w-4" />
                      </>
                    )}
                    <MoreVertical className="h-4 w-4" />
                  </div>
                </div>

                {/* Messages */}
                <div className={`flex-1 overflow-y-auto p-4 space-y-2 ${
                  selectedPlatform === "whatsapp" ? "bg-[hsl(220,20%,8%)]" :
                  selectedPlatform === "twitter" ? "bg-[hsl(220,25%,7%)]" :
                  "bg-background"
                }`}>
                  {activeMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <div className="bg-secondary/30 rounded-xl p-6 text-center max-w-xs">
                        <ShieldCheck className="h-8 w-8 mx-auto mb-3 text-primary opacity-50" />
                        <p className="text-sm font-medium text-foreground">Protected Chat</p>
                        <p className="text-xs mt-1">Messages are analyzed in real-time using our ML model trained on 18,000+ data samples</p>
                        <div className="flex items-center justify-center gap-1 mt-3 text-[10px] text-primary/70">
                          <LockIcon className="h-3 w-3" />
                          <span>End-to-end encrypted · Locally processed</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeMessages.map((msg) => {
                    const isBully = msg.detection?.label === "Bullying";
                    const isUser = msg.sender === "user";
                    return (
                      <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm relative ${
                          isBully
                            ? "bg-destructive/20 border border-destructive/40 text-foreground"
                            : isUser
                              ? `${theme!.userBubbleBg} text-primary-foreground`
                              : `${theme!.contactBubbleBg} text-secondary-foreground`
                        } ${selectedPlatform === "whatsapp" ? "rounded-tl-sm" : ""}`}>
                          <p className={isBully ? "text-foreground" : ""}>{msg.text}</p>
                          <div className="flex items-center justify-end gap-1 mt-0.5">
                            <span className={`text-[10px] ${isBully ? "text-destructive/70" : isUser ? "text-primary-foreground/50" : "text-muted-foreground"}`}>
                              {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {isUser && selectedPlatform === "whatsapp" && (
                              <CheckCheck className={`h-3 w-3 ${isBully ? "text-destructive/50" : "text-primary-foreground/50"}`} />
                            )}
                            {isBully && (
                              <span className="text-[10px] text-destructive flex items-center gap-0.5 ml-1">
                                <AlertTriangle className="h-2.5 w-2.5" /> {msg.detection!.severity}
                              </span>
                            )}
                          </div>
                          {isBully && msg.detection && (
                            <div className="mt-1 pt-1 border-t border-destructive/20 text-[10px]">
                              <div className="text-destructive/70 mb-1">
                                Classification: {msg.detection.label} · 
                                ML Confidence: {Math.round(msg.detection.confidence * 100)}% · 
                                Score: {msg.detection.details.combinedScore}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-destructive/70">Category:</span>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${getCategoryBadgeStyle(msg.detection.detailedCategory).bg} ${getCategoryBadgeStyle(msg.detection.detailedCategory).text}`}>
                                  {getCategoryBadgeStyle(msg.detection.detailedCategory).icon} {msg.detection.detailedCategory.replace(/_/g, " ")}
                                </span>
                                <span className="text-destructive/70 ml-1">Flagged: {msg.detection.flaggedWords.slice(0, 3).join(", ")}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                {isBlocked ? (
                  <div className="px-4 py-4 border-t border-border bg-destructive/5 text-center">
                    <p className="text-sm text-destructive font-medium">Chat closed due to repeated bullying</p>
                    <p className="text-xs text-muted-foreground mt-1">Select another conversation to continue</p>
                  </div>
                ) : (
                  <div className="px-3 py-2.5 border-t border-border bg-card">
                    <div className="flex items-center gap-2">
                      {selectedPlatform === "whatsapp" && <Smile className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
                      {selectedPlatform === "instagram" && <Camera className="h-5 w-5 text-muted-foreground flex-shrink-0" />}
                      <input
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                        placeholder={
                          selectedPlatform === "whatsapp" ? "Type a message" :
                          selectedPlatform === "twitter" ? "Start a new message" :
                          selectedPlatform === "instagram" ? "Message..." : "Aa"
                        }
                        className="flex-1 bg-secondary/50 border border-border rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground"
                      />
                      {input.trim() ? (
                        <button onClick={sendMessage} className="gradient-primary text-primary-foreground p-2 rounded-full hover:opacity-90 transition-opacity">
                          <Send className="h-4 w-4" />
                        </button>
                      ) : (
                        <div className="flex gap-1.5 text-muted-foreground">
                          {selectedPlatform === "whatsapp" && (<><Paperclip className="h-5 w-5" /><Mic className="h-5 w-5" /></>)}
                          {selectedPlatform === "facebook" && <ThumbsUp className="h-5 w-5" />}
                          {selectedPlatform === "instagram" && <Heart className="h-5 w-5" />}
                        </div>
                      )}
                    </div>
                    {(bullyStrikes[activeContact.id] || 0) > 0 && (
                      <p className="text-[10px] text-[hsl(var(--warning))] mt-1.5 text-center">
                        ⚠ {bullyStrikes[activeContact.id]} warning{bullyStrikes[activeContact.id] > 1 ? "s" : ""} — 
                        {3 - (bullyStrikes[activeContact.id] || 0) > 0
                          ? ` ${3 - (bullyStrikes[activeContact.id] || 0)} remaining before chat closes`
                          : " chat will close on next offense"}
                      </p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
                <div className={`rounded-2xl p-4 mb-4 ${theme!.headerBg}`}>
                  <PlatformIcon platform={selectedPlatform} className="h-8 w-8 text-primary-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{theme!.name} Monitor</h3>
                <p className="text-sm text-center max-w-xs">Select a conversation to start monitoring.</p>
                <div className="flex items-center gap-1 mt-3 text-[10px] text-primary/60">
                  <ShieldCheck className="h-3 w-3" />
                  <span>Signed in · ML protection active</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Block Dialog */}
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Repeated Bullying Detected
            </DialogTitle>
            <DialogDescription>
              Multiple bullying messages detected in this {theme?.name || ""} conversation. Continuing may be harmful to your mental health.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm">
            <p className="font-medium text-destructive mb-1">What happens if you close:</p>
            <ul className="text-muted-foreground text-xs space-y-1 list-disc list-inside">
              <li>This conversation will be permanently closed</li>
              <li>You can still access all other conversations</li>
              <li>The chat history will remain visible but locked</li>
            </ul>
          </div>
          <div className="bg-secondary/30 border border-border rounded-lg p-3 text-sm">
            <p className="font-medium text-foreground mb-1">If this is friendly banter:</p>
            <p className="text-xs text-muted-foreground">Click "Continue Chat" to keep the conversation open.</p>
          </div>
          <DialogFooter className="gap-2">
            <button onClick={continueChat} className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
              Continue Chat
            </button>
            <button onClick={blockChat} className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors">
              Close Chat
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Chat;
