import React, { useEffect } from 'react';
import {
  AlertTriangle, Check, ChevronDown, CircleCheck, Info, Loader2, Search, X,
  type LucideIcon,
} from 'lucide-react';
import { LEVEL_TONES, STATUS_LABELS, STATUS_TONES, formatNumber, initials } from '../lib/format';
import { IncidentStatus } from '../lib/types';

type ButtonVariant = 'primary' | 'danger' | 'outline' | 'outline-light' | 'ghost' | 'subtle' | 'dark' | 'success';

export function Button({
  children, variant = 'outline', size = 'md', icon: Icon, loading = false, className = '', ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg'; icon?: LucideIcon; loading?: boolean;
}) {
  return (
    <button
      {...props}
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={props.disabled || loading}
    >
      {loading ? <Loader2 size={15} className="spin" /> : Icon ? <Icon size={15} strokeWidth={2.1} /> : null}
      {children}
    </button>
  );
}

export function IconButton({ icon: Icon, className = '', label, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label?: string }) {
  return (
    <button {...props} className={`icon-btn ${className}`} aria-label={label} title={label}>
      <Icon size={17} strokeWidth={2} />
    </button>
  );
}

export function Card({ children, className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`card ${className}`}>{children}</div>;
}

export function CardHead({
  title, subtitle, action, icon: Icon, tone = 'blue',
}: { title: string; subtitle?: string; action?: React.ReactNode; icon?: LucideIcon; tone?: string }) {
  return (
    <div className="card-head">
      <div className="card-head-text">
        {Icon && <span className={`card-head-icon tone-${tone}`}><Icon size={16} /></span>}
        <div>
          <h3 className="card-title">{title}</h3>
          {subtitle && <p className="card-sub">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="card-head-action">{action}</div>}
    </div>
  );
}

export function Badge({
  children, tone = 'slate', dot = false, className = '',
}: { children: React.ReactNode; tone?: string; dot?: boolean; className?: string }) {
  return (
    <span className={`badge badge-${tone} ${className}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus | string }) {
  const key = (status in STATUS_LABELS ? status : 'pending') as IncidentStatus;
  return <Badge tone={STATUS_TONES[key]} dot>{STATUS_LABELS[key]}</Badge>;
}

export function SeverityBadge({ severity }: { severity: number }) {
  const tone = severity >= 5 ? 'red' : severity >= 4 ? 'orange' : severity >= 3 ? 'amber' : 'blue';
  return <Badge tone={tone} className="badge-mono">S{severity}</Badge>;
}

export function LevelBadge({ level }: { level: string }) {
  return <Badge tone={LEVEL_TONES[level] || 'slate'} dot>{level}</Badge>;
}

export function Avatar({ name, color = '#3b7ff5', size = 34, className = '' }: { name?: string; color?: string; size?: number; className?: string }) {
  return (
    <span
      className={`avatar ${className}`}
      style={{ width: size, height: size, background: `${color}1c`, color, borderColor: `${color}3a`, fontSize: size * 0.36 }}
    >
      {initials(name || '?')}
    </span>
  );
}

export function StatCard({
  label, value, hint, icon: Icon, tone = 'blue', delta, loading = false, onClick,
}: {
  label: string; value: React.ReactNode; hint?: string; icon: LucideIcon; tone?: string;
  delta?: string; loading?: boolean; onClick?: () => void;
}) {
  return (
    <div className={`stat-card ${onClick ? 'clickable' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      <div className={`stat-icon tone-${tone}`}><Icon size={19} strokeWidth={2} /></div>
      <div className="stat-main">
        <span className="stat-label">{label}</span>
        {loading ? <Skeleton width={72} height={26} /> : <strong className="stat-value">{value}</strong>}
        <div className="stat-foot">
          {delta && <span className={`stat-delta ${delta.startsWith('-') ? 'down' : 'up'}`}>{delta}</span>}
          {hint && <span className="stat-hint">{hint}</span>}
        </div>
      </div>
    </div>
  );
}

export function ProgressBar({ value, max = 100, tone = 'blue', height = 6, label }: { value: number; max?: number; tone?: string; height?: number; label?: string }) {
  const percent = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div className="progress-wrap">
      {label && <div className="progress-label"><span>{label}</span><span>{Math.round(percent)}%</span></div>}
      <div className="progress-track" style={{ height }}>
        <div className={`progress-fill fill-${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function PriorityMeter({ score }: { score: number }) {
  const tone = score >= 80 ? 'red' : score >= 60 ? 'orange' : score >= 40 ? 'amber' : 'teal';
  return (
    <div className="priority-meter">
      <span className={`priority-number priority-${tone}`}>{score}</span>
      <div className="priority-bar"><div className={`progress-fill fill-${tone}`} style={{ width: `${score}%` }} /></div>
    </div>
  );
}

export function Field({
  label, required, hint, error, children, className = '',
}: { label: string; required?: boolean; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`field ${className}`}>
      <label className="field-label">{label}{required && <span className="required">*</span>}</label>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`input ${props.className || ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`input textarea ${props.className || ''}`} />;
}

export function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="select-wrap">
      <select {...props} className={`input select ${props.className || ''}`}>{children}</select>
      <ChevronDown size={15} className="select-chevron" />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', className = '' }: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={`search-input ${className}`}>
      <Search size={16} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
      {value && <button className="search-clear" onClick={() => onChange('')} aria-label="Clear search"><X size={14} /></button>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label?: string; description?: string; disabled?: boolean }) {
  return (
    <label className={`toggle-row ${disabled ? 'disabled' : ''}`}>
      <div className="toggle-text">
        {label && <span className="toggle-label">{label}</span>}
        {description && <span className="toggle-description">{description}</span>}
      </div>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}>
        <span className="switch-knob" />
      </button>
    </label>
  );
}

export function Modal({
  open, onClose, title, subtitle, children, footer, size = 'md',
}: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({
  open, onClose, title, subtitle, children, footer, width = 620,
}: { open: boolean; onClose: () => void; title: React.ReactNode; subtitle?: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; width?: number }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay drawer-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="drawer" style={{ width }} role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div className="drawer-head-text"><h2>{title}</h2>{subtitle && <div className="drawer-sub">{subtitle}</div>}</div>
          <IconButton icon={X} label="Close" onClick={onClose} />
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </aside>
    </div>
  );
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, description, confirmLabel = 'Delete', loading = false,
}: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; description: string; confirmLabel?: string; loading?: boolean }) {
  return (
    <Modal
      open={open} onClose={onClose} title={title} size="sm"
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </>}
    >
      <div className="confirm-body">
        <span className="confirm-icon"><AlertTriangle size={22} /></span>
        <p>{description}</p>
      </div>
    </Modal>
  );
}

