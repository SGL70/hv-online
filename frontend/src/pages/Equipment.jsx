import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import CatalogTab from './Catalog';
import PrioImport from './PrioImport';

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

// Left-edge color bar by status
const STATUS_BAR = {
  ok:            'bg-green-400',
  ej_mottagen:   'bg-yellow-400',
  ej_tilldelad:  'bg-gray-300',
  förlustanmäld: 'bg-red-500',
  byte_pågår:    'bg-blue-400',
};

function CaseModal({ item, onClose, onDone }) {
  // item has: equipment_id (may be null), template_id (may be null), name, status
  const defaultType = item.status === 'ej_tilldelad' ? 'ej_mottagen' : 'ej_mottagen';
  const [type, setType]   = useState(defaultType);
  const [form, setForm]   = useState({
    description:           '',
    incident_time:         '',
    incident_location:     '',
    incident_description:  '',
    witnesses:             '',
    agrees_to_compensate:  '',
  });
  const [saving, setSaving] = useState(false);
  const isLoss = type === 'förlust';
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createCase({
        equipment_id: item.equipment_id || undefined,
        template_id:  item.template_id  || undefined,
        type,
        description: form.description,
        ...(isLoss ? {
          incident_time:        form.incident_time        || null,
          incident_location:    form.incident_location    || null,
          incident_description: form.incident_description || null,
          witnesses:            form.witnesses            || null,
          agrees_to_compensate: form.agrees_to_compensate === 'ja'  ? true
                              : form.agrees_to_compensate === 'nej' ? false
                              : null,
        } : {}),
      });
      onDone();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-semibold text-military-navy text-sm">Anmäl ärende — {item.name}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form onSubmit={submit} className="px-5 py-4 space-y-4">
          {item.status === 'ej_tilldelad' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5 text-xs text-amber-800">
              Artikeln saknas i din utrustning — ärendet skapar automatiskt en post med status "Ej mottagen".
            </div>
          )}

          <div>
            <label className="text-xs text-gray-500 block mb-1">Ärendetyp</label>
            <select value={type} onChange={e => setType(e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none">
              <option value="ej_mottagen">Ej mottagen</option>
              <option value="beställning">Beställ ersättning</option>
              <option value="förlust">Förlustanmälan</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Beskrivning</label>
            <textarea required placeholder="Beskriv ärendet kortfattat…" value={form.description}
                      onChange={f('description')} rows={2}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
          </div>

          {isLoss && (
            <>
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-800">
                Artikeln låses under utredning. Uppgifterna nedan används för att förbereda
                blankett M7102-500360E (Förlustförteckning).
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Tid för förlusten</label>
                  <input type="datetime-local" value={form.incident_time} onChange={f('incident_time')}
                         className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Plats</label>
                  <input placeholder="Skjutfält, förläggning…" value={form.incident_location}
                         onChange={f('incident_location')}
                         className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Redogörelse — under vilka omständigheter skedde förlusten?
                </label>
                <textarea placeholder="Beskriv händelseförloppet i detalj…" value={form.incident_description}
                          onChange={f('incident_description')} rows={4}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Vittnen / personer som känner till förlusten
                </label>
                <textarea placeholder="Namn, befattning…" value={form.witnesses}
                          onChange={f('witnesses')} rows={2}
                          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Medger att ersätta förlusten</label>
                <select value={form.agrees_to_compensate} onChange={f('agrees_to_compensate')}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none">
                  <option value="">Ej angett</option>
                  <option value="ja">Ja</option>
                  <option value="nej">Nej</option>
                </select>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Avbryt</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Skickar…' : 'Skicka in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Equipment() {
  const { hasRole, isLogistics } = useAuth();
  const [kit, setKit]               = useState({ standard: [], extra: [] });
  const [shortfalls, setShortfalls] = useState([]);
  const [selected, setSelected]     = useState(null);
  const [tab, setTab]               = useState('mine');
  const [openInv, setOpenInv]       = useState(null);
  const [lastInv, setLastInv]       = useState(null);
  const [invFormMode, setInvFormMode] = useState(false);
  const [counts, setCounts]           = useState({});

  function load() {
    api.myKit().then(setKit);
    api.myInventory().then(setOpenInv).catch(() => {});
    api.lastInventory().then(setLastInv).catch(() => {});
    if (hasRole('grpc')) api.unitShortfalls().then(setShortfalls);
  }
  useEffect(load, []);

  function startInvForm(kitData) {
    const src = kitData || kit;
    const initial = {};
    src.standard.forEach(i => {
      initial[i.article_number] = i.status === 'förlustanmäld' ? 0 : i.std_quantity;
    });
    setCounts(initial);
    setInvFormMode(true);
  }

  async function handleSubmitInventory() {
    if (!openInv) return;
    const items = Object.entries(counts).map(([article_number, actual_qty]) => ({
      article_number, actual_qty: Number(actual_qty) || 0
    }));
    try {
      const r = await api.submitInventory(openInv.id, items);
      setOpenInv(null);
      setInvFormMode(false);
      setCounts({});
      if (r.losses > 0) alert(`Inventering klar. ${r.losses} förlustanmälning(ar) skapade.`);
      load();
    } catch (e) { alert(e.message); }
  }

  const tabs = [
    ['mine',    'Min utrustning'],
    ...(isLogistics() ? [['catalog', 'Katalog'], ['prio', 'PRIO-import']] : []),
  ];

  // Group standard kit by category
  const stdCats = [...new Set(kit.standard.map(i => i.category || 'Övrigt'))].sort();
  const extraCats = [...new Set(kit.extra.map(i => i.category || 'Övrigt'))].sort();

  // Can the user report a new case for this item?
  function canReport(item) {
    if (item.active_case_id) return false;
    return ['ok', 'ej_tilldelad'].includes(item.status);
  }

  function openCase(item) {
    setSelected({
      equipment_id: item.equipment_id || null,
      template_id:  item.template_id  || null,
      name:         item.name,
      status:       item.status,
    });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-bold text-military-navy mb-5">Pers. Utrustning</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 flex-wrap">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
                              ${tab === key
                                ? 'border-military-navy text-military-navy'
                                : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Min utrustning */}
      {tab === 'mine' && (
        <div className="space-y-6">

          {/* Inventory banner / form launcher */}
          {openInv && !invFormMode && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-900">Genomför inventering av Personlig materiel</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Startad av {openInv.initiated_by_name} · {new Date(openInv.created_at).toLocaleDateString('sv-SE')}
                </p>
                {openInv.deadline && (
                  <p className="text-xs text-amber-800 font-medium mt-0.5">
                    Klart senast: {new Date(openInv.deadline).toLocaleDateString('sv-SE')}
                  </p>
                )}
                <p className="text-xs text-amber-600 mt-1">
                  Fyll i faktiskt antal för varje artikel. 0 = förlustanmälan skapas automatiskt.
                </p>
              </div>
              <button
                onClick={() => startInvForm()}
                className="shrink-0 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
                Fyll i inventering
              </button>
            </div>
          )}

          {/* Last inventory date (no active inventory) */}
          {!openInv && lastInv?.submitted_at && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span>
              Senast inventerad: {new Date(lastInv.submitted_at).toLocaleDateString('sv-SE')}
            </div>
          )}

          {/* ── INVENTORY FORM MODE ─────────────────────────────── */}
          {invFormMode && openInv && (
            <div className="space-y-4">
              {/* Sticky header */}
              <div className="bg-amber-50 border border-amber-300 rounded-xl px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-amber-900">Inventering — fyll i antal</p>
                  <p className="text-xs text-amber-700">
                    Ange faktiskt antal du har. 0 = förlust anmäls. Röd bakgrund = saknas.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { setInvFormMode(false); setCounts({}); }}
                          className="text-xs text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-300">
                    Avbryt
                  </button>
                  <button onClick={handleSubmitInventory}
                          className="btn-primary text-xs">
                    Skicka in
                  </button>
                </div>
              </div>

              {stdCats.map(cat => (
                <div key={cat}>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{cat}</h2>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <ul className="divide-y divide-gray-100">
                      {kit.standard.filter(i => (i.category || 'Övrigt') === cat).map(i => {
                        const val = counts[i.article_number] ?? i.std_quantity;
                        const isZero = Number(val) === 0;
                        return (
                          <li key={i.template_id}
                              className={`flex items-center gap-0 pr-4 ${isZero ? 'bg-red-50' : ''}`}>
                            <div className={`w-1 self-stretch shrink-0 ${isZero ? 'bg-red-500' : 'bg-green-400'}`} />
                            <div className="flex-1 py-3 mx-4 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{i.name}</div>
                              <div className="text-xs font-mono text-gray-400">
                                {i.article_number} · förväntat: {i.std_quantity} {i.unit}
                              </div>
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={val}
                              onChange={e => setCounts(p => ({ ...p, [i.article_number]: e.target.value === '' ? '' : Number(e.target.value) }))}
                              className={`w-16 text-center border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 ${isZero ? 'border-red-400 text-red-700 bg-red-50' : 'border-gray-300'}`}
                            />
                            <span className="text-xs text-gray-400 ml-2 w-6 shrink-0">{i.unit}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              ))}

              <button onClick={handleSubmitInventory}
                      className="btn-primary w-full text-sm py-3">
                Skicka in inventering
              </button>
            </div>
          )}

          {/* ── NORMAL VIEW ────────────────────────────────────── */}
          {!invFormMode && (
            <>
              {/* Stats bar */}
              {kit.standard.length > 0 && (() => {
                const ok    = kit.standard.filter(i => i.status === 'ok').length;
                const miss  = kit.standard.filter(i => i.status === 'ej_tilldelad' || i.status === 'ej_mottagen').length;
                const issue = kit.standard.filter(i => i.status === 'förlustanmäld' || i.status === 'byte_pågår').length;
                return (
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-700 font-medium">{ok} ok</span>
                    {miss  > 0 && <span className="text-yellow-700 font-medium">{miss} saknas/ej mottagen</span>}
                    {issue > 0 && <span className="text-red-700 font-medium">{issue} pågående ärende</span>}
                    <span className="text-gray-400">/ {kit.standard.length} standardartiklar</span>
                  </div>
                );
              })()}

              {/* Standard kit grouped by category */}
              {stdCats.map(cat => (
                <div key={cat}>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{cat}</h2>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <ul className="divide-y divide-gray-100">
                      {kit.standard.filter(i => (i.category || 'Övrigt') === cat).map(i => (
                        <li key={i.template_id}
                            className="flex items-center gap-0 pr-4 hover:bg-gray-50 transition-colors">
                          <div className={`w-1 self-stretch shrink-0 ${STATUS_BAR[i.status] || 'bg-gray-200'}`} />
                          {i.image_path ? (
                            <img src={`/img/${i.image_path}`} alt=""
                                 className="w-10 h-10 object-cover rounded mx-3 shrink-0" />
                          ) : (
                            <div className="w-10 h-10 bg-gray-100 rounded mx-3 shrink-0 flex items-center justify-center">
                              <span className="text-gray-300 text-lg">📦</span>
                            </div>
                          )}
                          <div className="flex-1 py-3 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">{i.name}</div>
                            <div className="text-xs font-mono text-gray-400">{i.article_number}</div>
                            {i.description && <div className="text-xs text-gray-400 truncate">{i.description}</div>}
                          </div>
                          <div className="text-xs text-gray-400 mx-3 shrink-0">{i.std_quantity} {i.unit}</div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusBadge status={i.status} />
                            {canReport(i) && (
                              <button onClick={() => openCase(i)}
                                      className="text-xs text-gray-400 hover:text-military-navy transition-colors">
                                Anmäl
                              </button>
                            )}
                            {i.active_case_id && i.active_case_type === 'förlust' && (
                              <Link to={`/blankett/${i.active_case_id}`}
                                    className="text-xs text-military-steel hover:underline">
                                Skapa AFSE
                              </Link>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}

              {/* Extra items (PRIO-imported) */}
              {kit.extra.length > 0 && (
                <div>
                  <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Extra utrustning</h2>
                  {extraCats.map(cat => (
                    <div key={cat} className="mb-3">
                      <h3 className="text-xs text-gray-300 mb-1 ml-1">{cat}</h3>
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <ul className="divide-y divide-gray-100">
                          {kit.extra.filter(i => (i.category || 'Övrigt') === cat).map(i => (
                            <li key={i.id} className="flex items-center gap-0 pr-4 hover:bg-gray-50 transition-colors">
                              <div className={`w-1 self-stretch shrink-0 ${STATUS_BAR[i.status] || 'bg-gray-200'}`} />
                              <div className="w-10 h-10 bg-gray-100 rounded mx-3 shrink-0 flex items-center justify-center">
                                <span className="text-gray-300 text-lg">📦</span>
                              </div>
                              <div className="flex-1 py-3 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">{i.name}</div>
                                <div className="text-xs font-mono text-gray-400">{i.article_number}</div>
                              </div>
                              <div className="text-xs text-gray-400 mx-3 shrink-0">{i.quantity} {i.unit}</div>
                              <div className="flex items-center gap-2 shrink-0">
                                <StatusBadge status={i.status} />
                                {i.status === 'ok' && !i.active_case_id && (
                                  <button onClick={() => openCase({ ...i, equipment_id: i.id, template_id: null })}
                                          className="text-xs text-gray-400 hover:text-military-navy transition-colors">
                                    Anmäl
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {kit.standard.length === 0 && kit.extra.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">Laddar utrustning…</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Katalog (logistikroller) */}
      {tab === 'catalog' && <CatalogTab />}

      {/* PRIO-import (logistik) */}
      {tab === 'prio' && <PrioImport />}

      {selected && (
        <CaseModal item={selected} onClose={() => setSelected(null)}
                   onDone={() => { setSelected(null); load(); }} />
      )}
    </div>
  );
}
