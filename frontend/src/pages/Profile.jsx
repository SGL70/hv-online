import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { RankSelect } from '../components/Rank';
import { UnitPicker } from '../components/UnitPicker';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [email,      setEmail]      = useState(user?.email       || '');
  const [mobile,     setMobile]     = useState(user?.mobile      || '');
  const [street,     setStreet]     = useState(user?.street      || '');
  const [postalCode, setPostalCode] = useState(user?.postal_code || '');
  const [city,       setCity]       = useState(user?.city        || '');
  const [rank,       setRank]       = useState(user?.rank        || '');
  const [orgUnitId,  setOrgUnitId]  = useState(user?.org_unit_id || null);
  const [units,      setUnits]      = useState([]);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  useEffect(() => { api.orgs().then(setUnits); }, []);

  if (!user) return <div className="min-h-screen flex items-center justify-center">Laddar…</div>;

  const isSetup = !user.profile_complete;

  async function handleExport() {
    try {
      await api.exportPerson(user.id, user.hv_id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!email || !mobile) { setError('E-post och mobilnummer krävs.'); return; }
    if (!orgUnitId) { setError('Ange organisationstillhörighet.'); return; }
    setSaving(true);
    try {
      await api.saveProfile({ email, mobile, street, postal_code: postalCode, city, rank, org_unit_id: orgUnitId });
      await refreshUser();
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-military-navy">
            {isSetup ? 'Komplettera din profil' : 'Redigera profil'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isSetup
              ? 'Ange kontaktuppgifter för att kunna nås via appen.'
              : 'Uppdatera dina kontaktuppgifter.'}
          </p>
        </div>

        <div className="mb-5 p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-sm text-military-navy font-medium">{user.name}</p>
          <p className="text-xs text-gray-500">{user.personal_number}</p>
          <p className="text-xs text-gray-400 mt-0.5">Inloggad via BankID · {user.unit_name}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              E-postadress <span className="text-red-500">*</span>
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="namn@exempel.se"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-military-steel"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mobilnummer <span className="text-red-500">*</span>
            </label>
            <input
              type="tel" value={mobile} onChange={e => setMobile(e.target.value)}
              placeholder="070-000 00 00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-military-steel"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gatuadress</label>
            <input
              type="text" value={street} onChange={e => setStreet(e.target.value)}
              placeholder="Storgatan 1"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-military-steel"
            />
          </div>
          <div className="flex gap-3">
            <div className="w-28">
              <label className="block text-sm font-medium text-gray-700 mb-1">Postnummer</label>
              <input
                type="text" value={postalCode} onChange={e => setPostalCode(e.target.value)}
                placeholder="123 45"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-military-steel"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ort</label>
              <input
                type="text" value={city} onChange={e => setCity(e.target.value)}
                placeholder="Stockholm"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-military-steel"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grad</label>
            <RankSelect value={rank} onChange={setRank}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-military-steel" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Organisationstillhörighet</p>
            <p className="text-xs text-gray-500 mb-2">
              Ange minst bataljon och kompani. Pluton och grupp lämnas tomt om du tillhör kompaniledningen.
            </p>
            <UnitPicker units={units} value={orgUnitId} onChange={setOrgUnitId} />
          </div>
          <div className="flex gap-3 pt-1">
            {!isSetup && (
              <button type="button" onClick={() => navigate(-1)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm text-gray-600
                           hover:bg-gray-50 transition-colors">
                Avbryt
              </button>
            )}
            <button type="submit" disabled={saving}
              className="flex-1 bg-military-navy text-white rounded-lg py-2 text-sm font-medium
                         hover:bg-military-navy/90 disabled:opacity-50 transition-colors">
              {saving ? 'Sparar…' : isSetup ? 'Spara och fortsätt' : 'Spara'}
            </button>
          </div>
        </form>

        <button type="button" onClick={handleExport}
          className="w-full text-center text-xs text-gray-400 hover:text-military-navy mt-4 transition-colors">
          Ladda ned mina uppgifter (registerutdrag)
        </button>
      </div>
    </div>
  );
}
