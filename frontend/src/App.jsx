import React, { useState, useMemo, useEffect } from "react";
import {
  LayoutDashboard, FileText, Map as MapIcon, IndianRupee, FileBarChart,
  Plus, ChevronRight, Users, CheckCircle2, X, LogOut, Loader2, AlertCircle,
  Calculator, Upload, FileIcon, TrendingUp, Sparkles, AlertTriangle, Clock, Home
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { api } from "./api";
import GISMap from "./GISMap";

const STAGES = ["Proposed", "Notified", "Declared", "Surveyed", "Awarded", "Possession", "R&R complete"];
const STAGE_COLORS = ["#94A3B8", "#60A5FA", "#38BDF8", "#FBBF24", "#FB923C", "#34D399", "#10B981"];
const OFFICIAL_ROLES = ["district_officer", "state_official", "central_ministry"];

const inr = (n) => "₹" + (n / 10000000).toFixed(2) + " Cr";
const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
const fmtDateLong = (d) => new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function StageBadge({ stage }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: STAGE_COLORS[stage] + "22", color: STAGE_COLORS[stage] }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[stage] }} />
      {STAGES[stage]}
    </span>
  );
}

function Stepper({ stage, onAdvance, canAdvance, advancing }) {
  return (
    <div>
      <div className="flex items-center">
        {STAGES.map((s, i) => (
          <React.Fragment key={s}>
            <div className="flex flex-col items-center" style={{ width: 90 }}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2"
                style={{
                  backgroundColor: i <= stage ? STAGE_COLORS[i] : "white",
                  borderColor: STAGE_COLORS[i],
                  color: i <= stage ? "white" : STAGE_COLORS[i],
                }}
              >
                {i < stage ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className="text-[10px] text-slate-500 mt-1 text-center leading-tight">{s}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div className="flex-1 h-0.5" style={{ backgroundColor: i < stage ? STAGE_COLORS[i] : "#E2E8F0" }} />
            )}
          </React.Fragment>
        ))}
      </div>
      {canAdvance && stage < STAGES.length - 1 && (
        <button
          onClick={onAdvance}
          disabled={advancing}
          className="mt-4 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-md hover:bg-slate-700 transition-colors flex items-center gap-1 disabled:opacity-50"
        >
          {advancing ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
          Advance to {STAGES[stage + 1]}
        </button>
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function BottleneckPanel({ onOpen }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getBottlenecks().then(setReport).catch((e) => setError(e.message));
  }, []);

  const styles = {
    delayed: { bg: "#FEF2F2", fg: "#DC2626", label: "Delayed" },
    at_risk: { bg: "#FFFBEB", fg: "#D97706", label: "At risk" },
    on_track: { bg: "#F0FDF4", fg: "#16A34A", label: "On track" },
  };

  if (error) return null;
  if (!report) return <div className="bg-white rounded-xl border border-slate-200 p-5 text-xs text-slate-400 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Analysing stage timelines…</div>;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-start justify-between mb-1">
        <div className="text-sm font-medium text-slate-700 flex items-center gap-1.5"><AlertTriangle size={15} className="text-amber-500" /> Bottleneck &amp; delay watch</div>
        {report.bottleneck_stage && (
          <span className="text-[11px] bg-red-50 text-red-600 px-2 py-1 rounded-full font-medium">Most delays at: {report.bottleneck_stage}</span>
        )}
      </div>
      <div className="text-[11px] text-slate-400 mb-4">
        Computed from the audit log: days spent in the current stage versus the planning target and the average other proposals actually took.
      </div>
      <div className="space-y-2">
        {report.items.length === 0 && <div className="text-xs text-slate-400">No proposals in progress.</div>}
        {report.items.map((i) => {
          const st = styles[i.status];
          return (
            <div key={i.proposal_id} onClick={() => onOpen(i.proposal_id)} className="flex items-center justify-between rounded-lg px-3 py-2.5 cursor-pointer hover:opacity-80" style={{ backgroundColor: st.bg }}>
              <div>
                <div className="text-sm font-medium text-slate-800">{i.project_name}</div>
                <div className="text-[11px] text-slate-500">
                  {i.stage_label} · {i.days_in_stage} days in stage (target {i.target_days}d{i.avg_days_for_stage != null ? `, typical ${i.avg_days_for_stage}d` : ""})
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold" style={{ color: st.fg }}>{st.label}</div>
                {i.over_by_days > 0 && <div className="text-[10px]" style={{ color: st.fg }}>+{i.over_by_days} days over</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RRPanel({ proposalId, isOfficial }) {
  const [rr, setRR] = useState(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const load = () => api.getRR(proposalId).then((r) => { setRR(r); setValue(String(r.families_rehabilitated)); }).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [proposalId]);

  const save = async () => {
    setError("");
    try {
      const r = await api.updateRR(proposalId, Number(value));
      setRR(r);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!rr) return <div className="text-xs text-slate-400">Loading…</div>;

  return (
    <div>
      {error && <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg mb-3"><AlertCircle size={13} /> {error}</div>}
      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
        <span>Families rehabilitated</span>
        <span>{rr.families_rehabilitated} / {rr.families_affected} ({rr.progress_pct}%)</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div className="h-full bg-sky-500" style={{ width: `${rr.progress_pct}%` }} />
      </div>
      {isOfficial && rr.families_affected > 0 && (
        <div className="flex items-end gap-2">
          <div>
            <label className="text-[10px] text-slate-400">Update families rehabilitated</label>
            <input type="number" min="0" max={rr.families_affected} value={value} onChange={(e) => setValue(e.target.value)} className="border border-slate-200 rounded-md px-2 py-1.5 text-xs mt-0.5 w-40 block" />
          </div>
          <button onClick={save} className="text-xs font-medium bg-sky-600 text-white px-3 py-1.5 rounded-md hover:bg-sky-700">Save</button>
        </div>
      )}
      {rr.families_affected === 0 && <div className="text-xs text-slate-400">No affected families recorded for this proposal yet.</div>}
    </div>
  );
}

function PredictiveEstimate({ proposal }) {
  const estimate = useMemo(() => {
    if (!proposal || proposal.stage === 0) return null;
    const created = new Date(proposal.created_at);
    const now = new Date();
    const daysElapsed = Math.max(1, (now - created) / (1000 * 60 * 60 * 24));
    const avgDaysPerStage = daysElapsed / proposal.stage;
    const remainingStages = STAGES.length - 1 - proposal.stage;
    const remainingDays = Math.round(avgDaysPerStage * remainingStages);
    const projected = new Date(now.getTime() + remainingDays * 24 * 60 * 60 * 1000);
    return { avgDaysPerStage: Math.round(avgDaysPerStage), remainingDays, projected };
  }, [proposal]);

  if (!estimate) {
    return (
      <div className="bg-indigo-50 rounded-lg p-4 text-xs text-indigo-400">
        Not enough stage history yet to project a completion date — this fills in once the proposal advances at least once.
      </div>
    );
  }

  return (
    <div className="bg-indigo-50 rounded-lg p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-indigo-700 mb-2">
        <Sparkles size={13} /> Predicted completion
      </div>
      <div className="text-lg font-semibold text-indigo-900">{fmtDateLong(estimate.projected)}</div>
      <div className="text-[11px] text-indigo-400 mt-1">
        Based on this proposal's own pace so far — ~{estimate.avgDaysPerStage} days/stage, {estimate.remainingDays} days remaining across {STAGES.length - 1 - proposal.stage} stages.
      </div>
    </div>
  );
}

function CompensationPanel({ proposalId, isOfficial }) {
  const [comp, setComp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ market_value_per_ha: "", multiplication_factor: "1.5", asset_value: "0", delay_months: "0" });
  const [calculating, setCalculating] = useState(false);
  const [disburseAmount, setDisburseAmount] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.getCompensation(proposalId)
      .then(setComp)
      .catch(() => setComp(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [proposalId]);

  const calculate = async () => {
    setError("");
    setCalculating(true);
    try {
      const result = await api.calculateCompensation(proposalId, {
        market_value_per_ha: Number(form.market_value_per_ha),
        multiplication_factor: Number(form.multiplication_factor),
        asset_value: Number(form.asset_value),
        delay_months: Number(form.delay_months),
      });
      setComp(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setCalculating(false);
    }
  };

  const disburse = async () => {
    if (!disburseAmount) return;
    setError("");
    try {
      const result = await api.disburse(proposalId, Number(disburseAmount));
      setComp(result);
      setDisburseAmount("");
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="text-xs text-slate-400 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Loading compensation…</div>;

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">
          <AlertCircle size={13} /> {error}
        </div>
      )}

      {comp && (
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-[10px] text-slate-500 mb-0.5">Market value</div>
            <div className="text-sm font-semibold text-slate-800">{inr(comp.base_market_value)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-[10px] text-slate-500 mb-0.5">Solatium (100%)</div>
            <div className="text-sm font-semibold text-slate-800">{inr(comp.solatium_amount)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3">
            <div className="text-[10px] text-slate-500 mb-0.5">Delay interest</div>
            <div className="text-sm font-semibold text-slate-800">{inr(comp.interest_amount)}</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-3">
            <div className="text-[10px] text-emerald-600 mb-0.5">Total compensation</div>
            <div className="text-sm font-semibold text-emerald-700">{inr(comp.total_compensation)}</div>
          </div>
        </div>
      )}

      {comp && (
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Disbursed</span>
            <span>{inr(comp.amount_disbursed)} / {inr(comp.total_compensation)}</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${(comp.amount_disbursed / comp.total_compensation) * 100}%` }} />
          </div>
        </div>
      )}

      {isOfficial && (
        <div className="border-t border-slate-100 pt-4">
          <div className="text-xs font-medium text-slate-600 mb-2 flex items-center gap-1.5">
            <Calculator size={13} /> {comp ? "Recalculate" : "Calculate"} compensation (Sections 26–30)
          </div>
          <div className="grid grid-cols-4 gap-2 mb-2">
            <div>
              <label className="text-[10px] text-slate-400">Market value / ha (₹)</label>
              <input type="number" value={form.market_value_per_ha} onChange={(e) => setForm({ ...form, market_value_per_ha: e.target.value })} className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs mt-0.5" placeholder="500000" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">Multiplier (1–2)</label>
              <input type="number" step="0.1" min="1" max="2" value={form.multiplication_factor} onChange={(e) => setForm({ ...form, multiplication_factor: e.target.value })} className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs mt-0.5" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">Asset value (₹)</label>
              <input type="number" value={form.asset_value} onChange={(e) => setForm({ ...form, asset_value: e.target.value })} className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs mt-0.5" />
            </div>
            <div>
              <label className="text-[10px] text-slate-400">Delay (months)</label>
              <input type="number" value={form.delay_months} onChange={(e) => setForm({ ...form, delay_months: e.target.value })} className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-xs mt-0.5" />
            </div>
          </div>
          <button onClick={calculate} disabled={calculating || !form.market_value_per_ha} className="text-xs font-medium bg-slate-900 text-white px-3 py-1.5 rounded-md hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1.5">
            {calculating && <Loader2 size={12} className="animate-spin" />} Calculate award
          </button>

          {comp && (
            <div className="mt-4 flex items-end gap-2">
              <div>
                <label className="text-[10px] text-slate-400">Disburse amount (₹)</label>
                <input type="number" value={disburseAmount} onChange={(e) => setDisburseAmount(e.target.value)} className="border border-slate-200 rounded-md px-2 py-1.5 text-xs mt-0.5 w-40" placeholder="e.g. 5000000" />
              </div>
              <button onClick={disburse} className="text-xs font-medium bg-emerald-600 text-white px-3 py-1.5 rounded-md hover:bg-emerald-700">
                Record disbursement
              </button>
            </div>
          )}
        </div>
      )}

      {!comp && !isOfficial && (
        <div className="text-xs text-slate-400">Compensation has not been assessed for this proposal yet.</div>
      )}
    </div>
  );
}

function DocumentsPanel({ proposalId }) {
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    api.listDocuments(proposalId).then(setDocs).catch(() => setDocs([]));
  };

  useEffect(() => { load(); }, [proposalId]);

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      await api.uploadDocument(proposalId, file);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div>
      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg mb-3">
          <AlertCircle size={13} /> {error}
        </div>
      )}
      <div className="space-y-2 mb-3">
        {docs.length === 0 ? (
          <div className="text-xs text-slate-400">No documents uploaded yet.</div>
        ) : (
          docs.map((d) => (
            <div key={d.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
              <span className="flex items-center gap-2 text-slate-700"><FileIcon size={13} className="text-slate-400" /> {d.filename} <span className="text-slate-400">v{d.version}</span></span>
              <span className="text-slate-400">{fmtDate(d.uploaded_at)}</span>
            </div>
          ))
        )}
      </div>
      <label className="inline-flex items-center gap-1.5 text-xs font-medium bg-white border border-slate-200 px-3 py-1.5 rounded-md cursor-pointer hover:bg-slate-50">
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {uploading ? "Uploading…" : "Upload document"}
        <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
      </label>
    </div>
  );
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await api.login(username, password);
      onLogin(user);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-slate-50 flex items-center justify-center" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 p-8 w-96">
        <div className="text-[#0F2A47] font-semibold text-xl mb-1">LandSync AI</div>
        <div className="text-slate-400 text-sm mb-6">Sign in to the national land acquisition system</div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg mb-4">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <label className="text-xs text-slate-500 mb-1 block">Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3" placeholder="e.g. officer1" />

        <label className="text-xs text-slate-500 mb-1 block">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-5" placeholder="••••••••" />

        <button type="submit" disabled={loading} className="w-full bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {loading && <Loader2 size={14} className="animate-spin" />}
          Sign in
        </button>

        <div className="text-[11px] text-slate-400 mt-4 leading-relaxed">
          No account yet? Register a user first via the API docs at{" "}
          <code className="bg-slate-100 px-1 rounded">localhost:8000/docs</code> — try{" "}
          <code className="bg-slate-100 px-1 rounded">POST /auth/register</code> with a role of{" "}
          <code className="bg-slate-100 px-1 rounded">citizen</code> or{" "}
          <code className="bg-slate-100 px-1 rounded">district_officer</code>.
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(api.getStoredUser());
  const [view, setView] = useState("dashboard");
  const [proposals, setProposals] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ project_name: "", state: "", district: "", area_total_ha: "", latitude: "", longitude: "" });
  const [loading, setLoading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isOfficial = user && OFFICIAL_ROLES.includes(user.role);

  const loadProposals = async () => {
    setLoading(true);
    try {
      setProposals(await api.listProposals());
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      setSummary(await api.getDashboardSummary());
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  useEffect(() => {
    if (user) {
      loadProposals();
      loadSummary();
    }
  }, [user]);

  useEffect(() => {
    if (selectedId) {
      api.getProposal(selectedId).then(setSelected).catch((e) => setErrorMsg(e.message));
      api.getAuditLog(selectedId).then(setAuditLog).catch(() => setAuditLog([]));
    } else {
      setSelected(null);
    }
  }, [selectedId]);

  const stateChart = useMemo(() => {
    const byState = {};
    proposals.forEach((p) => {
      if (!byState[p.state]) byState[p.state] = { state: p.state, notified: 0, acquired: 0 };
      byState[p.state].notified += p.area_total_ha;
      byState[p.state].acquired += p.area_acquired_ha;
    });
    return Object.values(byState);
  }, [proposals]);

  const advance = async () => {
    setAdvancing(true);
    try {
      const updated = await api.advanceStage(selected.id, { note: "Advanced via dashboard" });
      setSelected(updated);
      const logs = await api.getAuditLog(selected.id);
      setAuditLog(logs);
      loadProposals();
      loadSummary();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setAdvancing(false);
    }
  };

  const submitProposal = async () => {
    if (!form.project_name || !form.state || !form.district || !form.area_total_ha) return;
    try {
      await api.createProposal({
        ...form,
        area_total_ha: Number(form.area_total_ha),
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
      });
      setForm({ project_name: "", state: "", district: "", area_total_ha: "", latitude: "", longitude: "" });
      setShowForm(false);
      setView("proposals");
      loadProposals();
      loadSummary();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "proposals", label: "Proposals", icon: FileText },
    { id: "map", label: "GIS map", icon: MapIcon },
    { id: "compensation", label: "Compensation", icon: IndianRupee },
    ...(isOfficial ? [{ id: "reports", label: "Reports", icon: FileBarChart }] : []),
  ];

  return (
    <div className="w-full h-screen bg-slate-50 flex text-slate-800" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="w-56 bg-[#0F2A47] flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-white font-semibold text-lg leading-none">LandSync AI</div>
          <div className="text-slate-400 text-[11px] mt-1">National Land Acquisition System</div>
        </div>
        <nav className="flex-1 py-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setView(item.id); setSelectedId(null); }}
              className={`w-full flex items-center gap-2.5 px-5 py-2.5 text-sm transition-colors ${
                view === item.id ? "bg-white/10 text-white font-medium" : "text-slate-300 hover:bg-white/5"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10">
          <div className="text-white text-sm font-medium">{user.full_name}</div>
          <div className="text-slate-400 text-[11px] mb-3 capitalize">{user.role.replace("_", " ")}</div>
          <button
            onClick={() => { api.logout(); setUser(null); }}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="px-8 py-5 bg-white border-b border-slate-200 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900 capitalize">{view === "map" ? "GIS map" : view}</h1>
          {!isOfficial && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-emerald-600 text-white text-sm font-medium px-3.5 py-2 rounded-lg hover:bg-emerald-700 transition-colors">
              <Plus size={15} /> New proposal
            </button>
          )}
        </div>

        {errorMsg && (
          <div className="mx-8 mt-4 flex items-center justify-between bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg">
            <span className="flex items-center gap-2"><AlertCircle size={14} /> {errorMsg}</span>
            <button onClick={() => setErrorMsg("")}><X size={14} /></button>
          </div>
        )}

        <div className="p-8">
          {view === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <KpiCard icon={MapIcon} label="Area notified" value={(summary?.area_notified_ha ?? 0) + " ha"} color="#378ADD" />
                <KpiCard icon={CheckCircle2} label="Area acquired" value={(summary?.area_acquired_ha ?? 0) + " ha"} color="#10B981" />
                <KpiCard icon={IndianRupee} label="Compensation disbursed" value={inr(summary?.compensation_disbursed ?? 0)} sub={`of ${inr(summary?.compensation_assessed ?? 0)} assessed`} color="#F59E0B" />
                <KpiCard icon={Users} label="Families affected" value={summary?.families_affected ?? 0} color="#D85A30" />
                <KpiCard icon={Home} label="R&R progress" value={`${summary?.rr_progress_pct ?? 0}%`} sub={`${summary?.rr_families_rehabilitated ?? 0} of ${summary?.families_affected ?? 0} families rehabilitated`} color="#0EA5E9" />
                <KpiCard icon={Clock} label="Timeline adherence" value={`${summary?.timeline_adherence_pct ?? 100}%`} sub={`${summary?.delayed_count ?? 0} proposals past target`} color={(summary?.delayed_count ?? 0) > 0 ? "#DC2626" : "#16A34A"} />
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="text-sm font-medium text-slate-700 mb-4">State-wise area: notified vs acquired (ha)</div>
                {stateChart.length === 0 ? (
                  <div className="text-sm text-slate-400 py-10 text-center">No proposals yet — submit one to see this chart populate.</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stateChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F5" vertical={false} />
                      <XAxis dataKey="state" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="notified" fill="#CBD5E1" radius={[4, 4, 0, 0]} name="Notified" />
                      <Bar dataKey="acquired" fill="#10B981" radius={[4, 4, 0, 0]} name="Acquired" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              {isOfficial && <BottleneckPanel onOpen={(id) => { setView("proposals"); setSelectedId(id); }} />}
            </div>
          )}

          {view === "proposals" && !selected && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {loading ? (
                <div className="p-10 text-center text-slate-400 text-sm flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin" /> Loading proposals…</div>
              ) : proposals.length === 0 ? (
                <div className="p-10 text-center text-slate-400 text-sm">No proposals yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs text-slate-500">
                      <th className="px-5 py-3 font-medium">ID</th>
                      <th className="px-5 py-3 font-medium">Project</th>
                      <th className="px-5 py-3 font-medium">Location</th>
                      <th className="px-5 py-3 font-medium">Stage</th>
                      <th className="px-5 py-3 font-medium">Area (ha)</th>
                      <th className="px-5 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposals.map((p) => (
                      <tr key={p.id} onClick={() => setSelectedId(p.id)} className="border-t border-slate-50 hover:bg-slate-50 cursor-pointer">
                        <td className="px-5 py-3 text-slate-400">PR-{p.id}</td>
                        <td className="px-5 py-3 font-medium text-slate-800">{p.project_name}</td>
                        <td className="px-5 py-3 text-slate-500">{p.district}, {p.state}</td>
                        <td className="px-5 py-3"><StageBadge stage={p.stage} /></td>
                        <td className="px-5 py-3 text-slate-600">{p.area_acquired_ha}/{p.area_total_ha}</td>
                        <td className="px-5 py-3 text-slate-300"><ChevronRight size={16} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {view === "proposals" && selected && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <button onClick={() => setSelectedId(null)} className="text-xs text-slate-400 hover:text-slate-600 mb-4 flex items-center gap-1">
                ← Back to proposals
              </button>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selected.project_name}</h2>
                  <div className="text-sm text-slate-400">PR-{selected.id} · {selected.district}, {selected.state}</div>
                </div>
                <StageBadge stage={selected.stage} />
              </div>

              <div className="mb-6">
                <Stepper stage={selected.stage} onAdvance={advance} canAdvance={isOfficial} advancing={advancing} />
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-1">Area acquired</div>
                  <div className="text-lg font-semibold text-slate-800">{selected.area_acquired_ha} / {selected.area_total_ha} ha</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="text-xs text-slate-500 mb-1">Families affected</div>
                  <div className="text-lg font-semibold text-slate-800">{selected.families_affected}</div>
                </div>
                <PredictiveEstimate proposal={selected} />
              </div>

              <div className="mb-6">
                <div className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-1.5"><IndianRupee size={14} /> Compensation</div>
                <CompensationPanel proposalId={selected.id} isOfficial={isOfficial} />
              </div>

              <div className="mb-6">
                <div className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-1.5"><Home size={14} /> Rehabilitation &amp; Resettlement</div>
                <RRPanel proposalId={selected.id} isOfficial={isOfficial} />
              </div>

              <div className="mb-6">
                <div className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-1.5"><FileText size={14} /> Documents</div>
                <DocumentsPanel proposalId={selected.id} />
              </div>

              <div>
                <div className="text-sm font-medium text-slate-700 mb-3">Audit log</div>
                <div className="space-y-2">
                  {auditLog.map((log) => (
                    <div key={log.id} className="flex items-center justify-between text-xs bg-slate-50 rounded-lg px-3 py-2">
                      <span className="text-slate-600">{log.note || `Advanced to ${STAGES[log.to_stage]}`}</span>
                      <span className="text-slate-400">{log.actor_role.replace("_", " ")} · {fmtDate(log.timestamp)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {view === "map" && (
            <div>
              <div className="flex items-center gap-4 mb-4 flex-wrap bg-white rounded-xl border border-slate-200 px-4 py-3">
                {STAGES.map((s, i) => (
                  <div key={s} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[i] }} />
                    {s}
                  </div>
                ))}
              </div>
              <GISMap proposals={proposals} onSelect={(id) => { setView("proposals"); setSelectedId(id); }} />
              <div className="text-xs text-slate-400 mt-3">Marker size reflects total area notified. Click a marker to open that proposal. Coordinates are approximated by district for this prototype — production would render real parcel boundaries from PostGIS.</div>
            </div>
          )}

          {view === "compensation" && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 font-medium">Stage</th>
                    <th className="px-5 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {proposals.map((p) => (
                    <tr key={p.id} onClick={() => { setView("proposals"); setSelectedId(p.id); }} className="border-t border-slate-50 hover:bg-slate-50 cursor-pointer">
                      <td className="px-5 py-3 font-medium text-slate-800">{p.project_name}</td>
                      <td className="px-5 py-3"><StageBadge stage={p.stage} /></td>
                      <td className="px-5 py-3 text-slate-300 text-right"><ChevronRight size={16} className="inline" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-3 text-xs text-slate-400 border-t border-slate-100">Open a proposal to view or calculate its compensation breakdown.</div>
            </div>
          )}

          {view === "reports" && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="text-sm font-medium text-slate-700 mb-4 flex items-center gap-1.5"><TrendingUp size={15} /> National summary</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Total proposals</span><span className="font-medium">{summary?.proposal_count ?? 0}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Area notified</span><span className="font-medium">{summary?.area_notified_ha ?? 0} ha</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Area acquired</span><span className="font-medium">{summary?.area_acquired_ha ?? 0} ha</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Families affected</span><span className="font-medium">{summary?.families_affected ?? 0}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Compensation assessed</span><span className="font-medium">{inr(summary?.compensation_assessed ?? 0)}</span></div>
                <div className="flex justify-between border-b border-slate-100 pb-2"><span className="text-slate-500">Compensation disbursed</span><span className="font-medium">{inr(summary?.compensation_disbursed ?? 0)}</span></div>
              </div>
              <div className="text-xs text-slate-400 mt-4">Formatted PDF/Excel export is a natural next addition — this summary is already live from the database.</div>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" style={{ position: "absolute" }}>
          <div className="bg-white rounded-xl p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Submit new proposal</h3>
              <button onClick={() => setShowForm(false)}><X size={18} className="text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <input placeholder="Project name" value={form.project_name} onChange={(e) => setForm({ ...form, project_name: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="District" value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <input placeholder="Area required (ha)" type="number" value={form.area_total_ha} onChange={(e) => setForm({ ...form, area_total_ha: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input placeholder="Latitude (optional)" type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                <input placeholder="Longitude (optional)" type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="text-[10px] text-slate-400 -mt-1">Coordinates are stored as real PostGIS geometry — leave blank to skip for now.</div>
            </div>
            <button onClick={submitProposal} className="w-full mt-4 bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-emerald-700 transition-colors">
              Submit proposal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
