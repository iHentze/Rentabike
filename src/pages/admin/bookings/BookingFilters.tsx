import { PInputSearch, PSelect, PSelectOption } from '@porsche-design-system/components-react';

interface BookingFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusChange: (value: string) => void;
}

export function BookingFilters({
  search,
  onSearchChange,
  statusFilter,
  onStatusChange,
}: BookingFiltersProps) {
  return (
    <div className="flex flex-wrap gap-static-sm items-end">
      <div className="flex-1 min-w-[200px]">
        <PInputSearch
          label="Search"
          name="search"
          placeholder="Name, email, or code..."
          hideLabel
          value={search}
          onInput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
        />
      </div>
      <div className="w-[180px]">
        <PSelect
          label="Status"
          name="status"
          hideLabel
          value={statusFilter}
          onChange={(e) => onStatusChange(e.detail.value)}
        >
          <PSelectOption value="">All statuses</PSelectOption>
          <PSelectOption value="pending">Pending</PSelectOption>
          <PSelectOption value="confirmed">Confirmed</PSelectOption>
          <PSelectOption value="picked_up">Picked Up</PSelectOption>
          <PSelectOption value="returned">Returned</PSelectOption>
          <PSelectOption value="cancelled">Cancelled</PSelectOption>
        </PSelect>
      </div>
    </div>
  );
}