export function EmptyState({
  icon: Icon = Info, title, description, action,
}: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={24} /></div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function Skeleton({ width = '100%', height = 14, circle = false }: { width?: number | string; height?: number; circle?: boolean }) {
  return <span className="skeleton" style={{ width, height, borderRadius: circle ? '50%' : 6 }} />;
}

export function SkeletonRows({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-table">
      {Array.from({ length: rows }).map((_, row) => (
        <div className="skeleton-row" key={row}>
          {Array.from({ length: cols }).map((__, col) => <Skeleton key={col} width={col === 0 ? '55%' : '80%'} height={12} />)}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="stats-grid">
      {Array.from({ length: count }).map((_, index) => (
        <div className="card stat-card" key={index}>
          <Skeleton width={38} height={38} />
          <div className="stat-main"><Skeleton width={80} height={11} /><Skeleton width={60} height={25} /><Skeleton width={110} height={10} /></div>
        </div>
      ))}
    </div>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return <Loader2 size={size} className="spin" />;
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button key={tab.id} className={`tab ${active === tab.id ? 'active' : ''}`} onClick={() => onChange(tab.id)}>
          {tab.label}{tab.count !== undefined && <span className="tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function FilterChips({ options, value, onChange }: { options: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <div className="filter-chips">
      {options.map((option) => (
        <button key={option.id} className={`filter-chip ${value === option.id ? 'active' : ''}`} onClick={() => onChange(option.id)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SectionTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="section-title">
      <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
      {action}
    </div>
  );
}

export function TagList({ tags = [], tone = 'slate' }: { tags?: string[]; tone?: string }) {
  if (!tags?.length) return <span className="muted">—</span>;
  return <div className="tag-list">{tags.slice(0, 5).map((tag) => <span className={`tag tag-${tone}`} key={tag}>{tag}</span>)}</div>;
}

export function ToastStack({ toasts, onDismiss }: { toasts: { id: string; title: string; description?: string; tone: string }[]; onDismiss: (id: string) => void }) {
  const icons: Record<string, LucideIcon> = { success: CircleCheck, error: AlertTriangle, warning: AlertTriangle, critical: AlertTriangle, info: Info };
  return (
    <div className="toast-stack">
      {toasts.map((toast) => {
        const Icon = icons[toast.tone] || Info;
        return (
          <div className={`toast toast-${toast.tone}`} key={toast.id}>
            <span className="toast-icon"><Icon size={16} /></span>
            <div className="toast-content"><strong>{toast.title}</strong>{toast.description && <p>{toast.description}</p>}</div>
            <button onClick={() => onDismiss(toast.id)} aria-label="Dismiss"><X size={14} /></button>
          </div>
        );
      })}
    </div>
  );
}

export function KeyValue({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="kv-row">
      <span className="kv-label">{label}</span>
      <span className={`kv-value ${mono ? 'mono' : ''}`}>{value ?? '—'}</span>
    </div>
  );
}

export function SuccessCheck({ label }: { label: string }) {
  return <span className="success-check"><Check size={13} /> {label}</span>;
}

export function formatStat(value: number | undefined) {
  return formatNumber(value ?? 0);
}
