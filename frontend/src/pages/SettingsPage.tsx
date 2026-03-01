import { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import { Settings, Shield, Tag, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, Search, Plus, Pencil, Trash2, X, ImageUp } from 'lucide-react';

interface AuditLog {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  created_at: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UserItem {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
}

const actionLabels: Record<string, string> = {
  LOGIN: 'Autentificare',
  REGISTER: 'Înregistrare',
  CREATE_PROJECT: 'Creare proiect',
  UPDATE_PROJECT: 'Actualizare proiect',
  DELETE_PROJECT: 'Ștergere proiect',
  CREATE_USER: 'Creare utilizator',
  UPDATE_ROLE: 'Schimbare rol',
  UPDATE_SETTINGS: 'Actualizare setări',
};

const actionColors: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-700',
  REGISTER: 'bg-green-100 text-green-700',
  CREATE_PROJECT: 'bg-purple-100 text-purple-700',
  UPDATE_PROJECT: 'bg-yellow-100 text-yellow-700',
  DELETE_PROJECT: 'bg-red-100 text-red-700',
  CREATE_USER: 'bg-teal-100 text-teal-700',
  UPDATE_ROLE: 'bg-orange-100 text-orange-700',
  UPDATE_SETTINGS: 'bg-gray-100 text-gray-700',
};

interface LabelItem {
  _id: string;
  name: string;
  color: string;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#6366f1', '#a855f7', '#ec4899',
  '#14b8a6', '#64748b',
];

type Tab = 'general' | 'labels' | 'audit';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general');

  // Labels state
  const [labels, setLabels] = useState<LabelItem[]>([]);
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState('#3b82f6');
  const [editingLabel, setEditingLabel] = useState<LabelItem | null>(null);
  const [labelMsg, setLabelMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [labelSaving, setLabelSaving] = useState(false);

  // General settings
  const [orgName, setOrgName] = useState('');
  const [orgNameSaving, setOrgNameSaving] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Logo
  const [orgLogo, setOrgLogo] = useState<string>('');
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoMsg, setLogoMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // Audit log
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 25, totalPages: 0 });
  const [logsLoading, setLogsLoading] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);

  // Load labels
  useEffect(() => {
    api.get('/labels').then((res) => setLabels(res.data.labels || [])).catch(() => {});
  }, []);

  async function handleSaveLabel(e: React.FormEvent) {
    e.preventDefault();
    if (!labelName.trim()) return;
    setLabelSaving(true);
    setLabelMsg(null);
    try {
      if (editingLabel) {
        const res = await api.put(`/labels/${editingLabel._id}`, { name: labelName, color: labelColor });
        setLabels((prev) => prev.map((l) => (l._id === editingLabel._id ? res.data.label : l)));
        setLabelMsg({ type: 'success', text: 'Etichetă actualizată.' });
      } else {
        const res = await api.post('/labels', { name: labelName, color: labelColor });
        setLabels((prev) => [...prev, res.data.label]);
        setLabelMsg({ type: 'success', text: 'Etichetă creată.' });
      }
      setLabelName('');
      setLabelColor('#3b82f6');
      setEditingLabel(null);
    } catch (err: any) {
      setLabelMsg({ type: 'error', text: err.response?.data?.error || 'Eroare la salvare.' });
    } finally {
      setLabelSaving(false);
    }
  }

  async function handleDeleteLabel(label: LabelItem) {
    if (!window.confirm(`Ștergi eticheta "${label.name}"? Va fi eliminată și din proiecte/sarcini.`)) return;
    try {
      await api.delete(`/labels/${label._id}`);
      setLabels((prev) => prev.filter((l) => l._id !== label._id));
    } catch {
      setLabelMsg({ type: 'error', text: 'Eroare la ștergere.' });
    }
  }

  function startEditLabel(label: LabelItem) {
    setEditingLabel(label);
    setLabelName(label.name);
    setLabelColor(label.color);
    setLabelMsg(null);
  }

  // Load settings
  useEffect(() => {
    api.get('/settings').then((res) => {
      setOrgName(res.data.settings?.org_name || '');
      const logo = res.data.settings?.org_logo || '';
      setOrgLogo(logo);
      setLogoPreview(logo);
    }).catch(() => {});

    api.get('/settings/audit-logs/actions').then((res) => {
      setAvailableActions(res.data.actions || []);
    }).catch(() => {});

    api.get('/users/list').then((res) => {
      setUsers(res.data.users || []);
    }).catch(() => {});
  }, []);

  // Load audit logs when tab or filters change
  useEffect(() => {
    if (activeTab === 'audit') {
      fetchLogs(1);
    }
  }, [activeTab, filterAction, filterUserId]);

  async function fetchLogs(page: number) {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (filterAction) params.set('action', filterAction);
      if (filterUserId) params.set('userId', filterUserId);
      const res = await api.get(`/settings/audit-logs?${params}`);
      setLogs(res.data.logs || []);
      setPagination(res.data.pagination);
    } catch { /* ignore */ } finally {
      setLogsLoading(false);
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setOrgNameSaving(true);
    setSettingsMsg(null);
    try {
      await api.put('/settings', { settings: { org_name: orgName } });
      setSettingsMsg({ type: 'success', text: 'Setările au fost salvate.' });
    } catch (err: any) {
      setSettingsMsg({ type: 'error', text: err.response?.data?.error || 'Eroare la salvare.' });
    } finally {
      setOrgNameSaving(false);
    }
  }

  function handleLogoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setLogoMsg({ type: 'error', text: 'Selectează o imagine (PNG, JPG, SVG, WebP).' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoMsg({ type: 'error', text: 'Imaginea este prea mare. Dimensiunea maximă este 2 MB.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setLogoPreview(base64);
      setOrgLogo(base64);
      setLogoMsg(null);
    };
    reader.readAsDataURL(file);
  }

  async function handleSaveLogo() {
    if (!orgLogo) return;
    setLogoSaving(true);
    setLogoMsg(null);
    try {
      await api.put('/settings/logo', { logo: orgLogo });
      setLogoMsg({ type: 'success', text: 'Logo salvat cu succes.' });
    } catch (err: any) {
      setLogoMsg({ type: 'error', text: err.response?.data?.error || 'Eroare la salvare.' });
    } finally {
      setLogoSaving(false);
    }
  }

  async function handleDeleteLogo() {
    if (!window.confirm('Ștergi logo-ul organizației?')) return;
    try {
      await api.delete('/settings/logo');
      setOrgLogo('');
      setLogoPreview('');
      setLogoMsg({ type: 'success', text: 'Logo eliminat.' });
      if (logoInputRef.current) logoInputRef.current.value = '';
    } catch (err: any) {
      setLogoMsg({ type: 'error', text: err.response?.data?.error || 'Eroare.' });
    }
  }

  function formatDetails(details: any): string {
    if (!details) return '—';
    try {
      const obj = typeof details === 'string' ? JSON.parse(details) : details;
      return Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
    } catch {
      return String(details);
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Setări și administrare</h1>
        <p className="text-gray-500 mt-1">Configurare sistem și jurnal de activitate</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Settings className="w-4 h-4" />
          Setări generale
        </button>
        <button
          onClick={() => setActiveTab('labels')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'labels' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Tag className="w-4 h-4" />
          Etichete
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'audit' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          <Shield className="w-4 h-4" />
          Jurnal activitate
        </button>
      </div>

      {/* ── General Settings ── */}
      {activeTab === 'general' && (
        <div className="max-w-xl">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-5">Organizație</h2>

            {settingsMsg && (
              <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${settingsMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {settingsMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                {settingsMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Numele organizației
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                  placeholder="Ex: Compania Mea SRL"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Apare în titlul aplicației și în rapoarte.
                </p>
              </div>

              <button
                type="submit"
                disabled={orgNameSaving}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition font-medium text-sm"
              >
                {orgNameSaving ? 'Se salvează...' : 'Salvare'}
              </button>
            </form>
          </div>

          {/* Logo organizație */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mt-4">
            <h2 className="font-semibold text-gray-900 mb-1">Logo organizație</h2>
            <p className="text-xs text-gray-400 mb-5">PNG, JPG, SVG sau WebP — max 2 MB. Recomandat: 200×60 px.</p>

            {logoMsg && (
              <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${logoMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {logoMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                {logoMsg.text}
              </div>
            )}

            {/* Preview */}
            {logoPreview ? (
              <div className="mb-4 flex items-center gap-4">
                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50 inline-block">
                  <img src={logoPreview} alt="Logo organizație" className="h-14 max-w-[200px] object-contain" />
                </div>
                <button
                  onClick={handleDeleteLogo}
                  className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" /> Elimină logo
                </button>
              </div>
            ) : (
              <div className="mb-4 border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                <ImageUp className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Niciun logo setat</p>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="block text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
              />
              {orgLogo && (
                <button
                  onClick={handleSaveLogo}
                  disabled={logoSaving}
                  className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition font-medium text-sm"
                >
                  {logoSaving ? 'Se salvează...' : 'Salvează logo'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Labels ── */}
      {activeTab === 'labels' && (
        <div className="max-w-2xl space-y-6">
          {/* Form creare/editare */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-gray-900 mb-4">
              {editingLabel ? 'Editare etichetă' : 'Etichetă nouă'}
            </h2>
            {labelMsg && (
              <div className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${labelMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                {labelMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                {labelMsg.text}
              </div>
            )}
            <form onSubmit={handleSaveLabel} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nume etichetă</label>
                <input
                  type="text"
                  value={labelName}
                  onChange={(e) => setLabelName(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none text-sm"
                  placeholder="Ex: Frontend, Bug, Urgent..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Culoare</label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setLabelColor(c)}
                      className="w-7 h-7 rounded-full border-2 transition"
                      style={{
                        backgroundColor: c,
                        borderColor: labelColor === c ? '#1e40af' : 'transparent',
                        outline: labelColor === c ? `2px solid ${c}` : 'none',
                        outlineOffset: '2px',
                      }}
                    />
                  ))}
                  {/* Preview */}
                  <div className="ml-2 px-3 py-1 rounded-full text-xs font-medium"
                    style={{ backgroundColor: labelColor + '25', color: labelColor, border: `1px solid ${labelColor}50` }}>
                    {labelName || 'Preview'}
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                {editingLabel && (
                  <button type="button" onClick={() => { setEditingLabel(null); setLabelName(''); setLabelColor('#3b82f6'); setLabelMsg(null); }}
                    className="flex items-center gap-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm">
                    <X className="w-4 h-4" /> Anulare
                  </button>
                )}
                <button type="submit" disabled={labelSaving || !labelName.trim()}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition text-sm font-medium">
                  <Plus className="w-4 h-4" />
                  {labelSaving ? 'Se salvează...' : editingLabel ? 'Actualizare' : 'Creare'}
                </button>
              </div>
            </form>
          </div>

          {/* Lista etichete */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Etichete existente ({labels.length})</h2>
            </div>
            {labels.length === 0 ? (
              <p className="text-center text-gray-400 text-sm py-8">Nicio etichetă creată încă.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {labels.map((label) => (
                  <div key={label._id} className="flex items-center gap-4 px-5 py-3">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: label.color }} />
                    <span className="flex-1 text-sm font-medium text-gray-900">{label.name}</span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-medium"
                      style={{ backgroundColor: label.color + '20', color: label.color }}>
                      {label.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => startEditLabel(label)}
                        className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700 transition">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteLabel(label)}
                        className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Audit Log ── */}
      {activeTab === 'audit' && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              >
                <option value="">Toate acțiunile</option>
                {availableActions.map((a) => (
                  <option key={a} value={a}>{actionLabels[a] || a}</option>
                ))}
              </select>
            </div>
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">Toți utilizatorii</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
            <span className="ml-auto text-sm text-gray-400 self-center">
              {pagination.total} înregistrări
            </span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Utilizator</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Acțiune</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Entitate</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Detalii</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logsLoading ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">Se încarcă...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">Nicio înregistrare găsită.</td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('ro-RO')}
                      </td>
                      <td className="px-4 py-3">
                        {log.email ? (
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {log.first_name} {log.last_name}
                            </p>
                            <p className="text-xs text-gray-400">{log.email}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Sistem</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${actionColors[log.action] || 'bg-gray-100 text-gray-700'}`}>
                          {actionLabels[log.action] || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {log.entity_type}
                        {log.entity_id && log.entity_id !== 'system' && (
                          <span className="text-xs text-gray-400 ml-1">#{log.entity_id.slice(-6)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate" title={formatDetails(log.details)}>
                        {formatDetails(log.details)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500">
                Pagina {pagination.page} din {pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchLogs(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="w-4 h-4" /> Anterior
                </button>
                <button
                  onClick={() => fetchLogs(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Următor <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
