import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const ROLE_LABELS = {
  soldat:'Soldat', grpc:'Gruppchef', pc:'Plutonchef', toc:'Troppchef',
  kompc:'Kompanichef', kvm:'Kvartermästare', s4:'S4', batCh:'Bataljonschef', stab:'Stab'
};

const RESPONSE_COLORS = {
  ja:     'bg-green-100 text-green-800 border-green-200',
  nej:    'bg-red-100 text-red-800 border-red-200',
  kanske: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

const STATUS_META = {
  ok:            { label:'Ok',            color:'text-green-600' },
  ej_mottagen:   { label:'Ej mottagen',   color:'text-yellow-600' },
  ej_tilldelad:  { label:'Ej tilldelad',  color:'text-gray-500' },
  förlustanmäld: { label:'Förlustanmäld', color:'text-red-600' },
  byte_pågår:    { label:'Byte pågår',    color:'text-blue-600' },
};

const REPORT_TYPE = { km_ers:'Km-ers', utlagg:'Utlägg', traktamente:'Traktamente', sava:'SÄVA' };
const REPORT_STATUS = {
  draft:     { label:'Utkast',    cls:'bg-gray-100 text-gray-500' },
  submitted: { label:'Inskickad', cls:'bg-blue-100 text-blue-700' },
  reviewed:  { label:'Granskad',  cls:'bg-yellow-100 text-yellow-700' },
  returned:  { label:'Avfärdad',  cls:'bg-red-100 text-red-700' },
  approved:  { label:'Attesterad',cls:'bg-green-100 text-green-700' },
};
function reportTitle(r) {
  const typ = REPORT_TYPE[r.report_type] || r.report_type;
  const akt = r.activity_title || r.description || '–';
  return `${typ} | ${akt}`;
}

function fmt(iso) {
  return new Date(iso).toLocaleDateString('sv-SE', {
    weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
  });
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('sv-SE', { day:'numeric', month:'short', year:'numeric' });
}

function InviteCard({ activity }) {
  const isPast = new Date(activity.start_time) < new Date();
  const resp = activity.my_response;
  const colorClass = resp ? RESPONSE_COLORS[resp] : 'bg-gray-50 border-gray-200';
  return (
    <Link to="/kalender"
          className={`block rounded-xl border p-3 hover:shadow-sm transition-shadow ${colorClass}`}>
      <div className="text-xs font-semibold text-gray-700 truncate">{activity.title}</div>
      <div className="text-xs text-gray-500 mt-0.5">{fmt(activity.start_time)}</div>
      <div className="text-xs text-gray-400">{activity.unit_name}</div>
      {!resp && !isPast && (
        <div className="mt-1.5 text-xs font-medium text-yellow-700">Svara →</div>
      )}
    </Link>
  );
}

function NewsModal({ post, onClose, onSaved }) {
  const isEdit = !!post;
  const [title, setTitle]   = useState(post?.title || '');
  const [body,  setBody]    = useState(post?.body  || '');
  const [image, setImage]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [publishMode, setPublishMode] = useState(
    post?.publish_at && new Date(post.publish_at) > new Date() ? 'scheduled' : 'now'
  );
  const [publishAt, setPublishAt] = useState(
    post?.publish_at ? new Date(post.publish_at).toISOString().slice(0,16) : ''
  );
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError('Rubrik krävs'); return; }
    if (publishMode === 'scheduled' && !publishAt) { setError('Ange datum och tid för publicering'); return; }
    setSaving(true);
    try {
      const publish_at = publishMode === 'now' ? null : new Date(publishAt).toISOString();
      const data = { title: title.trim(), body: body.trim() || null, publish_at };
      const saved = isEdit
        ? await api.updateNews(post.id, data)
        : await api.createNews(data);
      if (image) await api.uploadNewsImage(saved.id, image);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-base font-bold text-military-navy mb-4">
          {isEdit ? 'Redigera nyhet' : 'Ny nyhet / information'}
        </h2>
        {error && <div className="mb-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rubrik *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Text</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isEdit ? 'Byt bild (valfritt)' : 'Bild (valfritt)'}
            </label>
            {isEdit && post.image_path && (
              <img src={`/img/news/${post.image_path}`} alt="" className="h-16 rounded mb-1 object-cover" />
            )}
            <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0] || null)}
              className="text-sm text-gray-600" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Publicering</label>
            <div className="flex gap-4 mb-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" name="publishMode" value="now"
                  checked={publishMode === 'now'} onChange={() => setPublishMode('now')} />
                Direkt
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="radio" name="publishMode" value="scheduled"
                  checked={publishMode === 'scheduled'} onChange={() => setPublishMode('scheduled')} />
                Schemalägg
              </label>
            </div>
            {publishMode === 'scheduled' && (
              <input type="datetime-local" value={publishAt} onChange={e => setPublishAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              Avbryt
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 bg-military-navy text-white rounded-lg py-2 text-sm font-medium hover:bg-military-navy/90 disabled:opacity-50 transition-colors">
              {saving ? 'Sparar…' : isEdit ? 'Spara' : publishMode === 'now' ? 'Publicera' : 'Schemalägg'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewsPanel({ canPost }) {
  const [posts, setPosts]           = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingPost, setEditingPost] = useState(null);

  function load() { api.newsList().then(setPosts).catch(() => {}); }
  useEffect(load, []);

  async function handleDelete(id) {
    if (!confirm('Ta bort denna nyhet?')) return;
    await api.deleteNews(id);
    load();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Information / Nyheter
        </h2>
        {canPost && (
          <button onClick={() => setShowCreate(true)}
            className="text-xs bg-military-navy text-white px-3 py-1 rounded-lg hover:bg-military-navy/90 transition-colors">
            + Publicera
          </button>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-400">
          Inga nyheter publicerade
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {post.image_path && (
                <img src={`/img/news/${post.image_path}`} alt=""
                     className="w-full object-cover max-h-48" />
              )}
              <div className="p-4">
                <h3 className="text-sm font-semibold text-military-navy leading-tight">{post.title}</h3>
                {post.body && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{post.body}</p>}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-gray-400">{post.author_name} · {fmtDate(post.created_at)}</p>
                  {canPost && (
                    <div className="flex gap-2">
                      <button onClick={() => setEditingPost(post)}
                        className="text-xs text-gray-400 hover:text-military-navy border border-gray-200 hover:border-gray-400
                                   rounded px-2 py-0.5 transition-colors">
                        Redigera
                      </button>
                      <button onClick={() => handleDelete(post.id)}
                        className="text-xs text-gray-400 hover:text-red-600 border border-gray-200 hover:border-red-300
                                   rounded px-2 py-0.5 transition-colors">
                        Ta bort
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <NewsModal onClose={() => setShowCreate(false)} onSaved={load} />}
      {editingPost && <NewsModal post={editingPost} onClose={() => setEditingPost(null)} onSaved={load} />}
    </div>
  );
}

export default function Dashboard() {
  const { user, isLogistics } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState([]);
  const [equipment, setEquipment]   = useState([]);
  const [reports, setReports]       = useState([]);
  const [openInv, setOpenInv]       = useState(null);

  useEffect(() => {
    api.activities().then(setActivities).catch(() => {});
    api.myEquipment().then(setEquipment).catch(() => {});
    api.reports().then(setReports).catch(() => {});
    api.myInventory().then(setOpenInv).catch(() => {});
  }, []);

  const upcoming = activities.filter(a => new Date(a.start_time) > new Date()).slice(0, 4);
  const issues = equipment.filter(e => e.status !== 'ok');
  const pendingReports = reports.filter(r => r.status === 'draft' || r.status === 'submitted');

  return (
    <div className="p-6 h-full">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-military-navy">God dag, {user?.name?.split(' ')[0]}</h1>
        <p className="text-xs text-gray-400 mt-0.5">{ROLE_LABELS[user?.role]} · {user?.unit_name}</p>
      </div>

      {openInv && (
        <div className="mb-4 bg-amber-50 border border-amber-300 rounded-xl px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-amber-900">Genomför inventering av Personlig materiel</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Startad av {openInv.initiated_by_name} · {new Date(openInv.created_at).toLocaleDateString('sv-SE')}
            </p>
            {openInv.deadline && (
              <p className="text-xs text-amber-800 font-medium mt-0.5">
                Klart senast: {new Date(openInv.deadline).toLocaleDateString('sv-SE')}
              </p>
            )}
            <p className="text-xs text-amber-600 mt-1">Gå till Pers. Utrustning och fyll i faktiskt antal för varje artikel.</p>
          </div>
          <button onClick={() => navigate('/utrustning')}
                  className="shrink-0 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors">
            Fyll i inventering →
          </button>
        </div>
      )}

      {/* Hero image */}
      <div className="mb-5 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <img src="/hero.jpg" alt="Verksamhetsbild" className="w-full object-cover" style={{ maxHeight: '220px' }} />
      </div>

      <div className="flex gap-5">
        {/* Left: activities + news side by side */}
        <div className="flex-1 min-w-0 grid grid-cols-2 gap-5">
          {/* Aktiviteter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Kommande aktiviteter</h2>
              <Link to="/kalender" className="text-xs text-military-steel hover:underline">Visa alla</Link>
            </div>
            {upcoming.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white px-5 py-8 text-center text-sm text-gray-400">
                Inga kommande aktiviteter
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {upcoming.map(a => <InviteCard key={a.id} activity={a} />)}
              </div>
            )}
          </div>

          {/* Nyheter */}
          <NewsPanel canPost={isLogistics()} />
        </div>

        {/* Right widget column */}
        <div className="w-52 shrink-0 flex flex-col gap-4">
          <Link to="/utrustning"
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow block">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Pers. Utrustning</h3>
            {issues.length === 0 ? (
              <p className="text-xs text-green-600">Allt ok</p>
            ) : (
              <ul className="space-y-1">
                {issues.slice(0, 4).map(e => (
                  <li key={e.id} className="flex items-center justify-between gap-1">
                    <span className="text-xs text-gray-700 truncate">{e.name}</span>
                    <span className={`text-xs shrink-0 ${STATUS_META[e.status]?.color}`}>{STATUS_META[e.status]?.label}</span>
                  </li>
                ))}
                {issues.length > 4 && <li className="text-xs text-gray-400">+{issues.length - 4} till</li>}
              </ul>
            )}
          </Link>

          <Link to="/arenden"
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow block">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ärenden</h3>
            {pendingReports.length === 0 ? (
              <p className="text-xs text-gray-400">Inga väntande rapporter</p>
            ) : (
              <ul className="space-y-2">
                {pendingReports.slice(0, 3).map(r => {
                  const s = REPORT_STATUS[r.status] || REPORT_STATUS.draft;
                  return (
                    <li key={r.id} className="text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-gray-800 font-medium leading-snug">{reportTitle(r)}</span>
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${s.cls}`}>{s.label}</span>
                      </div>
                      <div className="text-gray-400 mt-0.5">
                        {fmtDate(r.report_date)}
                        {r.km > 0 && <span> · {r.km} km</span>}
                        {r.expenses > 0 && <span> · {Number(r.expenses).toFixed(0)} kr</span>}
                        {r.hours > 0 && <span> · {r.hours} tim</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Link>

          <Link to="/kalender"
                className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow block flex-1">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Kalender</h3>
            {activities.length === 0 ? (
              <p className="text-xs text-gray-400">Inga aktiviteter</p>
            ) : (
              <ul className="space-y-2.5">
                {activities.slice(0, 8).map(a => (
                  <li key={a.id} className="border-l-2 border-military-steel pl-2">
                    <div className="text-xs font-medium text-gray-800 leading-tight">{a.title}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(a.start_time).toLocaleDateString('sv-SE', { day:'numeric', month:'short' })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}
