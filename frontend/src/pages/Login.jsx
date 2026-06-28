import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const TOTAL_SECONDS = 30;

// Fake QR content — looks like real BankID format but is static
const FAKE_QR = 'bankid.prototype00000000.0.deadbeefcafe0000';

function ChevronIcon({ open }) {
  return (
    <svg className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`}
         fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function Accordion({ title }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-gray-200">
      <button
        className="w-full flex items-center justify-between py-4 px-1 text-left text-[#1d3557] text-sm"
        onClick={() => setOpen(v => !v)}
      >
        <span>{title}</span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="pb-4 px-1 text-sm text-gray-500">
          Hjälptext visas här i produktionsversionen.
        </div>
      )}
    </div>
  );
}

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
  const [timeLeft, setTimeLeft]     = useState(TOTAL_SECONDS);
  const [expired, setExpired]       = useState(false);
  const [showModal, setShowModal]   = useState(false);
  const [mockUsers, setMockUsers]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const intervalRef                 = useRef(null);
  const { login }                   = useAuth();
  const navigate                    = useNavigate();

  useEffect(() => {
    api.mockUsers().then(setMockUsers).catch(() => {});
    startTimer();
    return () => clearInterval(intervalRef.current);
  }, []);

  function startTimer() {
    clearInterval(intervalRef.current);
    setTimeLeft(TOTAL_SECONDS);
    setExpired(false);
    intervalRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(intervalRef.current); setExpired(true); return 0; }
        return t - 1;
      });
    }, 1000);
  }

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

  const progress = (timeLeft / TOTAL_SECONDS) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ backgroundColor: '#e8eef4' }}>

      <div className="w-full max-w-[380px] relative">
        {/* Close button (decorative in prototype) */}
        <div className="flex justify-end mb-4">
          <button className="w-9 h-9 rounded-full bg-[#1d3557] text-white flex items-center justify-center
                             opacity-50 cursor-not-allowed">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Logo + app name */}
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Hemvärnet" className="h-16 w-auto mb-3" />
          <h1 className="text-xl font-bold text-[#1d3557] text-center">Välkommen till HvSoldat</h1>
          <p className="text-center text-gray-500 text-sm mt-1">Logga in med BankID</p>
        </div>

        {/* BankID instruction */}
        <p className="text-center text-gray-500 text-sm mb-7">
          Öppna BankID-appen och skanna QR-koden.
        </p>

        {/* QR Code */}
        <div className="flex flex-col items-center mb-1">
          <button
            onClick={() => setShowModal(true)}
            disabled={loading}
            className="bg-white p-4 rounded-sm shadow-sm cursor-pointer hover:shadow-md transition-opacity"
            title="Klicka för att simulera inloggning (prototyp)"
          >
            <QRCodeSVG value={FAKE_QR} size={180} />
          </button>

          {/* Progress bar */}
          <div className="w-[212px] mt-1 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${progress}%`,
                backgroundColor: expired ? '#e63946' : '#5b9bd5',
              }}
            />
          </div>
        </div>

        {/* Timer / hint */}
        <p className="text-center text-sm text-gray-500 mt-2 mb-4">
          {expired
            ? 'QR-koden har gått ut'
            : `${timeLeft} sekunder kvar`}
        </p>
        <p className="text-center text-xs text-gray-400 mb-4">
          Klicka på QR-koden för att simulera inloggning
        </p>

        {/* Förläng */}
        <button
          onClick={startTimer}
          className="w-full bg-[#1d3557] text-white py-3 rounded font-medium
                     hover:bg-[#16294a] transition-colors mb-6"
        >
          Förläng
        </button>

        {/* Accordions */}
        <Accordion title="Hjälp med att skanna QR-kod" />
        <Accordion title="För dig som använder speciella hjälpmedel" />

        {/* Open on this device */}
        <button
          onClick={() => setShowModal(true)}
          disabled={loading}
          className="w-full border border-gray-300 text-[#1d3557] py-3 rounded
                     hover:bg-gray-50 transition-colors mt-4 text-sm"
        >
          Öppna BankID på den här enheten
        </button>
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
