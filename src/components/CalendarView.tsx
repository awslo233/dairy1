'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getEntries } from '@/lib/storage';
import type { JournalEntry } from '@/lib/types';

interface CalendarViewProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function CalendarView({ selectedDate, onSelectDate }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = selectedDate ? new Date(selectedDate) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const entriesWithDates = useMemo(() => {
    const entries = getEntries();
    const dateSet = new Set<string>();
    entries.forEach((e: JournalEntry) => {
      dateSet.add(e.createdAt.split('T')[0]);
    });
    return dateSet;
  }, []);

  const days = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const result: { date: string; day: number; isCurrentMonth: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      result.push({
        date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isCurrentMonth: false,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      result.push({
        date: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isCurrentMonth: true,
      });
    }

    const remaining = 42 - result.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      result.push({
        date: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isCurrentMonth: false,
      });
    }

    return result;
  }, [currentMonth]);

  const today = new Date().toISOString().split('T')[0];

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  return (
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <Button variant="ghost" size="icon-sm" onClick={prevMonth} className="rounded-lg">
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-medium">
          {currentMonth.getFullYear()}年{currentMonth.getMonth() + 1}月
        </span>
        <Button variant="ghost" size="icon-sm" onClick={nextMonth} className="rounded-lg">
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-xs text-muted-foreground py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(({ date, day, isCurrentMonth }) => {
          const isSelected = date === selectedDate;
          const isToday = date === today;
          const hasEntry = entriesWithDates.has(date);

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={cn(
                'relative h-8 w-full rounded-lg text-xs transition-all duration-200 flex items-center justify-center',
                !isCurrentMonth && 'text-muted-foreground/40',
                isSelected && 'bg-primary text-primary-foreground font-medium',
                isToday && !isSelected && 'ring-1 ring-primary/30',
                !isSelected && isCurrentMonth && 'hover:bg-accent'
              )}
            >
              {day}
              {hasEntry && !isSelected && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 size-1 rounded-full bg-primary/60" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
