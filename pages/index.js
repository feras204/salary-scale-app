import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Home, Settings, Grid, Users, Calculator, TrendingUp, FileText, Award,
  ChevronLeft, ChevronRight, Plus, Trash2, RotateCcw, Info, Check,
  Building2, Wallet, BarChart3, Target, Sparkles, Menu, X, UserPlus,
  Printer, FileDown, Bell, GitCompare, Moon, Sun, Search, Edit2,
  ArrowUpRight, AlertTriangle, ClipboardList, BookOpen, Briefcase, Clock, AlertCircle
} from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const STORAGE_KEY = 'salary_scale_v2';

const DEFAULT_DATA = {
  company: { name: 'شركة المثال', year: 2026, currency: 'ر.س' },
  ui: { darkMode: false, onboarded: false },
  structure: { numGrades: 12, numSteps: 10, baseStartingSalary: 4500, gradeDifferential: 0.18, stepDifferential: 0.025 },
  allowances: { housing: 0.25, transport: 0.10, minTransport: 300, hardship: 0.15, communication: 0.05 },
  obligations: { gosi: 0.1175, medical: 0.04, eosb: 0.0833 },
  benefits: { leaveInitial: 21, leaveAfter5: 30, educationStartGrade: 7, educationAmount: 15000, bonusStartGrade: 6 },
  merit: { exceptional: 0.06, exceeds: 0.045, meets: 0.03, needsImprovement: 0.01, unsatisfactory: 0 },
  grades: [
    { id: 1, nameAr: 'مساعد إداري', nameEn: 'Administrative Assistant', family: 'الدعم الإداري', experience: 0, hasHardship: false },
    { id: 2, nameAr: 'موظف', nameEn: 'Officer', family: 'الدعم الإداري', experience: 1, hasHardship: false },
    { id: 3, nameAr: 'موظف أول', nameEn: 'Senior Officer', family: 'الدعم الإداري', experience: 2, hasHardship: true },
    { id: 4, nameAr: 'أخصائي', nameEn: 'Specialist', family: 'الوظائف الفنية', experience: 3, hasHardship: true },
    { id: 5, nameAr: 'أخصائي أول', nameEn: 'Senior Specialist', family: 'الوظائف الفنية', experience: 5, hasHardship: true },
    { id: 6, nameAr: 'رئيس قسم', nameEn: 'Section Head', family: 'الإشرافية', experience: 7, hasHardship: false },
    { id: 7, nameAr: 'مدير وحدة', nameEn: 'Unit Manager', family: 'الإدارة الوسطى', experience: 8, hasHardship: false },
    { id: 8, nameAr: 'مدير إدارة', nameEn: 'Department Manager', family: 'الإدارة الوسطى', experience: 10, hasHardship: false },
    { id: 9, nameAr: 'مدير عام', nameEn: 'Senior Manager', family: 'الإدارة العليا', experience: 12, hasHardship: false },
    { id: 10, nameAr: 'مدير تنفيذي', nameEn: 'Executive Director', family: 'الإدارة العليا', experience: 15, hasHardship: false },
    { id: 11, nameAr: 'نائب رئيس', nameEn: 'Vice President', family: 'الإدارة العليا', experience: 18, hasHardship: false },
    { id: 12, nameAr: 'رئيس تنفيذي', nameEn: 'CEO', family: 'القيادة التنفيذية', experience: 20, hasHardship: false },
  ],
  employees: [], marketData: {}, scenarios: [],
};

const fmt = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(n || 0));
const fmtC = (n, c = 'ر.س') => `${fmt(n)} ${c}`;
const fmtP = (n) => `${(n * 100).toFixed(1)}%`;
const fmtDate = (d) => new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });

const calcBase = (data, g, s) => {
  const { baseStartingSalary, gradeDifferential, stepDifferential } = data.structure;
  return baseStartingSalary * Math.pow(1 + gradeDifferential, g - 1) * Math.pow(1 + stepDifferential, s - 1);
};

const calcAllow = (data, g, s, opts = {}) => {
  const base = calcBase(data, g, s);
  const info = data.grades.find(x => x.id === g);
  const { allowances: a } = data;
  const housing = opts.includeHousing !== false ? base * a.housing : 0;
  const transport = Math.max(base * a.transport, a.minTransport);
  const hardship = (info?.hasHardship && opts.includeHardship !== false) ? base * a.hardship : 0;
  const communication = g >= 9 ? base * a.communication : 0;
  return { housing, transport, hardship, communication, total: housing + transport + hardship + communication };
};

const calcComp = (data, g, s, opts = {}) => {
  const base = calcBase(data, g, s);
  const allow = calcAllow(data, g, s, opts);
  const monthlyGross = base + allow.total;
  const annualGross = monthlyGross * 12;
  const { gosi, medical, eosb } = data.obligations;
  const obligations = annualGross * (gosi + medical + eosb);
  return { base, allow, monthlyGross, annualGross, obligations, ctc: annualGross + obligations };
};

const calcEOSB = (salary, years, reason) => {
  if (years <= 0) return { eligible: 0, actual: 0, deduction: 0, percentage: 0 };
  const first5 = Math.min(years, 5);
  const rest = Math.max(0, years - 5);
  const eligible = (first5 * 0.5 * salary) + (rest * 1 * salary);
  let percentage = 1;
  if (reason === 'resignation') {
    if (years < 2) percentage = 0;
    else if (years < 5) percentage = 1/3;
    else if (years < 10) percentage = 2/3;
    else percentage = 1;
  }
  const actual = eligible * percentage;
  return { eligible, actual, deduction: eligible - actual, percentage };
};

const genAlerts = (data) => {
  const alerts = [];
  const { numGrades, numSteps } = data.structure;
  for (let g = 1; g <= numGrades; g++) {
    const mid = Math.ceil(numSteps / 2);
    const avg = calcBase(data, g, mid);
    const p50 = data.marketData[g]?.p50;
    if (p50 > 0) {
      const compa = avg / p50;
      if (compa < 0.9) alerts.push({ type: 'error', title: `فجوة سوقية - الدرجة ${g}`, message: `${(compa*100).toFixed(0)}%`, action: 'market' });
      else if (compa > 1.15) alerts.push({ type: 'warning', title: `تجاوز السوق - الدرجة ${g}`, message: `${(compa*100).toFixed(0)}%`, action: 'market' });
    }
  }
  const ratio = calcBase(data, numGrades, numSteps) / calcBase(data, 1, 1);
  if (ratio > 25) alerts.push({ type: 'warning', title: 'المضاعف مرتفع', message: `${ratio.toFixed(1)}x`, action: 'settings' });
  if (data.employees.length === 0) alerts.push({ type: 'info', title: 'لا يوجد موظفون', message: 'أضف الموظفين لتفعيل التحليلات', action: 'employees' });
  return alerts;
};

