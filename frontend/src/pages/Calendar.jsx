import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

function buildOrgOptions(units) {
  const map = {};
  units.forEach(u => map[u.id] = { ...u, children: [] });
  const roots = [];
  units.forEach(u => {
    if (u.parent_id && map[u.parent_id]) map[u.parent_id].children.push(map[u.id]);
    else roots.push(map[u.id]);
  });
  const PREFIX = ['', '  — ', '    — ', '      — '];
  const result = [];
  function walk(nodes, depth) {
    nodes.forEach(n => {
      result.push({ id: n.id, label: (PREFIX[depth] ?? '        — ') + n.name });
      walk(n.children, depth + 1);
    });
  }
  walk(roots, 0);
  return result;
}

function fmt(iso) {
  return new Date(iso).toLocaleDateString('sv-SE', {
    weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
  });
}

const TYPE_COLORS = {
  övning:'bg-red-100 text-red-700',
  utbildning:'bg-blue-100 text-blue-700',
  möte:'bg-green-100 text-green-700',
  övrigt:'bg-gray-100 text-gray-600',
  kfö:'bg-military-navy/10 text-military-navy font-semibold',
  söf:'bg-military-navy/10 text-military-navy font-semibold',
  söb:'bg-military-navy/10 text-military-navy font-semibold',
};
const RESP_COLORS = {
  ja:'bg-green-100 text-green-800 border-green-200',
  nej:'bg-red-100 text-red-800 border-red-200',
  kanske:'bg-yellow-100 text-yellow-800 border-yellow-200',
};

