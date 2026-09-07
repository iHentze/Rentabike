import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PButtonPure, PIcon, PText } from '@porsche-design-system/components-react';
import {
  borderRadiusLarge,
  borderRadiusMedium,
  borderRadiusSmall,
  spacingStaticSmall,
  spacingStaticMedium,
  dropShadowHighStyle,
  motionDurationShort,
  motionEasingBase,
  motionEasingIn,
  themeLightBackgroundBase,
  themeLightPrimary,
  themeLightContrastLow,
  themeLightContrastMedium,
  themeLightStateHover,
  themeLightStateDisabled,
} from '@porsche-design-system/components-react/styles';

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface CalendarPickerProps {
  label: string;
  value: string;
  min?: string;
  max?: string;
  state?: 'none' | 'error';
  message?: string;
  onChange: (value: string) => void;
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstWeekday(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1;
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseDate(dateStr);
  if (!d) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function CalendarPicker({ label, value, min, max, state, message, onChange }: CalendarPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDate(value);
  const minDate = parseDate(min || '');
  const maxDate = parseDate(max || '');

  const initialMonth = selected || new Date();
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth());

  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (open && selected) {
      setViewYear(selected.getFullYear());
      setViewMonth(selected.getMonth());
    }
  }, [open, selected]);

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 300),
      });
    }
  }, [open]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    const target = e.target as Node;
    if (
      containerRef.current && !containerRef.current.contains(target) &&
      panelRef.current && !panelRef.current.contains(target)
    ) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, handleClickOutside]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [open]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function selectDay(day: number) {
    const d = new Date(viewYear, viewMonth, day);
    onChange(toYMD(d));
    setOpen(false);
  }

  function isDisabled(day: number): boolean {
    const d = new Date(viewYear, viewMonth, day);
    if (minDate && d < minDate) return true;
    if (maxDate && d > maxDate) return true;
    return false;
  }

  function isSelected(day: number): boolean {
    if (!selected) return false;
    return isSameDay(new Date(viewYear, viewMonth, day), selected);
  }

  function isToday(day: number): boolean {
    return isSameDay(new Date(viewYear, viewMonth, day), new Date());
  }

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstWeekday = getFirstWeekday(viewYear, viewMonth);

  const hasError = state === 'error';

  return (
    <div ref={containerRef}>
      <label
        style={{
          display: 'block',
          fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
          fontSize: '14px',
          fontWeight: 400,
          lineHeight: 'calc(6px + 2.125ex)',
          color: 'var(--p-color-contrast-high)',
          marginBottom: '2px',
        }}
      >
        {label}
      </label>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacingStaticSmall,
          padding: '11px 12px',
          borderRadius: borderRadiusSmall,
          border: hasError
            ? '2px solid var(--p-color-notification-error)'
            : open
              ? '2px solid var(--p-color-state-focus)'
              : '2px solid var(--p-color-contrast-medium)',
          backgroundColor: 'var(--p-color-background-base)',
          cursor: 'pointer',
          fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
          fontSize: '16px',
          lineHeight: 'calc(6px + 2.125ex)',
          color: value ? 'var(--p-color-primary)' : 'var(--p-color-contrast-medium)',
          textAlign: 'left',
          transition: `border-color ${motionDurationShort} ${motionEasingBase}`,
          outline: 'none',
        }}
      >
        <span>{value ? formatDisplay(value) : 'Select date'}</span>
        <PIcon name="calendar" size="small" color={open ? 'primary' : 'contrast-medium'} />
      </button>
      {hasError && message && (
        <PText size="x-small" color="notification-error" style={{ marginTop: '4px' }}>
          {message}
        </PText>
      )}

      {createPortal(
      <div
        ref={panelRef}
        style={{
          position: 'fixed',
          top: panelPos.top,
          left: panelPos.left,
          width: panelPos.width,
          minWidth: '300px',
          zIndex: 9999,
          backgroundColor: themeLightBackgroundBase,
          borderRadius: borderRadiusLarge,
          ...dropShadowHighStyle,
          border: `1px solid ${themeLightContrastLow}`,
          overflow: 'hidden',
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0)' : 'translateY(-8px)',
          pointerEvents: open ? 'auto' : 'none',
          transition: `opacity ${motionDurationShort} ${motionEasingIn}, transform ${motionDurationShort} ${motionEasingIn}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${spacingStaticSmall} ${spacingStaticMedium}`,
            borderBottom: `1px solid ${themeLightContrastLow}`,
          }}
        >
          <PButtonPure icon="arrow-left" hideLabel onClick={prevMonth}>Previous month</PButtonPure>
          <span
            style={{
              fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
              fontSize: '14px',
              fontWeight: 600,
              color: themeLightPrimary,
            }}
          >
            {MONTH_LABELS[viewMonth]} {viewYear}
          </span>
          <PButtonPure icon="arrow-right" hideLabel onClick={nextMonth}>Next month</PButtonPure>
        </div>

        <div style={{ padding: spacingStaticMedium }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '2px',
              marginBottom: spacingStaticSmall,
            }}
          >
            {WEEKDAY_LABELS.map((wd) => (
              <div
                key={wd}
                style={{
                  textAlign: 'center',
                  fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
                  fontSize: '11px',
                  fontWeight: 700,
                  color: themeLightContrastMedium,
                  padding: '4px 0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {wd}
              </div>
            ))}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '2px',
            }}
          >
            {Array.from({ length: firstWeekday }, (_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const disabled = isDisabled(day);
              const sel = isSelected(day);
              const today = isToday(day);
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => selectDay(day)}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: borderRadiusMedium,
                    border: today && !sel ? `1px solid ${themeLightContrastLow}` : '1px solid transparent',
                    backgroundColor: sel
                      ? themeLightPrimary
                      : 'transparent',
                    color: sel
                      ? themeLightBackgroundBase
                      : disabled
                        ? themeLightStateDisabled
                        : themeLightPrimary,
                    fontFamily: "'Porsche Next','Arial Narrow',Arial,sans-serif",
                    fontSize: '14px',
                    fontWeight: sel ? 700 : 400,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: `background ${motionDurationShort} ${motionEasingBase}, color ${motionDurationShort} ${motionEasingBase}`,
                    outline: 'none',
                  }}
                  onMouseEnter={(e) => {
                    if (!disabled && !sel) {
                      e.currentTarget.style.backgroundColor = themeLightStateHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!sel) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: `${spacingStaticSmall} ${spacingStaticMedium}`,
            borderTop: `1px solid ${themeLightContrastLow}`,
          }}
        >
          <PButtonPure
            size="x-small"
            icon="calendar"
            onClick={() => {
              const now = new Date();
              onChange(toYMD(now));
              setOpen(false);
            }}
          >
            Today
          </PButtonPure>
        </div>
      </div>, document.body)}
    </div>
  );
}
