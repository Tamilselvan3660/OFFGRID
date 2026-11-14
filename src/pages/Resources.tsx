import React from 'react';
import { AlertTriangle, Boxes, Package, PackageCheck, TrendingDown } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ZONES } from '../lib/geo';
import { RESOURCE_STATUSES, asOptions } from '../lib/constants';
import { formatNumber } from '../lib/format';
import { Badge, Card, CardHead, ProgressBar, StatCard } from '../components/ui';
import { ResourceManager, type FormField, type TableColumn } from '../components/ResourceManager';

const fields: FormField[] = [
  { key: 'name', label: 'Resource name', type: 'text', required: true, span: 2, placeholder: 'Inflatable rescue boats' },
  { key: 'category', label: 'Category', type: 'text', placeholder: 'Rescue Equipment' },
  { key: 'quantity', label: 'Quantity', type: 'number', min: 0, required: true },
  { key: 'unit', label: 'Unit', type: 'text', placeholder: 'units' },
  { key: 'threshold', label: 'Low-stock threshold', type: 'number', min: 0 },
  { key: 'zone', label: 'Zone', type: 'select', options: asOptions(ZONES) },
  { key: 'supplier', label: 'Supplier', type: 'text' },
  { key: 'status', label: 'Status', type: 'select', options: asOptions(RESOURCE_STATUSES) },
];

const columns: TableColumn[] = [
  { key: 'name', label: 'Item', width: '25%', render: (row) => <div className="entity-cell"><span className={`entity-icon ${Number(row.quantity) <= Number(row.threshold) ? 'tone-red' : 'tone-blue'}`}><Package size={15} /></span><div><strong>{row.name}</strong><span className="cell-sub">{row.category} · {row.zone}</span></div></div> },
  { key: 'quantity', label: 'Stock level', render: (row) => <div className="stock-cell"><strong>{formatNumber(row.quantity)} <small>{row.unit}</small></strong><ProgressBar value={row.quantity} max={Math.max(Number(row.threshold) * 2, Number(row.quantity) * 1.3, 1)} tone={Number(row.quantity) <= Number(row.threshold) ? 'red' : 'teal'} height={5} /></div> },
  { key: 'threshold', label: 'Threshold', render: (row) => <span className="mono">{formatNumber(row.threshold)}</span> },
  { key: 'status', label: 'Status', render: (row) => <Badge tone={Number(row.quantity) <= Number(row.threshold) ? 'red' : row.status === 'available' ? 'green' : 'amber'} dot>{Number(row.quantity) <= Number(row.threshold) ? 'low stock' : row.status}</Badge> },
  { key: 'supplier', label: 'Supplier' },
];

export function Resources() {
  const { data, loading } = useApp();
  const lowStock = data.resources.filter((resource) => Number(resource.quantity) <= Number(resource.threshold));
  const totalUnits = data.resources.reduce((sum, resource) => sum + Number(resource.quantity), 0);

  return (
    <div className="page-stack">
      <div className="stats-grid">
        <StatCard label="Inventory lines" value={data.resources.length} icon={Boxes} tone="blue" hint="Tracked categories" loading={loading.resources} />
        <StatCard label="Total units" value={formatNumber(totalUnits)} icon={PackageCheck} tone="teal" hint="Across all depots" loading={loading.resources} />
        <StatCard label="Low-stock items" value={lowStock.length} icon={TrendingDown} tone="red" hint="Below replenishment threshold" loading={loading.resources} />
        <StatCard label="Depot zones" value={new Set(data.resources.map((item) => item.zone)).size} icon={Package} tone="violet" hint="Distribution coverage" loading={loading.resources} />
      </div>

      {lowStock.length > 0 && (
        <Card className="low-stock-card">
          <CardHead title="Replenishment required" subtitle="These items are at or below their configured threshold" icon={AlertTriangle} tone="red" />
          <div className="low-stock-grid">
            {lowStock.map((resource) => (
              <div className="low-stock-item" key={resource.id}>
                <span className="low-stock-icon"><AlertTriangle size={15} /></span>
                <div><strong>{resource.name}</strong><small>{resource.zone} · {resource.supplier}</small></div>
                <Badge tone="red">{formatNumber(resource.quantity)} / {formatNumber(resource.threshold)}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ResourceManager
        resource="resources"
        title="Resource inventory"
        subtitle="Create, edit and remove equipment and relief supplies"
        icon={Package}
        columns={columns}
        fields={fields}
        filters={[
          { key: 'status', label: 'Status', options: asOptions(RESOURCE_STATUSES) },
          { key: 'zone', label: 'Zone', options: asOptions(ZONES) },
        ]}
        defaultValues={{ quantity: 0, threshold: 10, unit: 'units', status: 'available', zone: 'Central Chennai' }}
        emptyTitle="No resources in inventory"
      />
    </div>
  );
}
