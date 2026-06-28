import React, { useEffect, useState, useRef } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

function fmt(iso) {
  return new Date(iso).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fileIcon(mime) {
  if (!mime) return '📄';
  if (mime.includes('pdf')) return '📕';
  if (mime.includes('word') || mime.includes('document')) return '📘';
  if (mime.includes('sheet') || mime.includes('excel')) return '📗';
  if (mime.includes('image')) return '🖼️';
  return '📄';
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function UploadModal({ onClose, onUploaded }) {
  const [title, setTitle]       = useState('');
  const [description, setDesc]  = useState('');
  const [file, setFile]         = useState(null);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!file) { setError('Välj en fil'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title || file.name);
      if (description) fd.append('description', description);
      await api.uploadDoc(fd);
      onUploaded();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-military-navy">Ladda upp dokument</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <form onSubmit={submit} className="px-6 py-4 space-y-4">
          {error && <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Fil *</label>
            <input type="file" onChange={e => setFile(e.target.files[0] || null)}
                   className="text-sm text-gray-700 w-full" required />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Titel</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                   placeholder="Lämna tomt för filnamn"
                   className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Beskrivning (valfritt)</label>
            <input type="text" value={description} onChange={e => setDesc(e.target.value)}
                   placeholder="t.ex. Gäller fr.o.m. 2026-01-01"
                   className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Avbryt</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? 'Laddar upp…' : 'Ladda upp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Documents() {
  const { isLogistics } = useAuth();
  const [docs, setDocs]         = useState([]);
  const [showUpload, setUpload] = useState(false);
  const [loading, setLoading]   = useState(true);

  function load() {
    api.docs().then(d => { setDocs(d); setLoading(false); }).catch(() => setLoading(false));
  }
  useEffect(load, []);

  async function remove(id, name) {
    if (!confirm(`Ta bort "${name}"?`)) return;
    await api.deleteDoc(id).catch(e => alert(e.message));
    load();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-military-navy">Dokument</h1>
        {isLogistics() && (
          <button onClick={() => setUpload(true)} className="btn-primary text-sm">
            + Ladda upp
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-gray-400 text-center py-12">Laddar…</div>
      ) : docs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl px-5 py-12 text-center text-sm text-gray-400">
          Inga dokument uppladdade ännu
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {docs.map(d => (
              <li key={d.id} className="px-5 py-4 flex items-center gap-4">
                <span className="text-2xl shrink-0">{fileIcon(d.mime_type)}</span>
                <div className="flex-1 min-w-0">
                  <a href={api.docUrl(d.id)} target="_blank" rel="noreferrer"
                     className="text-sm font-medium text-military-navy hover:underline truncate block">
                    {d.title}
                  </a>
                  {d.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{d.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {d.uploaded_by_name} · {fmt(d.created_at)}
                    {d.size && <span> · {fmtSize(d.size)}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={api.docUrl(d.id)} target="_blank" rel="noreferrer"
                     className="text-xs text-military-steel hover:underline">
                    Öppna
                  </a>
                  {isLogistics() && (
                    <button onClick={() => remove(d.id, d.title)}
                            className="text-xs text-gray-400 hover:text-red-600 transition-colors">
                      Ta bort
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showUpload && <UploadModal onClose={() => setUpload(false)} onUploaded={load} />}
    </div>
  );
}
