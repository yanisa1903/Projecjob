import { useEffect, useRef, useState } from 'react';
import { MapPin, Search, Tag } from 'lucide-react';
import { usePlaceSearch, type PlaceSearchOption } from '../hooks/usePlaceSearch';
import type { PlaceDetails } from '../services/placesApi';

interface PlaceSearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (place: PlaceDetails) => void;
  onExplore: (option: PlaceSearchOption) => void;
  onSearch: (query: string) => void;
  placeholder?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  containerClassName?: string;
  searchButtonClassName?: string;
  showSearchButton?: boolean;
}

export function PlaceSearchBox({
  value,
  onChange,
  onPlaceSelect,
  onExplore,
  onSearch,
  placeholder = 'ค้นหาสถานที่ จังหวัด หรือประเภทสถานที่',
  inputClassName = '',
  dropdownClassName = '',
  containerClassName = '',
  searchButtonClassName = '',
  showSearchButton = true,
}: PlaceSearchBoxProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectionError, setSelectionError] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const { options, isLoading, error } = usePlaceSearch(value, isOpen);
  const listId = 'place-search-suggestions';

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const chooseOption = async (option: PlaceSearchOption) => {
    if (option.kind !== 'place') {
      setIsOpen(false);
      setActiveIndex(-1);
      onChange(option.label);
      onExplore(option);
      return;
    }

    setIsSelecting(true);
    setSelectionError('');
    try {
      if (!Number.isFinite(option.latitude) || !Number.isFinite(option.longitude)) {
        throw new Error('ผลการค้นหานี้ไม่มีพิกัดสถานที่');
      }
      setIsOpen(false);
      setActiveIndex(-1);
      onChange(option.label);
      onPlaceSelect({
        id: option.id,
        name: option.label,
        address: option.subtitle,
        latitude: option.latitude,
        longitude: option.longitude,
        types: option.types || [],
        photos: [],
        rating: option.rating,
        userRatingCount: option.reviewCount,
      });
    } catch (cause) {
      setSelectionError(cause instanceof Error ? cause.message : 'ไม่สามารถโหลดรายละเอียดสถานที่ได้');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!isOpen) setIsOpen(true);
      if (options.length > 0) {
        event.preventDefault();
        setActiveIndex((current) => event.key === 'ArrowDown'
          ? (current + 1) % options.length
          : current <= 0 ? options.length - 1 : current - 1);
      }
      return;
    }
    if (event.key === 'Enter' && activeIndex >= 0 && options[activeIndex]) {
      event.preventDefault();
      void chooseOption(options[activeIndex]);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = value.trim();
    if (query) {
      setIsOpen(false);
      onSearch(query);
    }
  };

  const grouped = (kind: PlaceSearchOption['kind']) => options.filter((option) => option.kind === kind);
  let optionIndex = 0;

  return (
    <div ref={rootRef} className={`relative w-full ${containerClassName}`}>
      <form onSubmit={handleSubmit} role="search">
        <div className="relative">
          <input
            ref={inputRef}
            value={value}
            onChange={(event) => {
              setSelectionError('');
              onChange(event.target.value);
              setIsOpen(true);
              setActiveIndex(-1);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={inputClassName}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen && value.trim().length >= 2}
            aria-controls={listId}
            aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
            autoComplete="off"
          />
          {showSearchButton && (
            <button
              type="submit"
              aria-label="ค้นหาสถานที่"
              className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 ${searchButtonClassName}`}
            >
              <Search size={18} />
            </button>
          )}
        </div>
      </form>
      {isOpen && value.trim().length >= 2 && (
        <div
          id={listId}
          role="listbox"
          className={`absolute left-0 right-0 top-full z-[100] mt-2 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white py-2 text-slate-800 shadow-xl ${dropdownClassName}`}
        >
          {(['province', 'category', 'place'] as const).map((kind) => {
            const entries = grouped(kind);
            if (entries.length === 0) return null;
            const title = kind === 'province'
              ? 'จังหวัด'
              : kind === 'category'
                ? 'ประเภทสถานที่'
                : 'สถานที่ท่องเที่ยวที่ตรงกับคำค้นหา';
            return (
              <section key={kind} aria-label={title}>
                <div className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</div>
                {entries.map((option) => {
                  const index = optionIndex++;
                  const Icon = kind === 'province' ? MapPin : kind === 'category' ? Tag : Search;
                  return (
                    <button
                      key={`${option.kind}:${option.id}`}
                      id={`${listId}-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={activeIndex === index}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => void chooseOption(option)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${
                        activeIndex === index ? 'bg-blue-50 text-blue-800' : 'hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={17} aria-hidden="true" className="shrink-0 text-blue-600" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{option.label}</span>
                        {option.subtitle && <span className="block truncate text-xs text-slate-500">{option.subtitle}</span>}
                      </span>
                    </button>
                  );
                })}
              </section>
            );
          })}
          {isLoading && (
            <div className="px-4 py-3 text-sm text-slate-500" role="status">กำลังค้นหาสถานที่...</div>
          )}
          {(error || selectionError) && (
            <div className="px-4 py-3 text-sm text-red-600" role="alert">{selectionError || error}</div>
          )}
          {isSelecting && (
            <div className="px-4 py-3 text-sm text-slate-500" role="status">กำลังโหลดรายละเอียดสถานที่...</div>
          )}
          {!isLoading && !error && !selectionError && !isSelecting && options.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-500">ไม่พบสถานที่</div>
          )}
          {options.some((option) => option.kind === 'place' && option.id.startsWith('osm:')) && (
            <div className="border-t border-slate-100 px-4 pt-2 text-[11px] text-slate-400">
              ข้อมูลแผนที่ © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
