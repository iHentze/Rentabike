import { PText, PTag } from '@porsche-design-system/components-react';
import type { Booking, BookingPerson } from '../../../types';

export function GroupItemsCell({ booking }: { booking: Booking }) {
  const persons: BookingPerson[] = (booking.persons || []).sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const isGroup = persons.length > 1;

  if (!booking.items || booking.items.length === 0) return null;

  if (!isGroup) {
    return (
      <>
        {booking.items.map((item) => (
          <PText key={item.id} size="x-small">
            {item.quantity}x {item.bike?.name}
            {item.bike?.size ? ` (${item.bike.size})` : ''}
          </PText>
        ))}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-static-xs">
      <div className="mb-[2px]">
        <PTag variant="info" compact icon="group">
          {persons.length} people
        </PTag>
      </div>
      {persons.map((person) => {
        const pItems = (booking.items || []).filter((i) => i.person_id === person.id);
        if (pItems.length === 0) return null;
        return (
          <div key={person.id}>
            <PText size="x-small" weight="semi-bold" color="contrast-medium">
              {person.person_label}
            </PText>
            {pItems.map((item) => (
              <PText key={item.id} size="x-small">
                {item.quantity}x {item.bike?.name}
                {item.bike?.size ? ` (${item.bike.size})` : ''}
              </PText>
            ))}
          </div>
        );
      })}
      {(booking.items || [])
        .filter((i) => !i.person_id)
        .map((item) => (
          <PText key={item.id} size="x-small" color="contrast-medium">
            {item.quantity}x {item.bike?.name} (general)
          </PText>
        ))}
    </div>
  );
}
