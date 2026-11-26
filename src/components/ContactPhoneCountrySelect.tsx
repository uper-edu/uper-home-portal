import {useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent} from 'react';
import {ChevronDown, Search} from 'lucide-react';
import type {CountryCode} from 'libphonenumber-js/max';

const copy = {
  zh: {label: '国家或地区区号', search: '搜索国家、地区或区号', empty: '没有匹配的国家或地区'},
  en: {label: 'Country or region calling code', search: 'Search country, region or code', empty: 'No matching countries or regions'},
  id: {label: 'Kode negara atau wilayah', search: 'Cari negara, wilayah, atau kode', empty: 'Tidak ada negara atau wilayah yang cocok'},
};

export function ContactPhoneCountrySelect({countries, country, code, language, disabled, onChange}: {
  countries: ReadonlyArray<{country: CountryCode; code: string}>;
  country: CountryCode | '';
  code: string;
  language: keyof typeof copy;
  disabled?: boolean;
  onChange: (country: CountryCode) => void;
}) {
  const id = useId();
  const text = copy[language];
  const trigger = useRef<HTMLButtonElement>(null);
  const popup = useRef<HTMLSpanElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLSpanElement>(null);
  const focusSearch = useRef(false);
  const [open, setOpen] = useState(false);
  const [openedOnce, setOpenedOnce] = useState(false);
  const [query, setQuery] = useState('');
  const names = useMemo(() => typeof Intl.DisplayNames === 'function'
    ? new Intl.DisplayNames([language], {type: 'region'}) : undefined, [language]);
  const options = useMemo(() => {
    if (!openedOnce) return [];
    const english = names && language !== 'en' ? new Intl.DisplayNames(['en'], {type: 'region'}) : names;
    const compare = new Intl.Collator(language).compare;
    return countries.map(option => {
      const name = names?.of(option.country) ?? option.country;
      return {...option, name, terms: `${name} ${english?.of(option.country) ?? ''} ${option.country} +${option.code}`.toLocaleLowerCase(language)};
    }).sort((a, b) => compare(a.name, b.name));
  }, [countries, language, names, openedOnce]);
  const term = query.trim().toLocaleLowerCase(language);
  const expanded = open && !disabled;
  const visible = expanded && term ? options.filter(option => option.terms.includes(term)) : options;

  useLayoutEffect(() => {
    const panel = popup.current;
    if (!expanded || !panel) return;
    const viewport = window.visualViewport;
    const place = () => {
      const bounds = trigger.current?.getBoundingClientRect();
      if (!bounds) return;
      const margin = 8;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const width = Math.min(304, (viewport?.width ?? window.innerWidth) - 2 * margin);
      const bottom = top + (viewport?.height ?? window.innerHeight);
      const anchorTop = Math.min(bounds.top, bottom);
      const anchorBottom = Math.max(bounds.bottom, top);
      const below = bottom - anchorBottom - 2 * margin;
      const above = anchorTop - top - 2 * margin;
      const upward = below < 310 && above > below;
      const height = Math.min(310, Math.max(0, upward ? above : below));
      panel.style.width = width + 'px';
      panel.style.left = Math.max(left + margin, Math.min(bounds.left, left + (viewport?.width ?? window.innerWidth) - width - margin)) + 'px';
      panel.style.maxHeight = height + 'px';
      panel.style.top = (upward ? anchorTop - margin - panel.offsetHeight : anchorBottom + margin) + 'px';
    };
    const dismiss = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!trigger.current?.contains(target) && !panel.contains(target)) setOpen(false);
    };
    place();
    const resize = new ResizeObserver(place);
    resize.observe(panel);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    viewport?.addEventListener('resize', place);
    viewport?.addEventListener('scroll', place);
    document.addEventListener('pointerdown', dismiss);
    if (focusSearch.current) search.current?.focus({preventScroll: true});
    const selectedRow = list.current?.querySelector('[aria-selected="true"]');
    if (list.current && selectedRow) {
      list.current.scrollTop = selectedRow.getBoundingClientRect().top - list.current.getBoundingClientRect().top;
    }
    return () => {
      resize.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      viewport?.removeEventListener('resize', place);
      viewport?.removeEventListener('scroll', place);
      document.removeEventListener('pointerdown', dismiss);
    };
  }, [expanded]);

  function close() {
    setOpen(false);
    trigger.current?.focus({preventScroll: true});
  }

  function show(focus: boolean) {
    focusSearch.current = focus;
    setQuery('');
    setOpenedOnce(true);
    setOpen(true);
  }

  function navigate(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }
    if (event.nativeEvent.isComposing) return;
    const inSearch = event.target === search.current;
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(event.key) &&
        (inSearch || !['Home', 'End'].includes(event.key))) return;
    event.preventDefault();
    const rows = Array.from(list.current?.querySelectorAll('button') ?? []);
    if (!rows.length) return;
    if (event.key === 'Enter') {
      const active = rows.find(row => row === document.activeElement);
      if (active || rows.length === 1) {
        (active ?? rows[0]).click();
        return;
      }
    }
    const current = rows.indexOf(document.activeElement as HTMLButtonElement);
    const index = event.key === 'End' ? rows.length - 1
      : event.key === 'ArrowUp' ? Math.max(0, current < 0 ? rows.length - 1 : current - 1)
      : event.key === 'ArrowDown' ? Math.min(rows.length - 1, current + 1) : 0;
    rows[index].focus();
  }

  const selectedName = country && (names?.of(country) ?? country);
  return <span className="contact-phone-country"
    onBlur={event => {
      if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
    <button ref={trigger} type="button" className="contact-phone-country-trigger" disabled={disabled}
      aria-label={`${text.label}: +${code}${selectedName ? ' · ' + selectedName : ''}`}
      aria-haspopup="dialog" aria-expanded={expanded} aria-controls={expanded ? id : undefined}
      onClick={event => expanded ? close() : show(event.detail === 0 || !window.matchMedia('(pointer: coarse)').matches)}
      onKeyDown={event => {
        if (event.key === 'Escape' && expanded) navigate(event);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          if (expanded) navigate(event);
          else show(true);
        }
      }}>
      +{code}<ChevronDown size={14} aria-hidden="true"/>
    </button>
    {expanded && <span ref={popup} id={id} className="contact-phone-country-popup" role="dialog"
      aria-label={text.label} onKeyDown={navigate}>
      <span className="contact-phone-country-search">
        <Search size={16} aria-hidden="true"/>
        <input type="search" ref={search} value={query} aria-label={text.search} placeholder={text.search}
          autoComplete="off" onChange={event => {
            setQuery(event.target.value);
            if (list.current) list.current.scrollTop = 0;
          }}/>
      </span>
      <span ref={list} role="listbox" aria-label={text.label} className="contact-phone-country-options">
        {visible.map(option => <button key={option.country} type="button" role="option" tabIndex={-1}
          aria-selected={country === option.country} className="contact-phone-country-option"
          onClick={() => {
            if (option.country !== country) onChange(option.country);
            close();
          }}>
          <span className="contact-phone-country-check" aria-hidden="true">{option.country === country ? '✓' : ''}</span>
          <span>{option.name}</span><span className="contact-phone-country-code">+{option.code}</span>
        </button>)}
      </span>
      {!visible.length && <span className="contact-phone-country-empty" role="status">{text.empty}</span>}
    </span>}
  </span>;
}
