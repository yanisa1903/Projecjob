import { useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import * as Popover from '@radix-ui/react-popover';
import 'react-day-picker/dist/style.css';

interface DatePickerProps {
  placeholder: string;
  selected?: Date;
  onSelect: (date: Date | undefined) => void;
  minDate?: Date;
}

export default function DatePicker({ placeholder, selected, onSelect, minDate }: DatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="w-full min-h-11 text-left pl-3 pr-8 py-2.5 bg-gray-100 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#1F2E7A] relative">
          {selected ? format(selected, 'd MMM yyyy', { locale: th }) : placeholder}
          <CalendarIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 z-50 w-[min(320px,calc(100vw-1rem))] max-w-[calc(100vw-1rem)]"
          sideOffset={5}
          align="start"
        >
          <style>{`
            .rdp {
              --rdp-cell-size: 38px;
              --rdp-accent-color: #1F2E7A;
              --rdp-background-color: #E8EAF6;
              margin: 0;
            }
            .rdp-months {
              justify-content: center;
            }
            .rdp-caption {
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 0;
              margin-bottom: 12px;
            }
            .rdp-caption_label {
              font-size: 14px;
              font-weight: 600;
              color: #1F2E7A;
            }
            .rdp-nav {
              position: absolute;
              top: 0;
              right: 0;
              left: 0;
              display: flex;
              justify-content: space-between;
            }
            .rdp-nav_button {
              width: 32px;
              height: 32px;
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #1F2E7A;
              background: transparent;
              border: none;
              cursor: pointer;
            }
            .rdp-nav_button:hover {
              background-color: #F5F6FA;
            }
            .rdp-head_cell {
              font-size: 12px;
              font-weight: 600;
              color: #666;
              text-transform: uppercase;
            }
            .rdp-cell {
              padding: 2px;
            }
            .rdp-day {
              width: 100%;
              height: 100%;
              border-radius: 8px;
              font-size: 13px;
              border: none;
              background: transparent;
              cursor: pointer;
              transition: all 0.15s;
            }
            .rdp-day:hover:not(.rdp-day_selected):not(.rdp-day_disabled) {
              background-color: #F5F6FA;
              color: #1F2E7A;
            }
            .rdp-day_selected {
              background-color: #1F2E7A !important;
              color: white !important;
              font-weight: 600;
            }
            .rdp-day_today:not(.rdp-day_selected) {
              color: #1F2E7A;
              font-weight: 600;
              background-color: #E8EAF6;
            }
            .rdp-day_disabled {
              color: #ccc;
              cursor: not-allowed;
            }
            .rdp-day_outside {
              color: #ccc;
            }
          `}</style>
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(date) => {
              onSelect(date);
              setOpen(false);
            }}
            disabled={minDate ? { before: minDate } : undefined}
            locale={th}
            defaultMonth={selected || minDate || new Date()}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
