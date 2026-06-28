import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

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

function CreateModal({ onClose, onCreated }) {
  const { user } = useAuth();
  const [orgs, setOrgs]   = useState([]);
  const [form, setForm]   = useState({
    title:'', description:'', type:'övning',
    start_time:'', end_time:'', org_unit_id: user?.org_unit_id || ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.orgs().then(setOrgs); }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createActivity(form);
      onCreated();
    } catch(err) { alert(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-military-navy">Skapa aktivitet</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-3">
          <input required placeholder="Titel" value={form.title}
                 onChange={e => setForm(f=>({...f,title:e.target.value}))}
                 className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
          <textarea placeholder="Beskrivning (valfritt)" value={form.description}
                    onChange={e => setForm(f=>({...f,description:e.target.value}))} rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
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
          <select value={form.org_unit_id}
                  onChange={e => setForm(f=>({...f,org_unit_id:e.target.value}))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none">
            {orgs.map(o => <option key={o.id} value={o.id}>{o.name} ({o.type})</option>)}
          </select>
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
              {saving ? 'Skapar…' : 'Skapa'}
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

function ActivityCard({ a, responding, onRespond }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="font-medium text-gray-900 text-sm">{a.title}</span>
        <span className={`badge shrink-0 ${TYPE_COLORS[a.type] || TYPE_COLORS.övrigt}`}>{a.type}</span>
      </div>
      <div className="text-xs text-gray-400 mb-0.5">{fmt(a.start_time)} – {fmt(a.end_time)}</div>
      <div className="text-xs text-gray-400">{a.unit_name} · {a.created_by_name}</div>
      {a.description && <p className="text-xs text-gray-500 mt-2">{a.description}</p>}

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

export default function Calendar() {
  const { hasRole } = useAuth();
  const [activities, setActivities] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [responding, setResponding] = useState(null);

  function load() { api.activities().then(setActivities); }
  useEffect(load, []);

  async function respond(actId, status) {
    setResponding(actId);
    await api.respond(actId, status).catch(()=>{});
    load();
    setResponding(null);
  }

  const past     = activities.filter(a => new Date(a.end_time) < new Date());
  const upcoming = activities.filter(a => new Date(a.end_time) >= new Date());

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-military-navy">Kalender</h1>
        {hasRole('pc') && (
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
            {upcoming.map(a => <ActivityCard key={a.id} a={a} responding={responding} onRespond={respond} />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Genomförda</h2>
          <div className="space-y-3 opacity-60">
            {past.map(a => <ActivityCard key={a.id} a={a} responding={responding} onRespond={respond} />)}
          </div>
        </section>
      )}

      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
}
