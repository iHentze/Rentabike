import { useState, useMemo } from 'react';
import {
  PHeading,
  PButton,
  PSpinner,
  PTabsBar,
  PSegmentedControl,
  PSegmentedControlItem,
  PSelect,
  PSelectOption,
} from '@porsche-design-system/components-react';
import { InventoryTable } from './InventoryTable';
import { InventoryGrid } from './InventoryGrid';
import { InventoryEditFlyout } from './InventoryEditFlyout';
import type { Bike, Category } from '../../../types';

interface InventorySectionProps {
  bikes: Bike[];
  categories: Category[];
  loading: boolean;
  onRefresh: () => void;
  onUpdateBike: (id: string, updates: Partial<Bike>) => void;
  onCreateBike: (bike: Omit<Bike, 'id' | 'created_at' | 'category' | 'available_quantity'>) => void;
  onDeleteBike: (id: string) => void;
}

export function InventorySection({
  bikes,
  categories,
  loading,
  onRefresh,
  onUpdateBike,
  onCreateBike,
  onDeleteBike,
}: InventorySectionProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [sizeFilter, setSizeFilter] = useState('');
  const [editBike, setEditBike] = useState<Bike | null>(null);
  const [creating, setCreating] = useState(false);

  const tabs = useMemo(() => ['All', ...categories.map((c) => c.name)], [categories]);

  const sizes = useMemo(() => {
    const unique = new Set(bikes.map((b) => b.size).filter(Boolean));
    return Array.from(unique).sort();
  }, [bikes]);

  const filtered = useMemo(() => {
    let result = bikes;
    if (activeTab !== 0) {
      const cat = categories[activeTab - 1];
      if (cat) result = result.filter((b) => b.category_id === cat.id);
    }
    if (sizeFilter) {
      result = result.filter((b) => b.size === sizeFilter);
    }
    return result;
  }, [bikes, categories, activeTab, sizeFilter]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <PSpinner size="large" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-fluid-md">
      <div className="flex justify-between items-start flex-wrap gap-static-md">
        <PHeading size="x-large" tag="h1">Inventory</PHeading>
        <div className="flex items-center gap-static-sm">
          <PSegmentedControl
            value={viewMode}
            onChange={(e) => setViewMode(e.detail.value as 'list' | 'grid')}
            label="View"
            hideLabel
            compact
            columns={2}
          >
            <PSegmentedControlItem value="list" icon="list" aria={{ 'aria-label': 'List view' }} />
            <PSegmentedControlItem value="grid" icon="grid" aria={{ 'aria-label': 'Grid view' }} />
          </PSegmentedControl>
          <PButton variant="secondary" icon="refresh" compact onClick={onRefresh}>
            Refresh
          </PButton>
          <PButton icon="add" compact onClick={() => setCreating(true)}>
            Add Item
          </PButton>
        </div>
      </div>

      <div className="flex items-end justify-between gap-static-md flex-wrap">
        <PTabsBar activeTabIndex={activeTab} onUpdate={(e) => setActiveTab(e.detail.activeTabIndex)}>
          {tabs.map((tab) => (
            <button key={tab} type="button">{tab}</button>
          ))}
        </PTabsBar>
        <div className="w-[160px] shrink-0">
          <PSelect
            name="sizeFilter"
            label="Size"
            hideLabel
            compact
            value={sizeFilter}
            onChange={(e) => setSizeFilter(e.detail.value)}
          >
            <PSelectOption value="">All sizes</PSelectOption>
            {sizes.map((size) => (
              <PSelectOption key={size} value={size}>{size}</PSelectOption>
            ))}
          </PSelect>
        </div>
      </div>

      {viewMode === 'list' ? (
        <InventoryTable
          bikes={filtered}
          onToggleActive={(id, active) => onUpdateBike(id, { is_active: active })}
          onEdit={setEditBike}
        />
      ) : (
        <InventoryGrid
          bikes={filtered}
          onToggleActive={(id, active) => onUpdateBike(id, { is_active: active })}
          onEdit={setEditBike}
        />
      )}

      <InventoryEditFlyout
        bike={editBike}
        categories={categories}
        open={!!editBike || creating}
        onDismiss={() => { setEditBike(null); setCreating(false); }}
        onSave={(data) => {
          if (editBike) {
            onUpdateBike(editBike.id, data);
          } else {
            onCreateBike(data as Omit<Bike, 'id' | 'created_at' | 'category' | 'available_quantity'>);
          }
          setEditBike(null);
          setCreating(false);
        }}
        onDelete={editBike ? () => { onDeleteBike(editBike.id); setEditBike(null); } : undefined}
      />
    </div>
  );
}
