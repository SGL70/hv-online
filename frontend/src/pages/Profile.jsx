import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [email,   setEmail]   = useState(user?.email   || '');
  const [mobile,  setMobile]  = useState(user?.mobile  || '');
  const [address, setAddress] = useState(user?.address || '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  if (!user) return <div className="min-h-screen flex items-center justify-center">Laddar…</div>;

  const isSetup = !user.profile_complete;

  async function handleSave(e) {
    e.preventDefault();
    if (!email || !mobile) { setError('E-post och mobilnummer krävs.'); return; }
    setSaving(true);
    try {
      await api.saveProfile({ email, mobile, address });
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Hemadress</label>
            <textarea
              value={address} onChange={e => setAddress(e.target.value)}
              placeholder={"Gatuadress\nPostnummer Ort"}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-military-steel resize-none"
            />
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
      </div>
    </div>
  );
}
