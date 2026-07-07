import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import PersonalImport from './PersonalImport';
import { RankInsignia, RankSelect } from '../components/Rank';
import { TYPE_ORDER, TYPE_LABELS } from '../constants/orgUnits';
import { useAuth } from '../context/AuthContext';

const ROLE_LABELS = {
  soldat:'Soldat', grpc:'Gruppchef', pc:'Plutonchef', toc:'Troppchef',
  kompc:'Kompanichef', kvm:'Komp-VKM', s4:'S4/Bat-VKM', batCh:'Bataljonschef', stab:'Stab'
};
const ROLE_COLORS = {
  soldat:'bg-gray-100 text-gray-600', grpc:'bg-blue-100 text-blue-700',
  pc:'bg-indigo-100 text-indigo-700', toc:'bg-violet-100 text-violet-700',
  kompc:'bg-amber-100 text-amber-800', kvm:'bg-orange-100 text-orange-800',
  s4:'bg-red-100 text-red-700', batCh:'bg-red-200 text-red-800', stab:'bg-slate-200 text-slate-700'
};

function PersonalList() {
  const { hasRole } = useAuth();
  const [persons,    setPersons]    = useState([]);
  const [units,      setUnits]      = useState([]);
  const [query,      setQuery]      = useState('');
  const [editing,    setEditing]    = useState(null);  // person id being edited
  const [draft,      setDraft]      = useState({});
  const [saving,     setSaving]     = useState(false);
  const [loading,    setLoading]    = useState(true);
  const [anonymizing, setAnonymizing] = useState(null); // person id being anonymized
  const canAnonymize = hasRole('s4');

  function load() {
    Promise.all([api.personalList(), api.orgs()])
      .then(([ps, us]) => { setPersons(ps); setUnits(us); })
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  function startEdit(p) {
    setEditing(p.id);
    setDraft({
      name: p.name, role: p.role, org_unit_id: p.org_unit_id || '',
      mobile: p.mobile || '', email: p.email || '', rank: p.rank || '',
      service_ended_at: p.service_ended_at ? p.service_ended_at.slice(0, 10) : '',
    });
  }

  async function save(id) {
    setSaving(true);
    try {
      const updated = await api.updatePerson(id, draft);
      setPersons(prev => prev.map(p => p.id === id ? { ...p, ...updated,
        unit_name: units.find(u => u.id === Number(draft.org_unit_id))?.name || p.unit_name,
        parent_unit_name: units.find(u => u.id === Number(units.find(u2 => u2.id === Number(draft.org_unit_id))?.parent_id))?.name || p.parent_unit_name,
      } : p));
      setEditing(null);
    } catch(e) { alert(e.message); }
    finally { setSaving(false); }
  }

  async function exportPerson(p, e) {
    e.stopPropagation();
    try { await api.exportPerson(p.id, p.hv_id); } catch (err) { alert(err.message); }
  }

  async function anonymize(p, e) {
    e.stopPropagation();
    if (!confirm(
      `Anonymisera ${p.name}?\n\nNamn, personnummer, kontaktuppgifter och grad rensas permanent. ` +
      `Kontrollera själv att inga lagringskrav (t.ex. SÄVA/km-ersättning, 7 år) gäller innan du fortsätter — ` +
      `detta görs inte automatiskt.`
    )) return;
    setAnonymizing(p.id);
    try {
      const updated = await api.anonymizePerson(p.id);
      setPersons(prev => prev.map(x => x.id === p.id ? { ...x, ...updated, personal_number: null } : x));
    } catch (err) { alert(err.message); }
    finally { setAnonymizing(null); }
  }

  const filtered = persons.filter(p => {
    const q = query.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q)
              || p.unit_name?.toLowerCase().includes(q)
              || ROLE_LABELS[p.role]?.toLowerCase().includes(q);
  });

  if (loading) return <p className="text-sm text-gray-400">Laddar…</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input type="search" placeholder="Sök namn, enhet eller roll…" value={query}
          onChange={e => setQuery(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
        <span className="text-xs text-gray-400 shrink-0">{filtered.length} / {persons.length}</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Namn</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Roll</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Enhet</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Inloggningsnr</th>
              <th className="px-4 py-2 w-8"></th>
              <th className="px-4 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map(p => editing === p.id ? (
              <tr key={p.id} className="bg-blue-50">
                <td colSpan={6} className="px-4 py-3">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Namn</label>
                      <input value={draft.name} onChange={e => setDraft(d => ({...d, name: e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Roll</label>
                      <select value={draft.role} onChange={e => setDraft(d => ({...d, role: e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
                        {Object.entries(ROLE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Enhet</label>
                      <select value={draft.org_unit_id} onChange={e => setDraft(d => ({...d, org_unit_id: e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none">
                        <option value="">– Ingen –</option>
                        {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Telefon</label>
                      <input value={draft.mobile} onChange={e => setDraft(d => ({...d, mobile: e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">E-post</label>
                      <input value={draft.email} onChange={e => setDraft(d => ({...d, email: e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Grad</label>
                      <RankSelect value={draft.rank} onChange={v => setDraft(d => ({...d, rank: v}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Slutade (tjänstgöring)</label>
                      <input type="date" value={draft.service_ended_at}
                        onChange={e => setDraft(d => ({...d, service_ended_at: e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => save(p.id)} disabled={saving}
                      className="btn-primary text-xs">{saving ? 'Sparar…' : 'Spara'}</button>
                    <button onClick={() => setEditing(null)}
                      className="btn-secondary text-xs">Avbryt</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => startEdit(p)}>
                <td className="px-4 py-2 font-medium text-gray-900">
                  <span className="flex items-center gap-1.5">
                    <RankInsignia rank={p.rank} />
                    {p.name}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span className={`badge text-xs ${ROLE_COLORS[p.role] || 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABELS[p.role] || p.role}
                  </span>
                </td>
                <td className="px-4 py-2 text-gray-500 text-xs">
                  {p.parent_unit_name && <span className="text-gray-300">{p.parent_unit_name} › </span>}
                  {p.unit_name || '–'}
                </td>
                <td className="px-4 py-2 text-gray-400 text-xs font-mono">{p.personal_number}</td>
                <td className="px-4 py-2 text-gray-300 text-xs">✎</td>
                <td className="px-4 py-2 text-xs">
                  <div className="flex items-center gap-3 justify-end">
                    {canAnonymize && (
                      <button onClick={e => exportPerson(p, e)}
                        className="text-gray-400 hover:text-military-navy transition-colors">
                        Exportera
                      </button>
                    )}
                    {p.anonymized_at ? (
                      <span className="text-gray-300">Anonymiserad</span>
                    ) : canAnonymize && (
                      <button onClick={e => anonymize(p, e)} disabled={anonymizing === p.id}
                        className="text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors">
                        {anonymizing === p.id ? 'Anonymiserar…' : 'Anonymisera'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-400">Inga träffar</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildTree(units) {
  const map = {};
  units.forEach(u => { map[u.id] = { ...u, children: [] }; });
  const roots = [];
  units.forEach(u => {
    if (u.parent_id && map[u.parent_id]) map[u.parent_id].children.push(map[u.id]);
    else roots.push(map[u.id]);
  });
  return roots;
}

function TreeNode({ node, onDelete, depth = 0 }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ paddingLeft: depth * 20 }}>
      <div className="flex items-center gap-2 py-1.5 group">
        {node.children.length > 0 && (
          <button onClick={() => setOpen(o=>!o)} className="text-gray-400 w-4 text-xs">
            {open ? '▾' : '▸'}
          </button>
        )}
        {node.children.length === 0 && <span className="w-4" />}
        <span className="text-xs badge bg-gray-100 text-gray-500">{TYPE_LABELS[node.type]}</span>
        <span className="text-sm text-gray-900">{node.name}</span>
        <button onClick={() => onDelete(node.id)}
                className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
          Ta bort
        </button>
      </div>
      {open && node.children.map(c => (
        <TreeNode key={c.id} node={c} onDelete={onDelete} depth={depth+1} />
      ))}
    </div>
  );
}

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('sv-SE') : '–';
}

function RetentionPanel() {
  const [data,    setData]    = useState({ contacts: [], stale_activity_responses: [] });
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState(null); // id being acted on

  function load() {
    setLoading(true);
    api.retentionCandidates().then(setData).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function anonymize(c) {
    if (!confirm(`Anonymisera ${c.name} (${c.hv_id})? Slutade tjänstgöra ${fmtDate(c.service_ended_at)}.`)) return;
    setBusy(c.id);
    try {
      await api.anonymizePerson(c.id);
      setData(d => ({ ...d, contacts: d.contacts.filter(x => x.id !== c.id) }));
    } catch (e) { alert(e.message); }
    finally { setBusy(null); }
  }

  async function deleteResponse(r) {
    if (!confirm(`Radera aktivitetssvaret från ${r.user_name} för "${r.activity_title}"?`)) return;
    setBusy(r.id);
    try {
      await api.deleteActivityResponse(r.id);
      setData(d => ({ ...d, stale_activity_responses: d.stale_activity_responses.filter(x => x.id !== r.id) }));
    } catch (e) { alert(e.message); }
    finally { setBusy(null); }
  }

  if (loading) return <p className="text-sm text-gray-400">Laddar…</p>;

  return (
    <div className="space-y-6">
      <p className="text-xs text-gray-500">
        Kandidater flaggas här för manuell granskning — inget raderas eller anonymiseras automatiskt.
        Kontrollera själv att åtgärden är rimlig innan du bekräftar.
      </p>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Kontaktdata — slutade för mer än 1 år sedan ({data.contacts.length})
        </h2>
        {data.contacts.length === 0 ? (
          <p className="text-sm text-gray-400">Inga kandidater</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {data.contacts.map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{c.name} <span className="text-xs text-gray-400 font-mono ml-1">{c.hv_id}</span></span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">Slutade {fmtDate(c.service_ended_at)}</span>
                  <button onClick={() => anonymize(c)} disabled={busy === c.id}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors">
                    {busy === c.id ? 'Anonymiserar…' : 'Anonymisera'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-2">
          Aktivitetssvar äldre än 2 år ({data.stale_activity_responses.length})
        </h2>
        {data.stale_activity_responses.length === 0 ? (
          <p className="text-sm text-gray-400">Inga kandidater</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {data.stale_activity_responses.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{r.user_name} <span className="text-xs text-gray-400">— {r.activity_title}</span></span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{fmtDate(r.start_time)}</span>
                  <button onClick={() => deleteResponse(r)} disabled={busy === r.id}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50 transition-colors">
                    {busy === r.id ? 'Raderar…' : 'Radera'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrgAdmin() {
  const { hasRole } = useAuth();
  const [tab, setTab]       = useState('org');
  const [units, setUnits]   = useState([]);
  const [form, setForm]     = useState({ name:'', type:'kompani', parent_id:'' });
  const [saving, setSaving] = useState(false);

  function load() { api.orgs().then(setUnits); }
  useEffect(load, []);

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createUnit({ ...form, parent_id: form.parent_id || null });
      setForm(f => ({ ...f, name:'' }));
      load();
    } catch(err) { alert(err.message); }
    finally { setSaving(false); }
  }

  async function del(id) {
    if (!confirm('Ta bort enhet? Soldater kopplade till denna enhet förlorar sin tillhörighet.')) return;
    await api.deleteUnit(id).catch(e => alert(e.message));
    load();
  }

  const tree = buildTree(units);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-military-navy mb-5">Administration</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          ['org','Org-träd'], ['lista','Personal'], ['personal','Personalimport'],
          ...(hasRole('s4') ? [['retention','Retention']] : []),
        ].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
                    ${tab===k ? 'border-military-navy text-military-navy' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'personal'  && <PersonalImport />}
      {tab === 'lista'     && <PersonalList />}
      {tab === 'retention' && hasRole('s4') && <RetentionPanel />}
      {tab === 'org' && <>


      {/* Create form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Skapa ny enhet</h2>
        <form onSubmit={create} className="flex gap-2 flex-wrap">
          <input required placeholder="Namn" value={form.name}
                 onChange={e => setForm(f=>({...f,name:e.target.value}))}
                 className="flex-1 min-w-36 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
          <select value={form.type} onChange={e => setForm(f=>({...f,type:e.target.value}))}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none">
            {TYPE_ORDER.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
          <select value={form.parent_id} onChange={e => setForm(f=>({...f,parent_id:e.target.value}))}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none">
            <option value="">Ingen överordnad</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.name} ({u.type})</option>)}
          </select>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Skapar…' : 'Skapa'}
          </button>
        </form>
      </div>

      {/* Tree view */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Nuvarande struktur</h2>
        {tree.length === 0 ? (
          <p className="text-sm text-gray-400">Inga enheter skapade</p>
        ) : (
          tree.map(n => <TreeNode key={n.id} node={n} onDelete={del} />)
        )}
      </div>
      </>}
    </div>
  );
}
