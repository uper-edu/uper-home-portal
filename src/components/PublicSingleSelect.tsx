import { useId, useRef } from 'react';

export function PublicSingleSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const id = useId();
  const details = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  function close(restoreFocus = false) {
    if (details.current) details.current.open = false;
    if (restoreFocus) trigger.current?.focus();
  }
  return <div className="public-select">
    <span id={id}>{label}</span>
    <details ref={details}
      onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}
      onKeyDown={event => { if (event.key === 'Escape' && details.current?.open) { event.preventDefault(); close(true); } }}>
      <summary ref={trigger} aria-describedby={id}>{options.find(option => option.value === value)?.label ?? options[0]?.label}</summary>
      <div role="group" aria-labelledby={id}>
        {options.map(option => <button key={option.value} type="button" aria-pressed={option.value === value}
          onClick={() => { onChange(option.value); close(true); }}>{option.label}
          {option.value === value && <span aria-hidden="true">✓</span>}
        </button>)}
      </div>
    </details>
  </div>;
}
