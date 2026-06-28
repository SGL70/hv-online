import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { CreateModal, SavaDaysEditor, calcSavaHours } from './Reports';

const STATUS_META = {
  ok:            { label:'Ok',            color:'bg-green-100 text-green-800'  },
  ej_mottagen:   { label:'Ej mottagen',   color:'bg-yellow-100 text-yellow-800'},
  ej_tilldelad:  { label:'Ej tilldelad',  color:'bg-gray-100 text-gray-500'   },
  förlustanmäld: { label:'Förlustanmäld', color:'bg-red-100 text-red-800'     },
  byte_pågår:    { label:'Byte pågår',    color:'bg-blue-100 text-blue-800'   },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.ok;
  return <span className={`badge ${m.color}`}>{m.label}</span>;
}

function fmt(iso) {
  return new Date(iso).toLocaleDateString('sv-SE');
}

function fmtDate(val) {
  // Handles both "2026-06-26" and "2026-06-26T00:00:00.000Z"
  return (val || '').toString().slice(0, 10);
}

const TYPE_LABELS = {
  km_ers: 'Km-ersättning', utlagg: 'Utlägg', traktamente: 'Traktamente', sava: 'SÄVA',
};

function reportTitle(r) {
  const typ = TYPE_LABELS[r.report_type] || 'Km-ersättning';
  const akt = r.activity_title || r.description || null;
  return akt ? `${typ} | ${akt}` : typ;
}

