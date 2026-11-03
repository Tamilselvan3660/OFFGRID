import React, { useMemo } from 'react';
import { KeyRound, ShieldCheck, UserCheck, UsersRound } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ZONES } from '../lib/geo';
import { USER_ROLES, USER_STATUSES, asOptions } from '../lib/constants';
import { ROLE_LABEL } from '../lib/permissions';
import { timeAgo } from '../lib/format';
import { Avatar, Badge, StatCard } from '../components/ui';
import { ResourceManager, type FormField, type TableColumn } from '../components/ResourceManager';

const columns: TableColumn[] = [
  {
    key: 'name', label: 'User', width: '26%',
    render: (row) => <div className="entity-cell"><Avatar name={row.name} color={row.avatar_color || '#3b7ff5'} size={34} /><div><strong>{row.name}</strong><span className="cell-sub">{row.email}</span></div></div>,
  },
  { key: 'role', label: 'Role', render: (row) => <Badge tone={row.role === 'admin' ? 'orange' : row.role === 'authority' ? 'blue' : row.role === 'citizen' ? 'amber' : 'teal'}>{ROLE_LABEL[row.role as keyof typeof ROLE_LABEL] || row.role}</Badge> },
  { key: 'zone', label: 'Zone' },
  { key: 'designation', label: 'Designation', render: (row) => <span className="cell-sub">{row.designation || '—'}</span> },
  { key: 'status', label: 'Status', render: (row) => <Badge tone={row.status === 'active' ? 'green' : 'slate'} dot>{row.status}</Badge> },
  { key: 'last_active_at', label: 'Last active', render: (row) => timeAgo(row.last_active_at) },
];

export function Users() {
  const { data, loading } = useApp();
  const fields: FormField[] = useMemo(() => [
    { key: 'name', label: 'Full name', type: 'text', required: true },
    { key: 'email', label: 'Email address', type: 'email', required: true },
    { key: 'role', label: 'Platform role', type: 'select', required: true, options: USER_ROLES },
    { key: 'status', label: 'Account status', type: 'select', options: asOptions(USER_STATUSES) },
    { key: 'zone', label: 'Operating zone', type: 'select', options: asOptions(ZONES) },
    { key: 'team_id', label: 'Assigned team', type: 'select', options: data.teams.map((team) => ({ value: String(team.id), label: `${team.code} · ${team.name}` })) },
    { key: 'designation', label: 'Designation', type: 'text', span: 2, placeholder: 'Incident Commander · Night Shift' },
    { key: 'phone', label: 'Phone number', type: 'text' },
    { key: 'password', label: 'Password', type: 'password', hint: 'Leave blank on edit. New accounts default to Demo@123.' },
  ], [data.teams]);

  return (
    <div className="page-stack">
      <div className="stats-grid">
        <StatCard label="Total accounts" value={data.users.length} icon={UsersRound} tone="blue" hint="All participating roles" loading={loading.users} />
        <StatCard label="Active accounts" value={data.users.filter((user) => user.status === 'active').length} icon={UserCheck} tone="green" hint="Can access the network" loading={loading.users} />
        <StatCard label="Field personnel" value={data.users.filter((user) => ['responder', 'medical'].includes(user.role)).length} icon={ShieldCheck} tone="teal" hint="Responders & medics" loading={loading.users} />
        <StatCard label="Administrators" value={data.users.filter((user) => user.role === 'admin').length} icon={KeyRound} tone="orange" hint="Full platform access" loading={loading.users} />
      </div>

      <ResourceManager
        resource="users"
        title="Users & access"
        subtitle="Role-based accounts for citizens, responders, authorities, hospitals and administrators"
        icon={ShieldCheck}
        columns={columns}
        fields={fields}
        filters={[
          { key: 'role', label: 'Role', options: USER_ROLES },
          { key: 'status', label: 'Status', options: asOptions(USER_STATUSES) },
          { key: 'zone', label: 'Zone', options: asOptions(ZONES) },
        ]}
        defaultValues={{ role: 'citizen', status: 'active', zone: 'Central Chennai' }}
        emptyTitle="No users match these filters"
        searchPlaceholder="Search name, email or designation…"
      />
    </div>
  );
}
