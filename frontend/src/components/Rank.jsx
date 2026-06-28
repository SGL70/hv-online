import React from 'react';

export const RANKS = [
  { value: '',              label: '— Ingen grad —',          insignia: '',      cls: '' },
  // Soldater
  { value: 'menig',        label: 'Menig',                   insignia: '',      cls: '' },
  { value: 'hvman',        label: 'Hemvärnsman/-kvinna',     insignia: '',      cls: '' },
  { value: 'korpral',      label: 'Korpral',                 insignia: '›',     cls: 'text-gray-400' },
  // Underofficerare
  { value: 'sergeant',     label: 'Sergeant',                insignia: '››',    cls: 'text-gray-400' },
  { value: 'hvfanjunkare', label: 'Hemvärnsfanjunkare',      insignia: '›››',   cls: 'text-gray-400' },
  { value: 'fanjunkare',   label: 'Fanjunkare',              insignia: '›››',   cls: 'text-gray-400' },
  { value: 'forvaltare',   label: 'Förvaltare',              insignia: '⬡',     cls: 'text-amber-500' },
  // Officerare
  { value: 'fanrik',       label: 'Fänrik',                  insignia: '★',     cls: 'text-yellow-500' },
  { value: 'lojtnant',     label: 'Löjtnant',                insignia: '★★',    cls: 'text-yellow-500' },
  { value: 'kapten',       label: 'Kapten',                  insignia: '★★★',   cls: 'text-yellow-500' },
  { value: 'major',        label: 'Major',                   insignia: '✦★',    cls: 'text-yellow-500' },
  { value: 'ovlojtnant',   label: 'Överstelöjtnant',         insignia: '✦★★',   cls: 'text-yellow-500' },
  { value: 'overste',      label: 'Överste',                 insignia: '✦★★★',  cls: 'text-yellow-500' },
];

const RANK_MAP = Object.fromEntries(RANKS.map(r => [r.value, r]));

export function RankInsignia({ rank, className = '' }) {
  const r = RANK_MAP[rank];
  if (!r || !r.insignia) return null;
  return (
    <span className={`font-bold tracking-tighter ${r.cls} ${className}`} title={r.label}>
      {r.insignia}
    </span>
  );
}

export function RankSelect({ value, onChange, className = '' }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)}
            className={className}>
      {RANKS.map(r => (
        <option key={r.value} value={r.value}>
          {r.insignia ? `${r.insignia} ${r.label}` : r.label}
        </option>
      ))}
    </select>
  );
}
