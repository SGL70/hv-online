import React, { useEffect, useMemo } from 'react';
import { TYPE_LABELS } from '../constants/orgUnits';

// Bataljon and kompani must be chosen; pluton/tropp/grupp are always optional
// (kompaniledning only has a kompani, no pluton). Keyed by type rather than
// tree depth, since in single-company mode the root is already "kompani"
// (no separate bataljon row) and its children are pluton — which must stay optional.
const REQUIRED_TYPES = new Set(['bataljon', 'kompani']);
const isRequiredLevel = level => REQUIRED_TYPES.has(level.options[0]?.type);

function useByParent(units) {
  return useMemo(() => {
    const map = new Map();
    units.forEach(u => {
      const key = u.parent_id ?? 'root';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(u);
    });
    for (const arr of map.values()) arr.sort((a, b) => a.name.localeCompare(b.name, 'sv'));
    return map;
  }, [units]);
}

function useChain(units, value) {
  return useMemo(() => {
    const byId = new Map(units.map(u => [u.id, u]));
    const chain = [];
    let cur = value ? byId.get(Number(value)) : undefined;
    while (cur) {
      chain.unshift(cur);
      cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    }
    return chain;
  }, [units, value]);
}

// Cascading Bataljon → Kompani → Pluton → (Tropp) → Grupp selector.
// Levels are derived from the actual tree shape rather than hardcoded types,
// so it adapts to single-company deployments (root = kompani) as well as a
// future multi-battalion tree (root = bataljon).
export function UnitPicker({ units, value, onChange, className = '' }) {
  const byParent = useByParent(units);
  const chain = useChain(units, value);

  const levels = [];
  let parentKey = 'root';
  let depth = 0;
  while (true) {
    const options = byParent.get(parentKey) || [];
    if (options.length === 0) break;
    const selected = chain[depth] || null;
    levels.push({ depth, options, selected, parentId: parentKey === 'root' ? null : parentKey });
    if (!selected) break;
    parentKey = selected.id;
    depth++;
  }

  // Auto-select required levels that only have a single possible option.
  useEffect(() => {
    const autoLevel = levels.find(
      l => isRequiredLevel(l) && !l.selected && l.options.length === 1
    );
    if (autoLevel) onChange(autoLevel.options[0].id);
  }, [levels, onChange]);

  function selectAt(level, newId) {
    if (!newId) {
      // "Stay here" — collapse back to this level's parent.
      onChange(level.parentId || null);
      return;
    }
    onChange(Number(newId));
  }

  if (levels.length === 0) {
    return <p className={`text-sm text-gray-400 ${className}`}>Inga organisationsenheter definierade ännu.</p>;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {levels.map(level => {
        const label = TYPE_LABELS[level.options[0]?.type] || 'Enhet';
        const required = isRequiredLevel(level);
        return (
          <div key={level.depth}>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {label} {required && <span className="text-red-500">*</span>}
            </label>
            <select
              value={level.selected?.id ?? ''}
              onChange={e => selectAt(level, e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-military-steel"
            >
              {!required && <option value="">– Ingen (stanna här) –</option>}
              {required && !level.selected && <option value="">– Välj –</option>}
              {level.options.map(o => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
