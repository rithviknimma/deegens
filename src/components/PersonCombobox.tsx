import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { headshotUrl, type Person } from '../lib/nba';
import { TeamLogo } from './TeamLogo';

type Props = {
  options: readonly Person[];
  value: string; // only ever a name from options (or '')
  disabled: boolean;
  onChange: (name: string) => void;
};

const MAX_RESULTS = 20;

// "Nikola Jokić" -> "nikola jokic" so typing without accents still matches.
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Custom autocomplete: native <datalist> renders as keyboard suggestions on iOS.
export function PersonCombobox({ options, value, disabled, onChange }: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  // Show the saved pick whenever we're not mid-edit.
  useEffect(() => {
    if (!open) setQuery(value);
  }, [value, open]);

  const results = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return [];
    const starts: Person[] = [];
    const contains: Person[] = [];
    for (const p of options) {
      const name = fold(p.name);
      // Rank first-name/last-name prefix matches above matches mid-word.
      if (name.startsWith(q) || name.includes(` ${q}`)) starts.push(p);
      else if (name.includes(q)) contains.push(p);
      if (starts.length >= MAX_RESULTS) break;
    }
    return [...starts, ...contains].slice(0, MAX_RESULTS);
  }, [options, query]);

  function choose(p: Person) {
    onChange(p.name);
    setQuery(p.name);
    setOpen(false);
    inputRef.current?.blur();
  }

  function close() {
    setOpen(false);
    // Leaving the field without choosing: an emptied box clears the pick, anything else reverts.
    if (!query.trim()) onChange('');
    else setQuery(value);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && open && results[active]) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      close();
      inputRef.current?.blur();
    }
  }

  const showList = open && query.trim().length > 0;

  return (
    <div className="combo">
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        value={query}
        disabled={disabled}
        placeholder="Start typing a name"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="words"
        spellCheck={false}
        enterKeyHint="done"
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={(e) => {
          e.target.select();
          // Give the phone keyboard a moment, then keep the field and its list in view.
          setTimeout(() => inputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
        }}
        onBlur={close}
        onKeyDown={onKeyDown}
      />
      {value && !disabled && !open && (
        <button type="button" className="combo-clear" aria-label="Clear" onClick={() => onChange('')}>
          ×
        </button>
      )}
      {showList && (
        <ul id={listId} role="listbox" className="combo-list">
          {results.length === 0 && <li className="combo-empty">No matches</li>}
          {results.map((p, i) => (
            <li
              key={`${p.name}-${p.team}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              // Keep focus in the input (so blur doesn't revert) and pick on click: phones only fire
              // click for a tap, never for a scroll/swipe that started on the list.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(p)}
              onMouseEnter={() => setActive(i)}
            >
              <Avatar person={p} />
              <span className="combo-name">{p.name}</span>
              <span className="muted">{p.team}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Headshot when ESPN has one, otherwise (or if it fails to load) the team logo.
function Avatar({ person }: { person: Person }) {
  const [failed, setFailed] = useState(false);
  if (!person.headshotId || failed) {
    return (
      <span className="avatar">
        <TeamLogo teamId={person.team} size={22} />
      </span>
    );
  }
  return (
    <span className="avatar">
      <img src={headshotUrl(person.headshotId)} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>
  );
}
