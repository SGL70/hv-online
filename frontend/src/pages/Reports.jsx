import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const STATUS_META = {
  draft:     { label:'Utkast',     color:'bg-gray-100 text-gray-600'    },
  submitted: { label:'Inskickad',  color:'bg-blue-100 text-blue-700'    },
  reviewed:  { label:'Granskad',   color:'bg-yellow-100 text-yellow-700' },
  approved:  { label:'Attesterad', color:'bg-green-100 text-green-700'  },
  rejected:  { label:'Returnerad', color:'bg-red-100 text-red-700'      },
};

const TYPE_LABELS = {
  km_ers:      'Km-ersättning',
  utlagg:      'Utlägg',
  traktamente: 'Traktamente',
  sava:        'SÄVA',
};

function reportTitle(r) {
  const typ = TYPE_LABELS[r.report_type] || 'Km-ersättning';
  const akt = r.activity_title || r.description || '–';
  return `${typ} | ${akt}`;
}

export function fmtDate(val) {
  // Hanterar både "2026-06-26" och "2026-06-26T00:00:00.000Z"
  return (val || '').toString().slice(0, 10);
}

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return <span className={`badge ${m.color}`}>{m.label}</span>;
}

export function calcSavaHours(days) {
  return (days || []).reduce((sum, d) => {
    if (!d.start || !d.end) return sum;
    const [sh, sm] = d.start.split(':').map(Number);
    const [eh, em] = d.end.split(':').map(Number);
    return sum + Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
  }, 0);
}

export function SavaDaysEditor({ days, onChange }) {
  const today = new Date().toISOString().slice(0, 10);

  function addDay() {
    const last = days.length > 0 ? days[days.length - 1].date : today;
    const next = new Date(last);
    next.setDate(next.getDate() + 1);
    onChange([...days, { date: next.toISOString().slice(0, 10), start: '08:00', end: '16:00' }]);
  }

  function update(i, field, value) {
    onChange(days.map((d, idx) => idx === i ? { ...d, [field]: value } : d));
  }

  const total = calcSavaHours(days);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-500">Dagar</label>
        <button type="button" onClick={addDay}
                className="text-xs text-military-steel hover:underline font-medium">
          + Lägg till dag
        </button>
      </div>
      {days.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-lg">
          Inga dagar tillagda
        </p>
      )}
      {days.map((d, i) => (
        <div key={i} className="flex gap-1.5 items-center">
          <input type="date" value={d.date}
                 onChange={e => update(i, 'date', e.target.value)}
                 className="flex-1 border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-military-steel" />
          <input type="time" value={d.start}
                 onChange={e => update(i, 'start', e.target.value)}
                 className="w-[90px] border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-military-steel" />
          <span className="text-gray-400 text-xs shrink-0">–</span>
          <input type="time" value={d.end}
                 onChange={e => update(i, 'end', e.target.value)}
                 className="w-[90px] border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-military-steel" />
          <button type="button" onClick={() => onChange(days.filter((_, idx) => idx !== i))}
                  className="text-gray-300 hover:text-red-500 text-base leading-none shrink-0">✕</button>
        </div>
      ))}
      {days.length > 0 && (
        <div className="text-xs text-gray-500 text-right pt-0.5">
          Totalt: <span className="font-medium text-military-navy">{total % 1 === 0 ? total : total.toFixed(1)} timmar</span>
        </div>
      )}
    </div>
  );
}

