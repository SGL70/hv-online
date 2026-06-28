const BASE = '/api';

export function getToken() {
  return localStorage.getItem('token');
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/';
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  put:    (path, body)  => request('PUT',    path, body),
  delete: (path)        => request('DELETE', path),

  // Auth
  mockUsers:  ()           => api.get('/auth/mock-users'),
  mockLogin:  (userId)     => api.post('/auth/mock-login', { userId }),
  me:         ()           => api.get('/auth/me'),
  saveProfile:(data)       => api.put('/auth/profile', data),

  // Org
  orgs:            ()              => api.get('/orgs'),
  unitMembers:     (id)            => api.get(`/orgs/${id}/members`),
  createUnit:      (data)          => api.post('/orgs', data),
  updateUnit:      (id, data)      => api.put(`/orgs/${id}`, data),
  deleteUnit:      (id)            => api.delete(`/orgs/${id}`),
  addMember:       (id, data)      => api.post(`/orgs/${id}/members`, data),
  removeMember:    (id, userId)    => api.delete(`/orgs/${id}/members/${userId}`),
  setMemberRole:   (id, uid, role) => api.put(`/orgs/${id}/members/${uid}/role`, { role }),

  // Activities
  activities:       ()         => api.get('/activities'),
  activity:         (id)       => api.get(`/activities/${id}`),
  createActivity:   (data)     => api.post('/activities', data),
  respond:          (id, s)    => api.put(`/activities/${id}/response`, { status: s }),
  attendance:       (id, data) => api.put(`/activities/${id}/attendance`, { attendance: data }),

  // Reports
  reports:         (filter)   => api.get(`/reports${filter ? `?filter=${filter}` : ''}`),
  exportReports:   async (from, to, mark = false) => {
    const p = new URLSearchParams();
    if (from) p.append('from', from);
    if (to)   p.append('to', to);
    if (mark) p.append('mark', '1');
    const res = await fetch(`/api/reports/export?${p}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!res.ok) throw new Error('Export misslyckades');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ersattningar${from ? `-${from}` : ''}${to ? `-${to}` : ''}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  },
  markMr: (ids) => api.post('/reports/mark-mr', { ids }),
  pendingCount:    ()         => api.get('/reports/pending-count'),
  deleteReport:    (id)       => api.delete(`/reports/${id}`),
  createReport:    (data)     => api.post('/reports', data),
  updateReport:    (id, data) => api.put(`/reports/${id}`, data),
  submitReport:    (id)       => api.post(`/reports/${id}/submit`),
  reviewReport:    (id, action, comment) => api.post(`/reports/${id}/review`, { action, comment }),
  approveReport:   (id, action) => api.post(`/reports/${id}/approve`, { action }),

  // Equipment
  myKit:           ()          => api.get('/equipment/my-kit'),
  myEquipment:     ()          => api.get('/equipment/mine'),
  unitShortfalls:  ()          => api.get('/equipment/unit'),
  createCase:      (data)      => api.post('/equipment/cases', data),
  getCase:         (id)        => api.get(`/equipment/cases/${id}`),
  pendingCases:    ()          => api.get('/equipment/cases'),
  decideCase:      (id, data)  => api.post(`/equipment/cases/${id}/decide`, data),

  // Inventory
  myInventory:     ()           => api.get('/inventory/mine'),
  lastInventory:   ()           => api.get('/inventory/last'),
  startInventory:  (deadline)   => api.post('/inventory/start', { deadline: deadline || null }),
  submitInventory: (id, items)  => api.post(`/inventory/${id}/submit`, { items: items || [] }),
  unitInventory:   ()           => api.get('/inventory/unit'),

  // Personal
  personalList:   ()         => api.get('/personal'),
  updatePerson:   (id, data) => api.put(`/personal/${id}`, data),

  // News
  newsList:        ()         => api.get('/news'),
  createNews:      (data)     => api.post('/news', data),
  updateNews:      (id, data) => api.put(`/news/${id}`, data),
  deleteNews:      (id)       => api.delete(`/news/${id}`),
  uploadNewsImage: (id, file) => {
    const form = new FormData();
    form.append('image', file);
    const token = localStorage.getItem('token');
    return fetch(`/api/news/${id}/image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(r => r.json());
  },

  // PRIO import
  prioParse:  (file) => {
    const form = new FormData();
    form.append('file', file);
    const token = localStorage.getItem('token');
    return fetch('/api/prio/parse', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(r => r.json());
  },
  prioImport: (userId, file) => {
    const form = new FormData();
    form.append('file', file);
    form.append('user_id', userId);
    const token = localStorage.getItem('token');
    return fetch('/api/prio/import', {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(r => r.json());
  },

  // Catalog (equipment_templates)
  catalog:             ()           => api.get('/catalog'),
  createCatalogItem:   (data)       => api.post('/catalog', data),
  updateCatalogItem:   (id, data)   => api.put(`/catalog/${id}`, data),
  deleteCatalogItem:   (id)         => api.delete(`/catalog/${id}`),
  uploadCatalogImage:  (id, file)   => {
    const form = new FormData();
    form.append('image', file);
    const token = localStorage.getItem('token');
    return fetch(`/api/catalog/${id}/image`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(r => r.json());
  },

  // KVM-inställningar & AFSE
  kvmSettings:       ()       => api.get('/kvm/settings'),
  saveKvmSettings:   (data)   => api.put('/kvm/settings', data),
  afseUrl:           (caseId) => `/api/kvm/cases/${caseId}/afse`,
  afseHistory:       ()       => api.get('/kvm/afse-history'),
  caseReceived:      (id)     => api.post(`/equipment/cases/${id}/received`),
};
