import React, { useEffect, useMemo, useRef, useState } from "react";

const WEEK_DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatDateValue(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateValue(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDisplayDate(value) {
  const date = parseDateValue(value);
  if (!date) return "";
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function sameDate(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function buildCalendarDays(monthDate) {
  const firstDay = startOfMonth(monthDate);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const firstCell = new Date(firstDay);
  firstCell.setDate(firstDay.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCell);
    date.setDate(firstCell.getDate() + index);
    return date;
  });
}

function isBeforeMin(date, minDate) {
  if (!minDate) return false;
  const current = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const minimum = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
  return current < minimum;
}

export default function CalendarDatePicker({
  value,
  onChange,
  min,
  required = false,
  placeholder = "Selectionner une date"
}) {
  const rootRef = useRef(null);
  const selectedDate = parseDateValue(value);
  const minDate = parseDateValue(min);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(selectedDate || new Date()));

  useEffect(() => {
    if (selectedDate) {
      setVisibleMonth(startOfMonth(selectedDate));
    }
  }, [value]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const days = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const monthLabel = visibleMonth.toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric"
  });
  const today = new Date();

  const selectDate = (date) => {
    if (isBeforeMin(date, minDate)) return;
    onChange(formatDateValue(date));
    setIsOpen(false);
  };

  return (
    <div className="calendar-date-picker" ref={rootRef}>
      <div className="calendar-date-picker__control">
        <input
          type="text"
          value={formatDisplayDate(value)}
          onClick={() => setIsOpen(true)}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          required={required}
          readOnly
        />
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-label="Ouvrir le calendrier"
        >
          v
        </button>
      </div>

      {isOpen && (
        <div className="calendar-date-picker__popover">
          <div className="calendar-date-picker__header">
            <button
              type="button"
              onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
              aria-label="Mois precedent"
            >
              {"<"}
            </button>
            <strong>{monthLabel}</strong>
            <button
              type="button"
              onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
              aria-label="Mois suivant"
            >
              {">"}
            </button>
          </div>

          <div className="calendar-date-picker__weekdays">
            {WEEK_DAYS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar-date-picker__grid">
            {days.map((date) => {
              const dateValue = formatDateValue(date);
              const isDisabled = isBeforeMin(date, minDate);
              return (
                <button
                  key={dateValue}
                  type="button"
                  className={[
                    "calendar-date-picker__day",
                    date.getMonth() !== visibleMonth.getMonth()
                      ? "calendar-date-picker__day--muted"
                      : "",
                    sameDate(date, selectedDate) ? "calendar-date-picker__day--selected" : "",
                    sameDate(date, today) ? "calendar-date-picker__day--today" : ""
                  ].filter(Boolean).join(" ")}
                  onClick={() => selectDate(date)}
                  disabled={isDisabled}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
