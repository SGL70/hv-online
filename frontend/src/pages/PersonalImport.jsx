import React, { useRef, useState } from 'react';
import { api } from '../api/client';

const BASE = '/api';
function getToken() { return localStorage.getItem('token'); }

async function uploadFile(path, file) {
  const form = new FormData();
  form.append('file', file);
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const ROLES = [
  { value: 'soldat', label: 'Soldat' },
  { value: 'grpc',   label: 'Gruppchef' },
  { value: 'pc',     label: 'Plutonchef' },
  { value: 'toc',    label: 'Troppchef' },
  { value: 'kompc',  label: 'Kompanichef' },
  { value: 'kvm',    label: 'Komp-VKM' },
  { value: 'stab',   label: 'Stab' },
];

export default function PersonalImport() {
  const fileRef           = useRef();
  const [file,    setFile]    = useState(null);
  const [persons, setPersons] = useState(null);   // editable list
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  async function handlePreview() {
    if (!file) return;
    setLoading(true); setError(''); setPersons(null); setResult(null);
    try {
      const data = await uploadFile('/personal/preview', file);
      // Add a local _id for React keys and a _skip flag
      setPersons(data.persons.map((p, i) => ({ ...p, _id: i, _skip: false })));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleImport() {
    const toImport = persons.filter(p => !p._skip);
    if (!toImport.length) return;
    if (!confirm(`Importera ${toImport.length} personer?`)) return;
    setLoading(true); setError('');
    try {
      const data = await api.post('/personal/import', {
        persons: toImport.map(({ _id, _skip, ...p }) => p),
      });
      setResult(data);
      setPersons(null);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function update(id, field, value) {
    setPersons(prev => prev.map(p => {
      if (p._id !== id) return p;
      // Clear path info when user manually edits the unit field
      if (field === 'unit_label') return { ...p, unit_label: value, unit_path: [value], unit_types: [] };
      return { ...p, [field]: value };
    }));
  }

  function toggleSkip(id) {
    setPersons(prev => prev.map(p => p._id === id ? { ...p, _skip: !p._skip } : p));
  }

  const included = persons?.filter(p => !p._skip).length ?? 0;

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 text-sm text-blue-800">
        Importera personal från en ODS-fil. Granska och redigera listan innan import —
        klicka på namn/roll för att justera, eller kryssa ur rader som inte ska importeras.
      </div>

      {/* File picker */}
      <div className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <label className="text-xs text-gray-500 block mb-1">Personalfil (.ods eller .xlsx)</label>
          <input
            ref={fileRef}
            type="file"
            accept=".ods,.xlsx,.xls"
            onChange={e => { setFile(e.target.files[0] || null); setPersons(null); setResult(null); setError(''); }}
            className="block text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:bg-military-navy file:text-white hover:file:bg-[#16294a] cursor-pointer"
          />
        </div>
        <button onClick={handlePreview} disabled={!file || loading} className="btn-secondary text-sm shrink-0">
          {loading && !persons ? 'Läser…' : 'Förhandsgranska'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 text-sm text-green-800">
          <p className="font-semibold">Import klar — {result.total} behandlade</p>
          <p className="mt-0.5">{result.created} nya · {result.updated} uppdaterade</p>
          <p className="text-xs text-green-600 mt-2">
            Inloggning: personnummer = födelsedat (YYMMDD), t.ex. 700916 för -70.
          </p>
        </div>
      )}

      {result && (result.conflicts?.length > 0 || result.duplicate_keys_in_file?.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 text-sm text-amber-800 space-y-2">
          <p className="font-semibold">
            {(result.conflicts?.length || 0) + (result.duplicate_keys_in_file?.length || 0)} rad(er) hoppades över — hanteras inte automatiskt
          </p>
          {result.conflicts?.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1">
                Saknar riktigt personnummer och pekar på en annan persons rad — kontrollera manuellt:
              </p>
              <ul className="text-xs space-y-0.5 list-disc list-inside">
                {result.conflicts.map((c, i) => (
                  <li key={i}>{c.incoming_name} ↔ befintlig rad "{c.existing_name}" ({c.personal_number})</li>
                ))}
              </ul>
            </div>
          )}
          {result.duplicate_keys_in_file?.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1">
                Samma nyckel förekommer flera gånger i filen (kan inte särskiljas):
              </p>
              <ul className="text-xs space-y-0.5 list-disc list-inside">
                {result.duplicate_keys_in_file.map((k, i) => <li key={i}>{k}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Editable persons list */}
      {persons && (
        <div className="space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              {included} av {persons.length} markerade för import.
              {persons.length - included > 0 && (
                <span className="text-gray-400"> ({persons.length - included} exkluderade)</span>
              )}
            </p>
            <button
              onClick={handleImport}
              disabled={loading || included === 0}
              className="btn-primary text-sm shrink-0">
              {loading ? 'Importerar…' : `Importera ${included} personer`}
            </button>
          </div>

          {/* Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-3 py-2 w-8"></th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Namn</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Roll</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Enhet</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Födelsedat</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {persons.map(p => (
                    <tr key={p._id} className={p._skip ? 'opacity-35 bg-gray-50' : 'hover:bg-gray-50'}>
                      {/* Include checkbox */}
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={!p._skip}
                          onChange={() => toggleSkip(p._id)}
                          className="rounded border-gray-300 text-military-navy focus:ring-military-navy"
                        />
                      </td>

                      {/* Name */}
                      <td className="px-3 py-2">
                        <input
                          value={p.name}
                          onChange={e => update(p._id, 'name', e.target.value)}
                          disabled={p._skip}
                          className="w-full text-sm text-gray-900 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-military-steel focus:outline-none py-0.5 disabled:cursor-default"
                        />
                      </td>

                      {/* Role */}
                      <td className="px-3 py-2">
                        <select
                          value={p.role}
                          onChange={e => update(p._id, 'role', e.target.value)}
                          disabled={p._skip}
                          className="text-xs border-0 border-b border-transparent hover:border-gray-300 focus:border-military-steel focus:outline-none bg-transparent py-0.5 disabled:cursor-default">
                          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                      </td>

                      {/* Unit */}
                      <td className="px-3 py-2">
                        <input
                          value={p.unit_label}
                          onChange={e => update(p._id, 'unit_label', e.target.value)}
                          disabled={p._skip}
                          className="w-full text-xs text-gray-600 bg-transparent border-0 border-b border-transparent hover:border-gray-300 focus:border-military-steel focus:outline-none py-0.5 disabled:cursor-default"
                        />
                      </td>

                      {/* Birth date */}
                      <td className="px-3 py-2 text-xs text-gray-400 font-mono whitespace-nowrap">
                        {p.birth || '–'}
                      </td>

                      {/* Remove */}
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => setPersons(prev => prev.filter(x => x._id !== p._id))}
                          title="Ta bort rad permanent"
                          className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none">
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
