import { createContext, useContext } from 'react';
import type { CartItem, Bike, BookingPersonSetup } from '../types';

export interface CartStore {
  items: CartItem[];
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
  pickupLocation: string;
  dropoffLocation: string;
  persons: BookingPersonSetup[];
  currentPersonIndex: number;
  setDates: (start: string, end: string) => void;
  setTimes: (startTime: string, endTime: string) => void;
  setLocations: (pickup: string, dropoff: string) => void;
  setPersons: (persons: BookingPersonSetup[]) => void;
  setCurrentPersonIndex: (index: number) => void;
  addItem: (bike: Bike, quantity?: number, personIndex?: number) => void;
  removeItem: (bikeId: string, personIndex?: number) => void;
  updateQuantity: (bikeId: string, quantity: number, personIndex?: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  rentalDays: number;
}

export const CartContext = createContext<CartStore>({
  items: [],
  startDate: '',
  endDate: '',
  startTime: '09:00',
  endTime: '09:00',
  startAt: '',
  endAt: '',
  pickupLocation: 'torshavn',
  dropoffLocation: 'torshavn',
  persons: [],
  currentPersonIndex: 0,
  setDates: () => {},
  setTimes: () => {},
  setLocations: () => {},
  setPersons: () => {},
  setCurrentPersonIndex: () => {},
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  totalItems: 0,
  totalPrice: 0,
  rentalDays: 0,
});

export const useCart = () => useContext(CartContext);
