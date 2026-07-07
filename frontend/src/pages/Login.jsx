import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

function RoleModal({ users, onSelect, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-military-navy text-white px-5 py-3 flex items-center gap-2">
          <span className="text-xs font-bold tracking-widest uppercase opacity-70">Prototypläge</span>
        </div>
        <div className="px-5 py-4">
          <p className="text-[#1d3557] font-semibold mb-1">Välj roll att simulera</p>
          <p className="text-xs text-gray-400 mb-4">
            Simulerar BankID-inloggning med fördefinierad testanvändare.
          </p>
          <ul className="space-y-2">
            {users.map(u => (
              <li key={u.id}>
                <button
                  onClick={() => onSelect(u.id)}
                  className="w-full text-left px-4 py-3 rounded-lg border border-gray-200
                             hover:border-military-navy hover:bg-blue-50 transition-colors"
                >
                  <div className="font-medium text-[#1d3557] text-sm">{u.name}</div>
                  <div className="text-xs text-gray-400">{u.label}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="px-5 pb-4">
          <button onClick={onClose}
                  className="w-full text-center text-sm text-gray-400 hover:text-gray-600 py-2">
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  const [showModal, setShowModal] = useState(false);
  const [mockUsers, setMockUsers] = useState([]);
  const [loading, setLoading]     = useState(false);
  const { login }                 = useAuth();
  const navigate                  = useNavigate();

  useEffect(() => {
    api.mockUsers().then(setMockUsers).catch(() => {});
  }, []);

  async function handleSelectUser(userId) {
    setShowModal(false);
    setLoading(true);
    try {
      await login(userId);
      navigate('/');
    } catch (e) {
      alert('Inloggning misslyckades: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#1d3557' }}>
      {/* ─── Vänster panel ─── */}
      <div
        className="w-full md:w-[44%] md:min-w-[300px] flex flex-col px-8 md:px-10 py-12"
        style={{ fontFamily: '"Segoe UI", system-ui, sans-serif' }}
      >
        {/* Toppspacer — skjuter innehållet mot mitten */}
        <div className="flex-[2]" />

        {/* Korp + text, centrerat */}
        <div className="flex flex-col items-center text-center">
          <img
            src="/korp.png"
            alt="Korp"
            className="h-32 w-auto mb-5 select-none"
          />
          <h1 className="text-2xl mb-1 tracking-wide" style={{ letterSpacing: 2 }}>
            <span className="text-white font-black">Hv</span>
            <span className="text-white/60 font-normal">Online</span>
          </h1>
          <p className="text-white/40 text-[11px] uppercase mb-5" style={{ letterSpacing: 3 }}>
            Personlig admin för Hemvärnet
          </p>
          <div className="border-b border-white/25 w-16 mb-4" />
          <p className="text-white/70 text-sm leading-relaxed">
            Håll koll på din materiel, kommande<br />
            aktiviteter och utlägg/ersättningar
          </p>
        </div>

        {/* Mellanspacer */}
        <div className="flex-[2]" />

        {/* Knapp centrerad */}
        <div className="flex justify-center">
          <button
            onClick={() => setShowModal(true)}
            disabled={loading}
            className="border border-white/50 text-white/90 text-sm px-7 py-2.5
                       hover:bg-white/10 transition-colors"
          >
            {loading ? 'Loggar in…' : 'Logga in med BankID'}
          </button>
        </div>

        {/* Bottomspacer + versionsnummer */}
        <div className="flex-[2] flex flex-col items-center justify-end gap-1">
          <p className="text-white/25 text-xs text-center">V0.1 Prototyp</p>
          <Link to="/integritetspolicy" className="text-white/25 hover:text-white/50 text-xs underline transition-colors">
            Integritetspolicy
          </Link>
        </div>
      </div>

      {/* ─── Höger panel — bergsfoto, dold på mobil ─── */}
      <div className="hidden md:block flex-1 h-screen">
        <img
          src="/hero-mountain.jpg"
          alt=""
          className="w-full h-full object-cover block"
        />
      </div>

      {showModal && (
        <RoleModal
          users={mockUsers}
          onSelect={handleSelectUser}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
