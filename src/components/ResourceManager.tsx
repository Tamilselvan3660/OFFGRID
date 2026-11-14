import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, Plus, Search, SlidersHorizontal, Trash2, type LucideIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ResourceKey } from '../lib/types';
import { formatDateTime, safeText, titleCase } from '../lib/format';
import {
  Badge, Button, ConfirmDialog, Drawer, EmptyState, Field, IconButton, KeyValue,
  Modal, SearchInput, Select, SkeletonRows, TextArea, TextInput, Toggle,
} from './ui';

export interface FormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'multi' | 'tags' | 'json' | 'email' | 'password';
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  hint?: string;
  span?: 1 | 2;
  min?: number;
  max?: number;
  step?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  render?: (row: any) => React.ReactNode;
}

interface FilterConfig {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface Props {
  resource: ResourceKey;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  columns: TableColumn[];
  fields: FormField[];
  filters?: FilterConfig[];
  defaultValues?: Record<string, any>;
  extra?: React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  createLabel?: string;
  searchPlaceholder?: string;
  onRowClick?: (row: any) => void;
}

const CAPABILITY: Record<ResourceKey, string> = {
  incidents: 'incident:assign', teams: 'team:manage', hospitals: 'hospital:manage',
  resources: 'resource:manage', broadcasts: 'broadcast:manage', users: 'user:manage',
};

const SINGULAR_LABEL: Record<ResourceKey, string> = {
  incidents: 'incident', teams: 'team', hospitals: 'hospital', resources: 'resource',
  broadcasts: 'broadcast', users: 'user',
};

function toFormValue(field: FormField, value: any): any {
  if (value === undefined || value === null) return field.type === 'multi' || field.type === 'tags' ? '' : '';
  if (field.type === 'tags') return Array.isArray(value) ? value.join(', ') : String(value);
  if (field.type === 'multi') return Array.isArray(value) ? value : String(value).split(',').filter(Boolean);
  if (field.type === 'json') return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
  return value;
}

function fromFormValue(field: FormField, value: any): any {
  if (field.type === 'tags') return String(value || '').split(',').map((part) => part.trim()).filter(Boolean);
  if (field.type === 'multi') return Array.isArray(value) ? value : [];
  if (field.type === 'json') {
    try { return JSON.parse(String(value || '{}')); } catch { return {}; }
  }
  if (field.type === 'number') return Number(value) || 0;
  return value;
}

export function ResourceManager({
  resource, title, subtitle, icon: Icon, columns, fields, filters = [], defaultValues = {},
  extra, emptyTitle, emptyDescription, createLabel, searchPlaceholder, onRowClick,
}: Props) {
  const { data, loading, mutate, can, globalSearch, pushToast } = useApp();
  const rows = (data[resource] as any[]) || [];
  const canManage = can(CAPABILITY[resource]);
  const [search, setSearch] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { if (globalSearch) setSearch(globalSearch); }, [globalSearch]);

  const filtered = useMemo(() => rows.filter((row) => {
    const term = search.trim().toLowerCase();
    if (term && !JSON.stringify(row).toLowerCase().includes(term)) return false;
    for (const [key, value] of Object.entries(filterValues)) {
      if (value && value !== 'all' && String(row[key] ?? '') !== value) return false;
    }
    return true;
  }), [rows, search, filterValues]);

