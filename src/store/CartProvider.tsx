import { useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { CartContext } from './cartStore';
import type { CartItem, Bike, BookingPersonSetup } from '../types';
import { buildDatetime, computeRentalDays } from '../utils/rentalDuration';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:00');
  const [pickupLocation, setPickupLocation] = useState('torshavn');
  const [dropoffLocation, setDropoffLocation] = useState('torshavn');
  const [persons, setPersonsState] = useState<BookingPersonSetup[]>([]);
  const [currentPersonIndex, setCurrentPersonIndex] = useState(0);

  const startAt = useMemo(
    () => (startDate && startTime ? buildDatetime(startDate, startTime) : ''),
    [startDate, startTime]
  );
  const endAt = useMemo(
    () => (endDate && endTime ? buildDatetime(endDate, endTime) : ''),
    [endDate, endTime]
  );
  const rentalDays = useMemo(() => computeRentalDays(startAt, endAt), [startAt, endAt]);
  const totalItems = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const totalPrice = useMemo(
    () => items.reduce((sum, item) => sum + item.bike.price_per_day * item.quantity * rentalDays, 0),
    [items, rentalDays]
  );

  const personsRef = useRef(persons);
  personsRef.current = persons;

  const setDates = useCallback((start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  }, []);

  const setTimes = useCallback((st: string, et: string) => {
    setStartTime(st);
    setEndTime(et);
  }, []);

  const setLocations = useCallback((pickup: string, dropoff: string) => {
    setPickupLocation(pickup);
    setDropoffLocation(dropoff);
  }, []);

  const setPersons = useCallback((newPersons: BookingPersonSetup[]) => {
    const prev = personsRef.current;
    const changed =
      newPersons.length !== prev.length ||
      newPersons.some(
        (p, i) =>
          p.name !== prev[i]?.name ||
          p.accessoriesOnly !== prev[i]?.accessoriesOnly
      );
    setPersonsState(newPersons);
    if (changed) {
      setItems([]);
      setCurrentPersonIndex(0);
    }
  }, []);

  const addItem = useCallback((bike: Bike, quantity = 1, personIndex?: number) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.bike.id === bike.id && i.personIndex === personIndex
      );
      if (existing) {
        return prev.map((i) =>
          i.bike.id === bike.id && i.personIndex === personIndex
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { bike, quantity, personIndex }];
    });
  }, []);

  const removeItem = useCallback((bikeId: string, personIndex?: number) => {
    setItems((prev) =>
      prev.filter((i) => !(i.bike.id === bikeId && i.personIndex === personIndex))
    );
  }, []);

  const updateQuantity = useCallback((bikeId: string, quantity: number, personIndex?: number) => {
    if (quantity <= 0) {
      setItems((prev) =>
        prev.filter((i) => !(i.bike.id === bikeId && i.personIndex === personIndex))
      );
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.bike.id === bikeId && i.personIndex === personIndex ? { ...i, quantity } : i
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setPersonsState([]);
    setCurrentPersonIndex(0);
    setStartDate('');
    setEndDate('');
    setStartTime('09:00');
    setEndTime('09:00');
    setPickupLocation('torshavn');
    setDropoffLocation('torshavn');
  }, []);

  const contextValue = useMemo(
    () => ({
      items,
      startDate,
      endDate,
      startTime,
      endTime,
      startAt,
      endAt,
      pickupLocation,
      dropoffLocation,
      persons,
      currentPersonIndex,
      setDates,
      setTimes,
      setLocations,
      setPersons,
      setCurrentPersonIndex,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      rentalDays,
    }),
    [
      items, startDate, endDate, startTime, endTime, startAt, endAt,
      pickupLocation, dropoffLocation, persons, currentPersonIndex,
      setDates, setTimes, setLocations, setPersons,
      addItem, removeItem, updateQuantity, clearCart,
      totalItems, totalPrice, rentalDays,
    ]
  );

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
}
