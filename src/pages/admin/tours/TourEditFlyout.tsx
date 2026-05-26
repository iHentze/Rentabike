import { useState, useEffect, useMemo } from 'react';
import {
  PFlyout,
  PHeading,
  PText,
  PButton,
  PInputText,
  PTextarea,
  PSelect,
  PSelectOption,
  PInputNumber,
  PSwitch,
  PDivider,
  PTag,
  PIcon,
  PAccordion,
  PCheckbox,
  PInlineNotification,
} from '@porsche-design-system/components-react';
import { TourDatesManager } from './TourDatesManager';
import type { Tour, Bike, Category } from '../../../types';

interface TourEditFlyoutProps {
  open: boolean;
  tour: Tour | null;
  bikes: Bike[];
  categories: Category[];
  onDismiss: () => void;
  onSave: (tourData: Partial<Tour>, allowedBikeIds: string[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onCreateTourDate: (td: { tour_id: string; date: string; start_time: string; available_spots: number }) => Promise<void>;
  onUpdateTourDate: (id: string, updates: Record<string, unknown>) => Promise<void>;
  onDeleteTourDate: (id: string) => Promise<void>;
  onRefresh: () => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function TourEditFlyout({
  open,
  tour,
  bikes,
  categories,
  onDismiss,
  onSave,
  onDelete,
  onCreateTourDate,
  onUpdateTourDate,
  onDeleteTourDate,
  onRefresh,
}: TourEditFlyoutProps) {
  const isEdit = !!tour;

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState('bike');
  const [difficulty, setDifficulty] = useState('easy');
  const [durationHours, setDurationHours] = useState('2');
  const [pricePerPerson, setPricePerPerson] = useState('0');
  const [maxParticipants, setMaxParticipants] = useState('8');
  const [meetingPoint, setMeetingPoint] = useState('Rent a Bike, Sverrisgota 20, Torshavn');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [needsBike, setNeedsBike] = useState(true);
  const [selectedBikeIds, setSelectedBikeIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      if (tour) {
        setName(tour.name);
        setSlug(tour.slug);
        setShortDescription(tour.short_description);
        setDescription(tour.description);
        setActivityType(tour.activity_type);
        setDifficulty(tour.difficulty);
        setDurationHours(String(tour.duration_hours));
        setPricePerPerson(String(tour.price_per_person));
        setMaxParticipants(String(tour.max_participants));
        setMeetingPoint(tour.meeting_point);
        setImageUrl(tour.image_url || '');
        setIsActive(tour.is_active);
        setNeedsBike(tour.needs_bike);
        setSelectedBikeIds(new Set((tour.allowed_bikes || []).map((ab) => ab.bike_id)));
      } else {
        setName('');
        setSlug('');
        setShortDescription('');
        setDescription('');
        setActivityType('bike');
        setDifficulty('easy');
        setDurationHours('2');
        setPricePerPerson('0');
        setMaxParticipants('8');
        setMeetingPoint('Rent a Bike, Sverrisgota 20, Torshavn');
        setImageUrl('');
        setIsActive(true);
        setNeedsBike(true);
        setSelectedBikeIds(new Set());
      }
      setError('');
    }
  }, [open, tour]);

  useEffect(() => {
    if (activityType === 'hike' || activityType === 'trail-run') {
      setNeedsBike(false);
    } else {
      setNeedsBike(true);
    }
  }, [activityType]);

  const bikesByCategory = useMemo(() => {
    const activeBikes = bikes.filter((b) => b.is_active);
    const grouped = new Map<string, { category: Category; bikes: Bike[] }>();
    for (const bike of activeBikes) {
      const catId = bike.category_id;
      if (!grouped.has(catId)) {
        const cat = categories.find((c) => c.id === catId) || bike.category;
        if (cat) grouped.set(catId, { category: cat, bikes: [] });
      }
      grouped.get(catId)?.bikes.push(bike);
    }
    return Array.from(grouped.values()).sort((a, b) => a.category.name.localeCompare(b.category.name));
  }, [bikes, categories]);

  function toggleBike(bikeId: string) {
    setSelectedBikeIds((prev) => {
      const next = new Set(prev);
      if (next.has(bikeId)) next.delete(bikeId);
      else next.add(bikeId);
      return next;
    });
  }

  function toggleCategory(categoryBikes: Bike[]) {
    const ids = categoryBikes.map((b) => b.id);
    const allSelected = ids.every((id) => selectedBikeIds.has(id));
    setSelectedBikeIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function handleSave() {
    if (!name.trim()) {
      setError('Tour name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const tourData: Partial<Tour> = {
        name: name.trim(),
        slug: slug || slugify(name),
        short_description: shortDescription.trim(),
        description: description.trim(),
        activity_type: activityType as Tour['activity_type'],
        difficulty: difficulty as Tour['difficulty'],
        duration_hours: parseFloat(durationHours) || 2,
        price_per_person: parseFloat(pricePerPerson) || 0,
        max_participants: parseInt(maxParticipants) || 8,
        meeting_point: meetingPoint.trim(),
        image_url: imageUrl.trim(),
        is_active: isActive,
        needs_bike: needsBike,
      };
      await onSave(tourData, Array.from(selectedBikeIds));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PFlyout open={open} onDismiss={onDismiss} aria={{ 'aria-label': isEdit ? 'Edit tour' : 'Create tour' }}>
      <div slot="header">
        <PHeading size="large" tag="h2">{isEdit ? 'Edit Tour' : 'New Tour'}</PHeading>
      </div>

      <div className="flex flex-col gap-static-md">
        {error && (
          <PInlineNotification state="error" heading="Error" description={error} dismissButton={false} />
        )}

        <PInputText
          label="Tour Name"
          name="name"
          value={name}
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value;
            setName(v);
            if (!isEdit) setSlug(slugify(v));
          }}
        />

        <PInputText
          label="Slug"
          name="slug"
          value={slug}
          onInput={(e) => setSlug((e.target as HTMLInputElement).value)}
          description="URL-friendly identifier"
        />

        <PInputText
          label="Short Description"
          name="shortDescription"
          value={shortDescription}
          onInput={(e) => setShortDescription((e.target as HTMLInputElement).value)}
        />

        <PTextarea
          label="Full Description"
          name="description"
          value={description}
          onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
        />

        <PDivider />

        <PHeading size="small" tag="h3">Configuration</PHeading>

        <div className="grid grid-cols-2 gap-static-sm">
          <PSelect
            label="Activity Type"
            name="activityType"
            value={activityType}
            onChange={(e) => setActivityType(e.detail.value)}
          >
            <PSelectOption value="bike">Biking</PSelectOption>
            <PSelectOption value="combo">Hike & Bike</PSelectOption>
            <PSelectOption value="hike">Hiking</PSelectOption>
            <PSelectOption value="trail-run">Trail Run</PSelectOption>
          </PSelect>

          <PSelect
            label="Difficulty"
            name="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.detail.value)}
          >
            <PSelectOption value="easy">Easy</PSelectOption>
            <PSelectOption value="moderate">Moderate</PSelectOption>
          </PSelect>
        </div>

        <div className="grid grid-cols-3 gap-static-sm">
          <PInputNumber
            label="Duration (h)"
            name="duration"
            value={durationHours}
            min={0.5}
            max={12}
            onInput={(e) => setDurationHours((e.target as HTMLInputElement).value)}
          />
          <PInputNumber
            label="Price/Person (DKK)"
            name="price"
            value={pricePerPerson}
            min={0}
            onInput={(e) => setPricePerPerson((e.target as HTMLInputElement).value)}
          />
          <PInputNumber
            label="Max Participants"
            name="maxPart"
            value={maxParticipants}
            min={1}
            max={30}
            onInput={(e) => setMaxParticipants((e.target as HTMLInputElement).value)}
          />
        </div>

        <PInputText
          label="Meeting Point"
          name="meetingPoint"
          value={meetingPoint}
          onInput={(e) => setMeetingPoint((e.target as HTMLInputElement).value)}
        />

        <PInputText
          label="Image URL"
          name="imageUrl"
          value={imageUrl}
          onInput={(e) => setImageUrl((e.target as HTMLInputElement).value)}
        />

        <div className="flex items-center justify-between gap-static-md">
          <div>
            <PText size="small" weight="semi-bold">Active</PText>
            <PText size="x-small" color="contrast-medium">Tour is visible to customers</PText>
          </div>
          <PSwitch checked={isActive} hideLabel onUpdate={(e) => setIsActive(e.detail.checked)} />
        </div>

        <div className="flex items-center justify-between gap-static-md">
          <div>
            <PText size="small" weight="semi-bold">Needs Bike</PText>
            <PText size="x-small" color="contrast-medium">Customers will select bikes when booking</PText>
          </div>
          <PSwitch checked={needsBike} hideLabel onUpdate={(e) => setNeedsBike(e.detail.checked)} />
        </div>

        {needsBike && (
          <>
            <PDivider />
            <div className="flex items-center justify-between">
              <PHeading size="small" tag="h3">Allowed Bikes</PHeading>
              <PTag compact color={selectedBikeIds.size > 0 ? 'notification-success-soft' : 'notification-warning-soft'}>
                {selectedBikeIds.size} of {bikes.filter((b) => b.is_active).length} selected
              </PTag>
            </div>
            <PText size="x-small" color="contrast-medium">
              Select which bikes customers can choose from when booking this tour.
              Each person will pick their preferred bike and size.
            </PText>

            <div className="flex flex-col gap-static-xs">
              {bikesByCategory.map(({ category, bikes: catBikes }) => {
                const allSelected = catBikes.every((b) => selectedBikeIds.has(b.id));
                const someSelected = catBikes.some((b) => selectedBikeIds.has(b.id));
                const selectedCount = catBikes.filter((b) => selectedBikeIds.has(b.id)).length;

                return (
                  <PAccordion
                    key={category.id}
                    heading={`${category.name} (${selectedCount}/${catBikes.length})`}
                    tag="h4"
                    open={someSelected}
                  >
                    <div className="flex flex-col gap-static-xs">
                      <button
                        type="button"
                        onClick={() => toggleCategory(catBikes)}
                        className="flex items-center gap-static-xs text-left bg-transparent border-none cursor-pointer p-static-xs rounded-[var(--p-border-radius-sm)] hover:bg-surface transition-colors"
                      >
                        <PIcon
                          name={allSelected ? 'check' : 'add'}
                          size="x-small"
                          color={allSelected ? 'notification-success' : 'primary'}
                        />
                        <PText size="x-small" weight="semi-bold">
                          {allSelected ? 'Deselect all' : 'Select all'} {category.name}
                        </PText>
                      </button>

                      {catBikes.map((bike) => (
                        <div
                          key={bike.id}
                          className="flex items-center gap-static-sm py-static-xs px-static-sm rounded-[var(--p-border-radius-sm)] cursor-pointer hover:bg-surface transition-colors"
                          onClick={() => toggleBike(bike.id)}
                        >
                          <PCheckbox
                            label=""
                            name={`bike-${bike.id}`}
                            checked={selectedBikeIds.has(bike.id)}
                            hideLabel
                            onUpdate={() => toggleBike(bike.id)}
                          />
                          <div className="flex-1">
                            <PText size="small">{bike.name}</PText>
                            <PText size="x-small" color="contrast-medium">
                              Size {bike.size} -- {bike.price_per_day} DKK/day -- {bike.total_quantity} in stock
                            </PText>
                          </div>
                        </div>
                      ))}
                    </div>
                  </PAccordion>
                );
              })}
            </div>
          </>
        )}

        {isEdit && tour && (
          <>
            <PDivider />
            <TourDatesManager
              tour={tour}
              onCreateDate={onCreateTourDate}
              onUpdateDate={onUpdateTourDate}
              onDeleteDate={onDeleteTourDate}
              onRefresh={onRefresh}
            />
          </>
        )}
      </div>

      <div slot="footer" className="flex gap-static-sm">
        <PButton onClick={handleSave} loading={saving}>{isEdit ? 'Save Changes' : 'Create Tour'}</PButton>
        <PButton variant="secondary" onClick={onDismiss}>Cancel</PButton>
        {isEdit && tour && (
          <PButton
            variant="tertiary"
            icon="delete"
            onClick={() => {
              if (confirm('Delete this tour? This cannot be undone.')) {
                onDelete(tour.id);
              }
            }}
          >
            Delete
          </PButton>
        )}
      </div>
    </PFlyout>
  );
}
