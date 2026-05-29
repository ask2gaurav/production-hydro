import { useLoaderData, Link } from "react-router";
import { useState } from "react";
import { requireSupplier } from "../lib/auth.server";
import { connectDB } from "../lib/db";
import Machine from "../models/Machine";
import MachineSupplier from "../models/MachineSupplier";
import Patient from "../models/Patient";
import Therapist from "../models/Therapist";
import Session from "../models/Session";
import User from "../models/User";

// ---------- Helpers ----------

const computeAge = (dob?: string): string => {
  if (!dob) return "—";
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return "—";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return String(age);
};

const formatDate = (d: any): string =>
  d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

const formatTime = (d: any): string =>
  d ? new Date(d).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—";

const formatDateTime = (d: any): string =>
  d ? new Date(d).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

// ---------- Loader ----------

export async function loader({ request, params }: { request: Request; params: any }) {
  const decoded: any = await requireSupplier(request);
  const supplierId = decoded.userId;
  await connectDB();

  const { id } = params;

  // Verify this machine belongs to the supplier
  const assignment = await MachineSupplier.findOne({ machine_id: id, supplier_id: supplierId });
  if (!assignment) throw new Response("Not Found", { status: 404 });

  const machine = await Machine.findById(id).lean() as any;
  if (!machine) throw new Response("Not Found", { status: 404 });

  const [rawPatients, rawTherapists, rawSessions] = await Promise.all([
    Patient.find({ machine_id: id }).lean(),
    Therapist.find({ machine_id: id }).lean(),
    Session.find({ machine_id: id }).sort({ start_time: -1 }).lean(),
  ]);

  // Populate extended_by user names for demo history
  const rawDemoHistory: any[] = (machine as any).demo_extended_at ?? [];
  const extenderIds = rawDemoHistory
    .map((e: any) => e.extended_by?.toString())
    .filter(Boolean);
  const extenderUsers = extenderIds.length
    ? await User.find({ _id: { $in: extenderIds } }).select("first_name last_name email").lean()
    : [];
  const extenderMap: Record<string, string> = {};
  (extenderUsers as any[]).forEach((u: any) => {
    extenderMap[u._id.toString()] = `${u.first_name} ${u.last_name}`;
  });

  const demoHistory = rawDemoHistory.map((e: any) => ({
    extended_by: e.extended_by ? (extenderMap[e.extended_by.toString()] ?? "Unknown") : "—",
    previous_limit: e.previous_limit ?? null,
    new_limit: e.new_limit ?? null,
    reason: e.reason ?? "",
    timestamp: e.timestamp instanceof Date ? e.timestamp.toISOString() : (e.timestamp ?? null),
  })).reverse(); // most recent first

  // Login extension history
  const rawLoginHistory: any[] = (machine as any).owner_login_extended_at ?? [];
  const loginExtenderIds = rawLoginHistory
    .map((e: any) => e.extended_by?.toString())
    .filter(Boolean);
  const loginExtenderUsers = loginExtenderIds.length
    ? await User.find({ _id: { $in: loginExtenderIds } }).select("first_name last_name email").lean()
    : [];
  const loginExtenderMap: Record<string, string> = {};
  (loginExtenderUsers as any[]).forEach((u: any) => {
    loginExtenderMap[u._id.toString()] = `${u.first_name} ${u.last_name}`;
  });

  const loginHistory = rawLoginHistory.map((e: any) => ({
    extended_by: e.extended_by ? (loginExtenderMap[e.extended_by.toString()] ?? "Unknown") : "—",
    previous_limit: e.previous_limit ?? null,
    new_limit: e.new_limit ?? null,
    reason: e.reason ?? "",
    timestamp: e.timestamp instanceof Date ? e.timestamp.toISOString() : (e.timestamp ?? null),
  })).reverse();

  // Compute per-patient stats
  const patients = rawPatients.map((p: any) => {
    const pSessions = rawSessions.filter((s: any) => s.patient_id?.toString() === p._id.toString());
    const last = pSessions.length > 0 ? pSessions[0].start_time : null;
    return {
      _id: p._id.toString(),
      first_name: p.first_name,
      last_name: p.last_name,
      phone: p.phone ?? null,
      email: p.email ?? null,
      gender: p.gender ?? null,
      dob: p.dob instanceof Date ? p.dob.toISOString() : (p.dob ?? null),
      total_sessions: pSessions.length,
      last_session: last instanceof Date ? last.toISOString() : (last ?? null),
    };
  });

  // Compute per-therapist stats
  const therapists = rawTherapists.map((t: any) => {
    const tSessions = rawSessions.filter((s: any) => s.therapist_id?.toString() === t._id.toString());
    const last = tSessions.length > 0 ? tSessions[0].start_time : null;
    return {
      _id: t._id.toString(),
      first_name: t.first_name,
      last_name: t.last_name,
      phone: t.phone ?? null,
      email: t.email ?? null,
      gender: t.gender ?? null,
      total_sessions: tSessions.length,
      last_session: last instanceof Date ? last.toISOString() : (last ?? null),
    };
  });

  // Build a lookup for patient/therapist names in sessions
  const patientMap: Record<string, string> = {};
  rawPatients.forEach((p: any) => { patientMap[p._id.toString()] = `${p.first_name} ${p.last_name}`; });

  const therapistMap: Record<string, string> = {};
  rawTherapists.forEach((t: any) => { therapistMap[t._id.toString()] = `${t.first_name} ${t.last_name}`; });

  const sessions = rawSessions.map((s: any) => ({
    _id: s._id.toString(),
    start_time: s.start_time instanceof Date ? s.start_time.toISOString() : (s.start_time ?? null),
    end_time: s.end_time instanceof Date ? s.end_time.toISOString() : (s.end_time ?? null),
    duration_minutes: s.duration_minutes,
    status: s.status,
    session_note: s.session_note ?? "",
    patient_name: s.patient_id ? (patientMap[s.patient_id.toString()] ?? "—") : "—",
    therapist_name: s.therapist_id ? (therapistMap[s.therapist_id.toString()] ?? "—") : "—",
  }));

  return {
    machine: {
      _id: machine._id.toString(),
      serial_number: machine.serial_number,
      model_name: machine.model_name,
      owner_login_count: (machine as any).owner_login_count ?? 0,
      owner_login_limit: (machine as any).owner_login_limit ?? 2,
    },
    patients,
    therapists,
    sessions,
    demoHistory,
    loginHistory,
  };
}

