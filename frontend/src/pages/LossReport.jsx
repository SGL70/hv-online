import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, getToken } from '../api/client';
import { useAuth } from '../context/AuthContext';

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('sv-SE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function Row({ num, label, value, note }) {
  return (
    <tr className="border-b border-gray-200">
      <td className="py-2 pr-3 text-right text-xs font-mono text-gray-400 w-10 align-top">{num}</td>
      <td className="py-2 pr-4 text-xs text-gray-500 w-48 align-top">{label}</td>
      <td className="py-2 text-sm font-medium text-gray-900 align-top">
        {value || <span className="text-gray-300 italic">—</span>}
        {note && <div className="text-xs text-gray-400 font-normal mt-0.5">{note}</div>}
      </td>
    </tr>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-bold uppercase tracking-widest text-military-steel mb-3
                     border-b border-military-steel pb-1">
        {title}
      </h2>
      <table className="w-full">{children}</table>
    </div>
  );
}

const SETTINGS_FIELDS = [
  { key: 'myndighet',         label: 'Myndighet/enhet',      num: '1'  },
  { key: 'materielutlamnare', label: 'Materielutlämnare',    num: '5'  },
  { key: 'kvm_initialer',     label: 'KVM initialer (sign)', num: '—'  },
  { key: 'foradsplats',       label: 'Förrådsplats',         num: '9'  },
  { key: 'natv_order',        label: 'Nat-V / Order nr',     num: '—'  },
  { key: 'kostbadsstalle',    label: 'Kostbadsställe',       num: '—'  },
  { key: 'transkod',          label: 'Transkod',             num: '3'  },
  { key: 'vernr',             label: 'Verifnr',              num: '4'  },
  { key: 'konto',             label: 'Konto',                num: '8'  },
  { key: 'kloss',             label: 'Kloss',                num: '10' },
];

function KvmSettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState({
    myndighet: '', foradsplats: '', natv_order: '', kostbadsstalle: '',
    transkod: '', vernr: '', konto: '', kloss: '',
    ...settings,
  });
  const [saving, setSaving] = useState(false);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await api.saveKvmSettings(form);
      onSave(saved);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900">KVM-inställningar</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <form onSubmit={save} className="px-6 py-4 space-y-3">
          <p className="text-xs text-gray-500">Dessa värden förifylls på alla AFSE-blanketter.</p>
          {SETTINGS_FIELDS.map(f => (
            <div key={f.key}>
              <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
              <input value={form[f.key] || ''}
                     onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                     className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
            </div>
          ))}
          <div className="flex gap-2 pt-2">
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