function ResponseButtons({ current, onSelect, disabled }) {
  return (
    <div className="flex gap-2 mt-3">
      {['ja','nej','kanske'].map(s => (
        <button key={s}
          onClick={() => onSelect(s)}
          disabled={disabled}
          className={`px-3 py-1 rounded text-xs font-medium border transition-colors
                      ${current === s ? RESP_COLORS[s] : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
        >
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </button>
      ))}
    </div>
  );
}

function toLocalDT(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ActivityModal({ activity, onClose, onSaved }) {
  const { user } = useAuth();
  const isEdit = !!activity;
  const [orgs, setOrgs]       = useState([]);
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({
    title:          activity?.title          || '',
    description:    activity?.description    || '',
    type:           activity?.type           || 'övning',
    start_time:     activity ? toLocalDT(activity.start_time) : '',
    end_time:       activity ? toLocalDT(activity.end_time)   : '',
    org_unit_id:    activity?.org_unit_id    || user?.org_unit_id || '',
    responsible_id: activity?.responsible_id || user?.id || '',
    location:       activity?.location       || '',
    equipment:      activity?.equipment      || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.scopedOrgs().then(setOrgs); }, []);

  useEffect(() => {
    if (!form.org_unit_id) return;
    api.unitMembers(form.org_unit_id).then(setMembers).catch(() => {});
  }, [form.org_unit_id]);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      isEdit ? await api.updateActivity(activity.id, form) : await api.createActivity(form);
      onSaved();
    } catch(err) { alert(err.message); }
    finally { setSaving(false); }
  }

  const typeSelect = (
    <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none">
      <option value="övning">Övning</option>
      <option value="utbildning">Utbildning</option>
      <option value="möte">Möte</option>
      <option value="övrigt">Övrigt</option>
      <optgroup label="Avtalsövningar">
        <option value="kfö">KFÖ — Krigsförbandsövning</option>
        <option value="söf">SÖF — Särskild övning förband</option>
        <option value="söb">SÖB — Särskild övning befäl</option>
      </optgroup>
    </select>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-military-navy">{isEdit ? 'Redigera aktivitet' : 'Skapa aktivitet'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-3">
          <input required placeholder="Titel" value={form.title}
                 onChange={e => setForm(f=>({...f,title:e.target.value}))}
                 className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
          <textarea placeholder="Beskrivning (valfritt)" value={form.description}
                    onChange={e => setForm(f=>({...f,description:e.target.value}))} rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
          {typeSelect}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Riktas till</label>
            <select value={form.org_unit_id}
                    onChange={e => setForm(f=>({...f,org_unit_id:e.target.value}))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none">
              {buildOrgOptions(orgs).map(o => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Ansvarig</label>
            <select value={form.responsible_id}
                    onChange={e => setForm(f=>({...f,responsible_id:e.target.value}))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="">— Ingen ansvarig —</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <input placeholder="Plats (valfritt)" value={form.location}
                 onChange={e => setForm(f=>({...f,location:e.target.value}))}
                 className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
          <textarea placeholder="Utrustning som ska medföras (valfritt)" value={form.equipment}
                    onChange={e => setForm(f=>({...f,equipment:e.target.value}))} rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start</label>
              <input type="datetime-local" required value={form.start_time}
                     onChange={e => setForm(f=>({...f,start_time:e.target.value}))}
                     className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Slut</label>
              <input type="datetime-local" required value={form.end_time}
                     onChange={e => setForm(f=>({...f,end_time:e.target.value}))}
                     className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Avbryt</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Sparar…' : isEdit ? 'Spara' : 'Skapa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const RESP_ICON = { ja: '✓', nej: '✗', kanske: '?' };
const RESP_ROW  = {
  ja:     'text-green-700',
  nej:    'text-red-600',
  kanske: 'text-yellow-600',
};

function ResponseSummary({ a }) {
  const ja      = Number(a.count_ja)      || 0;
  const nej     = Number(a.count_nej)     || 0;
  const kanske  = Number(a.count_kanske)  || 0;
  const pending = Number(a.count_pending) || 0;
  const total   = ja + nej + kanske + pending;
  if (total === 0) return null;
  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      {ja > 0      && <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-0.5">✓ {ja}</span>}
      {nej > 0     && <span className="inline-flex items-center gap-1 text-xs text-red-600  bg-red-50   border border-red-200   rounded px-2 py-0.5">✗ {nej}</span>}
      {kanske > 0  && <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-0.5">? {kanske}</span>}
      {pending > 0 && <span className="inline-flex items-center gap-1 text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded px-2 py-0.5">– {pending}</span>}
    </div>
  );
}

function ActivityDetail({ actId }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    api.activity(actId).then(setDetail);
  }, [actId]);

  if (!detail) return <p className="text-xs text-gray-400 py-2">Laddar…</p>;

  // Group responses by unit
  const groups = {};
  for (const r of detail.responses) {
    const key = r.unit_name || 'Okänd enhet';
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  return (
    <div className="mt-3 border-t border-gray-100 pt-3 space-y-3">
      {Object.entries(groups).map(([unit, members]) => (
        <div key={unit}>
          <div className="text-xs font-semibold text-gray-500 mb-1">{unit}</div>
          <div className="space-y-0.5">
            {members.map(m => (
              <div key={m.user_id} className="flex items-center gap-2 text-xs">
                <span className={`w-4 text-center font-bold ${RESP_ROW[m.status] || 'text-gray-300'}`}>
                  {RESP_ICON[m.status] || '–'}
                </span>
                <span className={m.status ? 'text-gray-700' : 'text-gray-400'}>{m.user_name}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityCard({ a, responding, onRespond, onEdit, onDelete, onAttend, canEdit, isResponsible }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-gray-900 text-sm">{a.title}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`badge ${TYPE_COLORS[a.type] || TYPE_COLORS.övrigt}`}>{a.type}</span>
          {canEdit && (
            <>
              <button onClick={() => onEdit(a)} className="text-xs text-gray-400 hover:text-military-navy transition-colors">Redigera</button>
              <button onClick={() => onDelete(a)} className="text-xs text-gray-400 hover:text-red-600 transition-colors">Ta bort</button>
            </>
          )}
          {isResponsible && (
            <button onClick={() => onAttend(a)}
              className="text-xs text-military-navy font-medium hover:underline transition-colors">
              Närvaro
            </button>
          )}
        </div>
      </div>
      <div className="text-xs text-gray-400 mb-0.5">{fmt(a.start_time)} – {fmt(a.end_time)}</div>
      <div className="text-xs text-gray-400 space-y-0.5">
        <div>{a.unit_name}</div>
        {a.responsible_name && <div><span className="text-military-navy font-medium">Ansvarig:</span> {a.responsible_name}</div>}
        <div><span className="text-gray-400">Skapad av:</span> {a.created_by_name}</div>
      </div>
      {a.description && <p className="text-xs text-gray-500 mt-2">{a.description}</p>}
      {(a.location || a.equipment) && (
        <div className="mt-2 space-y-0.5">
          {a.location  && <div className="text-xs text-gray-500">📍 {a.location}</div>}
          {a.equipment && <div className="text-xs text-gray-500">🎒 {a.equipment}</div>}
        </div>
      )}

      {['kfö','söf','söb'].includes(a.type) ? (
        <div className="mt-2 text-xs text-military-navy font-medium">Avtalsövning</div>
      ) : (
        <>
          {/* Response counts + expand toggle */}
          <div className="flex items-center justify-between mt-2">
            <ResponseSummary a={a} />
            <button onClick={() => setExpanded(e => !e)}
                    className="text-xs text-gray-400 hover:text-military-navy transition-colors shrink-0 ml-2">
              {expanded ? 'Dölj ▲' : 'Visa svar ▾'}
            </button>
          </div>

          {/* Expanded detail */}
          {expanded && <ActivityDetail actId={a.id} />}

          {/* My response */}
          <ResponseButtons current={a.my_response} disabled={responding === a.id}
                           onSelect={s => onRespond(a.id, s)} />
        </>
      )}
    </div>
  );
}

function AttendanceModal({ activity, onClose, onSaved }) {
  const [detail,      setDetail]      = useState(null);
  const [allMembers,  setAllMembers]  = useState([]);
  const [attendance,  setAttendance]  = useState({});  // {userId: {present, km}}
  const [walkIns,     setWalkIns]     = useState([]);  // [{user_id, name, km}]
  const [walkInId,    setWalkInId]    = useState('');
  const [walkInKm,    setWalkInKm]    = useState('');
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    api.activity(activity.id).then(d => {
      setDetail(d);
      const init = {};
      d.responses.forEach(r => { init[r.user_id] = { present: false, km: '' }; });
      setAttendance(init);
    });
    api.unitMembers(activity.org_unit_id).then(setAllMembers);
  }, [activity.id]);

  const respondentIds = new Set(detail?.responses.map(r => r.user_id) || []);
  const walkInIds     = new Set(walkIns.map(w => w.user_id));
  const available     = allMembers.filter(m => !respondentIds.has(m.id) && !walkInIds.has(m.id));

  function addWalkIn() {
    if (!walkInId) return;
    const m = allMembers.find(m => m.id === Number(walkInId));
    setWalkIns(prev => [...prev, { user_id: m.id, name: m.name, km: walkInKm }]);
    setWalkInId(''); setWalkInKm('');
  }

  async function submit() {
    setSaving(true);
    try {
      const present   = (detail?.responses || []).filter(r => attendance[r.user_id]?.present)
                          .map(r => ({ user_id: r.user_id, km: Number(attendance[r.user_id]?.km) || 0 }));
      const absent    = (detail?.responses || []).filter(r => !attendance[r.user_id]?.present)
                          .map(r => ({ user_id: r.user_id }));
      const walk_ins  = walkIns.map(w => ({ user_id: w.user_id, km: Number(w.km) || 0 }));
      await api.reportAttendance(activity.id, { present, absent, walk_ins });
      onSaved();
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  }

  const STATUS_ORDER = { ja: 0, kanske: 1, null: 2, nej: 3 };
  const sorted = [...(detail?.responses || [])].sort((a, b) =>
    (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2)
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="font-semibold text-military-navy">Närvaro — {activity.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-4 space-y-1">
          {!detail && <p className="text-sm text-gray-400 text-center py-4">Laddar…</p>}

          {sorted.map(r => (
            <div key={r.user_id} className="flex items-center gap-3 py-1.5 border-b border-gray-50">
              <input type="checkbox" className="h-4 w-4 accent-military-navy"
                checked={!!attendance[r.user_id]?.present}
                onChange={e => setAttendance(prev => ({...prev, [r.user_id]: {...prev[r.user_id], present: e.target.checked}}))} />
              <span className="flex-1 text-sm text-gray-800">{r.user_name}</span>
              <span className="text-xs text-gray-400 w-12 text-center">{r.status ?? '–'}</span>
              {attendance[r.user_id]?.present && (
                <div className="flex items-center gap-1">
                  <input type="number" min="0" placeholder="km"
                    value={attendance[r.user_id]?.km || ''}
                    onChange={e => setAttendance(prev => ({...prev, [r.user_id]: {...prev[r.user_id], km: e.target.value}}))}
                    className="w-16 border rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-military-steel" />
                  <span className="text-xs text-gray-400">km</span>
                </div>
              )}
            </div>
          ))}

          {/* Walk-ins */}
          <div className="pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Walk-ins</p>
            {walkIns.map((w, i) => (
              <div key={i} className="flex items-center gap-3 py-1 text-sm text-gray-700">
                <span className="flex-1">{w.name}</span>
                <input type="number" min="0" value={w.km}
                  onChange={e => setWalkIns(prev => prev.map((x,j) => j===i ? {...x, km: e.target.value} : x))}
                  className="w-16 border rounded px-2 py-0.5 text-xs text-right focus:outline-none" />
                <span className="text-xs text-gray-400">km</span>
                <button onClick={() => setWalkIns(prev => prev.filter((_,j) => j!==i))}
                  className="text-gray-300 hover:text-red-400 text-xs">✕</button>
              </div>
            ))}
            {available.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <select value={walkInId} onChange={e => setWalkInId(e.target.value)}
                  className="flex-1 border rounded px-2 py-1 text-sm focus:outline-none">
                  <option value="">+ Lägg till person</option>
                  {available.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <input type="number" min="0" placeholder="km" value={walkInKm}
                  onChange={e => setWalkInKm(e.target.value)}
                  className="w-16 border rounded px-2 py-1 text-xs text-right focus:outline-none" />
                <button onClick={addWalkIn} className="btn-secondary text-xs px-3 py-1">Lägg till</button>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 shrink-0">
          <button onClick={onClose} className="btn-secondary flex-1">Avbryt</button>
          <button onClick={submit} disabled={saving || !detail} className="btn-primary flex-1">
            {saving ? 'Sparar…' : 'Spara närvaro'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const { user, hasRole } = useAuth();
  const [activities,      setActivities]      = useState([]);
  const [showCreate,      setShowCreate]      = useState(false);
  const [editActivity,    setEditActivity]    = useState(null);
  const [attendActivity,  setAttendActivity]  = useState(null);
  const [responding,      setResponding]      = useState(null);

  function load() { api.activities().then(setActivities); }
  useEffect(load, []);

  async function respond(actId, status) {
    setResponding(actId);
    await api.respond(actId, status).catch(()=>{});
    load();
    setResponding(null);
  }

  async function handleDelete(a) {
    if (!confirm(`Ta bort "${a.title}"?`)) return;
    await api.deleteActivity(a.id).catch(e => alert(e.message));
    load();
  }

  const past     = activities.filter(a => new Date(a.end_time) < new Date());
  const upcoming = activities.filter(a => new Date(a.end_time) >= new Date());

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-military-navy">Kalender</h1>
        {hasRole('grpc') && (
          <button onClick={() => setShowCreate(true)} className="btn-primary text-sm">
            + Ny aktivitet
          </button>
        )}
      </div>

      {upcoming.length === 0 && past.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">Inga aktiviteter</div>
      )}

      {upcoming.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Kommande</h2>
          <div className="space-y-3">
            {upcoming.map(a => <ActivityCard key={a.id} a={a} responding={responding} onRespond={respond} canEdit={hasRole('grpc')} onEdit={setEditActivity} onDelete={handleDelete} onAttend={setAttendActivity} isResponsible={a.responsible_id === user?.id} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Genomförda</h2>
          <div className="space-y-3 opacity-60">
            {past.map(a => <ActivityCard key={a.id} a={a} responding={responding} onRespond={respond} canEdit={hasRole('grpc')} onEdit={setEditActivity} onDelete={handleDelete} onAttend={setAttendActivity} isResponsible={a.responsible_id === user?.id} />)}
          </div>
        </section>
      )}

      {showCreate && (
        <ActivityModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />
      )}
      {editActivity && (
        <ActivityModal activity={editActivity} onClose={() => setEditActivity(null)} onSaved={() => { setEditActivity(null); load(); }} />
      )}
      {attendActivity && (
        <AttendanceModal activity={attendActivity} onClose={() => setAttendActivity(null)} onSaved={() => { setAttendActivity(null); load(); }} />
      )}
    </div>
  );
}