  const openCreate = () => {
    const values: Record<string, any> = { ...defaultValues };
    for (const field of fields) {
      if (values[field.key] !== undefined) {
        if (field.type === 'json' && typeof values[field.key] === 'object') values[field.key] = JSON.stringify(values[field.key], null, 2);
        else if (field.type === 'tags' && Array.isArray(values[field.key])) values[field.key] = values[field.key].join(', ');
        continue;
      }
      values[field.key] = field.type === 'multi' ? [] : '';
    }
    setEditing(null);
    setFormValues(values);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (row: any) => {
    const values: Record<string, any> = {};
    for (const field of fields) values[field.key] = toFormValue(field, row[field.key]);
    setEditing(row);
    setFormValues(values);
    setFormError(null);
    setFormOpen(true);
    setDetail(null);
  };

  const submit = async () => {
    const payload: Record<string, any> = {};
    const missing: string[] = [];
    for (const field of fields) {
      const value = formValues[field.key];
      if (field.required && (value === '' || value === undefined || value === null || (Array.isArray(value) && !value.length))) {
        missing.push(field.label);
        continue;
      }
      if (editing && field.type === 'password' && !value) continue;
      if (!editing && value === '' && field.type !== 'password') continue;
      if (field.type === 'email' && value && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value))) {
        setFormError(`${field.label} must be a valid email address.`);
        return;
      }
      payload[field.key] = fromFormValue(field, value);
    }
    if (missing.length) {
      setFormError(`Required: ${missing.join(', ')}`);
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      if (editing) await mutate.update(resource, editing.id, payload);
      else await mutate.create(resource, payload);
      setFormOpen(false);
      setEditing(null);
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await mutate.remove(resource, deleteTarget.id);
      setDeleteTarget(null);
      setDetail(null);
    } catch { /* handled in context */ }
    finally { setDeleting(false); }
  };

  const renderField = (field: FormField) => {
    const value = formValues[field.key];
    const set = (next: any) => setFormValues((prev) => ({ ...prev, [field.key]: next }));
    const common = { value: value ?? '', onChange: (event: any) => set(event.target.value), placeholder: field.placeholder };
    return (
      <Field key={field.key} label={field.label} required={field.required} hint={field.hint} className={field.span === 2 ? 'span-2' : ''}>
        {field.type === 'textarea' && <TextArea rows={3} {...common} />}
        {field.type === 'select' && (
          <Select value={value ?? ''} onChange={(event) => set(event.target.value)}>
            <option value="">Select…</option>
            {(field.options || []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Select>
        )}
        {field.type === 'multi' && (
          <div className="multi-select">
            {(field.options || []).map((option) => {
              const active = Array.isArray(value) && value.includes(option.value);
              return (
                <button
                  type="button" key={option.value}
                  className={`multi-option ${active ? 'active' : ''}`}
                  onClick={() => set(active ? (value as string[]).filter((item) => item !== option.value) : [...(Array.isArray(value) ? value : []), option.value])}
                >
                  {active && <span>✓</span>}{option.label}
                </button>
              );
            })}
          </div>
        )}
        {field.type === 'json' && <TextArea rows={3} {...common} className="mono" />}
        {['text', 'number', 'email', 'password', 'tags'].includes(field.type) && (
          <TextInput
            type={field.type === 'number' ? 'number' : field.type === 'password' ? 'password' : field.type === 'email' ? 'email' : 'text'}
            min={field.min} max={field.max} step={field.step}
            {...common}
          />
        )}
      </Field>
    );
  };

  const renderDetailValue = (field: FormField, row: any) => {
    const value = row?.[field.key];
    if (value === undefined || value === null || value === '') return '—';
    if (Array.isArray(value)) return <div className="tag-list">{value.map((item) => <span className="tag tag-blue" key={String(item)}>{String(item)}</span>)}</div>;
    if (typeof value === 'object') return <span className="mono">{JSON.stringify(value)}</span>;
    if (field.type === 'password') return '••••••••';
    return String(value);
  };

  return (
    <div className="resource-manager">
      <div className="resource-toolbar card">
        <div className="resource-toolbar-head">
          <div className="resource-title">
            <span className="resource-title-icon"><Icon size={18} /></span>
            <div><h2>{title}</h2><p>{subtitle}</p></div>
          </div>
          {canManage && (
            <Button variant="primary" icon={Plus} onClick={openCreate}>{createLabel || `New ${SINGULAR_LABEL[resource]}`}</Button>
          )}
        </div>
        <div className="resource-toolbar-filters">
          <SearchInput value={search} onChange={setSearch} placeholder={searchPlaceholder || `Search ${title.toLowerCase()}…`} className="toolbar-search" />
          {filters.map((filter) => (
            <div className="toolbar-filter" key={filter.key}>
              <SlidersHorizontal size={14} />
              <Select value={filterValues[filter.key] || 'all'} onChange={(event) => setFilterValues((prev) => ({ ...prev, [filter.key]: event.target.value }))}>
                <option value="all">{filter.label}: All</option>
                {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </Select>
            </div>
          ))}
          <span className="result-count">{filtered.length} of {rows.length}</span>
        </div>
      </div>

      {extra}

      <div className="card table-card">
        {loading[resource] ? (
          <div className="table-loading"><SkeletonRows rows={7} cols={columns.length} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Icon}
            title={emptyTitle || `No ${title.toLowerCase()} found`}
            description={emptyDescription || (search ? 'Try a different search or clear your filters.' : `Create the first ${SINGULAR_LABEL[resource]} to get started.`)}
            action={canManage && !search ? <Button variant="primary" icon={Plus} onClick={openCreate}>{createLabel || `New ${SINGULAR_LABEL[resource]}`}</Button> : undefined}
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((column) => <th key={column.key} style={column.width ? { width: column.width } : undefined}>{column.label}</th>)}
                  <th className="actions-col" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.id}
                    className={`${row._optimistic ? 'is-optimistic' : ''} ${onRowClick || true ? 'clickable-row' : ''}`}
                    onClick={() => { if (onRowClick) onRowClick(row); else setDetail(row); }}
                  >
                    {columns.map((column) => (
                      <td key={column.key}>{column.render ? column.render(row) : safeText(row[column.key])}</td>
                    ))}
                    <td className="actions-col" onClick={(event) => event.stopPropagation()}>
                      <div className="row-actions">
                        <IconButton icon={Edit3} label="Edit" disabled={!canManage} onClick={() => openEdit(row)} />
                        <IconButton icon={Trash2} label="Delete" disabled={!canManage} onClick={() => setDeleteTarget(row)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `Edit ${SINGULAR_LABEL[resource]}` : `Create ${SINGULAR_LABEL[resource]}`}
        subtitle={editing ? `Updating ${editing.name || editing.title || `#${editing.id}`}` : 'Changes appear instantly with optimistic updates'}
        size="lg"
        footer={<><Button variant="ghost" onClick={() => setFormOpen(false)}>Cancel</Button><Button variant="primary" loading={saving} onClick={submit}>{editing ? 'Save changes' : 'Create'}</Button></>}
      >
        <div className="form-grid">{fields.map(renderField)}</div>
        {formError && <div className="form-error">{formError}</div>}
      </Modal>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail?.name || detail?.title || `${SINGULAR_LABEL[resource]} #${detail?.id}`}
        subtitle={<span className="mono">{detail?.code || `ID ${detail?.id}`}</span>}
        width={540}
        footer={detail && canManage ? (
          <>
            <Button variant="ghost" icon={Trash2} onClick={() => setDeleteTarget(detail)} className="btn-danger-text">Delete</Button>
            <div className="grow" />
            <Button variant="primary" icon={Edit3} onClick={() => openEdit(detail)}>Edit record</Button>
          </>
        ) : undefined}
      >
        {detail && (
          <div className="drawer-section">
            <div className="detail-grid detail-grid-wide">
              {fields.map((field) => <KeyValue key={field.key} label={field.label} value={renderDetailValue(field, detail)} />)}
              <KeyValue label="Record ID" value={`#${detail.id}`} mono />
              {detail.created_at && <KeyValue label="Created" value={formatDateTime(detail.created_at)} />}
              {detail.updated_at && <KeyValue label="Last updated" value={formatDateTime(detail.updated_at)} />}
            </div>
            {detail.body && <div className="detail-body"><span className="field-label">Message</span><p>{detail.body}</p></div>}
          </div>
        )}
      </Drawer>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={`Delete this ${SINGULAR_LABEL[resource]}?`}
        description={`This will permanently remove ${deleteTarget?.name || deleteTarget?.title || `record #${deleteTarget?.id}`} from OFFGRID. Linked records will be kept but unassigned.`}
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
