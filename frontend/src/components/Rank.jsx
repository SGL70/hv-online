import React from 'react';

export const RANKS = [
  { value: '',       label: '— Ingen grad —',  abbr: '' },
  // Officerare
  { value: 'mj',    label: 'Major',            abbr: 'Mj'    },
  { value: 'kn',    label: 'Kapten',           abbr: 'Kn'    },
  { value: 'lt',    label: 'Löjtnant',         abbr: 'Lt'    },
  { value: 'fk',    label: 'Fänrik',           abbr: 'Fk'    },
  // Specialistofficerare
  { value: 'fv',    label: 'Förvaltare',       abbr: 'Fv'    },
  { value: 'fj',    label: 'Fanjunkare',       abbr: 'Fj'    },
  { value: 'oserg', label: 'Översergeant',     abbr: 'Öserg' },
  { value: 'serg',  label: 'Sergeant',         abbr: 'Serg'  },
  // Gruppchefer
  { value: 'ofu',   label: 'Överfurir',        abbr: 'Öfu'   },
  { value: 'fu',    label: 'Furir',            abbr: 'Fu'    },
  { value: 'krp',   label: 'Korpral',          abbr: 'Krp'   },
  { value: 'vkrp',  label: 'Vicekorpral',      abbr: 'Vkrp'  },
  // Soldater
  { value: 'men4',  label: 'Menig 4',          abbr: 'Men 4' },
  { value: 'men3',  label: 'Menig 3',          abbr: 'Men 3' },
  { value: 'men2',  label: 'Menig 2',          abbr: 'Men 2' },
  { value: 'men1',  label: 'Menig 1',          abbr: 'Men 1' },
  { value: 'men',   label: 'Menig',            abbr: 'Men'   },
];

const RANK_MAP = Object.fromEntries(RANKS.map(r => [r.value, r]));

export function RankInsignia({ rank, className = '', size = 'sm' }) {
  const r = RANK_MAP[rank];
  if (!r || !r.value) return null;
  const cls = size === 'sidebar' ? 'w-7 h-auto'
            : size === 'lg'      ? 'h-10 w-auto'
            : size === 'md'      ? 'h-7 w-auto'
                                 : 'h-5 w-auto';
  return (
    <img
      src={`/ranks/${r.value}.png`}
      alt={r.label}
      title={r.label}
      className={`${cls} shrink-0 ${className}`}
    />
  );
}

export function RankAbbr({ rank, className = '' }) {
  const r = RANK_MAP[rank];
  if (!r || !r.abbr) return null;
  return <span className={`text-xs text-gray-400 ${className}`}>{r.abbr}</span>;
}

export function RankSelect({ value, onChange, className = '' }) {
  const groups = [
    { label: 'Officerare',           values: ['mj','kn','lt','fk'] },
    { label: 'Specialistofficerare', values: ['fv','fj','oserg','serg'] },
    { label: 'Gruppchefer',          values: ['ofu','fu','krp','vkrp'] },
    { label: 'Soldater',             values: ['men4','men3','men2','men1','men'] },
  ];
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)} className={className}>
      <option value="">— Ingen grad —</option>
      {groups.map(g => (
        <optgroup key={g.label} label={g.label}>
          {g.values.map(v => {
            const r = RANK_MAP[v];
            return <option key={v} value={v}>{r.abbr} — {r.label}</option>;
          })}
        </optgroup>
      ))}
    </select>
  );
}