export default function LossReport() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData]         = useState(null);
  const [err, setErr]           = useState('');
  const [settings, setSettings] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [downloading, setDownloading]   = useState(false);

  const isKvm = user && ['kvm', 'kompc', 's4', 'batCh', 'stab'].includes(user.role);

  useEffect(() => {
    api.getCase(id).then(setData).catch(e => setErr(e.message));
    if (isKvm) api.kvmSettings().then(setSettings).catch(() => {});
  }, [id]);

  async function downloadAfse() {
    setDownloading(true);
    try {
      const token = getToken();
      const r = await fetch(api.afseUrl(id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `afse-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Kunde inte generera PDF: ' + e.message);
    } finally {
      setDownloading(false);
    }
  }

  if (err)   return <div className="p-8 text-red-600">{err}</div>;
  if (!data) return <div className="p-8 text-gray-400">Laddar…</div>;

  const created = new Date(data.created_at);

  return (
    <>
      {showSettings && (
        <KvmSettingsModal
          settings={settings || {}}
          onSave={s => { setSettings(s); setShowSettings(false); }}
          onClose={() => setShowSettings(false)}
        />
      )}

      <div className="print:hidden bg-military-navy text-white px-6 py-3 flex items-center gap-4">
        <Link to="/utrustning" className="text-white/60 hover:text-white text-sm">← Tillbaka</Link>
        <span className="text-sm font-medium flex-1">Förlustförteckning — {data.equipment_name}</span>
        {isKvm && (
          <button onClick={() => setShowSettings(true)}
                  className="text-white/60 hover:text-white text-sm">
            ⚙ Inställningar
          </button>
        )}
        <button onClick={() => window.print()}
                className="bg-white text-military-navy text-sm font-medium px-4 py-1.5 rounded hover:bg-gray-100">
          Skriv ut
        </button>
      </div>

      <div className="max-w-3xl mx-auto p-8 print:p-0 print:max-w-none">

        <div className="mb-8 print:mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-military-navy print:text-black">
                FÖRLUSTFÖRTECKNING – ANMÄLAN
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Blankett M7102-500360E · HvSoldat
              </p>
            </div>
            <div className="text-right text-xs text-gray-400">
              <div>Ärende #{data.id}</div>
              <div>Skapat {fmt(data.created_at)}</div>
            </div>
          </div>
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-xs text-yellow-800 print:hidden">
            Fältnumren nedan matchar blankett M7102-500360E. Klicka "Hämta ifylld blankett" för att ladda ned en förifylld PDF.
          </div>
        </div>

        {isKvm && settings && (
          <Section title="KVM-inställningar (förifylls automatiskt)">
            <tbody>
              {SETTINGS_FIELDS.map(f => (
                <Row key={f.key} num={f.num} label={f.label} value={settings[f.key] || null} />
              ))}
            </tbody>
          </Section>
        )}

        <Section title="Hämtas från systemet">
          <tbody>
            <Row num="2"  label="Upprättad"
                 value={`${created.getFullYear()} / ${String(created.getMonth()+1).padStart(2,'0')} / ${String(created.getDate()).padStart(2,'0')}`}
                 note="År / Mån / Dag" />
            <Row num="6"  label="Personnr och namn"
                 value={`${data.personal_number || ''}  ${data.user_name}`} />
            <Row num="20" label="Förrådsbeteckning"
                 value={data.article_number} />
            <Row num="23" label="Förrådsbenämning"
                 value={data.equipment_name} />
            <Row num="22" label="Antal"
                 value={String(data.quantity || 1)} />
            <Row num="—"  label="Enhet / Organisation"
                 value={data.unit_name} />
          </tbody>
        </Section>

        <Section title="Omständigheter — sida 3 på blanketten">
          <tbody>
            <Row num="—" label="Tid för förlusten"
                 value={data.incident_time ? fmt(data.incident_time) : null} />
            <Row num="—" label="Plats för förlusten"
                 value={data.incident_location} />
            <Row num="—" label="Redogörelse (omständigheter)"
                 value={data.incident_description
                   ? <span className="whitespace-pre-wrap">{data.incident_description}</span>
                   : null} />
            <Row num="—" label="Vittnen / personer som känner till förlusten"
                 value={data.witnesses
                   ? <span className="whitespace-pre-wrap">{data.witnesses}</span>
                   : null} />
            <Row num="—" label="Medger att ersätta förlusten"
                 value={data.agrees_to_compensate === true  ? 'Ja'
                      : data.agrees_to_compensate === false ? 'Nej'
                      : null} />
          </tbody>
        </Section>

        {data.description && (
          <Section title="Ärendebeskrivning (från anmälan)">
            <tbody>
              <Row num="—" label="Beskrivning"
                   value={<span className="whitespace-pre-wrap">{data.description}</span>} />
            </tbody>
          </Section>
        )}

        <Section title="Fylls i manuellt av KVM">
          <tbody>
            <Row num="5"  label="Materielutlämnare" value={null} note="KVM:s namn och enhet" />
            <Row num="7"  label="Avg-typ"           value={null} />
            <Row num="21" label="A-typ"             value={null} note="Ej vid komp (motsv)" />
            <Row num="24" label="Enhet"             value={null} note="st, par, set …" />
            <Row num="26" label="à-pris"            value={null} />
            <Row num="27" label="Belopp"            value={null} />
            <Row num="30" label="Motsv mtrl beställs" value={null} note="Kryssa ruta på blanketten" />
            <Row num="40" label="Beslut"            value={null} note="Överlämnas / Ersatt / Avslutas" />
            <Row num="—"  label="Kompadj sign"      value={null} />
            <Row num="—"  label="Underskrift + tjänstegrad" value={null} />
          </tbody>
        </Section>

        <div className="print:hidden mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="flex-1 text-sm text-gray-600">
            {isKvm
              ? 'Ladda ned förifylld blankett med uppgifter från systemet och KVM-inställningar.'
              : 'Ladda ned den officiella blanketten och fyll i för hand.'}
          </div>
          {isKvm ? (
            <button onClick={downloadAfse} disabled={downloading}
                    className="btn-primary text-sm whitespace-nowrap">
              {downloading ? 'Genererar…' : 'Hämta ifylld blankett'}
            </button>
          ) : (
            <a href="/uploads/docs/forlustforteckning.pdf" target="_blank"
               className="btn-primary text-sm">
              Öppna blankett (PDF)
            </a>
          )}
        </div>

        <div className="hidden print:block mt-8 pt-4 border-t border-gray-300 text-xs text-gray-400">
          HvSoldat · Ärendeid {data.id} · Utskrivet {new Date().toLocaleString('sv-SE')}
        </div>
      </div>
    </>
  );
}