export function CreateModal({ onClose, onCreated }) {
  const [activities, setActivities] = useState([]);
  const [form, setForm] = useState({
    report_type:         'km_ers',
    activity_id:         '',
    description:         '',
    report_date:         new Date().toISOString().slice(0,10),
    km:                  0,
    expenses:            0,
    expense_description: '',
    sava_days:           [],
  });
  const [saving, setSaving]         = useState(false);
  const [kmFollowUp, setKmFollowUp] = useState(null); // {report_date, activity_id, description, andSubmit}
  const [kmValue, setKmValue]       = useState('');

  useEffect(() => { api.activities().then(setActivities); }, []);

  const useCalendar = form.activity_id !== '' && form.activity_id !== null;
  const isSava = form.report_type === 'sava';

  async function submit(e, andSubmit = false) {
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
      const created = await api.createReport({
        ...form, hours, report_date,
        activity_id: form.activity_id || null,
        sava_days: isSava ? form.sava_days : null,
      });
      if (andSubmit) await api.submitReport(created.id);
      if (isSava) {
        setKmFollowUp({ report_date, activity_id: form.activity_id || null, description: form.description, andSubmit });
        setKmValue('');
      } else {
        onCreated();
      }
    } catch(err) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function submitKmFollowUp(km) {
    if (km > 0) {
      try {
        const r = await api.createReport({
          report_type: 'km_ers',
          activity_id: kmFollowUp.activity_id,
          description: kmFollowUp.description,
          report_date: kmFollowUp.report_date,
          km, hours: 0, expenses: 0,
        });
        if (kmFollowUp.andSubmit) await api.submitReport(r.id);
      } catch(err) { alert('Km-ärende kunde inte skapas: ' + err.message); }
    }
    setKmFollowUp(null);
    onCreated();
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-military-navy">Ny redovisning</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-3">

          {/* Typ */}
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

          {/* Aktivitet */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Aktivitet</label>
            <select value={form.activity_id}
                    onChange={e => setForm(f=>({...f, activity_id: e.target.value, description: ''}))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel">
              <option value="">Övrigt (ange nedan)</option>
              {activities.map(a => (
                <option key={a.id} value={a.id}>{a.title}</option>
              ))}
            </select>
          </div>

          {!useCalendar && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Vad avser redovisningen?</label>
              <input required value={form.description}
                     onChange={e => setForm(f=>({...f, description: e.target.value}))}
                     placeholder="t.ex. Förrådsbesök, Planeringsmöte…"
                     className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
            </div>
          )}

          {/* SÄVA: dagslista */}
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
                       className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
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
                <>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Notering</label>
                    <input placeholder="t.ex. Utlägg för lunch, parkeringsavgift…"
                           value={form.expense_description}
                           onChange={e => setForm(f=>({...f, expense_description: e.target.value}))}
                           className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-800">
                    Kom ihåg att skicka originalkvitto per post till MR-grupp/HR.
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Avbryt</button>
            <button type="submit" disabled={saving} className="btn-secondary flex-1"
                    onClick={e => submit(e, false)}>
              {saving ? 'Sparar…' : 'Spara utkast'}
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1"
                    onClick={e => submit(e, true)}>
              {saving ? 'Skickar…' : 'Skicka in'}
            </button>
          </div>
        </form>
      </div>
    </div>

    {kmFollowUp && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-military-navy">Km-ersättning?</h2>
            <p className="text-xs text-gray-500 mt-1">
              Vill du redovisa km-ersättning i samband med denna SÄVA?
            </p>
          </div>
          <div className="px-6 py-4 space-y-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Antal km</label>
              <input
                type="number" min="0" autoFocus
                value={kmValue}
                onChange={e => setKmValue(e.target.value)}
                placeholder="0"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => submitKmFollowUp(0)}
                      className="btn-secondary flex-1">Nej tack</button>
              <button onClick={() => submitKmFollowUp(Number(kmValue))}
                      disabled={!kmValue || Number(kmValue) <= 0}
                      className="btn-primary flex-1 disabled:opacity-40">
                Lägg till
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

export function EditReportModal({ report, onClose, onSaved }) {
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

export default function Reports() {
  const { hasRole } = useAuth();
  const [tab, setTab]               = useState('mine');
  const [reports, setReports]       = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingReport, setEditingReport] = useState(null);

  function load() {
    api.reports(tab === 'mine' ? '' : tab).then(setReports);
  }
  useEffect(load, [tab]);

  async function submit(id) {
    await api.submitReport(id).catch(e => alert(e.message));
    load();
  }
  async function approve(id, action) {
    await api.approveReport(id, action).catch(e => alert(e.message));
    load();
  }

  const tabs = [
    ['mine',    'Mina'],
    ...(hasRole('pc') ? [['approve', 'Attestera']] : []),
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-military-navy">Utlägg / Km-ersättning</h1>
        {tab === 'mine' && (
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
            + Ny redovisning
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(([key,label]) => (
          <button key={key} onClick={() => setTab(key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
                    ${tab===key ? 'border-military-navy text-military-navy'
                                : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">Inga rapporter</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {reports.map(r => (
              <li key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Title: Typ | Aktivitet */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900">{reportTitle(r)}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    {/* Date + submitter */}
                    <div className="text-xs text-gray-400 mt-0.5">
                      {r.report_date}{r.user_name ? ` · ${r.user_name}` : ''}
                    </div>
                    {/* Amounts */}
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      {r.km > 0       && <span>{r.km} km</span>}
                      {r.hours > 0    && <span>{r.hours} tim</span>}
                      {r.expenses > 0 && <span className="text-yellow-700">{Number(r.expenses).toFixed(2)} kr</span>}
                      {r.expense_description && <span className="text-gray-400">— {r.expense_description}</span>}
                    </div>
                    {r.status === 'returned' && r.reviewer_comment && (
                      <div className="mt-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                        Avfärdad: {r.reviewer_comment}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                    {tab === 'mine' && (r.status === 'draft' || r.status === 'returned') && (
                      <>
                        <button onClick={() => setEditingReport(r)}
                                className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200">
                          Redigera
                        </button>
                        <button onClick={() => submit(r.id)}
                                className="text-xs bg-military-navy text-white px-3 py-1 rounded hover:bg-[#16294a]">
                          Skicka in
                        </button>
                      </>
                    )}
                    {tab === 'approve' && (
                      <>
                        <button onClick={() => approve(r.id,'approve')}
                                className="text-xs bg-green-600 text-white px-3 py-1 rounded">Attestera</button>
                        <button onClick={() => approve(r.id,'return')}
                                className="text-xs bg-gray-200 text-gray-600 px-3 py-1 rounded">Returnera</button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)}
                     onCreated={() => { setShowCreate(false); load(); }} />
      )}
      {editingReport && (
        <EditReportModal report={editingReport}
                         onClose={() => setEditingReport(null)}
                         onSaved={() => { setEditingReport(null); load(); }} />
      )}
    </div>
  );
}
