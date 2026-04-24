import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, RefreshCw, Download, Sun, Moon, ChevronDown, ChevronUp, BarChart2, Activity, AlertTriangle, CheckCircle, Zap } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
  }
  render() {
    if (this.state.hasError) return (
      <div style={{ padding: '2rem', background: '#111', color: '#ff4444', minHeight: '100vh', fontFamily: 'monospace' }}>
        <h2>UI Error</h2>
        <pre>{this.state.error?.toString()}</pre>
      </div>
    );
    return this.props.children;
  }
}

const themes = {
  light: {
    name: 'light',
    bg: '#f8fafc',
    panel: 'rgba(255, 255, 255, 0.7)',
    text: '#0f172a',
    muted: '#64748b',
    border: 'rgba(255, 255, 255, 0.8)',
    accent: '#6366f1',
    accentLight: 'rgba(99, 102, 241, 0.1)',
    danger: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    inputBg: 'rgba(255, 255, 255, 0.9)',
    shadow: '0 8px 32px rgba(0,0,0,0.04)',
    hoverShadow: '0 12px 48px rgba(0,0,0,0.08)',
    glass: 'blur(20px) saturate(180%)',
    gradientBg: 'radial-gradient(circle at 15% 50%, rgba(99,102,241,0.08), transparent 25%), radial-gradient(circle at 85% 30%, rgba(56,189,248,0.08), transparent 25%)'
  },
  dark: {
    name: 'dark',
    bg: '#050505',
    panel: 'rgba(20, 20, 22, 0.6)',
    text: '#f8fafc',
    muted: '#94a3b8',
    border: 'rgba(255, 255, 255, 0.08)',
    accent: '#818cf8',
    accentLight: 'rgba(129, 140, 248, 0.1)',
    danger: '#f87171',
    warning: '#fbbf24',
    success: '#34d399',
    inputBg: 'rgba(255, 255, 255, 0.03)',
    shadow: '0 8px 32px rgba(0,0,0,0.4)',
    hoverShadow: '0 12px 48px rgba(0,0,0,0.6)',
    glass: 'blur(20px) saturate(180%)',
    gradientBg: 'radial-gradient(circle at 15% 50%, rgba(99,102,241,0.12), transparent 25%), radial-gradient(circle at 85% 30%, rgba(139,92,246,0.12), transparent 25%)'
  }
};

const STEPS = ['Scraping Google Play Store…', 'Scraping Apple App Store…', 'Fetching Reddit discussions…', 'Running AI analysis…'];

const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
const itemVariants = { hidden: { opacity: 0, y: 15 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 350, damping: 25 } } };

const ThemeToggle = ({ themeName, toggleTheme, T }) => (
  <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={toggleTheme} style={{ background: T.panel, border: `1px solid ${T.border}`, color: T.text, padding: '0.6rem', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: T.glass, boxShadow: T.shadow }}>
    {themeName === 'light' ? <Moon size={18} /> : <Sun size={18} />}
  </motion.button>
);

const AnimatedNumber = ({ value }) => {
  const count = useMotionValue(0);
  const rounded = useTransform(count, Math.round);
  useEffect(() => { const animation = animate(count, value, { duration: 1.5, ease: "circOut" }); return animation.stop; }, [value, count]);
  return <motion.span>{rounded}</motion.span>;
};