const dlCSV = (rows, name) => {
  const csv = rows.map(r => r.map(c => typeof c === 'string' && c.includes(',') ? `"${c}"` : c).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
};

const printHTML = (title, content) => {
  const w = window.open('', '', 'width=900,height=700');
  w.document.write(`<!DOCTYPE html><html dir="rtl"><head><title>${title}</title>
    <style>body{font-family:Arial;padding:40px;color:#0f172a}h1{color:#1F3864;border-bottom:3px solid #F59E0B;padding-bottom:10px}h2{color:#1F3864;margin-top:25px}table{width:100%;border-collapse:collapse;margin:15px 0}th{background:#1F3864;color:white;padding:10px;text-align:right}td{border:1px solid #ddd;padding:8px;text-align:right}.kpi{background:#f8fafc;padding:15px;border-right:4px solid #F59E0B;margin:10px 0}.footer{margin-top:40px;padding-top:20px;border-top:1px solid #ccc;text-align:center;color:#666}@media print{body{padding:20px}}</style>
    </head><body>${content}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
};

export default function App() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saved, setSaved] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [onboard, setOnboard] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const l = JSON.parse(stored);
          const merged = { ...DEFAULT_DATA, ...l, 
            ui: { ...DEFAULT_DATA.ui, ...(l.ui || {}) },
            benefits: { ...DEFAULT_DATA.benefits, ...(l.benefits || {}) },
          };
          setData(merged);
          if (!merged.ui.onboarded) setOnboard(true);
        } else { setData(DEFAULT_DATA); setOnboard(true); }
      } catch { setData(DEFAULT_DATA); }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded || !data) return;
    const t = setTimeout(async () => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); setSaved('محفوظ'); setTimeout(() => setSaved(''), 2000); }
      catch { setSaved('خطأ'); }
    }, 600);
    return () => clearTimeout(t);
  }, [data, loaded]);

  const reset = async () => {
    if (window.confirm('إعادة كل البيانات؟')) {
      setData(DEFAULT_DATA);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DATA));
    }
  };

  const alerts = useMemo(() => data ? genAlerts(data) : [], [data]);

  if (!loaded || !data) return <div className="min-h-screen flex items-center justify-center bg-stone-50"><div>جارٍ التحميل...</div></div>;

  const dark = data.ui.darkMode;
  const pages = [
    { id: 'dashboard', label: 'لوحة التحكم', icon: Home, group: 'main' },
    { id: 'settings', label: 'الإعدادات', icon: Settings, group: 'setup' },
    { id: 'grades', label: 'الدرجات', icon: Building2, group: 'setup' },
    { id: 'scale', label: 'سلم الرواتب', icon: Grid, group: 'setup' },
    { id: 'cards', label: 'بطاقات الدرجات', icon: FileText, group: 'setup' },
    { id: 'employees', label: 'الموظفون', icon: Users, group: 'ops' },
    { id: 'calc', label: 'محاكي التوظيف', icon: Calculator, group: 'ops' },
    { id: 'eosb', label: 'نهاية الخدمة', icon: Briefcase, group: 'ops' },
    { id: 'promo', label: 'محاكي الترقيات', icon: ArrowUpRight, group: 'ops' },
    { id: 'market', label: 'مقارنة السوق', icon: TrendingUp, group: 'analysis' },
    { id: 'merit', label: 'العلاوات', icon: Award, group: 'analysis' },
    { id: 'budget', label: 'الميزانية', icon: BarChart3, group: 'analysis' },
    { id: 'scenarios', label: 'السيناريوهات', icon: GitCompare, group: 'analysis' },
    { id: 'report', label: 'التقرير المالي', icon: ClipboardList, group: 'analysis' },
    { id: 'method', label: 'المنهجية', icon: BookOpen, group: 'docs' },
  ];
  const groups = { main: 'الرئيسية', setup: 'الإعداد', ops: 'العمليات', analysis: 'التحليل', docs: 'التوثيق' };

  const props = { data, setData, setPage };
  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard {...props} alerts={alerts} />;
      case 'settings': return <SettingsView {...props} />;
      case 'grades': return <GradesView {...props} />;
      case 'scale': return <ScaleView {...props} />;
      case 'calc': return <CalcView {...props} />;
      case 'market': return <MarketView {...props} />;
      case 'cards': return <CardsView {...props} />;
      case 'merit': return <MeritView {...props} />;
      case 'budget': return <BudgetView {...props} />;
      case 'employees': return <EmployeesView {...props} />;
      case 'eosb': return <EOSBView {...props} />;
      case 'promo': return <PromoView {...props} />;
      case 'scenarios': return <ScenariosView {...props} />;
      case 'report': return <ReportView {...props} />;
      case 'method': return <MethodView {...props} />;
      default: return <Dashboard {...props} alerts={alerts} />;
    }
  };

  return (
    <div dir="rtl" className={`min-h-screen ${dark ? 'bg-slate-950 text-stone-100' : 'bg-stone-50 text-slate-900'} flex`} style={{ fontFamily: 'system-ui, sans-serif' }}>
      {onboard && <Onboarding data={data} setData={setData} onClose={() => { setData(p => ({ ...p, ui: { ...p.ui, onboarded: true } })); setOnboard(false); }} />}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={`fixed lg:sticky top-0 right-0 h-screen w-72 z-50 transition-transform duration-300 overflow-y-auto ${dark ? 'bg-slate-900 border-l border-slate-800' : 'bg-gradient-to-b from-slate-900 to-slate-800'} text-stone-100 ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="p-5 border-b border-slate-700">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0"><Wallet className="w-6 h-6 text-slate-900" strokeWidth={2.5} /></div>
              <div className="min-w-0"><h1 className="font-bold text-base">سلم الرواتب</h1><p className="text-xs text-stone-400">Pro</p></div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-stone-400 p-1"><X className="w-5 h-5" /></button>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-700">
            <p className="text-xs text-stone-400">المنشأة</p>
            <p className="text-sm font-medium truncate">{data.company.name}</p>
          </div>
        </div>
        <nav className="p-3">
          {Object.entries(groups).map(([key, label]) => {
            const gp = pages.filter(p => p.group === key);
            return (
              <div key={key} className="mb-4">
                <p className="text-xs text-stone-500 uppercase px-3 mb-1.5">{label}</p>
                {gp.map(pg => {
                  const Icon = pg.icon;
                  const active = page === pg.id;
                  const has = pg.id === 'dashboard' && alerts.length > 0;
                  return (
                    <button key={pg.id} onClick={() => { setPage(pg.id); setSidebarOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-right ${active ? 'bg-amber-500 text-slate-900 font-semibold' : 'text-stone-300 hover:bg-slate-700/50'}`}>
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm flex-1">{pg.label}</span>
                      {has && <span className="bg-red-500 text-white text-xs px-1.5 rounded-full">{alerts.length}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-700 space-y-1">
          <button onClick={() => setData(p => ({ ...p, ui: { ...p.ui, darkMode: !p.ui.darkMode } }))}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-stone-300 hover:bg-slate-700 text-sm">
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}<span>{dark ? 'فاتح' : 'داكن'}</span>
          </button>
          <button onClick={reset} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-stone-400 hover:bg-red-900/30 text-sm">
            <RotateCcw className="w-4 h-4" /><span>إعادة تعيين</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        <div className={`sticky top-0 z-30 ${dark ? 'bg-slate-950/80' : 'bg-white/80'} backdrop-blur-lg border-b ${dark ? 'border-slate-800' : 'border-stone-200'}`}>
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -mr-2"><Menu className="w-6 h-6" /></button>
              <h2 className="text-lg lg:text-xl font-bold">{pages.find(p => p.id === page)?.label}</h2>
            </div>
            {saved && <div className="flex items-center gap-1 text-sm text-emerald-500"><Check className="w-4 h-4" /><span>{saved}</span></div>}
          </div>
        </div>
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">{renderPage()}</div>
      </main>
    </div>
  );
}

function Onboarding({ data, setData, onClose }) {
  const [step, setStep] = useState(0);
  const [t, setT] = useState({ n: data.company.name, g: data.structure.numGrades, s: data.structure.baseStartingSalary });
  const steps = [
    { title: 'أهلاً بك', body: <div className="space-y-4"><div className="w-16 h-16 rounded-2xl bg-amber-500 mx-auto flex items-center justify-center"><Sparkles className="w-8 h-8 text-slate-900" /></div><p className="text-center text-slate-600 dark:text-stone-300">أداة شاملة لبناء وإدارة سلم الرواتب. 3 خطوات.</p></div> },
    { title: 'اسم المنشأة', body: <input value={t.n} onChange={e => setT({ ...t, n: e.target.value })} className="w-full px-4 py-3 rounded-lg border border-stone-300 dark:border-slate-700 dark:bg-slate-800 outline-none text-lg" placeholder="مثلاً: شركة الأمل" /> },
    { title: 'الإعدادات', body: (
      <div className="space-y-4">
        <div><label className="block text-sm font-medium mb-1.5">عدد الدرجات</label><input type="number" value={t.g} onChange={e => setT({ ...t, g: parseInt(e.target.value) || 12 })} className="w-full px-4 py-3 rounded-lg border border-stone-300 dark:border-slate-700 dark:bg-slate-800 outline-none" /></div>
        <div><label className="block text-sm font-medium mb-1.5">الراتب الابتدائي</label><input type="number" value={t.s} onChange={e => setT({ ...t, s: parseFloat(e.target.value) || 4500 })} className="w-full px-4 py-3 rounded-lg border border-stone-300 dark:border-slate-700 dark:bg-slate-800 outline-none" /></div>
      </div>
    )},
    { title: 'جاهز', body: <div className="text-center space-y-4"><div className="w-16 h-16 rounded-2xl bg-emerald-500 mx-auto flex items-center justify-center"><Check className="w-8 h-8 text-white" /></div><p>تم إعداد بياناتك. عدّل أي شي من الإعدادات.</p></div> },
  ];
  const finish = () => {
    setData(p => ({ ...p, company: { ...p.company, name: t.n }, structure: { ...p.structure, numGrades: t.g, baseStartingSalary: t.s } }));
    onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6">
        <div className="flex gap-1.5 mb-4">{steps.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-amber-500' : 'bg-stone-200 dark:bg-slate-700'}`}></div>)}</div>
        <h3 className="text-xl font-bold mb-4">{steps[step].title}</h3>
        <div className="min-h-[180px] mb-4">{steps[step].body}</div>
        <div className="flex justify-between gap-3">
          {step > 0 ? <button onClick={() => setStep(step - 1)} className="px-4 py-2 rounded-lg border border-stone-300 dark:border-slate-700 text-sm">السابق</button> : <button onClick={onClose} className="px-4 py-2 text-stone-500 text-sm">تخطي</button>}
          {step < steps.length - 1 
            ? <button onClick={() => setStep(step + 1)} className="px-6 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm" disabled={step === 1 && !t.n}>التالي</button>
            : <button onClick={finish} className="px-6 py-2 rounded-lg bg-emerald-500 text-white font-semibold text-sm">ابدأ</button>}
        </div>
      </div>
    </div>
  );
}

function Card({ title, subtitle, children, dark, action }) {
  return (
    <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
      {title && <div className={`px-5 py-4 border-b flex items-center justify-between ${dark ? 'border-slate-800' : 'border-stone-100'}`}>
        <div><h3 className="font-bold">{title}</h3>{subtitle && <p className={`text-xs mt-0.5 ${dark ? 'text-stone-400' : 'text-stone-500'}`}>{subtitle}</p>}</div>
        {action}
      </div>}
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', suffix, hint, dark }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          className={`flex-1 px-4 py-2.5 rounded-lg border outline-none ${dark ? 'bg-slate-800 border-slate-700 text-white focus:border-amber-500' : 'bg-white border-stone-300 focus:border-amber-500'}`} />
        {suffix && <span className="text-sm text-stone-500">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-stone-500 mt-1">{hint}</p>}
    </div>
  );
}

function PctField({ label, value, onChange, hint, dark }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input type="number" step="0.01" value={(value * 100).toFixed(2)} onChange={e => onChange(parseFloat(e.target.value) / 100 || 0)}
          className={`flex-1 px-4 py-2.5 rounded-lg border outline-none ${dark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-stone-300'}`} />
        <span className="text-sm text-stone-500">%</span>
      </div>
      {hint && <p className="text-xs text-stone-500 mt-1">{hint}</p>}
    </div>
  );
}

function KPI({ label, value, icon: Icon, color, dark }) {
  const colors = { emerald: 'from-emerald-500 to-emerald-600', amber: 'from-amber-500 to-amber-600', sky: 'from-sky-500 to-sky-600', purple: 'from-purple-500 to-purple-600' };
  return (
    <div className={`rounded-xl p-4 border ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colors[color]} flex items-center justify-center mb-3`}><Icon className="w-5 h-5 text-white" /></div>
      <p className={`text-xs mb-1 ${dark ? 'text-stone-400' : 'text-stone-500'}`}>{label}</p>
      <p className="text-base lg:text-xl font-bold">{value}</p>
    </div>
  );
}

function Dashboard({ data, setPage, alerts }) {
  const dark = data.ui.darkMode;
  const stats = useMemo(() => {
    const { numGrades, numSteps } = data.structure;
    const min = calcBase(data, 1, 1), max = calcBase(data, numGrades, numSteps);
    let actualPayroll = 0;
    data.employees.forEach(e => { actualPayroll += calcComp(data, e.grade, e.step, { includeHousing: e.housingType !== 'accommodation' }).ctc; });
    return { min, max, ratio: max / min, actualPayroll, empCount: data.employees.length };
  }, [data]);

  const scaleData = useMemo(() => Array.from({ length: data.structure.numGrades }, (_, i) => {
    const grade = i + 1;
    const mid = Math.ceil(data.structure.numSteps / 2);
    const c = calcComp(data, grade, mid);
    return { grade: `د${grade}`, base: c.base, gross: c.monthlyGross };
  }), [data]);

  return (
    <div className="space-y-6">
      {alerts.length > 0 && (
        <div className={`rounded-2xl border ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
          <div className="p-4 border-b flex items-center gap-2 border-inherit"><Bell className="w-5 h-5 text-amber-500" /><h3 className="font-bold">التنبيهات الذكية</h3><span className="text-xs bg-amber-500 text-slate-900 px-2 py-0.5 rounded-full font-bold">{alerts.length}</span></div>
          <div className="p-4 space-y-2 max-h-64 overflow-y-auto">
            {alerts.map((a, i) => <AlertItem key={i} a={a} setPage={setPage} />)}
          </div>
        </div>
      )}
      <div className="bg-gradient-to-l from-slate-900 to-slate-700 rounded-2xl p-6 lg:p-8 text-white">
        <div className="flex items-center gap-3 mb-3"><Sparkles className="w-6 h-6 text-amber-400" /><span className="text-amber-400 text-sm">نظرة عامة</span></div>
        <h1 className="text-2xl lg:text-3xl font-bold mb-2">{data.company.name}</h1>
        <p className="text-stone-300">{data.company.year} — {data.structure.numGrades} درجة × {data.structure.numSteps} مستوى</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI label="أدنى راتب" value={fmtC(stats.min, data.company.currency)} icon={ChevronLeft} color="emerald" dark={dark} />
        <KPI label="أعلى راتب" value={fmtC(stats.max, data.company.currency)} icon={ChevronRight} color="amber" dark={dark} />
        <KPI label="المضاعف" value={`${stats.ratio.toFixed(1)}x`} icon={TrendingUp} color="sky" dark={dark} />
        <KPI label="الموظفون" value={stats.empCount} icon={Users} color="purple" dark={dark} />
      </div>
      {stats.empCount > 0 && (
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white">
          <p className="text-emerald-100 text-sm mb-1">إجمالي كتلة الرواتب السنوية</p>
          <p className="text-3xl lg:text-4xl font-bold">{fmtC(stats.actualPayroll, data.company.currency)}</p>
          <p className="text-emerald-100 text-sm mt-2">متوسط {fmtC(stats.actualPayroll / stats.empCount, data.company.currency)} لكل موظف</p>
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card title="تدرج الرواتب" dark={dark}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={scaleData}>
              <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e5e5e5'} />
              <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <Tooltip formatter={v => fmtC(v)} contentStyle={{ direction: 'rtl', backgroundColor: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 8 }} />
              <Legend />
              <Line type="monotone" dataKey="base" stroke="#0F172A" strokeWidth={2} name="الأساسي" />
              <Line type="monotone" dataKey="gross" stroke="#F59E0B" strokeWidth={2} name="الإجمالي" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card title="الأدوات السريعة" dark={dark}>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'calc', label: 'حاسبة التوظيف', icon: Calculator, color: 'from-amber-500 to-orange-500' },
              { id: 'employees', label: 'الموظفون', icon: Users, color: 'from-emerald-500 to-teal-500' },
              { id: 'eosb', label: 'نهاية الخدمة', icon: Briefcase, color: 'from-sky-500 to-blue-500' },
              { id: 'report', label: 'التقرير المالي', icon: ClipboardList, color: 'from-purple-500 to-pink-500' },
            ].map(item => {
              const Icon = item.icon;
              return (
                <button key={item.id} onClick={() => setPage(item.id)}
                  className={`bg-gradient-to-br ${item.color} text-white p-4 rounded-xl flex flex-col items-center gap-2 hover:scale-105 transition-transform`}>
                  <Icon className="w-6 h-6" /><span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function AlertItem({ a, setPage }) {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-900/20 dark:border-red-800 dark:text-red-100',
    warning: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-100',
    info: 'bg-sky-50 border-sky-200 text-sky-900 dark:bg-sky-900/20 dark:border-sky-800 dark:text-sky-100',
  };
  const icons = { error: AlertCircle, warning: AlertTriangle, info: Info };
  const Icon = icons[a.type];
  return (
    <button onClick={() => setPage(a.action)} className={`w-full text-right border rounded-lg p-3 flex items-start gap-3 ${styles[a.type]}`}>
      <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <div className="flex-1"><p className="font-medium text-sm">{a.title}</p><p className="text-xs opacity-80 mt-0.5">{a.message}</p></div>
      <ChevronLeft className="w-4 h-4 opacity-50" />
    </button>
  );
}

function SettingsView({ data, setData }) {
  const dark = data.ui.darkMode;
  const [tab, setTab] = useState('company');
  const update = (path, value) => setData(prev => {
    const n = JSON.parse(JSON.stringify(prev));
    const keys = path.split('.');
    let o = n;
    for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
    o[keys[keys.length - 1]] = value;
    return n;
  });
  const tabs = [
    { id: 'company', label: 'المنشأة' }, { id: 'structure', label: 'الهيكل' },
    { id: 'allowances', label: 'البدلات' }, { id: 'obligations', label: 'الالتزامات' },
    { id: 'benefits', label: 'المزايا' }, { id: 'merit', label: 'العلاوات' },
  ];
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${tab === t.id ? 'bg-slate-900 text-amber-400' : dark ? 'bg-slate-800 text-stone-300' : 'bg-stone-100 text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'company' && <Card dark={dark}><div className="space-y-4">
        <Field label="اسم المنشأة" value={data.company.name} onChange={v => update('company.name', v)} dark={dark} />
        <Field label="السنة" value={data.company.year} type="number" onChange={v => update('company.year', parseInt(v))} dark={dark} />
        <Field label="العملة" value={data.company.currency} onChange={v => update('company.currency', v)} dark={dark} />
      </div></Card>}
      {tab === 'structure' && <Card dark={dark}><div className="space-y-4">
        <Field label="عدد الدرجات" value={data.structure.numGrades} type="number" onChange={v => update('structure.numGrades', parseInt(v))} hint="8-14 مثالي" dark={dark} />
        <Field label="عدد المستويات" value={data.structure.numSteps} type="number" onChange={v => update('structure.numSteps', parseInt(v))} hint="5-10 مثالي" dark={dark} />
        <Field label="راتب الدرجة 1 - المستوى 1" value={data.structure.baseStartingSalary} type="number" onChange={v => update('structure.baseStartingSalary', parseFloat(v))} suffix={data.company.currency} dark={dark} />
        <PctField label="الفرق بين الدرجات" value={data.structure.gradeDifferential} onChange={v => update('structure.gradeDifferential', v)} hint="15-25%" dark={dark} />
        <PctField label="العلاوة بين Steps" value={data.structure.stepDifferential} onChange={v => update('structure.stepDifferential', v)} hint="2-4%" dark={dark} />
      </div></Card>}
      {tab === 'allowances' && <Card dark={dark}><div className="space-y-4">
        <PctField label="بدل السكن" value={data.allowances.housing} onChange={v => update('allowances.housing', v)} dark={dark} />
        <PctField label="بدل النقل" value={data.allowances.transport} onChange={v => update('allowances.transport', v)} dark={dark} />
        <Field label="الحد الأدنى للنقل" value={data.allowances.minTransport} type="number" onChange={v => update('allowances.minTransport', parseFloat(v))} suffix={data.company.currency} dark={dark} />
        <PctField label="بدل طبيعة العمل" value={data.allowances.hardship} onChange={v => update('allowances.hardship', v)} dark={dark} />
        <PctField label="بدل الاتصالات (9+)" value={data.allowances.communication} onChange={v => update('allowances.communication', v)} dark={dark} />
      </div></Card>}
      {tab === 'obligations' && <Card dark={dark}><div className="space-y-4">
        <PctField label="التأمينات (GOSI)" value={data.obligations.gosi} onChange={v => update('obligations.gosi', v)} hint="السعودية: 11.75%" dark={dark} />
        <PctField label="التأمين الطبي" value={data.obligations.medical} onChange={v => update('obligations.medical', v)} dark={dark} />
        <PctField label="مخصص نهاية الخدمة" value={data.obligations.eosb} onChange={v => update('obligations.eosb', v)} hint="8.33%" dark={dark} />
      </div></Card>}
      {tab === 'benefits' && <Card dark={dark}><div className="space-y-4">
        <Field label="إجازة السنة الأولى (يوم)" value={data.benefits.leaveInitial} type="number" onChange={v => update('benefits.leaveInitial', parseInt(v))} dark={dark} />
        <Field label="إجازة بعد 5 سنوات (يوم)" value={data.benefits.leaveAfter5} type="number" onChange={v => update('benefits.leaveAfter5', parseInt(v))} dark={dark} />
        <Field label="بدل التعليم يبدأ من درجة" value={data.benefits.educationStartGrade} type="number" onChange={v => update('benefits.educationStartGrade', parseInt(v))} dark={dark} />
        <Field label="مبلغ التعليم السنوي" value={data.benefits.educationAmount} type="number" onChange={v => update('benefits.educationAmount', parseFloat(v))} suffix={data.company.currency} dark={dark} />
        <Field label="المكافأة تبدأ من درجة" value={data.benefits.bonusStartGrade} type="number" onChange={v => update('benefits.bonusStartGrade', parseInt(v))} dark={dark} />
      </div></Card>}
      {tab === 'merit' && <Card dark={dark}><div className="space-y-4">
        <PctField label="ممتاز" value={data.merit.exceptional} onChange={v => update('merit.exceptional', v)} dark={dark} />
        <PctField label="فوق المتوقع" value={data.merit.exceeds} onChange={v => update('merit.exceeds', v)} dark={dark} />
        <PctField label="يلبي التوقعات" value={data.merit.meets} onChange={v => update('merit.meets', v)} dark={dark} />
        <PctField label="بحاجة لتحسين" value={data.merit.needsImprovement} onChange={v => update('merit.needsImprovement', v)} dark={dark} />
        <PctField label="غير مُرضي" value={data.merit.unsatisfactory} onChange={v => update('merit.unsatisfactory', v)} dark={dark} />
      </div></Card>}
    </div>
  );
}

function GradesView({ data, setData }) {
  const dark = data.ui.darkMode;
  const upd = (id, f, v) => setData(p => ({ ...p, grades: p.grades.map(g => g.id === id ? { ...g, [f]: v } : g) }));
  return (
    <div className="space-y-3">
      {data.grades.slice(0, data.structure.numGrades).map(g => (
        <div key={g.id} className={`rounded-xl border p-4 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-amber-400 flex items-center justify-center font-bold text-lg flex-shrink-0">{g.id}</div>
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Field label="المسمى (عربي)" value={g.nameAr} onChange={v => upd(g.id, 'nameAr', v)} dark={dark} />
              <Field label="Job Title (EN)" value={g.nameEn} onChange={v => upd(g.id, 'nameEn', v)} dark={dark} />
              <div>
                <label className="text-sm font-medium block mb-1.5">العائلة</label>
                <select value={g.family} onChange={e => upd(g.id, 'family', e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-lg border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`}>
                  <option>الدعم الإداري</option><option>الوظائف الفنية</option><option>الإشرافية</option>
                  <option>الإدارة الوسطى</option><option>الإدارة العليا</option><option>القيادة التنفيذية</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="أدنى خبرة" value={g.experience} type="number" onChange={v => upd(g.id, 'experience', parseInt(v) || 0)} dark={dark} />
                <div>
                  <label className="text-sm font-medium block mb-1.5">بدل طبيعة عمل</label>
                  <label className={`flex items-center gap-2 h-[42px] px-3 rounded-lg border cursor-pointer ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`}>
                    <input type="checkbox" checked={g.hasHardship} onChange={e => upd(g.id, 'hasHardship', e.target.checked)} />
                    <span className="text-sm">{g.hasHardship ? 'نعم' : 'لا'}</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScaleView({ data }) {
  const dark = data.ui.darkMode;
  const { numGrades, numSteps } = data.structure;
  const matrix = useMemo(() => {
    const rows = [];
    for (let g = 1; g <= numGrades; g++) {
      const info = data.grades.find(x => x.id === g);
      const steps = [];
      for (let s = 1; s <= numSteps; s++) steps.push(calcBase(data, g, s));
      const avg = steps.reduce((a, b) => a + b, 0) / steps.length;
      rows.push({ grade: g, name: info?.nameAr || `درجة ${g}`, steps, avg });
    }
    return rows;
  }, [data, numGrades, numSteps]);
  const maxVal = Math.max(...matrix.flatMap(r => r.steps));
  const exportCSV = () => {
    const headers = ['الدرجة', 'المسمى', ...Array.from({ length: numSteps }, (_, i) => `Step ${i+1}`), 'المتوسط'];
    dlCSV([headers, ...matrix.map(r => [r.grade, r.name, ...r.steps.map(s => Math.round(s)), Math.round(r.avg)])], `salary_scale_${data.company.year}.csv`);
  };
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium">
          <FileDown className="w-4 h-4" /><span>تصدير CSV</span>
        </button>
      </div>
      <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs lg:text-sm">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="px-3 py-3 text-center">الدرجة</th>
                <th className="px-3 py-3 text-right min-w-32">المسمى</th>
                {Array.from({ length: numSteps }, (_, i) => (
                  <th key={i} className="px-2 py-3 text-center whitespace-nowrap">
                    <div className="text-amber-400 font-normal text-[10px]">Step</div><div>{i + 1}</div>
                  </th>
                ))}
                <th className="px-3 py-3 text-center bg-amber-500 text-slate-900">المتوسط</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map(row => (
                <tr key={row.grade} className={`border-b ${dark ? 'border-slate-800' : 'border-stone-100'}`}>
                  <td className="px-3 py-3 text-center font-bold">{row.grade}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">{row.name}</td>
                  {row.steps.map((val, i) => {
                    const intensity = val / maxVal;
                    return <td key={i} className="px-2 py-3 text-center font-medium whitespace-nowrap" style={{ backgroundColor: `rgba(245, 158, 11, ${intensity * 0.35})` }}>{fmt(val)}</td>;
                  })}
                  <td className="px-3 py-3 text-center font-bold bg-amber-100 text-slate-900 whitespace-nowrap">{fmt(row.avg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EmployeesView({ data, setData }) {
  const dark = data.ui.darkMode;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', id: '', nationality: 'سعودي', gender: 'ذكر', grade: 4, step: 3, hireDate: new Date().toISOString().split('T')[0], housingType: 'cash', department: '', jobTitle: '' });

  const openForm = (emp = null) => {
    if (emp) { setForm(emp); setEditing(emp.uid); }
    else { setForm({ name: '', id: '', nationality: 'سعودي', gender: 'ذكر', grade: 4, step: 3, hireDate: new Date().toISOString().split('T')[0], housingType: 'cash', department: '', jobTitle: '' }); setEditing(null); }
    setShowForm(true);
  };
  const save = () => {
    if (!form.name) return;
    setData(p => {
      const employees = editing ? p.employees.map(e => e.uid === editing ? { ...form, uid: editing } : e) : [...p.employees, { ...form, uid: Date.now().toString() }];
      return { ...p, employees };
    });
    setShowForm(false);
  };
  const del = (uid) => window.confirm('حذف؟') && setData(p => ({ ...p, employees: p.employees.filter(e => e.uid !== uid) }));

  const filtered = useMemo(() => data.employees.filter(e => {
    const s = !search || e.name.toLowerCase().includes(search.toLowerCase()) || e.jobTitle?.toLowerCase().includes(search.toLowerCase());
    const g = filter === 'all' || e.grade === parseInt(filter);
    return s && g;
  }), [data.employees, search, filter]);

  const exportEmp = () => {
    const headers = ['الاسم', 'الهوية', 'الجنسية', 'الجنس', 'الإدارة', 'المسمى', 'الدرجة', 'المستوى', 'التعيين', 'الشهري', 'CTC'];
    const rows = data.employees.map(e => {
      const c = calcComp(data, e.grade, e.step, { includeHousing: e.housingType !== 'accommodation' });
      return [e.name, e.id, e.nationality, e.gender, e.department, e.jobTitle, e.grade, e.step, e.hireDate, Math.round(c.monthlyGross), Math.round(c.ctc)];
    });
    dlCSV([headers, ...rows], `employees_${data.company.year}.csv`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className={`flex-1 min-w-[200px] flex items-center gap-2 px-3 py-2 rounded-lg border ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
          <Search className="w-4 h-4 text-stone-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث..." className="flex-1 outline-none bg-transparent text-sm" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className={`px-3 py-2 rounded-lg border text-sm ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
          <option value="all">كل الدرجات</option>
          {data.grades.slice(0, data.structure.numGrades).map(g => <option key={g.id} value={g.id}>د{g.id} - {g.nameAr}</option>)}
        </select>
        <button onClick={() => openForm()} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm">
          <UserPlus className="w-4 h-4" /> إضافة
        </button>
        {data.employees.length > 0 && <button onClick={exportEmp} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium"><FileDown className="w-4 h-4" /> تصدير</button>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className={`rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 ${dark ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">{editing ? 'تعديل' : 'إضافة'} موظف</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Field label="الاسم" value={form.name} onChange={v => setForm({ ...form, name: v })} dark={dark} />
              <Field label="رقم الهوية" value={form.id} onChange={v => setForm({ ...form, id: v })} dark={dark} />
              <div>
                <label className="text-sm font-medium block mb-1.5">الجنسية</label>
                <select value={form.nationality} onChange={e => setForm({ ...form, nationality: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-lg border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`}>
                  <option>سعودي</option><option>مصري</option><option>هندي</option><option>باكستاني</option><option>فلبيني</option><option>سوداني</option><option>أردني</option><option>سوري</option><option>يمني</option><option>أخرى</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">الجنس</label>
                <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-lg border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`}>
                  <option>ذكر</option><option>أنثى</option>
                </select>
              </div>
              <Field label="الإدارة" value={form.department} onChange={v => setForm({ ...form, department: v })} dark={dark} />
              <Field label="المسمى الفعلي" value={form.jobTitle} onChange={v => setForm({ ...form, jobTitle: v })} dark={dark} />
              <div>
                <label className="text-sm font-medium block mb-1.5">الدرجة</label>
                <select value={form.grade} onChange={e => setForm({ ...form, grade: parseInt(e.target.value) })}
                  className={`w-full px-3 py-2.5 rounded-lg border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`}>
                  {data.grades.slice(0, data.structure.numGrades).map(g => <option key={g.id} value={g.id}>د{g.id} - {g.nameAr}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1.5">المستوى</label>
                <select value={form.step} onChange={e => setForm({ ...form, step: parseInt(e.target.value) })}
                  className={`w-full px-3 py-2.5 rounded-lg border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`}>
                  {Array.from({ length: data.structure.numSteps }, (_, i) => <option key={i} value={i+1}>Step {i+1}</option>)}
                </select>
              </div>
              <Field label="تاريخ التعيين" value={form.hireDate} type="date" onChange={v => setForm({ ...form, hireDate: v })} dark={dark} />
              <div>
                <label className="text-sm font-medium block mb-1.5">السكن</label>
                <select value={form.housingType} onChange={e => setForm({ ...form, housingType: e.target.value })}
                  className={`w-full px-3 py-2.5 rounded-lg border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`}>
                  <option value="cash">بدل نقدي</option><option value="accommodation">عيني</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} className="flex-1 py-2.5 rounded-lg bg-amber-500 text-slate-900 font-semibold">{editing ? 'حفظ' : 'إضافة'}</button>
              <button onClick={() => setShowForm(false)} className="px-6 py-2.5 rounded-lg border border-stone-300 dark:border-slate-700">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={`rounded-xl border p-12 text-center ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
          <Users className="w-12 h-12 mx-auto mb-3 text-stone-400" />
          <p className="text-lg font-medium mb-1">لا يوجد موظفون</p>
          <p className="text-sm text-stone-500 mb-4">ابدأ بإضافة موظفيك لتفعيل التحليلات الفعلية</p>
          <button onClick={() => openForm()} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm">
            <UserPlus className="w-4 h-4" /> إضافة أول موظف
          </button>
        </div>
      ) : (
        <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-900 text-white">
                <tr><th className="px-3 py-3 text-right">الاسم</th><th className="px-3 py-3 text-right">المسمى</th><th className="px-3 py-3">الدرجة</th><th className="px-3 py-3">التعيين</th><th className="px-3 py-3">الشهري</th><th className="px-3 py-3">CTC</th><th className="px-3 py-3"></th></tr>
              </thead>
              <tbody>
                {filtered.map(emp => {
                  const c = calcComp(data, emp.grade, emp.step, { includeHousing: emp.housingType !== 'accommodation' });
                  return (
                    <tr key={emp.uid} className={`border-b ${dark ? 'border-slate-800' : 'border-stone-100'}`}>
                      <td className="px-3 py-3"><div className="font-medium">{emp.name}</div><div className="text-xs text-stone-500">{emp.nationality} - {emp.gender}</div></td>
                      <td className="px-3 py-3"><div>{emp.jobTitle}</div><div className="text-xs text-stone-500">{emp.department}</div></td>
                      <td className="px-3 py-3 text-center"><div className="font-bold">د{emp.grade}</div><div className="text-xs text-stone-500">Step {emp.step}</div></td>
                      <td className="px-3 py-3 text-center text-xs">{emp.hireDate}</td>
                      <td className="px-3 py-3 text-center font-medium">{fmt(c.monthlyGross)}</td>
                      <td className="px-3 py-3 text-center font-bold text-amber-600">{fmt(c.ctc)}</td>
                      <td className="px-3 py-3"><div className="flex gap-1">
                        <button onClick={() => openForm(emp)} className="p-1.5 rounded hover:bg-stone-100 dark:hover:bg-slate-800"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => del(emp.uid)} className="p-1.5 rounded hover:bg-red-100 text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CalcView({ data }) {
  const dark = data.ui.darkMode;
  const [g, setG] = useState(5);
  const [s, setS] = useState(3);
  const [housing, setHousing] = useState(true);
  const [hireDate, setHireDate] = useState(new Date().toISOString().split('T')[0]);
  const [showOffer, setShowOffer] = useState(false);

  const result = useMemo(() => calcComp(data, g, s, { includeHousing: housing }), [data, g, s, housing]);

  const firstMonth = useMemo(() => {
    const d = new Date(hireDate);
    const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const worked = days - d.getDate() + 1;
    return { worked, days, amount: (result.monthlyGross / days) * worked };
  }, [result.monthlyGross, hireDate]);

  const info = data.grades.find(x => x.id === g);
  return (
    <div className="space-y-6">
      <Card dark={dark}>
        <div className="grid lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">الدرجة</label>
            <select value={g} onChange={e => setG(parseInt(e.target.value))} className={`w-full px-4 py-3 rounded-lg border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`}>
              {data.grades.slice(0, data.structure.numGrades).map(x => <option key={x.id} value={x.id}>د{x.id} - {x.nameAr}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">المستوى</label>
            <select value={s} onChange={e => setS(parseInt(e.target.value))} className={`w-full px-4 py-3 rounded-lg border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`}>
              {Array.from({ length: data.structure.numSteps }, (_, i) => <option key={i} value={i+1}>Step {i+1}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">تاريخ المباشرة</label>
            <input type="date" value={hireDate} onChange={e => setHireDate(e.target.value)} className={`w-full px-4 py-3 rounded-lg border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">السكن</label>
            <label className={`flex items-center gap-2 h-[46px] px-4 rounded-lg border cursor-pointer ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`}>
              <input type="checkbox" checked={housing} onChange={e => setHousing(e.target.checked)} />
              <span className="text-sm">{housing ? 'نقدي' : 'عيني'}</span>
            </label>
          </div>
        </div>
      </Card>

      <div className={`rounded-xl border p-4 flex items-center gap-4 ${dark ? 'bg-sky-950 border-sky-900' : 'bg-sky-50 border-sky-200'}`}>
        <Clock className="w-8 h-8 text-sky-500 flex-shrink-0" />
        <div className="flex-1">
          <p className={`text-sm ${dark ? 'text-sky-300' : 'text-sky-700'}`}>راتب الشهر الأول التناسبي</p>
          <p className="text-lg font-bold">{fmtC(firstMonth.amount, data.company.currency)}</p>
          <p className={`text-xs ${dark ? 'text-sky-400' : 'text-sky-600'}`}>{firstMonth.worked} من {firstMonth.days} يوم</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-700 rounded-2xl p-6 text-white">
          <p className="text-amber-400 text-sm mb-2">التكلفة السنوية (CTC)</p>
          <p className="text-4xl lg:text-5xl font-bold mb-4">{fmt(result.ctc)}</p>
          <p className="text-stone-300 text-sm">{data.company.currency} سنوياً</p>
          <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-slate-600">
            <div><p className="text-xs text-stone-400 mb-1">الشهري</p><p className="text-xl font-bold text-amber-400">{fmtC(result.monthlyGross, data.company.currency)}</p></div>
            <div><p className="text-xs text-stone-400 mb-1">السنوي</p><p className="text-xl font-bold">{fmtC(result.annualGross, data.company.currency)}</p></div>
          </div>
        </div>
        <div className={`rounded-2xl border p-6 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
          <p className="text-xs text-stone-500 mb-1">الوظيفة</p>
          <p className="font-bold mb-4">{info?.nameAr}</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-stone-500">العائلة</span><span className="font-medium">{info?.family}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">أدنى خبرة</span><span className="font-medium">{info?.experience} سنة</span></div>
          </div>
          <button onClick={() => setShowOffer(true)} className="w-full mt-4 py-2.5 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm flex items-center justify-center gap-2">
            <FileText className="w-4 h-4" /> خطاب عرض
          </button>
        </div>
      </div>

      <Card title="تفصيل التكلفة" dark={dark}>
        <div className="space-y-2">
          <Row label="الراتب الأساسي" value={result.base} c={data.company.currency} />
          {result.allow.housing > 0 && <Row label="بدل السكن" value={result.allow.housing} c={data.company.currency} />}
          <Row label="بدل النقل" value={result.allow.transport} c={data.company.currency} />
          {result.allow.hardship > 0 && <Row label="بدل طبيعة العمل" value={result.allow.hardship} c={data.company.currency} />}
          {result.allow.communication > 0 && <Row label="بدل الاتصالات" value={result.allow.communication} c={data.company.currency} />}
          <Row label="إجمالي الشهري" value={result.monthlyGross} c={data.company.currency} amber />
          <Row label="السنوي" value={result.annualGross} c={data.company.currency} />
          <Row label="التأمينات" value={result.annualGross * data.obligations.gosi} c={data.company.currency} muted />
          <Row label="الطبي" value={result.annualGross * data.obligations.medical} c={data.company.currency} muted />
          <Row label="نهاية الخدمة" value={result.annualGross * data.obligations.eosb} c={data.company.currency} muted />
          <Row label="التكلفة السنوية (CTC)" value={result.ctc} c={data.company.currency} dark2 />
        </div>
      </Card>

      {showOffer && <OfferModal data={data} info={info} result={result} hireDate={hireDate} firstMonth={firstMonth} onClose={() => setShowOffer(false)} />}
    </div>
  );
}

function Row({ label, value, c, amber, muted, dark2 }) {
  const cls = dark2 ? 'bg-slate-900 text-white font-bold text-lg' : amber ? 'bg-amber-100 text-amber-900 font-bold' : muted ? 'text-stone-500' : 'text-slate-900 dark:text-white';
  return (
    <div className={`flex justify-between items-center px-4 py-2.5 rounded-lg ${cls}`}>
      <span className="text-sm">{label}</span>
      <span className={amber || dark2 ? 'text-base' : 'text-sm'}>{fmtC(value, c)}</span>
    </div>
  );
}

function OfferModal({ data, info, result, hireDate, firstMonth, onClose }) {
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const dark = data.ui.darkMode;

  const printOffer = () => {
    const content = `
      <h1>خطاب عرض وظيفي - ${data.company.name}</h1>
      <p>التاريخ: ${fmtDate(new Date())}</p>
      <p><strong>السيد/ة: ${name || '_____________'}</strong></p>
      <p><strong>الموضوع:</strong> عرض وظيفي في منصب ${info?.nameAr}</p>
      <p>السلام عليكم ورحمة الله وبركاته،</p>
      <p>بناءً على المقابلات، يسرنا تقديم عرض للعمل في منصب <strong>${info?.nameAr}</strong> ضمن <strong>${info?.family}</strong>:</p>
      <table>
        <tr><th style="text-align:right">البند</th><th style="text-align:right">القيمة</th></tr>
        <tr><td>تاريخ المباشرة</td><td>${fmtDate(hireDate)}</td></tr>
        <tr><td>الدرجة</td><td>${info?.id} - ${info?.nameAr}</td></tr>
        <tr><td>الراتب الأساسي</td><td>${fmtC(result.base, data.company.currency)}</td></tr>
        <tr><td>إجمالي الراتب الشهري</td><td><strong>${fmtC(result.monthlyGross, data.company.currency)}</strong></td></tr>
        <tr><td>راتب الشهر الأول (تناسبي)</td><td>${fmtC(firstMonth.amount, data.company.currency)}</td></tr>
        <tr><td>فترة التجربة</td><td>3 أشهر</td></tr>
        <tr><td>الإجازة السنوية</td><td>${data.benefits.leaveInitial} يوم</td></tr>
        <tr><td>التأمين الطبي</td><td>مشمول للموظف وأسرته</td></tr>
      </table>
      <p>هذا العرض ساري لمدة 14 يوماً. نتطلع للترحيب بكم.</p>
      <p>وتقبلوا فائق الاحترام.</p>
      <br><br>
      <table style="border:none"><tr>
        <td style="border:none"><strong>إدارة الموارد البشرية</strong><br>___________</td>
        <td style="border:none"><strong>توقيع المرشح</strong><br>___________</td>
      </tr></table>
    `;
    printHTML('خطاب عرض وظيفي', content);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className={`rounded-2xl max-w-lg w-full p-6 ${dark ? 'bg-slate-900' : 'bg-white'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">خطاب عرض وظيفي</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3 mb-4">
          <Field label="اسم المرشح" value={name} onChange={setName} dark={dark} />
          <Field label="رقم الهوية" value={id} onChange={setId} dark={dark} />
        </div>
        <div className={`rounded-lg p-4 border text-sm ${dark ? 'bg-slate-800 border-slate-700' : 'bg-stone-50 border-stone-200'}`}>
          <p className="mb-2"><strong>ملخص العرض:</strong></p>
          <div className="space-y-1 text-xs">
            <div>الوظيفة: {info?.nameAr}</div>
            <div>الراتب: {fmtC(result.monthlyGross, data.company.currency)}/شهر</div>
            <div>الشهر الأول: {fmtC(firstMonth.amount, data.company.currency)}</div>
            <div>تاريخ المباشرة: {fmtDate(hireDate)}</div>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={printOffer} className="flex-1 py-2.5 rounded-lg bg-amber-500 text-slate-900 font-semibold flex items-center justify-center gap-2">
            <Printer className="w-4 h-4" /> طباعة PDF
          </button>
          <button onClick={onClose} className="px-6 py-2.5 rounded-lg border border-stone-300 dark:border-slate-700">إغلاق</button>
        </div>
      </div>
    </div>
  );
}

function EOSBView({ data }) {
  const dark = data.ui.darkMode;
  const [selected, setSelected] = useState('manual');
  const [manualSalary, setManualSalary] = useState(10000);
  const [years, setYears] = useState(5);
  const [months, setMonths] = useState(6);
  const [reason, setReason] = useState('termination');

  const salary = useMemo(() => {
    if (selected === 'manual') return manualSalary;
    const emp = data.employees.find(e => e.uid === selected);
    if (!emp) return manualSalary;
    return calcComp(data, emp.grade, emp.step, { includeHousing: emp.housingType !== 'accommodation' }).monthlyGross;
  }, [selected, manualSalary, data]);

  const totalY = years + months / 12;
  const e = calcEOSB(salary, totalY, reason);

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${dark ? 'bg-sky-950 border-sky-900' : 'bg-sky-50 border-sky-200'}`}>
        <Info className="w-5 h-5 text-sky-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm"><strong>نظام العمل السعودي:</strong> نصف شهر عن كل سنة من السنوات الخمس الأولى، وشهر كامل عن كل سنة بعدها. الاستقالة تخصم جزءاً حسب مدة الخدمة.</div>
      </div>
      <Card title="بيانات الحساب" dark={dark}>
        <div className="space-y-4">
          {data.employees.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">الموظف</label>
              <select value={selected} onChange={ev => setSelected(ev.target.value)} className={`w-full px-4 py-3 rounded-lg border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`}>
                <option value="manual">إدخال يدوي</option>
                {data.employees.map(e => <option key={e.uid} value={e.uid}>{e.name} - {e.jobTitle}</option>)}
              </select>
            </div>
          )}
          {selected === 'manual' && <Field label="الراتب الشهري الأخير" value={manualSalary} type="number" onChange={v => setManualSalary(parseFloat(v) || 0)} suffix={data.company.currency} dark={dark} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label="سنوات الخدمة" value={years} type="number" onChange={v => setYears(parseInt(v) || 0)} dark={dark} />
            <Field label="أشهر إضافية" value={months} type="number" onChange={v => setMonths(parseInt(v) || 0)} dark={dark} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">سبب إنهاء الخدمة</label>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              {[
                { id: 'termination', label: 'فسخ من صاحب العمل', hint: '100%' },
                { id: 'retirement', label: 'التقاعد', hint: '100%' },
                { id: 'resignation', label: 'الاستقالة', hint: 'حسب المدة' },
              ].map(r => (
                <button key={r.id} onClick={() => setReason(r.id)}
                  className={`text-right p-3 rounded-lg border-2 ${reason === r.id ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : dark ? 'border-slate-700 bg-slate-800' : 'border-stone-200 bg-white'}`}>
                  <div className="font-medium text-sm">{r.label}</div>
                  <div className="text-xs text-stone-500 mt-0.5">{r.hint}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-2xl p-6 text-white">
          <p className="text-amber-400 text-sm mb-2">المستحق الكامل</p>
          <p className="text-3xl font-bold">{fmt(e.eligible)}</p>
          <p className="text-stone-300 text-sm mt-1">{data.company.currency}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-2xl p-6 text-white">
          <p className="text-emerald-100 text-sm mb-2">المستحق الفعلي ({(e.percentage * 100).toFixed(0)}%)</p>
          <p className="text-3xl font-bold">{fmt(e.actual)}</p>
          <p className="text-emerald-100 text-sm mt-1">{data.company.currency}</p>
        </div>
        {e.deduction > 0 && (
          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-2xl p-6 text-white">
            <p className="text-red-100 text-sm mb-2">المخصوم (استقالة)</p>
            <p className="text-3xl font-bold">{fmt(e.deduction)}</p>
            <p className="text-red-100 text-sm mt-1">{data.company.currency}</p>
          </div>
        )}
      </div>
      <Card title="التفاصيل" dark={dark}>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between p-3 rounded-lg bg-stone-50 dark:bg-slate-800"><span>مدة الخدمة</span><strong>{years} سنة و {months} شهر ({totalY.toFixed(2)} سنة)</strong></div>
          <div className="flex justify-between p-3 rounded-lg bg-stone-50 dark:bg-slate-800"><span>السنوات الخمس ({Math.min(totalY, 5).toFixed(2)} × 0.5 شهر)</span><strong>{fmt(Math.min(totalY, 5) * 0.5 * salary)}</strong></div>
          {totalY > 5 && <div className="flex justify-between p-3 rounded-lg bg-stone-50 dark:bg-slate-800"><span>ما بعد 5 سنوات ({(totalY-5).toFixed(2)} × 1 شهر)</span><strong>{fmt((totalY-5) * salary)}</strong></div>}
        </div>
      </Card>
    </div>
  );
}

function PromoView({ data }) {
  const dark = data.ui.darkMode;
  const [selected, setSelected] = useState('');
  const [newG, setNewG] = useState(5);
  const [newS, setNewS] = useState(1);
  const emp = data.employees.find(e => e.uid === selected);

  useEffect(() => {
    if (emp) { setNewG(Math.min(emp.grade + 1, data.structure.numGrades)); setNewS(1); }
  }, [selected]);

  const impact = useMemo(() => {
    if (!emp) return null;
    const cur = calcComp(data, emp.grade, emp.step);
    const pro = calcComp(data, newG, newS);
    return { cur, pro, monthlyDiff: pro.monthlyGross - cur.monthlyGross, annualDiff: pro.ctc - cur.ctc, pct: (pro.monthlyGross / cur.monthlyGross) - 1 };
  }, [emp, newG, newS, data]);

  if (data.employees.length === 0) {
    return (
      <div className={`rounded-xl border p-12 text-center ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
        <ArrowUpRight className="w-12 h-12 mx-auto mb-3 text-stone-400" />
        <p className="text-lg font-medium mb-1">أضف موظفين أولاً</p>
        <p className="text-sm text-stone-500">تحتاج موظفين لمحاكاة الترقية</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card title="اختر الموظف والترقية" dark={dark}>
        <div className="grid lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">الموظف</label>
            <select value={selected} onChange={e => setSelected(e.target.value)} className={`w-full px-4 py-3 rounded-lg border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`}>
              <option value="">-- اختر --</option>
              {data.employees.map(e => <option key={e.uid} value={e.uid}>{e.name} - د{e.grade} Step {e.step}</option>)}
            </select>
          </div>
          {emp && <>
            <div>
              <label className="block text-sm font-medium mb-2">الدرجة الجديدة</label>
              <select value={newG} onChange={e => setNewG(parseInt(e.target.value))} className={`w-full px-4 py-3 rounded-lg border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`}>
                {data.grades.slice(0, data.structure.numGrades).map(g => <option key={g.id} value={g.id}>د{g.id} - {g.nameAr}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">المستوى</label>
              <select value={newS} onChange={e => setNewS(parseInt(e.target.value))} className={`w-full px-4 py-3 rounded-lg border ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-stone-300'}`}>
                {Array.from({ length: data.structure.numSteps }, (_, i) => <option key={i} value={i+1}>Step {i+1}</option>)}
              </select>
            </div>
          </>}
        </div>
      </Card>
      {impact && (
        <>
          <div className="grid lg:grid-cols-3 gap-4">
            <div className={`rounded-2xl border p-6 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
              <p className="text-xs text-stone-500 mb-2">قبل</p>
              <p className="text-sm text-stone-500 mb-1">د{emp.grade} Step {emp.step}</p>
              <p className="text-2xl font-bold">{fmt(impact.cur.monthlyGross)}</p>
              <p className="text-sm mt-4">CTC: <strong>{fmt(impact.cur.ctc)}</strong></p>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white">
              <p className="text-emerald-100 text-xs mb-2">بعد</p>
              <p className="text-emerald-100 text-sm mb-1">د{newG} Step {newS}</p>
              <p className="text-2xl font-bold">{fmt(impact.pro.monthlyGross)}</p>
              <p className="text-sm mt-4">CTC: <strong>{fmt(impact.pro.ctc)}</strong></p>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl p-6 text-white">
              <p className="text-amber-100 text-xs mb-2">الأثر</p>
              <p className="text-3xl font-bold">+{fmtP(impact.pct)}</p>
              <p className="text-amber-100 text-sm mt-2">شهرياً: +{fmt(impact.monthlyDiff)}</p>
              <p className="text-amber-100 text-sm mt-1">سنوياً: +{fmt(impact.annualDiff)}</p>
            </div>
          </div>
          <Card title="التوصية" dark={dark}>
            {impact.pct < 0.05 && <div className="p-3 rounded-lg bg-red-50 text-red-900 dark:bg-red-900/20 dark:text-red-100 text-sm">⚠️ زيادة أقل من 5% - غير محفزة</div>}
            {impact.pct >= 0.10 && impact.pct <= 0.20 && <div className="p-3 rounded-lg bg-emerald-50 text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-100 text-sm">✓ الزيادة ضمن النطاق المثالي (10-20%)</div>}
            {impact.pct > 0.20 && <div className="p-3 rounded-lg bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-100 text-sm">⚠️ الزيادة تتجاوز 20% - راجع Step المقترح</div>}
          </Card>
        </>
      )}
    </div>
  );
}

function MarketView({ data, setData }) {
  const dark = data.ui.darkMode;
  const grades = data.grades.slice(0, data.structure.numGrades);
  const update = (id, f, v) => setData(p => ({ ...p, marketData: { ...p.marketData, [id]: { ...(p.marketData[id] || {}), [f]: parseFloat(v) || 0 } } }));
  const getDef = (g, k) => {
    const factors = { p25: 0.85, p50: 1.0, p75: 1.15 };
    return Math.round(calcBase(data, g, Math.ceil(data.structure.numSteps / 2)) * factors[k]);
  };
  const chartData = useMemo(() => grades.map(g => {
    const mid = Math.ceil(data.structure.numSteps / 2);
    const company = calcBase(data, g.id, mid);
    const md = data.marketData[g.id] || {};
    return { grade: `د${g.id}`, company: Math.round(company), p25: md.p25 || getDef(g.id, 'p25'), p50: md.p50 || getDef(g.id, 'p50'), p75: md.p75 || getDef(g.id, 'p75') };
  }), [data, grades]);

  return (
    <div className="space-y-4">
      <Card title="مقارنة مع السوق" dark={dark}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e5e5e5'} />
            <XAxis dataKey="grade" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
            <Tooltip formatter={v => fmtC(v)} contentStyle={{ direction: 'rtl', backgroundColor: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 8 }} />
            <Legend />
            <Line type="monotone" dataKey="p25" stroke="#94a3b8" strokeDasharray="5 5" name="السوق P25" />
            <Line type="monotone" dataKey="p50" stroke="#0EA5E9" strokeWidth={2} name="السوق P50" />
            <Line type="monotone" dataKey="p75" stroke="#94a3b8" strokeDasharray="5 5" name="السوق P75" />
            <Line type="monotone" dataKey="company" stroke="#F59E0B" strokeWidth={3} name="الشركة" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <div className={`rounded-xl border overflow-hidden ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-white">
              <tr><th className="px-3 py-3">الدرجة</th><th className="px-3 py-3 text-right">المسمى</th><th className="px-3 py-3">الشركة</th><th className="px-3 py-3">P25</th><th className="px-3 py-3">P50</th><th className="px-3 py-3">P75</th><th className="px-3 py-3">Compa</th><th className="px-3 py-3">الموقع</th></tr>
            </thead>
            <tbody>
              {grades.map(g => {
                const mid = Math.ceil(data.structure.numSteps / 2);
                const avg = calcBase(data, g.id, mid);
                const md = data.marketData[g.id] || {};
                const p25 = md.p25 || getDef(g.id, 'p25');
                const p50 = md.p50 || getDef(g.id, 'p50');
                const p75 = md.p75 || getDef(g.id, 'p75');
                const compa = avg / p50;
                const pos = avg < p25 ? { label: 'دون السوق', c: 'bg-red-100 text-red-700' } : avg < p50 ? { label: 'تنافسي', c: 'bg-amber-100 text-amber-700' } : avg < p75 ? { label: 'قوي', c: 'bg-emerald-100 text-emerald-700' } : { label: 'فوق السوق', c: 'bg-purple-100 text-purple-700' };
                return (
                  <tr key={g.id} className={`border-b ${dark ? 'border-slate-800' : 'border-stone-100'}`}>
                    <td className="px-3 py-2.5 text-center font-bold">{g.id}</td>
                    <td className="px-3 py-2.5 text-right">{g.nameAr}</td>
                    <td className="px-3 py-2.5 text-center font-medium">{fmt(avg)}</td>
                    <td className="px-2 py-2.5"><input type="number" value={p25} onChange={e => update(g.id, 'p25', e.target.value)} className={`w-20 px-2 py-1 text-center rounded text-sm ${dark ? 'bg-slate-800 border-slate-700 border' : 'border border-stone-200'}`} /></td>
                    <td className="px-2 py-2.5"><input type="number" value={p50} onChange={e => update(g.id, 'p50', e.target.value)} className={`w-20 px-2 py-1 text-center rounded text-sm ${dark ? 'bg-slate-800 border-slate-700 border' : 'border border-stone-200'}`} /></td>
                    <td className="px-2 py-2.5"><input type="number" value={p75} onChange={e => update(g.id, 'p75', e.target.value)} className={`w-20 px-2 py-1 text-center rounded text-sm ${dark ? 'bg-slate-800 border-slate-700 border' : 'border border-stone-200'}`} /></td>
                    <td className={`px-3 py-2.5 text-center font-bold ${compa < 0.9 ? 'text-red-600' : compa > 1.1 ? 'text-purple-600' : 'text-emerald-600'}`}>{fmtP(compa)}</td>
                    <td className="px-3 py-2.5 text-center"><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${pos.c}`}>{pos.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CardsView({ data }) {
  const dark = data.ui.darkMode;
  const [sel, setSel] = useState(4);
  const grades = data.grades.slice(0, data.structure.numGrades);
  const g = grades.find(x => x.id === sel);
  if (!g) return null;
  const min = calcBase(data, sel, 1);
  const max = calcBase(data, sel, data.structure.numSteps);
  const medical = sel <= 3 ? 'Class C' : sel <= 7 ? 'Class B' : 'Class A';
  const ticket = sel <= 7 ? 'سياحية' : 'أعمال';

  const printCard = () => {
    const content = `
      <div style="border:2px solid #262626;border-radius:12px;overflow:hidden;max-width:700px;margin:0 auto">
        <h1 style="background:#262626;color:white;text-align:center;padding:20px;margin:0">هيكل الدرجات والمزايا</h1>
        <table style="margin:0">
          <tr><td style="background:#262626;color:white;font-weight:bold;text-align:center">المجموعة الوظيفية | Job Family</td><td style="text-align:center"><strong>${g.family}</strong><br><small>${g.nameEn}</small></td></tr>
          <tr><td style="background:#262626;color:white;font-weight:bold;text-align:center">الدرجة | Grade</td><td style="text-align:center;font-size:24px;font-weight:bold;color:#F59E0B">${g.id}</td></tr>
          <tr><td style="background:#262626;color:white;font-weight:bold;text-align:center">نطاق الأجر</td><td style="text-align:center"><strong>${fmt(min)} - ${fmt(max)} ${data.company.currency}</strong></td></tr>
          <tr><td style="background:#262626;color:white;font-weight:bold;text-align:center">مدة العقد</td><td style="text-align:center">12 شهر</td></tr>
          <tr><td style="background:#262626;color:white;font-weight:bold;text-align:center">الإجازة السنوية</td><td style="text-align:center">${data.benefits.leaveInitial} يوم بعد 12 شهر، ${data.benefits.leaveAfter5} يوم بعد 5 سنوات</td></tr>
          <tr><td style="background:#262626;color:white;font-weight:bold;text-align:center">تذاكر السفر</td><td style="text-align:center">تذكرة ${ticket}</td></tr>
          <tr><td style="background:#262626;color:white;font-weight:bold;text-align:center">المواصلات</td><td style="text-align:center">${fmtP(data.allowances.transport)} من الأساسي بحد أدنى ${fmt(data.allowances.minTransport)} ريال</td></tr>
          <tr><td style="background:#262626;color:white;font-weight:bold;text-align:center">السكن</td><td style="text-align:center">${fmtP(data.allowances.housing)} من الأساسي</td></tr>
          <tr><td style="background:#262626;color:white;font-weight:bold;text-align:center">التأمين الطبي</td><td style="text-align:center"><strong>${medical}</strong></td></tr>
          <tr><td style="background:#262626;color:white;font-weight:bold;text-align:center">بدل التعليم</td><td style="text-align:center">${sel >= data.benefits.educationStartGrade ? fmt(data.benefits.educationAmount) + ' ر.س/سنة لكل ابن' : 'لا يوجد'}</td></tr>
          <tr><td style="background:#262626;color:white;font-weight:bold;text-align:center">المكافآت السنوية</td><td style="text-align:center">${sel >= 9 ? 'حتى 200%' : sel >= data.benefits.bonusStartGrade ? 'حتى 100%' : 'لا توجد'}</td></tr>
        </table>
      </div>
    `;
    printHTML(`بطاقة الدرجة ${sel}`, content);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        {grades.map(x => (
          <button key={x.id} onClick={() => setSel(x.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium ${sel === x.id ? 'bg-slate-900 text-amber-400' : dark ? 'bg-slate-800 text-stone-300' : 'bg-stone-100 text-slate-700'}`}>
            د{x.id}
          </button>
        ))}
      </div>
      <div className="flex justify-end">
        <button onClick={printCard} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium">
          <Printer className="w-4 h-4" /> طباعة / PDF
        </button>
      </div>
      <div className="bg-white rounded-2xl overflow-hidden border-2 border-slate-900 max-w-2xl mx-auto shadow-lg">
        <div className="bg-slate-900 text-white text-center py-4"><h2 className="text-xl font-bold">هيكل الدرجات والمزايا</h2></div>
        <div className="divide-y divide-stone-200">
          <BRow ar="المجموعة الوظيفية" en="Job Family" v={<div><div className="font-bold text-slate-900">{g.family}</div><div className="text-xs text-stone-500 mt-0.5" dir="ltr">{g.nameEn}</div></div>} />
          <BRow ar="الدرجة" en="Grade" v={<span className="text-3xl font-bold text-amber-600">{g.id}</span>} />
          <BRow ar="نطاق الأجر" en="Salary Range" v={<span className="font-bold text-slate-900">{fmt(min)} - {fmt(max)} {data.company.currency}</span>} />
          <BRow ar="مدة العقد" en="Contract" v={<span className="text-slate-900">شهر 12</span>} />
          <BRow ar="الإجازة السنوية" en="Annual Leave" v={<span className="text-slate-900">{data.benefits.leaveInitial} يوم بعد 12 شهر، {data.benefits.leaveAfter5} يوم بعد 5 سنوات</span>} />
          <BRow ar="تذاكر السفر" en="Tickets" v={<span className="text-slate-900">تذكرة {ticket}</span>} />
          <BRow ar="المواصلات" en="Transport" v={<span className="text-slate-900">{fmtP(data.allowances.transport)} من الراتب بحد أدنى {fmt(data.allowances.minTransport)} ريال</span>} />
          <BRow ar="السكن" en="Housing" v={<span className="text-slate-900">{fmtP(data.allowances.housing)} من الأساسي</span>} />
          <BRow ar="التأمين الطبي" en="Medical" v={<span className="font-bold text-slate-900" dir="ltr">{medical}</span>} />
          <BRow ar="بدل تعليم الأبناء" en="Education" v={sel >= data.benefits.educationStartGrade ? `${fmt(data.benefits.educationAmount)} ر.س/سنة لكل ابن` : 'لا يوجد'} muted={sel < data.benefits.educationStartGrade} />
          <BRow ar="المكافآت السنوية" en="Bonus" v={sel >= 9 ? 'حتى 200%' : sel >= data.benefits.bonusStartGrade ? 'حتى 100%' : 'لا توجد'} muted={sel < data.benefits.bonusStartGrade} />
        </div>
      </div>
    </div>
  );
}

function BRow({ ar, en, v, muted }) {
  return (
    <div className="grid grid-cols-[1fr,2fr]">
      <div className="bg-slate-900 text-white p-4 text-center">
        <div className="font-bold text-sm">{ar}</div>
        <div className="text-xs text-stone-400 mt-1" dir="ltr">{en}</div>
      </div>
      <div className={`p-4 flex items-center justify-center text-center text-sm ${muted ? 'text-stone-400 italic' : 'text-slate-900'}`}>{v}</div>
    </div>
  );
}

function MeritView({ data }) {
  const dark = data.ui.darkMode;
  const matrix = [
    { r: 'ممتاز', c: 'bg-emerald-500', q1: data.merit.exceptional * 1.33, q2: data.merit.exceptional * 1.17, q3: data.merit.exceptional, q4: data.merit.exceptional * 0.75 },
    { r: 'فوق المتوقع', c: 'bg-emerald-400', q1: data.merit.exceeds * 1.33, q2: data.merit.exceeds * 1.11, q3: data.merit.exceeds, q4: data.merit.exceeds * 0.78 },
    { r: 'يلبي التوقعات', c: 'bg-amber-400', q1: data.merit.meets * 1.33, q2: data.merit.meets * 1.17, q3: data.merit.meets, q4: data.merit.meets * 0.67 },
    { r: 'بحاجة لتحسين', c: 'bg-orange-400', q1: data.merit.needsImprovement * 2, q2: data.merit.needsImprovement * 1.5, q3: data.merit.needsImprovement, q4: 0 },
    { r: 'غير مُرضي', c: 'bg-red-400', q1: 0, q2: 0, q3: 0, q4: 0 },
  ];
  return (
    <Card title="مصفوفة العلاوات" subtitle="الأداء × موقع الراتب في الدرجة" dark={dark}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-3 py-3 bg-slate-900 text-white text-right">الأداء</th>
              <th className="px-3 py-3 bg-slate-700 text-white text-center">Q1</th>
              <th className="px-3 py-3 bg-slate-700 text-white text-center">Q2</th>
              <th className="px-3 py-3 bg-slate-700 text-white text-center">Q3</th>
              <th className="px-3 py-3 bg-slate-700 text-white text-center">Q4</th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={i} className={`border-b ${dark ? 'border-slate-800' : 'border-stone-200'}`}>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2"><div className={`w-2 h-8 rounded ${row.c}`}></div><span className="font-medium">{row.r}</span></div>
                </td>
                {[row.q1, row.q2, row.q3, row.q4].map((v, j) => (
                  <td key={j} className="px-3 py-3 text-center">
                    <span className="inline-block px-3 py-1.5 rounded-lg font-bold" style={{ backgroundColor: v > 0 ? `rgba(16, 185, 129, ${Math.min(v * 8, 1)})` : dark ? '#334155' : '#f1f5f9', color: v > 0.04 ? 'white' : dark ? '#cbd5e1' : '#0f172a' }}>{fmtP(v)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function BudgetView({ data }) {
  const dark = data.ui.darkMode;
  const [gOpt, setGOpt] = useState(0.08);
  const [gMod, setGMod] = useState(0.05);
  const [gCon, setGCon] = useState(0.03);
  const base = useMemo(() => {
    if (data.employees.length > 0) return data.employees.reduce((s, e) => s + calcComp(data, e.grade, e.step, { includeHousing: e.housingType !== 'accommodation' }).ctc, 0);
    let t = 0;
    for (let g = 1; g <= data.structure.numGrades; g++) t += calcComp(data, g, Math.ceil(data.structure.numSteps / 2)).ctc * Math.max(1, Math.round(50/g));
    return t;
  }, [data]);
  const projection = useMemo(() => Array.from({ length: 5 }, (_, y) => ({
    year: `س ${y+1}`,
    'متفائل': base * Math.pow(1 + gOpt, y),
    'معتدل': base * Math.pow(1 + gMod, y),
    'متحفظ': base * Math.pow(1 + gCon, y),
  })), [base, gOpt, gMod, gCon]);
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-900 to-slate-700 rounded-2xl p-6 text-white">
        <p className="text-amber-400 text-sm mb-2">إجمالي كتلة الرواتب السنوية (CTC)</p>
        <p className="text-4xl lg:text-5xl font-bold">{fmt(base)}</p>
        <p className="text-stone-300 text-sm mt-2">{data.employees.length > 0 ? `بناءً على ${data.employees.length} موظف` : 'تقدير افتراضي'}</p>
      </div>
      <Card title="سيناريوهات النمو (5 سنوات)" dark={dark}>
        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          <SSlider label="متفائل" v={gOpt} onC={setGOpt} c="emerald" dark={dark} />
          <SSlider label="معتدل" v={gMod} onC={setGMod} c="amber" dark={dark} />
          <SSlider label="متحفظ" v={gCon} onC={setGCon} c="sky" dark={dark} />
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={projection}>
            <CartesianGrid strokeDasharray="3 3" stroke={dark ? '#334155' : '#e5e5e5'} />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000000).toFixed(1)}M`} />
            <Tooltip formatter={v => fmtC(v)} contentStyle={{ direction: 'rtl', backgroundColor: dark ? '#1e293b' : '#fff', border: 'none', borderRadius: 8 }} />
            <Legend />
            <Line type="monotone" dataKey="متفائل" stroke="#10B981" strokeWidth={2} />
            <Line type="monotone" dataKey="معتدل" stroke="#F59E0B" strokeWidth={2} />
            <Line type="monotone" dataKey="متحفظ" stroke="#0EA5E9" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function SSlider({ label, v, onC, c, dark }) {
  const colors = { emerald: 'bg-emerald-500', amber: 'bg-amber-500', sky: 'bg-sky-500' };
  return (
    <div className={`rounded-lg border p-4 ${dark ? 'border-slate-700' : 'border-stone-200'}`}>
      <div className="flex justify-between items-center mb-2"><span className="text-sm font-medium">{label}</span><span className={`text-white text-xs px-2 py-0.5 rounded ${colors[c]}`}>{fmtP(v)}</span></div>
      <input type="range" min={0} max={0.15} step={0.005} value={v} onChange={e => onC(parseFloat(e.target.value))} className="w-full" />
    </div>
  );
}

function ScenariosView({ data, setData }) {
  const dark = data.ui.darkMode;
  const save = () => {
    const name = prompt('اسم السيناريو:');
    if (!name) return;
    setData(p => ({
      ...p,
      scenarios: [...(p.scenarios || []), { uid: Date.now().toString(), name, createdAt: new Date().toISOString(), snapshot: { structure: { ...p.structure }, allowances: { ...p.allowances }, obligations: { ...p.obligations } } }]
    }));
  };
  const del = (uid) => window.confirm('حذف؟') && setData(p => ({ ...p, scenarios: p.scenarios.filter(s => s.uid !== uid) }));
  const apply = (s) => window.confirm('تطبيق هذا السيناريو؟') && setData(p => ({ ...p, structure: s.snapshot.structure, allowances: s.snapshot.allowances, obligations: s.snapshot.obligations }));
  const scenarios = data.scenarios || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-stone-500">احفظ نسخاً من إعداداتك للمقارنة</p>
        <button onClick={save} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm">
          <Plus className="w-4 h-4" /> حفظ الحالي
        </button>
      </div>
      {scenarios.length === 0 ? (
        <div className={`rounded-xl border p-12 text-center ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
          <GitCompare className="w-12 h-12 mx-auto mb-3 text-stone-400" />
          <p className="text-lg font-medium mb-1">لا توجد سيناريوهات</p>
          <p className="text-sm text-stone-500">احفظ الإعدادات، عدّلها، ثم قارن</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {scenarios.map(s => {
            const min = s.snapshot.structure.baseStartingSalary;
            const max = min * Math.pow(1 + s.snapshot.structure.gradeDifferential, s.snapshot.structure.numGrades - 1) * Math.pow(1 + s.snapshot.structure.stepDifferential, s.snapshot.structure.numSteps - 1);
            return (
              <div key={s.uid} className={`rounded-xl border p-4 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div><h3 className="font-bold">{s.name}</h3><p className="text-xs text-stone-500">{new Date(s.createdAt).toLocaleString('ar-SA')}</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => apply(s)} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-xs font-medium">تطبيق</button>
                    <button onClick={() => del(s.uid)} className="p-1.5 rounded text-red-600 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div className="p-2 rounded bg-stone-50 dark:bg-slate-800"><p className="text-xs text-stone-500">الدرجات</p><p className="font-bold">{s.snapshot.structure.numGrades}</p></div>
                  <div className="p-2 rounded bg-stone-50 dark:bg-slate-800"><p className="text-xs text-stone-500">أدنى</p><p className="font-bold">{fmt(min)}</p></div>
                  <div className="p-2 rounded bg-stone-50 dark:bg-slate-800"><p className="text-xs text-stone-500">أعلى</p><p className="font-bold">{fmt(max)}</p></div>
                  <div className="p-2 rounded bg-stone-50 dark:bg-slate-800"><p className="text-xs text-stone-500">السكن</p><p className="font-bold">{fmtP(s.snapshot.allowances.housing)}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportView({ data }) {
  const dark = data.ui.darkMode;
  const rpt = useMemo(() => {
    const { numGrades, numSteps } = data.structure;
    const min = calcBase(data, 1, 1);
    const max = calcBase(data, numGrades, numSteps);
    let totalCTC = 0;
    const byGrade = {};
    const byNat = {};
    data.employees.forEach(emp => {
      const c = calcComp(data, emp.grade, emp.step, { includeHousing: emp.housingType !== 'accommodation' });
      totalCTC += c.ctc;
      if (!byGrade[emp.grade]) byGrade[emp.grade] = { count: 0, ctc: 0 };
      byGrade[emp.grade].count++;
      byGrade[emp.grade].ctc += c.ctc;
      const nk = emp.nationality === 'سعودي' ? 'سعودي' : 'غير سعودي';
      if (!byNat[nk]) byNat[nk] = { count: 0, ctc: 0 };
      byNat[nk].count++;
      byNat[nk].ctc += c.ctc;
    });
    return { min, max, totalCTC, byGrade, byNat, empCount: data.employees.length };
  }, [data]);

  const print = () => {
    let byGradeRows = '';
    Object.entries(rpt.byGrade).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).forEach(([g, info]) => {
      byGradeRows += `<tr><td>د${g}</td><td>${data.grades.find(x => x.id === parseInt(g))?.nameAr}</td><td style="text-align:center">${info.count}</td><td style="text-align:center">${fmt(info.ctc)}</td><td style="text-align:center">${fmtP(info.ctc / rpt.totalCTC)}</td></tr>`;
    });
    let byNatRows = '';
    Object.entries(rpt.byNat).forEach(([n, info]) => {
      byNatRows += `<tr><td>${n}</td><td style="text-align:center">${info.count}</td><td style="text-align:center">${fmtP(info.count / rpt.empCount)}</td><td style="text-align:center">${fmt(info.ctc)}</td></tr>`;
    });
    const content = `
      <h1>تقرير الأثر المالي لسلم الرواتب</h1>
      <p style="color:#666">${data.company.name} | ${fmtDate(new Date())}</p>
      <h2>١. الملخص التنفيذي</h2>
      <p>يقدم هذا التقرير تحليلاً مالياً شاملاً لسلم الرواتب المعتمد للعام ${data.company.year}. يتضمن السلم <strong>${data.structure.numGrades} درجة</strong> و <strong>${data.structure.numSteps} مستويات</strong> لكل درجة، بأدنى راتب ${fmtC(rpt.min, data.company.currency)} وأعلى راتب ${fmtC(rpt.max, data.company.currency)}. ${rpt.empCount > 0 ? `عدد الموظفين ${rpt.empCount} بإجمالي كتلة رواتب سنوية ${fmtC(rpt.totalCTC, data.company.currency)}.` : ''}</p>
      <div class="kpi">
        <table style="border:none">
          <tr>
            <td style="border:none"><strong>أدنى راتب</strong><br>${fmtC(rpt.min, data.company.currency)}</td>
            <td style="border:none"><strong>أعلى راتب</strong><br>${fmtC(rpt.max, data.company.currency)}</td>
            <td style="border:none"><strong>الموظفون</strong><br>${rpt.empCount}</td>
            <td style="border:none"><strong>CTC السنوي</strong><br>${fmtC(rpt.totalCTC, data.company.currency)}</td>
          </tr>
        </table>
      </div>
      ${Object.keys(rpt.byGrade).length > 0 ? `
      <h2>٢. توزيع الموظفين على الدرجات</h2>
      <table>
        <thead><tr><th>الدرجة</th><th>المسمى</th><th>العدد</th><th>CTC</th><th>%</th></tr></thead>
        <tbody>${byGradeRows}</tbody>
      </table>` : '<h2>٢. الموظفون</h2><p>لم يتم إضافة موظفين بعد.</p>'}
      ${Object.keys(rpt.byNat).length > 0 ? `
      <h2>٣. توزيع حسب الجنسية</h2>
      <table>
        <thead><tr><th>الفئة</th><th>العدد</th><th>النسبة</th><th>CTC</th></tr></thead>
        <tbody>${byNatRows}</tbody>
      </table>` : ''}
      <h2>٤. الإعدادات المالية</h2>
      <table>
        <tr><td>بدل السكن</td><td>${fmtP(data.allowances.housing)}</td></tr>
        <tr><td>بدل النقل</td><td>${fmtP(data.allowances.transport)} بحد أدنى ${fmt(data.allowances.minTransport)} ر.س</td></tr>
        <tr><td>التأمينات</td><td>${fmtP(data.obligations.gosi)}</td></tr>
        <tr><td>التأمين الطبي</td><td>${fmtP(data.obligations.medical)}</td></tr>
        <tr><td>نهاية الخدمة</td><td>${fmtP(data.obligations.eosb)}</td></tr>
      </table>
      <h2>٥. التوصيات</h2>
      <ul>
        <li>إجراء مسح دوري لبيانات السوق كل 12 شهراً.</li>
        <li>مراجعة المضاعف (${(rpt.max/rpt.min).toFixed(1)}x) للتأكد من انسجامه مع سياسات الأجر العادل.</li>
        <li>الالتزام بمصفوفة العلاوات لضمان مبدأ الاستحقاق.</li>
        <li>توثيق الاستثناءات للحفاظ على الشفافية.</li>
      </ul>
      <div class="footer">
        <p>تم إنشاء هذا التقرير آلياً من أداة سلم الرواتب</p>
        <p>${data.company.name} - ${fmtDate(new Date())}</p>
      </div>
    `;
    printHTML('التقرير المالي', content);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={print} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold text-sm">
          <Printer className="w-4 h-4" /> طباعة / PDF
        </button>
      </div>
      <div className={`rounded-xl border p-6 lg:p-8 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-white border-stone-200'}`}>
        <h1 className="text-2xl font-bold mb-2">تقرير الأثر المالي</h1>
        <p className="text-sm text-stone-500 mb-6">{data.company.name} | {fmtDate(new Date())}</p>
        <h2 className="text-lg font-bold mb-3 mt-6 text-slate-900 dark:text-white border-b-2 border-amber-500 pb-1 inline-block">١. الملخص التنفيذي</h2>
        <p className="text-sm leading-relaxed mb-4">
          يقدم هذا التقرير تحليلاً مالياً شاملاً لسلم الرواتب. يتضمن السلم <strong>{data.structure.numGrades} درجة</strong> و <strong>{data.structure.numSteps} مستويات</strong>، 
          بأدنى راتب <strong>{fmtC(rpt.min, data.company.currency)}</strong> وأعلى راتب <strong>{fmtC(rpt.max, data.company.currency)}</strong>.
          {rpt.empCount > 0 && <> عدد الموظفين <strong>{rpt.empCount}</strong> بإجمالي كتلة رواتب سنوية <strong>{fmtC(rpt.totalCTC, data.company.currency)}</strong>.</>}
        </p>
        <div className="bg-stone-50 dark:bg-slate-800 p-4 rounded-lg border-r-4 border-amber-500 my-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div><p className="text-xs text-stone-500">أدنى راتب</p><p className="font-bold text-lg">{fmtC(rpt.min, data.company.currency)}</p></div>
            <div><p className="text-xs text-stone-500">أعلى راتب</p><p className="font-bold text-lg">{fmtC(rpt.max, data.company.currency)}</p></div>
            <div><p className="text-xs text-stone-500">الموظفون</p><p className="font-bold text-lg">{rpt.empCount}</p></div>
            <div><p className="text-xs text-stone-500">CTC السنوي</p><p className="font-bold text-lg">{fmtC(rpt.totalCTC, data.company.currency)}</p></div>
          </div>
        </div>
        {Object.keys(rpt.byGrade).length > 0 && (
          <>
            <h2 className="text-lg font-bold mb-3 mt-6">٢. توزيع الموظفين على الدرجات</h2>
            <table className="w-full text-sm border-collapse">
              <thead><tr className="bg-slate-900 text-white"><th className="p-2 text-right">الدرجة</th><th className="p-2 text-right">المسمى</th><th className="p-2">العدد</th><th className="p-2">CTC</th><th className="p-2">%</th></tr></thead>
              <tbody>
                {Object.entries(rpt.byGrade).sort((a,b) => parseInt(a[0]) - parseInt(b[0])).map(([g, i]) => (
                  <tr key={g} className="border-b"><td className="p-2">د{g}</td><td className="p-2">{data.grades.find(x => x.id === parseInt(g))?.nameAr}</td><td className="p-2 text-center">{i.count}</td><td className="p-2 text-center">{fmt(i.ctc)}</td><td className="p-2 text-center">{fmtP(i.ctc/rpt.totalCTC)}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <h2 className="text-lg font-bold mb-3 mt-6">٣. الإعدادات المالية</h2>
        <table className="w-full text-sm border-collapse">
          <tbody>
            <tr className="border-b"><td className="p-2 font-medium">بدل السكن</td><td className="p-2">{fmtP(data.allowances.housing)}</td></tr>
            <tr className="border-b"><td className="p-2 font-medium">بدل النقل</td><td className="p-2">{fmtP(data.allowances.transport)} بحد أدنى {fmt(data.allowances.minTransport)}</td></tr>
            <tr className="border-b"><td className="p-2 font-medium">التأمينات (GOSI)</td><td className="p-2">{fmtP(data.obligations.gosi)}</td></tr>
            <tr className="border-b"><td className="p-2 font-medium">الطبي</td><td className="p-2">{fmtP(data.obligations.medical)}</td></tr>
            <tr className="border-b"><td className="p-2 font-medium">نهاية الخدمة</td><td className="p-2">{fmtP(data.obligations.eosb)}</td></tr>
          </tbody>
        </table>
        <h2 className="text-lg font-bold mb-3 mt-6">٤. التوصيات</h2>
        <ul className="space-y-2 text-sm">
          <li>• إجراء مسح دوري لبيانات السوق كل 12 شهراً.</li>
          <li>• مراجعة المضاعف ({(rpt.max/rpt.min).toFixed(1)}x) للتأكد من انسجامه.</li>
          <li>• الالتزام بمصفوفة العلاوات السنوية.</li>
          <li>• توثيق الاستثناءات وأسبابها.</li>
        </ul>
      </div>
    </div>
  );
}

function MethodView({ data }) {
  const dark = data.ui.darkMode;
  const sections = [
    { title: '1. المنهجية العلمية لبناء السلم', icon: BookOpen, lines: [
      'يعتمد السلم على منهجية Broadbanding المطبقة في أفضل الشركات الاستشارية.',
      `يتضمن ${data.structure.numGrades} درجة بنسبة فرق ${fmtP(data.structure.gradeDifferential)}.`,
      `كل درجة تحتوي ${data.structure.numSteps} مستويات بنسبة ${fmtP(data.structure.stepDifferential)}.`,
      'الصيغة: Salary = Base × (1 + GradeDiff)^(Grade-1) × (1 + StepDiff)^(Step-1)',
    ]},
    { title: '2. سياسة تحديد الراتب الابتدائي', icon: Target, lines: [
      'يُحدَّد الراتب الابتدائي بناءً على:',
      '• الدرجة الوظيفية المعتمدة',
      '• سنوات الخبرة والمؤهل',
      '• مقارنة السوق',
      '• التوازن الداخلي',
      'لا يجوز التوظيف فوق Step 5 دون اعتماد الرئيس التنفيذي.',
    ]},
    { title: '3. سياسة العلاوات والترقيات', icon: Award, lines: [
      'العلاوة السنوية بناءً على مصفوفة الأداء × موقع الراتب.',
      'الترقية تستلزم شغور + استيفاء المتطلبات + اعتماد اللجنة.',
      '• الترقية: تغيير الدرجة (10-20% زيادة)',
      '• العلاوة: ضمن الدرجة (2-8%)',
      'لا تجتمع في نفس السنة.',
    ]},
    { title: '4. سياسة مقارنة السوق', icon: TrendingUp, lines: [
      'الاستهداف: P50 من السوق كحد أدنى.',
      'الوظائف الحرجة قد ترتفع إلى P75.',
      'المصادر: Mercer, Korn Ferry, Aon.',
      'المراجعة: سنوياً + عند تغيرات كبيرة.',
    ]},
    { title: '5. الحوكمة والمسؤوليات', icon: Users, lines: [
      'مجلس الإدارة: اعتماد الإطار العام.',
      'لجنة المكافآت: الإشراف والمراجعة.',
      'الرئيس التنفيذي: اعتماد الدرجات 8-10.',
      'المدير المالي: ضمان الموارد.',
      'مدير الموارد البشرية: التطبيق.',
    ]},
    { title: '6. مبدأ السرية', icon: FileText, lines: [
      'جميع بيانات الرواتب سرية.',
      'إفشاء راتب موظف آخر مخالفة تأديبية.',
      'حق التظلم مكفول للموظف.',
    ]},
  ];
  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${dark ? 'bg-emerald-950 border-emerald-900' : 'bg-emerald-50 border-emerald-200'}`}>
        <BookOpen className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm"><strong>وثيقة المنهجية والسياسة</strong> — مرجع رسمي للحوكمة والمراجعة.</div>
      </div>
      {sections.map((s, i) => {
        const Icon = s.icon;
        return (
          <Card key={i} title={s.title} dark={dark}>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-amber-600" />
              </div>
              <div className="space-y-2 text-sm leading-relaxed">
                {s.lines.map((l, j) => <p key={j} className={l.startsWith('•') ? 'mr-4' : ''}>{l}</p>)}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
