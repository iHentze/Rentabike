import { useState, useMemo } from 'react';
import {
  PHeading,
  PButton,
  PSpinner,
  PInputSearch,
  PSelect,
  PSelectOption,
  PTable,
  PTableHead,
  PTableHeadRow,
  PTableHeadCell,
  PTableBody,
  PText,
} from '@porsche-design-system/components-react';
import { TourRow } from './TourRow';
import { TourEditFlyout } from './TourEditFlyout';
import type { Tour, Bike, Category } from '../../../types';

interface ToursSectionProps {
  tours: Tour[];
  loading: boolean;
  bikes: Bike[];
  categories: Category[];
  onRefresh: () => void;
  onCreateTour: (tour: Partial<Tour>) => Promise<Tour | null>;
  onUpdateTour: (id: string, updates: Partial<Tour>) => Promise<void>;
  onDeleteTour: (id: string) => Promise<void>;
  onSetAllowedBikes: (tourId: string, bikeIds: string[]) => Promise<void>;
  onCreateTourDate: (tourDate: { tour_id: string; date: string; start_time: string; available_spots: number }) => Promise<void>;
  onUpdateTourDate: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onDeleteTourDate: (id: string) => Promise<void>;
}

export function ToursSection({
  tours,
  loading,
  bikes,
  categories,
  onRefresh,
  onCreateTour,
  onUpdateTour,
  onDeleteTour,
  onSetAllowedBikes,
  onCreateTourDate,
  onUpdateTourDate,
  onDeleteTourDate,
}: ToursSectionProps) {
  const [search, setSearch] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);

  const filtered = useMemo(() => {
    let result = tours;
    if (activityFilter) {
      result = result.filter((t) => t.activity_type === activityFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q));
    }
    return result;
  }, [tours, search, activityFilter]);

  function handleEdit(tour: Tour) {
    setSelectedTour(tour);
    setEditOpen(true);
  }

  function handleCreate() {
    setSelectedTour(null);
    setEditOpen(true);
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <PSpinner size="large" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-fluid-md">
        <div className="flex justify-between items-start flex-wrap gap-static-md">
          <PHeading size="x-large" tag="h1">Guided Tours</PHeading>
          <div className="flex gap-static-sm">
            <PButton icon="add" onClick={handleCreate}>New Tour</PButton>
            <PButton variant="secondary" icon="refresh" compact onClick={onRefresh}>Refresh</PButton>
          </div>
        </div>

        <div className="flex flex-wrap gap-static-sm items-end">
          <div className="flex-1 min-w-[200px]">
            <PInputSearch
              label="Search"
              name="search"
              placeholder="Search tours..."
              hideLabel
              value={search}
              onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
            />
          </div>
          <div className="w-[180px]">
            <PSelect
              label="Activity"
              name="activity"
              hideLabel
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.detail.value)}
            >
              <PSelectOption value="">All activities</PSelectOption>
              <PSelectOption value="bike">Biking</PSelectOption>
              <PSelectOption value="combo">Hike & Bike</PSelectOption>
              <PSelectOption value="hike">Hiking</PSelectOption>
              <PSelectOption value="trail-run">Trail Run</PSelectOption>
            </PSelect>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-fluid-lg">
            <PText color="contrast-medium">No tours found</PText>
          </div>
        ) : (
          <PTable caption="All guided tours">
            <PTableHead>
              <PTableHeadRow>
                <PTableHeadCell>Tour</PTableHeadCell>
                <PTableHeadCell>Activity</PTableHeadCell>
                <PTableHeadCell>Difficulty</PTableHeadCell>
                <PTableHeadCell>Duration</PTableHeadCell>
                <PTableHeadCell>Price/Person</PTableHeadCell>
                <PTableHeadCell>Bikes</PTableHeadCell>
                <PTableHeadCell>Dates</PTableHeadCell>
                <PTableHeadCell>Status</PTableHeadCell>
                <PTableHeadCell>Actions</PTableHeadCell>
              </PTableHeadRow>
            </PTableHead>
            <PTableBody>
              {filtered.map((tour) => (
                <TourRow key={tour.id} tour={tour} onEdit={handleEdit} />
              ))}
            </PTableBody>
          </PTable>
        )}
      </div>

      <TourEditFlyout
        open={editOpen}
        tour={selectedTour}
        bikes={bikes}
        categories={categories}
        onDismiss={() => {
          setEditOpen(false);
          setSelectedTour(null);
        }}
        onSave={async (tourData, allowedBikeIds) => {
          if (selectedTour) {
            await onUpdateTour(selectedTour.id, tourData);
            await onSetAllowedBikes(selectedTour.id, allowedBikeIds);
          } else {
            const created = await onCreateTour(tourData);
            if (created) {
              await onSetAllowedBikes(created.id, allowedBikeIds);
            }
          }
          setEditOpen(false);
          setSelectedTour(null);
        }}
        onDelete={async (id) => {
          await onDeleteTour(id);
          setEditOpen(false);
          setSelectedTour(null);
        }}
        onCreateTourDate={onCreateTourDate}
        onUpdateTourDate={onUpdateTourDate}
        onDeleteTourDate={onDeleteTourDate}
        onRefresh={onRefresh}
      />
    </>
  );
}