function AppContent() {
  const [themeName, setThemeName] = useState(() => localStorage.getItem('theme') || 'dark');
  const T = themes[themeName];

  useEffect(() => {
    localStorage.setItem('theme', themeName);
    document.body.style.backgroundColor = T.bg;
    document.body.style.color = T.text;
  }, [themeName, T]);

  const toggleTheme = () => setThemeName(t => t === 'light' ? 'dark' : 'light');

  const [form, setForm] = useState({ appName: '', days: 30, isCustom: false });
  const [status, setStatus] = useState('idle');
  const [step, setStep] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [expandedIssue, setExpandedIssue] = useState(0);
  const [isPrinting, setIsPrinting] = useState(false);
  
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const wrap = { minHeight: '100vh', width: '100%', background: T.bg, backgroundImage: T.gradientBg, color: T.text, fontFamily: 'Inter, system-ui, sans-serif', transition: 'background-color 0.4s ease', position: 'relative', overflowX: 'hidden' };
  const panelStyle = { background: T.panel, border: `1px solid ${T.border}`, borderRadius: '1.25rem', boxShadow: T.shadow, backdropFilter: T.glass, transition: 'all 0.3s ease' };
  const inputStyle = { width: '100%', padding: '0.85rem 1rem', background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: '0.85rem', color: T.text, fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', transition: 'all 0.2s ease', backdropFilter: T.glass };

  useEffect(() => {
    const handleClickOutside = (e) => { if (suggestionRef.current && !suggestionRef.current.contains(e.target)) setShowSuggestions(false); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (form.appName.length < 2) return setSuggestions([]);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(form.appName)}`);
        setSuggestions(await res.json());
      } catch (e) { setSuggestions([]); }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [form.appName]);

  const run = async (e) => {
    e.preventDefault();
    setShowSuggestions(false);
    setStatus('loading'); setError(''); setStep(0);
    const timer = setInterval(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 4000);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appName: form.appName, days: form.days }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Server error');
      setData(json); setStatus('done'); setExpandedIssue(0);
    } catch (err) { setError(err.message); setStatus('error'); } 
    finally { clearInterval(timer); }
  };

  const NavBar = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 2rem', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
      <div style={{ fontWeight: 800, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: T.text, letterSpacing: '-0.5px' }}>
        <div style={{ background: `linear-gradient(135deg, ${T.accent}, #3b82f6)`, color: '#fff', padding: '0.4rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 12px ${T.accent}40` }}><Search size={16} strokeWidth={3} /></div>
        feedback.ai
      </div>
      <ThemeToggle themeName={themeName} toggleTheme={toggleTheme} T={T} />
    </div>
  );

  // ── IDLE / ERROR ──
  if (status === 'idle' || status === 'error') return (
    <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', paddingTop: '6rem' }}>
      <NavBar />
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1, type: 'spring', stiffness: 300, damping: 24 }} style={{ width: '100%', maxWidth: '700px', padding: '2.5rem 2rem', textAlign: 'center' }}>
        
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, delay: 0.2 }} style={{ display: 'inline-block', marginBottom: '1.5rem', padding: '0.4rem 1rem', borderRadius: '2rem', background: T.accentLight, border: `1px solid ${T.accent}30`, color: T.accent, fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.5px' }}>
          ✨ AI-POWERED INTELLIGENCE
        </motion.div>

        <h1 style={{ fontSize: '4rem', fontWeight: 800, color: T.text, marginBottom: '1rem', letterSpacing: '-1.5px', lineHeight: 1.1 }}>
          Analyze feedback in <br />
          <span className="text-gradient">Seconds.</span>
        </h1>
        <p style={{ color: T.muted, fontSize: '1.15rem', marginBottom: '3rem', maxWidth: '500px', margin: '0 auto 3rem auto', lineHeight: 1.6 }}>
          Gather, analyze, and extract actionable insights from App Stores and Reddit instantly using advanced AI models.
        </p>

        <form onSubmit={run} style={{ ...panelStyle, display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '450px', margin: '0 auto', padding: '2.5rem', textAlign: 'left' }} className="glass-card">
          <div style={{ position: 'relative' }} ref={suggestionRef}>
            <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.85rem', color: T.text, fontWeight: 600 }}>Product Name</label>
            <input 
              className="interactive-input" 
              style={inputStyle} 
              placeholder="e.g., Spotify, Notion, Instagram" 
              value={form.appName} 
              onChange={e => { set('appName', e.target.value); setShowSuggestions(true); }}
              onFocus={() => { if(suggestions.length) setShowSuggestions(true); }}
              required 
            />
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.ul
                  initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: T.panel, border: `1px solid ${T.border}`, borderRadius: '0.85rem', boxShadow: T.hoverShadow, backdropFilter: T.glass, marginTop: '0.5rem', padding: '0.5rem', zIndex: 20, listStyle: 'none', maxHeight: '220px', overflowY: 'auto' }}
                >
                  {suggestions.map((s, i) => (
                    <li 
                      key={i}
                      onClick={() => { set('appName', s.title); setShowSuggestions(false); }}
                      style={{ padding: '0.6rem 1rem', cursor: 'pointer', color: T.text, fontSize: '0.9rem', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '0.75rem', borderRadius: '0.5rem' }}
                      onMouseOver={(e) => e.currentTarget.style.background = T.accentLight}
                      onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {s.icon ? <img src={s.icon} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} /> : <div style={{ width: 28, height: 28, borderRadius: 6, background: T.border }} />}
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>{s.title}</span>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.6rem', fontSize: '0.85rem', color: T.text, fontWeight: 600 }}>Lookback Period</label>
            <select className="interactive-input" style={inputStyle} value={form.isCustom ? 'custom' : form.days} onChange={e => {
              if (e.target.value === 'custom') setForm(f => ({ ...f, isCustom: true, days: 30 }));
              else setForm(f => ({ ...f, isCustom: false, days: Number(e.target.value) }));
            }}>
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
              <option value="custom">Custom...</option>
            </select>
            <AnimatePresence>
              {form.isCustom && (
                <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: '0.75rem' }} exit={{ opacity: 0, height: 0, marginTop: 0 }} style={{ overflow: 'hidden' }}>
                  <input type="number" min="1" max="100" className="interactive-input" style={inputStyle} placeholder="Max 100 days" value={form.days} onChange={e => { let val = e.target.value; if (Number(val) > 100) val = '100'; set('days', val === '' ? '' : Number(val)); }} required />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {status === 'error' && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ background: `${T.danger}15`, border: `1px solid ${T.danger}40`, borderRadius: '0.75rem', padding: '1rem', fontSize: '0.85rem', color: T.danger, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} /> {error}
            </motion.div>
          )}

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" className="glowing-btn" style={{ width: '100%', color: '#fff', border: 'none', padding: '1rem', borderRadius: '0.85rem', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <Zap size={18} /> Generate Insights
          </motion.button>
        </form>
      </motion.div>
      <style>{`
        *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,sans-serif;} select option{background:${T.bg}; color: ${T.text}}
        .glass-card { transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), box-shadow 0.4s ease; }
        .glass-card:hover { transform: translateY(-4px); box-shadow: ${T.hoverShadow}; border-color: ${T.accent}50; }
        .interactive-input:focus { border-color: ${T.accent} !important; box-shadow: 0 0 0 4px ${T.accentLight}; }
        .text-gradient { background: linear-gradient(135deg, ${T.accent}, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .glowing-btn { background: linear-gradient(135deg, ${T.accent}, #4f46e5); box-shadow: 0 8px 24px ${T.accent}50; transition: all 0.3s ease; }
        .glowing-btn:hover { box-shadow: 0 12px 32px ${T.accent}80; }
        ::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
      `}</style>
    </div>
  );

  // ── LOADING ──
  if (status === 'loading') return (
    <div style={{ ...wrap, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <NavBar />
      <div style={{ ...panelStyle, width: '100%', maxWidth: '400px', padding: '3rem 2rem', textAlign: 'center' }} className="glass-card">
        <div style={{ position: 'relative', width: 64, height: 64, margin: '0 auto 1.5rem auto' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `${T.accent}20`, animation: 'pulse 2s infinite' }} />
          <Loader2 size={64} color={T.accent} style={{ animation: 'spin 1.5s linear infinite', position: 'relative', zIndex: 1 }} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem', color: T.text, letterSpacing: '-0.5px' }}>Analyzing {form.appName}</h2>
        <motion.p key={step} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ color: T.muted, fontSize: '0.9rem', minHeight: '1.5rem' }}>{STEPS[step]}</motion.p>
        <div style={{ marginTop: '2rem', height: 4, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
          <motion.div initial={{ width: 0 }} animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }} transition={{ duration: 3.5, ease: "easeInOut" }} style={{ height: '100%', background: `linear-gradient(90deg, ${T.accent}, #3b82f6)`, borderRadius: 2 }} />
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%{transform:scale(1);opacity:1}50%{transform:scale(1.2);opacity:0}100%{transform:scale(1);opacity:0}} *{box-sizing:border-box} body{margin:0}`}</style>
    </div>
  );

  // ── DASHBOARD ──
  const safeData = data || {};
  const { topIssues = [], categoryBreakdown = {}, sources = {}, totalReviews = 0, sentimentPercent = 0, overallSentiment = 'Neutral', executiveSummary = '', trends = {}, recommendations = {} } = safeData;
  const safeTopIssues = Array.isArray(topIssues) ? topIssues : [];
  const catData = Object.entries(categoryBreakdown || {}).filter(([, v]) => v > 0).map(([name, count]) => ({ name: name.split('/')[0], count }));
  const sentColor = sentimentPercent >= 60 ? T.success : sentimentPercent >= 40 ? T.warning : T.danger;

  const downloadPDF = () => {
    setIsPrinting(true);
    setTimeout(() => {
      const element = document.getElementById('pdf-report');
      if (!element) return setIsPrinting(false);
      html2pdf().set({ 
        margin: 0.5, 
        filename: `${form.appName}-insights-report.pdf`, 
        image: { type: 'jpeg', quality: 1 }, 
        html2canvas: { scale: 2, useCORS: true, letterRendering: true }, 
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' } 
      }).from(element).save().then(() => setIsPrinting(false));
    }, 500);
  };

  const getCatColor = (cat) => {
    if (cat.includes('Bug') || cat.includes('Crash')) return T.danger;
    if (cat.includes('UI')) return T.accent;
    if (cat.includes('Performance')) return T.warning;
    return '#3b82f6';
  };

  return (
    <motion.div initial="hidden" animate="show" variants={containerVariants} style={{ ...wrap, padding: '2rem 1rem', paddingTop: '6rem' }}>
      <NavBar />
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: isPrinting ? 'none' : 'block' }}>
          <motion.div variants={itemVariants} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: '1rem', letterSpacing: '-1px', margin: '0 0 0.5rem 0' }}>
              {form.appName}
            </h1>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: T.accent, background: T.accentLight, padding: '0.4rem 1rem', borderRadius: '2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Activity size={14}/> AI Insights Report</span>
              <span style={{ color: T.muted, fontSize: '0.9rem', fontWeight: 500 }}>
                Based on <AnimatedNumber value={totalReviews} /> real reviews (Last {form.days} days)
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.5rem' }}>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={downloadPDF} className="glass-btn" style={{ background: T.panel, color: T.text, border: `1px solid ${T.border}`, padding: '0.75rem 1.25rem', borderRadius: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600, backdropFilter: T.glass, boxShadow: T.shadow }}>
              <Download size={16} /> Export PDF
            </motion.button>
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setStatus('idle')} className="glass-btn" style={{ background: T.panel, color: T.text, border: `1px solid ${T.border}`, padding: '0.75rem 1.25rem', borderRadius: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', fontWeight: 600, backdropFilter: T.glass, boxShadow: T.shadow }}>
              <RefreshCw size={16} /> New Search
            </motion.button>
          </div>
        </motion.div>

        <div id="dashboard-content">
          {/* Summary */}
          {executiveSummary && (
            <motion.div variants={itemVariants} style={{ ...panelStyle, padding: '2rem', marginBottom: '2rem', position: 'relative', overflow: 'hidden' }} className="glass-card">
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: `linear-gradient(90deg, ${T.accent}, #3b82f6)` }} />
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
                <div style={{ background: T.accentLight, padding: '1rem', borderRadius: '1rem', color: T.accent }}><CheckCircle size={28} /></div>
                <div>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: T.text, fontWeight: 700 }}>Executive Summary</h3>
                  <p style={{ fontSize: '1rem', color: T.muted, lineHeight: 1.6, margin: 0 }}>{executiveSummary}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Stat cards */}
          <motion.div variants={containerVariants} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {[
              { label: 'Overall Sentiment', value: <><AnimatedNumber value={sentimentPercent} />%</>, sub: overallSentiment, color: sentColor },
              { label: 'Review Volume', value: <AnimatedNumber value={totalReviews} />, sub: `Play: ${sources.playStore||0} · App: ${sources.appStore||0} · Web: ${sources.reddit||0}`, color: T.accent },
              { label: 'Critical Issues', value: <AnimatedNumber value={safeTopIssues.length} />, sub: 'Action Required', color: T.warning },
            ].map((s, i) => (
              <motion.div variants={itemVariants} key={i} whileHover={{ y: -8, scale: 1.02 }} style={{ ...panelStyle, padding: '1.75rem', position: 'relative', overflow: 'hidden' }} className="glass-card stat-card">
                <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '100px', height: '100px', background: `${s.color}15`, borderRadius: '50%', filter: 'blur(20px)' }} />
                <div style={{ fontSize: '0.8rem', color: T.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', position: 'relative' }}>{s.label}</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: s.color, letterSpacing: '-1px', position: 'relative' }}>{s.value}</div>
                <div style={{ fontSize: '0.9rem', color: T.muted, marginTop: '0.25rem', fontWeight: 500, position: 'relative' }}>{s.sub}</div>
              </motion.div>
            ))}
          </motion.div>

          {/* Main Content Grid */}
          <motion.div variants={containerVariants} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            
            {/* Top Priority Issues */}
            <motion.div variants={itemVariants} style={{ ...panelStyle, padding: '2rem' }} className="glass-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <AlertTriangle size={20} color={T.danger} />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: T.text, margin: 0 }}>Top Priority Issues</h2>
              </div>
              
              {safeTopIssues.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: T.muted }}><CheckCircle size={40} style={{ opacity: 0.2, marginBottom: '1rem' }} /><p>No critical issues detected.</p></div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {safeTopIssues.slice(0, 5).map((iss, i) => {
                    const color = getCatColor(iss?.category || '');
                    const isExpanded = expandedIssue === i;
                    return (
                      <div key={i} style={{ background: isExpanded ? T.inputBg : 'transparent', border: `1px solid ${isExpanded ? color + '40' : T.border}`, borderRadius: '1rem', overflow: 'hidden', transition: 'all 0.3s ease' }}>
                        <div onClick={() => setExpandedIssue(isExpanded ? null : i)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', cursor: 'pointer' }} className="accordion-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${color}15`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700 }}>{i + 1}</div>
                            <span style={{ fontWeight: 600, color: isExpanded ? T.text : T.muted, fontSize: '0.95rem', transition: 'color 0.2s' }}>{iss?.title || 'Unknown Issue'}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.75rem', background: `${color}15`, color, padding: '0.3rem 0.75rem', borderRadius: '2rem', fontWeight: 700 }}>Score {iss?.priorityScore || '?'}</span>
                            {isExpanded ? <ChevronUp size={16} color={T.muted} /> : <ChevronDown size={16} color={T.muted} />}
                          </div>
                        </div>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
                              <div style={{ padding: '0 1.25rem 1.25rem 1.25rem' }}>
                                <p style={{ fontSize: '0.95rem', color: T.text, margin: '0.5rem 0 1rem 0', lineHeight: 1.6 }}>{iss?.description || 'No description provided.'}</p>
                                {(Array.isArray(iss?.quotes) ? iss.quotes : []).slice(0, 2).map((q, j) => (
                                  <div key={j} style={{ borderLeft: `3px solid ${color}50`, background: `${color}05`, padding: '0.85rem 1.25rem', borderRadius: '0 0.75rem 0.75rem 0', fontSize: '0.9rem', fontStyle: 'italic', color: T.muted, marginBottom: '0.5rem' }}>"{q}"</div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Charts & Trends */}
            <motion.div variants={containerVariants} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {catData.length > 0 && (
                <motion.div variants={itemVariants} style={{ ...panelStyle, padding: '2rem' }} className="glass-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <BarChart2 size={20} color={T.accent} />
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: T.text, margin: 0 }}>Category Breakdown</h2>
                  </div>
                  <div style={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={catData} layout="vertical" margin={{ left: -10, right: 20 }}>
                        <defs>
                          <linearGradient id="colorAccent" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={T.accent} stopOpacity={0.7}/>
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={1}/>
                          </linearGradient>
                        </defs>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: T.muted, fontSize: 13, fontWeight: 500 }} width={120} />
                        <Tooltip cursor={{ fill: `${T.accent}10`, radius: 6 }} contentStyle={{ background: T.panel, border: `1px solid ${T.border}`, borderRadius: '12px', boxShadow: T.hoverShadow, fontWeight: 600, color: T.text, backdropFilter: T.glass }} itemStyle={{ color: T.text, fontWeight: 800 }} />
                        <Bar dataKey="count" fill="url(#colorAccent)" radius={[0, 8, 8, 0]} barSize={24} animationDuration={1500} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </motion.div>
              )}

              {((Array.isArray(trends?.worsening) && trends.worsening.length > 0) || (Array.isArray(trends?.improving) && trends.improving.length > 0)) && (
                <motion.div variants={itemVariants} style={{ ...panelStyle, padding: '2rem' }} className="glass-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                    <Activity size={20} color={T.success} />
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: T.text, margin: 0 }}>Trend Signals</h2>
                  </div>
                  {[['Worsening', Array.isArray(trends?.worsening) ? trends.worsening : [], T.danger], ['Improving', Array.isArray(trends?.improving) ? trends.improving : [], T.success]].map(([label, items, color]) =>
                    items.length > 0 && (
                      <div key={label} style={{ marginBottom: '1.5rem' }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 700, color, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} /> {label}
                        </div>
                        {items.map((t, i) => <div key={i} style={{ fontSize: '0.95rem', color: T.text, padding: '0.5rem 1rem', background: `${color}08`, borderRadius: '0.5rem', marginBottom: '0.5rem', fontWeight: 500, border: `1px solid ${color}15` }}>{t}</div>)}
                      </div>
                    )
                  )}
                </motion.div>
              )}
            </motion.div>
          </motion.div>

          {/* Recommendations */}
          <motion.div variants={itemVariants} style={{ ...panelStyle, padding: '2rem', marginBottom: '2rem' }} className="glass-card">
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.5rem', color: T.text, letterSpacing: '-0.5px' }}>Strategic Recommendations</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '1.5rem' }}>
              {[
                { title: 'Immediate Action', items: Array.isArray(recommendations?.immediate) ? recommendations.immediate : [], color: T.danger },
                { title: 'Short Term', items: Array.isArray(recommendations?.midTerm) ? recommendations.midTerm : [], color: T.warning },
                { title: 'Long Term', items: Array.isArray(recommendations?.lowPriority) ? recommendations.lowPriority : [], color: T.success },
              ].map((rec, i) => (
                <div key={i} style={{ background: `${rec.color}05`, padding: '1.5rem', borderRadius: '1rem', border: `1px solid ${rec.color}20` }}>
                  <h3 style={{ color: rec.color, fontWeight: 700, fontSize: '0.85rem', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: rec.color }}/> {rec.title}</h3>
                  {rec.items.length === 0
                    ? <p style={{ color: T.muted, fontSize: '0.9rem', margin: 0 }}>No items flagged.</p>
                    : <ul style={{ margin: 0, paddingLeft: '1.2rem', color: T.text, fontSize: '0.95rem', lineHeight: 1.6 }}>
                        {rec.items.map((item, j) => <li key={j} style={{ marginBottom: '0.75rem' }}>{item}</li>)}
                      </ul>
                  }
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
      </div> {/* End of display block wrapper */}

      {/* Generating PDF Overlay */}
      <AnimatePresence>
        {isPrinting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'fixed', inset: 0, background: T.bg, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={48} color={T.accent} style={{ animation: 'spin 1.5s linear infinite', marginBottom: '1rem' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: T.text }}>Generating PDF Report...</h2>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PDF REPORT TEMPLATE */}
      <div id="pdf-report" style={{ display: isPrinting ? 'block' : 'none', width: '800px', background: '#ffffff', color: '#000000', padding: '40px', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ borderBottom: '2px solid #2563eb', paddingBottom: '20px', marginBottom: '30px' }}>
          <h1 style={{ margin: '0 0 10px 0', fontSize: '32px', color: '#1e3a8a' }}>{form.appName}</h1>
          <p style={{ margin: 0, fontSize: '14px', color: '#475569', fontWeight: 'bold' }}>AI-Powered Product Intelligence Report</p>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#64748b' }}>Analyzed {totalReviews} reviews over the last {form.days} days. (Generated on {new Date().toLocaleDateString()})</p>
        </div>

        {/* Executive Summary */}
        <div style={{ marginBottom: '30px', pageBreakInside: 'avoid' }}>
          <h2 style={{ fontSize: '18px', color: '#1e40af', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '15px' }}>Executive Summary</h2>
          <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#334155', margin: 0 }}>{executiveSummary}</p>
        </div>

        {/* Key Metrics */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '30px', pageBreakInside: 'avoid' }}>
          {[
            { label: 'Overall Sentiment', value: `${sentimentPercent}%`, sub: overallSentiment },
            { label: 'Total Volume', value: totalReviews, sub: 'Reviews Analyzed' },
            { label: 'Critical Issues', value: safeTopIssues.length, sub: 'Action Required' }
          ].map((m, i) => (
            <div key={i} style={{ flex: 1, padding: '15px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748b', fontWeight: 'bold', marginBottom: '5px' }}>{m.label}</div>
              <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#0f172a' }}>{m.value}</div>
              <div style={{ fontSize: '12px', color: '#475569', marginTop: '5px' }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Top Priority Issues */}
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '18px', color: '#1e40af', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '15px' }}>Top Priority Issues</h2>
          {safeTopIssues.length === 0 ? <p style={{ fontSize: '14px', color: '#64748b' }}>No critical issues detected.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {safeTopIssues.slice(0, 5).map((iss, i) => (
                <div key={i} style={{ borderLeft: '4px solid #ef4444', paddingLeft: '15px', pageBreakInside: 'avoid' }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#0f172a' }}>{i + 1}. {iss?.title} <span style={{ fontSize: '12px', fontWeight: 'normal', background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '12px', marginLeft: '10px' }}>Priority: {iss?.priorityScore}/10</span></h3>
                  <p style={{ fontSize: '14px', lineHeight: '1.5', color: '#334155', margin: '0 0 10px 0' }}>{iss?.description}</p>
                  <div style={{ background: '#f8fafc', padding: '10px 15px', borderLeft: '2px solid #cbd5e1' }}>
                    <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: '5px' }}>User Quotes:</div>
                    {(Array.isArray(iss?.quotes) ? iss.quotes : []).slice(0, 2).map((q, j) => (
                      <div key={j} style={{ fontSize: '13px', fontStyle: 'italic', color: '#475569', marginBottom: '4px' }}>"{q}"</div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Breakdown & Trends */}
        <div style={{ display: 'flex', gap: '30px', marginBottom: '30px', pageBreakInside: 'avoid' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '18px', color: '#1e40af', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '15px' }}>Category Breakdown</h2>
            <ul style={{ margin: 0, paddingLeft: '20px', color: '#334155', fontSize: '14px', lineHeight: '1.8' }}>
              {catData.map((c, i) => <li key={i}><strong>{c.name}:</strong> {c.count} mentions</li>)}
            </ul>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '18px', color: '#1e40af', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '15px' }}>Trend Signals</h2>
            {[['Worsening', Array.isArray(trends?.worsening) ? trends.worsening : [], '#ef4444'], ['Improving', Array.isArray(trends?.improving) ? trends.improving : [], '#10b981']].map(([label, items, color]) =>
              items.length > 0 && (
                <div key={label} style={{ marginBottom: '15px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', color, textTransform: 'uppercase', marginBottom: '5px' }}>{label}</div>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#334155', fontSize: '14px', lineHeight: '1.6' }}>
                    {items.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              )
            )}
          </div>
        </div>

        {/* Strategic Recommendations */}
        <div style={{ pageBreakInside: 'avoid' }}>
          <h2 style={{ fontSize: '18px', color: '#1e40af', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '15px' }}>Strategic Recommendations</h2>
          <div style={{ display: 'flex', gap: '20px' }}>
            {[
              { title: 'Immediate Action', items: Array.isArray(recommendations?.immediate) ? recommendations.immediate : [] },
              { title: 'Short Term', items: Array.isArray(recommendations?.midTerm) ? recommendations.midTerm : [] },
              { title: 'Long Term', items: Array.isArray(recommendations?.lowPriority) ? recommendations.lowPriority : [] }
            ].map((rec, i) => (
              <div key={i} style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', padding: '15px', borderRadius: '8px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#0f172a' }}>{rec.title}</h3>
                {rec.items.length === 0 ? <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>No items flagged.</p> : (
                  <ul style={{ margin: 0, paddingLeft: '20px', color: '#334155', fontSize: '13px', lineHeight: '1.5' }}>
                    {rec.items.map((item, j) => <li key={j} style={{ marginBottom: '5px' }}>{item}</li>)}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </div>
        
      </div>

      <style>{`
        *{box-sizing:border-box} body{margin:0;font-family:Inter,system-ui,sans-serif;} select option{background:${T.panel}; color: ${T.text}}
        .glass-card { transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .glass-card:hover { transform: translateY(-4px); box-shadow: ${T.hoverShadow}; border-color: ${T.border}; }
        .stat-card:hover { border-color: ${T.accent}50; }
        .accordion-header:hover span { color: ${T.text} !important; }
        .interactive-input:focus { border-color: ${T.accent} !important; box-shadow: 0 0 0 4px ${T.accentLight}; }
        .text-gradient { background: linear-gradient(135deg, ${T.accent}, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .glass-btn:hover { background: ${T.inputBg} !important; }
        ::-webkit-scrollbar { width: 8px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
      `}</style>
    </motion.div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
