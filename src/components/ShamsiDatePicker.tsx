import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  g_to_j,
  j_to_g,
  getJalaliMonthDays,
  getPersianWeekdayIndex,
  JALALI_MONTH_NAMES,
  WEEKDAYS_SHORT,
  toPersianDigits,
  parseGregorianToJalali,
  parseJalaliToGregorian,
  formatJalaliReadable
} from '../lib/shamsi';

interface ShamsiDatePickerProps {
  value: string | null; // Gregorian YYYY-MM-DD
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  clearable?: boolean;
}

export default function ShamsiDatePicker({
  value,
  onChange,
  placeholder = 'انتخاب تاریخ شمسی',
  className = '',
  clearable = true,
}: ShamsiDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert current input Gregorian value to Jalali parts
  const currentJalali = useMemo(() => {
    if (!value) return null;
    const jStr = parseGregorianToJalali(value);
    if (!jStr) return null;
    const parts = jStr.split('-');
    return {
      year: parseInt(parts[0], 10),
      month: parseInt(parts[1], 10),
      day: parseInt(parts[2], 10),
    };
  }, [value]);

  // Today in Jalali
  const todayJalali = useMemo(() => {
    const d = new Date();
    const [jy, jm, jd] = g_to_j(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return { year: jy, month: jm, day: jd };
  }, []);

  // Calendar navigator state (year & month shown in calendar)
  const [navYear, setNavYear] = useState<number>(todayJalali.year);
  const [navMonth, setNavMonth] = useState<number>(todayJalali.month);

  // Sync calendar nav view when value changes or when opened
  useEffect(() => {
    if (isOpen) {
      if (currentJalali) {
        setNavYear(currentJalali.year);
        setNavMonth(currentJalali.month);
      } else {
        setNavYear(todayJalali.year);
        setNavMonth(todayJalali.month);
      }
    }
  }, [isOpen, currentJalali, todayJalali]);

  // Close calendar when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute calendar grid days
  const calendarDays = useMemo(() => {
    const daysInMonth = getJalaliMonthDays(navYear, navMonth);
    // Find weekday of 1st day of month
    const [gy, gm, gd] = j_to_g(navYear, navMonth, 1);
    const dateOfFirst = new Date(gy, gm - 1, gd);
    const weekdayIndex = getPersianWeekdayIndex(dateOfFirst.getDay());

    const list: Array<{ day: number | null; isToday: boolean; isSelected: boolean }> = [];

    // Empty spaces for padding
    for (let i = 0; i < weekdayIndex; i++) {
      list.push({ day: null, isToday: false, isSelected: false });
    }

    // Days of current month
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday =
        todayJalali.year === navYear &&
        todayJalali.month === navMonth &&
        todayJalali.day === d;

      const isSelected = !!(
        currentJalali &&
        currentJalali.year === navYear &&
        currentJalali.month === navMonth &&
        currentJalali.day === d
      );

      list.push({ day: d, isToday, isSelected });
    }

    return list;
  }, [navYear, navMonth, todayJalali, currentJalali]);

  const handlePrevMonth = () => {
    if (navMonth === 1) {
      setNavMonth(12);
      setNavYear((y) => y - 1);
    } else {
      setNavMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (navMonth === 12) {
      setNavMonth(1);
      setNavYear((y) => y + 1);
    } else {
      setNavMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const jStr = `${navYear}-${String(navMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const gStr = parseJalaliToGregorian(jStr);
    onChange(gStr);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setIsOpen(false);
  };

  const displayLabel = useMemo(() => {
    if (!value) return placeholder;
    const jStr = parseGregorianToJalali(value);
    return formatJalaliReadable(jStr);
  }, [value, placeholder]);

  return (
    <div className={`relative inline-block text-right ${className}`} ref={containerRef} dir="rtl">
      {/* Input Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-sans font-bold text-slate-800 cursor-pointer shadow-sm hover:border-orange-400 hover:bg-slate-50/50 transition-all select-none min-w-[130px]"
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-orange-500 shrink-0" />
          <span className="truncate">{displayLabel}</span>
        </div>
        {clearable && value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 hover:text-red-500 p-0.5 rounded-md hover:bg-slate-100 transition-colors"
            title="حذف تاریخ"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className="absolute z-[9999] mt-2 left-0 md:left-auto md:right-0 bg-white border border-slate-200/80 rounded-2xl shadow-xl p-4 w-[280px] animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header Month/Year Selector */}
          <div className="flex items-center justify-between gap-1 mb-4">
            <button
              type="button"
              onClick={handleNextMonth} // Forward months go Left in RTL
              className="p-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 text-slate-500 hover:text-orange-600 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 font-extrabold text-slate-800 text-xs">
              <select
                value={navMonth}
                onChange={(e) => setNavMonth(parseInt(e.target.value, 10))}
                className="bg-transparent border-0 py-1 font-bold text-slate-800 focus:ring-0 focus:outline-none cursor-pointer hover:text-orange-600"
              >
                {JALALI_MONTH_NAMES.map((name, idx) => (
                  <option key={name} value={idx + 1}>
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={navYear}
                onChange={(e) => setNavYear(parseInt(e.target.value, 10))}
                className="bg-transparent border-0 py-1 font-sans font-bold text-slate-800 focus:ring-0 focus:outline-none cursor-pointer hover:text-orange-600"
              >
                {Array.from({ length: 30 }, (_, i) => todayJalali.year - 15 + i).map((y) => (
                  <option key={y} value={y}>
                    {toPersianDigits(y)}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handlePrevMonth} // Backward months go Right in RTL
              className="p-1.5 rounded-lg border border-slate-100 hover:bg-slate-50 text-slate-500 hover:text-orange-600 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Labels Grid */}
          <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-400 mb-2 gap-1 border-b border-slate-100 pb-1.5">
            {WEEKDAYS_SHORT.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 text-center gap-1">
            {calendarDays.map((item, idx) => {
              if (item.day === null) {
                return <div key={`empty-${idx}`} className="py-1.5" />;
              }

              return (
                <button
                  key={`day-${item.day}`}
                  type="button"
                  onClick={() => handleSelectDay(item.day!)}
                  className={`py-1.5 rounded-lg text-xs font-sans font-bold transition-all cursor-pointer relative ${
                    item.isSelected
                      ? 'bg-orange-500 text-white font-black shadow-sm'
                      : item.isToday
                      ? 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {toPersianDigits(item.day)}
                  {item.isToday && !item.isSelected && (
                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-orange-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Today fast button */}
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const jStr = `${todayJalali.year}-${String(todayJalali.month).padStart(2, '0')}-${String(todayJalali.day).padStart(2, '0')}`;
                const gStr = parseJalaliToGregorian(jStr);
                onChange(gStr);
                setIsOpen(false);
              }}
              className="text-[10px] font-extrabold text-orange-600 hover:text-orange-700 transition-colors"
            >
              برو به امروز ({toPersianDigits(todayJalali.day)} {JALALI_MONTH_NAMES[todayJalali.month - 1]})
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
            >
              بستن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