function EditReportModal({ report, onClose, onSaved }) {
  const [activities, setActivities] = useState([]);
  const [form, setForm] = useState({
    report_type:         report.report_type         || 'km_ers',
    activity_id:         report.activity_id         ? String(report.activity_id) : '',
    description:         report.description         || '',
    report_date:         fmtDate(report.report_date),
    km:                  report.km                  || 0,
    hours:               report.hours               || 0,
    expenses:            report.expenses             || 0,
    expense_description: report.expense_description || '',
    sava_days:           report.sava_days            || [],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.activities().then(setActivities).catch(() => {}); }, []);

  const useCalendar = form.activity_id !== '';
  const isSava = form.report_type === 'sava';

  async function submit(e) {
    e.preventDefault();
    if (!useCalendar && !form.description.trim()) {
      alert('Ange vad redovisningen avser.'); return;
    }
    if (isSava && form.sava_days.length === 0) {
      alert('Lägg till minst en dag.'); return;
    }
    const hours = isSava ? calcSavaHours(form.sava_days) : (form.hours || 0);
    const report_date = isSava && form.sava_days.length > 0
      ? form.sava_days[0].date
      : form.report_date;
    setSaving(true);
    try {
      await api.updateReport(report.id, {
        ...form, hours, report_date,
        activity_id: form.activity_id || null,
        sava_days: isSava ? form.sava_days : null,
      });
      onSaved();
    } catch(err) { alert(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-military-navy">Redigera redovisning</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ersättningstyp</label>
            <select required value={form.report_type}
                    onChange={e => setForm(f=>({...f, report_type: e.target.value, sava_days: []}))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel">
              <option value="km_ers">Km-ersättning</option>
              <option value="utlagg">Utlägg</option>
              <option value="sava">SÄVA (tid)</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Aktivitet</label>
            <select value={form.activity_id}
                    onChange={e => setForm(f=>({...f, activity_id: e.target.value, description: ''}))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel">
              <option value="">Övrigt (ange nedan)</option>
              {activities.map(a => <option key={a.id} value={String(a.id)}>{a.title}</option>)}
            </select>
          </div>
          {!useCalendar && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Vad avser redovisningen?</label>
              <input required value={form.description}
                     onChange={e => setForm(f=>({...f, description: e.target.value}))}
                     placeholder="t.ex. Förrådsbesök, Säkerhetsintervju…"
                     className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
            </div>
          )}
          {isSava ? (
            <SavaDaysEditor
              days={form.sava_days}
              onChange={days => setForm(f => ({ ...f, sava_days: days }))}
            />
          ) : (
            <>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Datum</label>
                <input type="date" required value={form.report_date}
                       onChange={e => setForm(f=>({...f, report_date: e.target.value}))}
                       className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {form.report_type === 'km_ers' && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Km</label>
                    <input type="number" min="0" value={form.km}
                           onChange={e => setForm(f=>({...f, km: e.target.value}))}
                           className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  </div>
                )}
                {form.report_type === 'utlagg' && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Belopp (kr)</label>
                    <input type="number" min="0" step="0.01" value={form.expenses}
                           onChange={e => setForm(f=>({...f, expenses: e.target.value}))}
                           className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" />
                  </div>
                )}
              </div>
              {form.report_type === 'utlagg' && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Notering</label>
                  <input placeholder="t.ex. Utlägg för lunch, parkeringsavgift…"
                         value={form.expense_description}
                         onChange={e => setForm(f=>({...f, expense_description: e.target.value}))}
                         className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
                </div>
              )}
            </>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Avbryt</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Sparar…' : 'Spara'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StartInventoryModal({ onConfirm, onClose }) {
  const [deadline, setDeadline] = useState('');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-military-navy">Starta inventering</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Klart senast (valfritt)</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                   className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
          </div>
          <p className="text-xs text-gray-400">
            Alla soldaters utrustning sätts till OK och de ombeds fylla i faktiskt antal.
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary flex-1">Avbryt</button>
            <button onClick={() => onConfirm(deadline || null)} className="btn-primary flex-1">
              Starta inventering
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Arenden() {
  const { user, hasRole, isLogistics } = useAuth();
  const navigate = useNavigate();
  const [unitInv,       setUnitInv]       = useState([]);
  const [cases,         setCases]         = useState([]);
  const [myReports,       setMyReports]       = useState([]);
  const [reviewReports,   setReviewReports]   = useState([]);
  const [approveReports,  setApproveReports]  = useState([]);
  const [approvedHistory, setApprovedHistory] = useState([]);
  const [showHistory,     setShowHistory]     = useState(false);
  const [showCreateReport, setShowCreateReport] = useState(false);
  const [showInvModal,    setShowInvModal]    = useState(false);
  const [startingInv,     setStartingInv]     = useState(false);
  const [editingReport,   setEditingReport]   = useState(null);
  const [returnTarget,    setReturnTarget]    = useState(null);
  const [returnComment,   setReturnComment]   = useState('');
  const [exportFrom,      setExportFrom]      = useState('');
  const [exportTo,        setExportTo]        = useState('');
  const [exporting,       setExporting]       = useState(false);

  function load() {
    api.reports().then(setMyReports).catch(() => {});
    if (hasRole('pc'))    api.reports('review')  .then(setReviewReports)   .catch(() => {});
    if (hasRole('kompc')) api.reports('approve') .then(setApproveReports)  .catch(() => {});
    if (hasRole('kompc')) api.reports('approved').then(setApprovedHistory) .catch(() => {});
    if (isLogistics()) {
      api.unitInventory().then(setUnitInv).catch(() => {});
      api.pendingCases().then(setCases).catch(() => {});
    }
  }

  useEffect(load, []);

  async function handleStartInventory(deadline) {
    setShowInvModal(false);
    setStartingInv(true);
    try {
      const r = await api.startInventory(deadline || null);
      alert(`Inventering startad — ${r.started} soldater har fått inventeringsorder.`);
      load();
    } catch (e) { alert(e.message); }
    finally { setStartingInv(false); }
  }

  async function handleExport(markAsSent) {
    setExporting(true);
    try { await api.exportReports(exportFrom || undefined, exportTo || undefined, markAsSent); if (markAsSent) load(); }
    catch (e) { alert(e.message); }
    finally { setExporting(false); }
  }

  async function decide(caseId, action) {
    await api.decideCase(caseId, { action }).catch(e => alert(e.message));
    load();
  }

  const invOpen      = unitInv.filter(m => m.inv_status === 'open');
  const invSubmitted = unitInv.filter(m => m.inv_status === 'submitted');
  const invNone      = unitInv.filter(m => !m.inv_status);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <h1 className="text-xl font-bold text-military-navy">Ärenden</h1>

      {/* ─── KM-ERS / UTLÄGG (alla användare) ────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Mina km-ers / Utlägg</h2>
          <button onClick={() => setShowCreateReport(true)}
                  className="btn-primary text-xs">
            + Ny redovisning
          </button>
        </div>

        {myReports.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center text-sm text-gray-400">
            Inga rapporter — klicka "Ny rapport" för att skapa.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {myReports.slice(0, 5).map(r => (
                <li key={r.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{reportTitle(r)}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {fmtDate(r.report_date)}
                        {r.km > 0       && <span className="ml-2">{r.km} km</span>}
                        {r.hours > 0    && <span className="ml-2">{r.hours} tim</span>}
                        {r.expenses > 0 && <span className="ml-2">{Number(r.expenses).toFixed(0)} kr</span>}
                      </div>
                      {r.status === 'returned' && r.reviewer_comment && (
                        <div className="mt-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                          Avfärdad: {r.reviewer_comment}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {(r.status === 'draft' || r.status === 'returned') && (
                        <>
                          <button onClick={() => setEditingReport(r)}
                                  className="text-xs px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">
                            Redigera
                          </button>
                          <button onClick={() => api.submitReport(r.id).then(load).catch(e => alert(e.message))}
                                  className="text-xs px-2.5 py-1 bg-military-navy text-white rounded-lg hover:bg-[#16294a]">
                            Skicka in
                          </button>
                        </>
                      )}
                      {['draft', 'submitted', 'returned'].includes(r.status) && (
                        <button
                          onClick={() => {
                            if (confirm('Ta bort ärendet?')) api.deleteReport(r.id).then(load).catch(e => alert(e.message));
                          }}
                          className="text-xs px-2.5 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
                          Ta bort
                        </button>
                      )}
                      <span className={`badge ${
                        r.status === 'approved'  ? 'bg-green-100 text-green-800' :
                        r.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                        r.status === 'reviewed'  ? 'bg-yellow-100 text-yellow-800' :
                        r.status === 'returned'  ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {r.status === 'approved'  ? 'Attesterad' :
                         r.status === 'submitted' ? 'Inskickad' :
                         r.status === 'reviewed'  ? 'Granskad' :
                         r.status === 'returned'  ? 'Avfärdad' : 'Utkast'}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {myReports.length > 5 && (
              <div className="px-5 py-2.5 border-t border-gray-100">
                <button onClick={() => navigate('/rapporter')}
                        className="text-xs text-military-steel hover:underline">
                  Visa alla {myReports.length} rapporter →
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ─── ATT GRANSKA (pc+) ───────────────────────────────── */}
      {hasRole('pc') && reviewReports.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Km-ers / Utlägg att granska</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <ul className="divide-y divide-gray-100">
              {reviewReports.map(r => (
                <li key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{reportTitle(r)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {r.user_name} · {fmtDate(r.report_date)}
                      {r.km > 0       && <span className="ml-2">{r.km} km</span>}
                      {r.hours > 0    && <span className="ml-2">{r.hours} tim</span>}
                      {r.expenses > 0 && <span className="ml-2">{Number(r.expenses).toFixed(0)} kr</span>}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => api.reviewReport(r.id, 'approve').then(load).catch(e => alert(e.message))}
                            className="text-xs px-2.5 py-1 bg-green-100 text-green-800 rounded-lg hover:bg-green-200">
                      Godkänn
                    </button>
                    <button onClick={() => { setReturnTarget(r.id); setReturnComment(''); }}
                            className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                      Avfärda
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ─── ATT ATTESTERA (kompc+) ──────────────────────────── */}
      {hasRole('kompc') && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Km-ers / Utlägg att attestera</h2>
          {approveReports.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 text-sm text-gray-400">
              Inget att attestera just nu.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {approveReports.map(r => (
                  <li key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{reportTitle(r)}</div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {r.user_name} · {fmtDate(r.report_date)}
                        {r.km > 0       && <span className="ml-2">{r.km} km</span>}
                        {r.expenses > 0 && <span className="ml-2">{Number(r.expenses).toFixed(0)} kr</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => api.approveReport(r.id, 'approve').then(load).catch(e => alert(e.message))}
                              className="text-xs px-2.5 py-1 bg-green-100 text-green-800 rounded-lg hover:bg-green-200">
                        Attestera
                      </button>
                      <button onClick={() => api.approveReport(r.id, 'return').then(load).catch(e => alert(e.message))}
                              className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                        Returnera
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Export till MR-grupp */}
          <div className="mt-4 bg-white border border-gray-200 rounded-xl px-5 py-4">
            <p className="text-xs font-semibold text-gray-600 mb-3">Exportera till MR-grupp</p>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500">Från</label>
                <input type="date" value={exportFrom} onChange={e => setExportFrom(e.target.value)}
                       className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-military-steel" />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-gray-500">Till</label>
                <input type="date" value={exportTo} onChange={e => setExportTo(e.target.value)}
                       className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-military-steel" />
              </div>
              <button onClick={() => handleExport(true)} disabled={exporting}
                      className="btn-primary text-xs disabled:opacity-50">
                {exporting ? 'Exporterar…' : 'Ladda ner & markera skickad'}
              </button>
              <button onClick={() => handleExport(false)} disabled={exporting}
                      className="btn-secondary text-xs disabled:opacity-50">
                Ladda ner (utan markering)
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Lämna datum tomt för att exportera alla. "Ladda ner & markera skickad" sätter datum i kolumnen "Skickat till MR".</p>
          </div>

          {/* Historik — attesterade rapporter */}
          {approvedHistory.length > 0 && (
            <div className="mt-3">
              <button onClick={() => setShowHistory(h => !h)}
                      className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                {showHistory ? '▲' : '▾'} Historik ({approvedHistory.length} attesterade)
              </button>
              {showHistory && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mt-2">
                  <ul className="divide-y divide-gray-100">
                    {approvedHistory.map(r => (
                      <li key={r.id} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-700">{reportTitle(r)}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {r.user_name} · {fmtDate(r.report_date)}
                            {r.km > 0       && <span className="ml-2">{r.km} km</span>}
                            {r.expenses > 0 && <span className="ml-2">{Number(r.expenses).toFixed(0)} kr</span>}
                          </div>
                        </div>
                        {r.mr_submitted_at ? (
                          <span className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5 shrink-0">
                            MR {new Date(r.mr_submitted_at).toLocaleDateString('sv-SE')}
                          </span>
                        ) : (
                          <button
                            onClick={() => api.markMr([r.id]).then(load).catch(e => alert(e.message))}
                            className="text-xs text-gray-400 hover:text-military-navy shrink-0">
                            Markera skickad
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ─── UTRUSTNINGSÄRENDEN (logistik) ────────────────────── */}
      {isLogistics() && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Utrustningsärenden</h2>

          {cases.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center text-sm text-gray-400">
              Inga väntande utrustningsärenden
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <ul className="divide-y divide-gray-100">
                {cases.map(c => (
                  <li key={c.id} className="px-5 py-3 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{c.equipment_name}</span>
                        <span className={`badge ${c.type === 'förlust' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                          {c.type === 'förlust' ? 'Förlust' : 'Byte'}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {c.user_name} · {c.unit_name} · {fmt(c.created_at)}
                      </div>
                      {c.description && <div className="text-xs text-gray-500 mt-1 truncate">{c.description}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {c.type === 'förlust' && (
                        <Link to={`/blankett/${c.id}`} className="text-xs text-military-steel hover:underline">Skapa AFSE</Link>
                      )}
                      <button onClick={() => decide(c.id, 'approve')}
                              className="text-xs px-2.5 py-1 bg-green-100 text-green-800 rounded-lg hover:bg-green-200 transition-colors">
                        Godkänn
                      </button>
                      <button onClick={() => decide(c.id, 'reject')}
                              className="text-xs px-2.5 py-1 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 transition-colors">
                        Avslå
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ─── INVENTERING (logistik) ───────────────────────────── */}
      {isLogistics() && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">Inventering</h2>
            <button onClick={() => setShowInvModal(true)} disabled={startingInv} className="btn-primary text-xs">
              {startingInv ? 'Startar…' : unitInv.length > 0 ? 'Starta om inventering' : 'Starta inventering'}
            </button>
          </div>

          {unitInv.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl px-5 py-8 text-center text-sm text-gray-400">
              Ingen aktiv inventering. Klicka "Starta inventering" för att börja.
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex gap-5 text-xs">
                <span className="text-green-700 font-medium">{invSubmitted.length} bekräftade</span>
                {invOpen.length > 0 && <span className="text-blue-600 font-medium">{invOpen.length} pågår</span>}
                {invNone.length > 0 && <span className="text-gray-400">{invNone.length} ej startad</span>}
                <span className="text-gray-300">/ {unitInv.length} totalt</span>
              </div>
              <ul className="divide-y divide-gray-100">
                {unitInv.map(m => (
                  <li key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-sm text-gray-900">{m.name}</span>
                      <span className="text-xs text-gray-400 ml-2">{m.unit_name}</span>
                    </div>
                    {m.inv_status === 'submitted' ? (
                      <span className="text-xs text-green-700 font-medium">✓ Bekräftad {m.submitted_at ? fmt(m.submitted_at) : ''}</span>
                    ) : m.inv_status === 'open' ? (
                      <span className="text-xs text-blue-500">Pågår sedan {fmt(m.inv_created)}</span>
                    ) : (
                      <span className="text-xs text-gray-300">Ej inventerad</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ─── MODAL: avfärda med motivering ──────────────────────── */}
      {returnTarget !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-military-navy">Avfärda redovisning</h2>
              <p className="text-xs text-gray-500 mt-1">Ange anledning — visas för den som skickade in.</p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <textarea
                autoFocus
                rows={3}
                value={returnComment}
                onChange={e => setReturnComment(e.target.value)}
                placeholder="t.ex. Datum stämmer inte, aktivitet saknas…"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel"
              />
              <div className="flex gap-2">
                <button onClick={() => setReturnTarget(null)} className="btn-secondary flex-1">Avbryt</button>
                <button
                  disabled={!returnComment.trim()}
                  onClick={() => {
                    const initials = (user?.name || '').split(' ').map(w => w[0]).join('').toUpperCase();
                    const comment = returnComment.trim() + (initials ? ` /${initials}` : '');
                    api.reviewReport(returnTarget, 'return', comment)
                      .then(() => { setReturnTarget(null); load(); })
                      .catch(e => alert(e.message));
                  }}
                  className="btn-primary flex-1 disabled:opacity-40">
                  Skicka tillbaka
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: starta inventering ──────────────────────────── */}
      {showInvModal && (
        <StartInventoryModal
          onConfirm={handleStartInventory}
          onClose={() => setShowInvModal(false)}
        />
      )}

      {showCreateReport && (
        <CreateModal
          onClose={() => setShowCreateReport(false)}
          onCreated={() => { setShowCreateReport(false); load(); }}
        />
      )}

      {/* ─── MODAL: redigera rapport ─────────────────────────────── */}
      {editingReport && (
        <EditReportModal
          report={editingReport}
          onClose={() => setEditingReport(null)}
          onSaved={() => { setEditingReport(null); load(); }}
        />
      )}
    </div>
  );
}
