import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Fragment } from 'react';
import { TEAM_BY_ID } from '../lib/nba';
import { PLAYOFF_LINE } from '../lib/scoring';
import { TeamLogo } from './TeamLogo';

type Props = {
  order: string[];
  onChange?: (order: string[]) => void; // omitted = read-only
};

const DIVIDERS: Record<number, string> = { [PLAYOFF_LINE]: 'Playoff line' };
const isPlayIn = (seed: number) => seed >= 7 && seed <= 10;

export function SeedList({ order, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!onChange || !over || active.id === over.id) return;
    onChange(arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id))));
  }

  function move(index: number, delta: number) {
    const to = index + delta;
    if (!onChange || to < 0 || to >= order.length) return;
    onChange(arrayMove(order, index, to));
  }

  const rows = order.map((teamId, i) => (
    <Fragment key={teamId}>
      <SeedRow teamId={teamId} seed={i + 1} editable={!!onChange} onMove={(d) => move(i, d)} />
      {DIVIDERS[i + 1] && <li className="seed-divider">{DIVIDERS[i + 1]}</li>}
    </Fragment>
  ));

  if (!onChange) return <ol className="seed-list">{rows}</ol>;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <ol className="seed-list">{rows}</ol>
      </SortableContext>
    </DndContext>
  );
}

function SeedRow({
  teamId,
  seed,
  editable,
  onMove,
}: {
  teamId: string;
  seed: number;
  editable: boolean;
  onMove: (delta: number) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: teamId, disabled: !editable });
  const team = TEAM_BY_ID[teamId];

  return (
    <li
      ref={setNodeRef}
      className={`seed-row${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <span className="seed-num">{seed}</span>
      <TeamLogo teamId={teamId} />
      <span className="seed-name">{team.name}</span>
      {isPlayIn(seed) && <span className="tag">play-in</span>}
      {editable && (
        <span className="seed-actions">
          <button type="button" className="icon-btn" aria-label={`Move ${team.name} up`} disabled={seed === 1} onClick={() => onMove(-1)}>
            ▲
          </button>
          <button type="button" className="icon-btn" aria-label={`Move ${team.name} down`} disabled={seed === 15} onClick={() => onMove(1)}>
            ▼
          </button>
          <button
            type="button"
            className="icon-btn drag-handle"
            aria-label={`Drag ${team.name}`}
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
          >
            ⠿
          </button>
        </span>
      )}
    </li>
  );
}