// ---------- Styles (matching frontend) ----------

const thStyle: React.CSSProperties = {
  padding: "0.65rem 1rem", textAlign: "left", fontWeight: 600,
  color: "#555", whiteSpace: "nowrap", fontSize: "0.82rem",
  backgroundColor: "#f4f5f8", borderBottom: "2px solid #ddd",
};

const tdStyle: React.CSSProperties = {
  padding: "0.65rem 1rem", fontSize: "0.85rem",
  verticalAlign: "middle", borderBottom: "1px solid #eee", color: "#333",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-700",
  active: "bg-yellow-100 text-yellow-700",
  paused: "bg-yellow-100 text-yellow-700",
};

type Tab = "patients" | "therapists" | "sessions" | "demo_history" | "login_history";

// ---------- Component ----------

export default function SupplierMachineDetail() {
  const { machine, patients, therapists, sessions, demoHistory, loginHistory } = useLoaderData<typeof loader>();

  const [activeTab, setActiveTab] = useState<Tab>("patients");

  // Patients filter
  const [pSearch, setPSearch] = useState("");

  // Therapists filter
  const [tSearch, setTSearch] = useState("");

  // Sessions filters
  const [sSearch, setSSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filteredPatients = patients.filter((p: any) => {
    if (!pSearch.trim()) return true;
    const q = pSearch.toLowerCase();
    return `${p.first_name} ${p.last_name} ${p.phone} ${p.email}`.toLowerCase().includes(q);
  });

  const filteredTherapists = therapists.filter((t: any) => {
    if (!tSearch.trim()) return true;
    const q = tSearch.toLowerCase();
    return `${t.first_name} ${t.last_name} ${t.phone} ${t.email}`.toLowerCase().includes(q);
  });

  const filteredSessions = sessions.filter((s: any) => {
    const start = new Date(s.start_time);
    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      if (start < from) return false;
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      if (start > to) return false;
    }
    if (sSearch.trim()) {
      const q = sSearch.toLowerCase();
      if (!`${s.patient_name} ${s.therapist_name}`.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const tabClass = (tab: Tab) =>
    `px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? "border-teal-600 text-teal-700"
        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
    }`;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Link to="/supplier/machines" className="text-gray-500 hover:text-gray-700 text-sm">
          ← My Machines
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{machine.serial_number}</h1>
          <p className="text-sm text-gray-500">{machine.model_name}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-1">
          <button className={tabClass("patients")} onClick={() => setActiveTab("patients")}>
            Patients <span className="ml-1 text-xs text-gray-400">({patients.length})</span>
          </button>
          <button className={tabClass("therapists")} onClick={() => setActiveTab("therapists")}>
            Therapists <span className="ml-1 text-xs text-gray-400">({therapists.length})</span>
          </button>
          <button className={tabClass("sessions")} onClick={() => setActiveTab("sessions")}>
            Session Logs <span className="ml-1 text-xs text-gray-400">({sessions.length})</span>
          </button>
          <button className={tabClass("demo_history")} onClick={() => setActiveTab("demo_history")}>
            Demo Extensions <span className="ml-1 text-xs text-gray-400">({demoHistory.length})</span>
          </button>
          <button className={tabClass("login_history")} onClick={() => setActiveTab("login_history")}>
            Login Extensions <span className="ml-1 text-xs text-gray-400">({loginHistory.length})</span>
          </button>
        </nav>
      </div>

      {/* Patients Tab */}
      {activeTab === "patients" && (
        <div>
          <div className="mb-4 flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-white max-w-sm">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              value={pSearch}
              onChange={(e) => setPSearch(e.target.value)}
              placeholder="Search by name, mobile or email..."
              className="flex-1 text-sm outline-none"
            />
          </div>
          <p className="text-xs text-gray-400 mb-3">{filteredPatients.length} patient{filteredPatients.length !== 1 ? "s" : ""} found</p>
          <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Mobile</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Gender</th>
                  <th style={thStyle}>Date of Birth</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Age</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Total Sessions</th>
                  <th style={thStyle}>Last Session</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ ...tdStyle, textAlign: "center", color: "#999", padding: "3rem" }}>
                      No patients found.
                    </td>
                  </tr>
                ) : (
                  filteredPatients.map((p: any) => (
                    <tr key={p._id}
                      className="hover:bg-gray-50"
                      style={{ backgroundColor: "white" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
                    >
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{p.first_name} {p.last_name}</td>
                      <td style={tdStyle}>{p.phone}</td>
                      <td style={tdStyle}>{p.email}</td>
                      <td style={tdStyle}>{p.gender || "—"}</td>
                      <td style={tdStyle}>{p.dob || "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{computeAge(p.dob)}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{p.total_sessions}</td>
                      <td style={tdStyle}>{formatDateTime(p.last_session)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Therapists Tab */}
      {activeTab === "therapists" && (
        <div>
          <div className="mb-4 flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-white max-w-sm">
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              value={tSearch}
              onChange={(e) => setTSearch(e.target.value)}
              placeholder="Search by name, mobile or email..."
              className="flex-1 text-sm outline-none"
            />
          </div>
          <p className="text-xs text-gray-400 mb-3">{filteredTherapists.length} therapist{filteredTherapists.length !== 1 ? "s" : ""} found</p>
          <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Mobile</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Gender</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Total Sessions</th>
                  <th style={thStyle}>Last Session</th>
                </tr>
              </thead>
              <tbody>
                {filteredTherapists.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#999", padding: "3rem" }}>
                      No therapists found.
                    </td>
                  </tr>
                ) : (
                  filteredTherapists.map((t: any) => (
                    <tr key={t._id}
                      style={{ backgroundColor: "white" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
                    >
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{t.first_name} {t.last_name}</td>
                      <td style={tdStyle}>{t.phone}</td>
                      <td style={tdStyle}>{t.email}</td>
                      <td style={tdStyle}>{t.gender || "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{t.total_sessions}</td>
                      <td style={tdStyle}>{formatDateTime(t.last_session)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Demo Extensions Tab */}
      {activeTab === "demo_history" && (
        <div>
          <p className="text-xs text-gray-400 mb-3">
            {demoHistory.length} extension{demoHistory.length !== 1 ? "s" : ""} recorded
          </p>
          <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Date &amp; Time</th>
                  <th style={thStyle}>Extended By</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Previous Limit</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>New Limit</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Sessions Added</th>
                  <th style={thStyle}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {demoHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#999", padding: "3rem" }}>
                      No demo extensions recorded.
                    </td>
                  </tr>
                ) : (
                  demoHistory.map((e: any, i: number) => (
                    <tr key={i}
                      style={{ backgroundColor: "white" }}
                      onMouseEnter={(ev) => (ev.currentTarget.style.backgroundColor = "#f9fafb")}
                      onMouseLeave={(ev) => (ev.currentTarget.style.backgroundColor = "white")}
                    >
                      <td style={tdStyle}>{formatDateTime(e.timestamp)}</td>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{e.extended_by}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{e.previous_limit ?? "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{e.new_limit ?? "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {e.previous_limit != null && e.new_limit != null
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                              +{e.new_limit - e.previous_limit}
                            </span>
                          : "—"}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 300, whiteSpace: "normal", wordBreak: "break-word", color: e.reason ? "#333" : "#aaa" }}>
                        {e.reason || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Login Extensions Tab */}
      {activeTab === "login_history" && (
        <div>
          <p className="text-xs text-gray-400 mb-1">
            Owner login usage: <strong className={machine.owner_login_count >= machine.owner_login_limit ? "text-red-600" : "text-gray-700"}>
              {machine.owner_login_count} / {machine.owner_login_limit}
            </strong> logins used
          </p>
          <p className="text-xs text-gray-400 mb-3">
            {loginHistory.length} extension{loginHistory.length !== 1 ? "s" : ""} recorded
          </p>
          <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Date &amp; Time</th>
                  <th style={thStyle}>Extended By</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Previous Limit</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>New Limit</th>
                  <th style={{ ...thStyle, textAlign: "center" }}>Logins Added</th>
                  <th style={thStyle}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#999", padding: "3rem" }}>
                      No login extensions recorded.
                    </td>
                  </tr>
                ) : (
                  loginHistory.map((e: any, i: number) => (
                    <tr key={i}
                      style={{ backgroundColor: "white" }}
                      onMouseEnter={(ev) => (ev.currentTarget.style.backgroundColor = "#f9fafb")}
                      onMouseLeave={(ev) => (ev.currentTarget.style.backgroundColor = "white")}
                    >
                      <td style={tdStyle}>{formatDateTime(e.timestamp)}</td>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{e.extended_by}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{e.previous_limit ?? "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>{e.new_limit ?? "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {e.previous_limit != null && e.new_limit != null
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              +{e.new_limit - e.previous_limit}
                            </span>
                          : "—"}
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 300, whiteSpace: "normal", wordBreak: "break-word", color: e.reason ? "#333" : "#aaa" }}>
                        {e.reason || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Session Logs Tab */}
      {activeTab === "sessions" && (
        <div>
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 bg-white flex-1 min-w-[220px]">
              <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                value={sSearch}
                onChange={(e) => setSSearch(e.target.value)}
                placeholder="Search by patient or therapist name..."
                className="flex-1 text-sm outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-semibold text-gray-500 whitespace-nowrap">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            {(sSearch || fromDate || toDate) && (
              <button
                onClick={() => { setSSearch(""); setFromDate(""); setToDate(""); }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-500 hover:bg-gray-50"
              >
                Clear
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mb-3">{filteredSessions.length} session{filteredSessions.length !== 1 ? "s" : ""} found</p>
          <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle}>Patient Name</th>
                  <th style={thStyle}>Therapist Name</th>
                  <th style={thStyle}>Session Date</th>
                  <th style={thStyle}>Session Time</th>
                  <th style={thStyle}>Duration</th>
                  <th style={thStyle}>Status</th>
                  <th style={{ ...thStyle, maxWidth: 260 }}>Session Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "#999", padding: "3rem" }}>
                      No sessions found.
                    </td>
                  </tr>
                ) : (
                  filteredSessions.map((s: any) => (
                    <tr key={s._id}
                      style={{ backgroundColor: "white" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "white")}
                    >
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{s.patient_name}</td>
                      <td style={tdStyle}>{s.therapist_name}</td>
                      <td style={tdStyle}>{formatDate(s.start_time)}</td>
                      <td style={tdStyle}>{formatTime(s.start_time)}</td>
                      <td style={tdStyle}>{s.duration_minutes > 0 ? `${s.duration_minutes} min` : "—"}</td>
                      <td style={tdStyle}>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {s.status || "—"}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, maxWidth: 260, whiteSpace: "normal", wordBreak: "break-word", color: s.session_note ? "#333" : "#aaa" }}>
                        {s.session_note || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
