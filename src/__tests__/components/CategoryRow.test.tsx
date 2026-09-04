// FILE: p2p-kids-admin/src/__tests__/components/CategoryRow.test.tsx
// DEV-TASK-110 (2026-09-04): Move Up / Move Down reorder affordance on CategoryRow.
// Guards the drag-free reorder path QA drives for ADM-TC-D08 (the buttons call
// onMove, which CategoryTable persists via the same /api/admin/categories/reorder
// endpoint the drag handler uses).

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

import { CategoryRow } from '../../app/categories/components/CategoryRow';
import type { Category } from '../../types/category';

const makeCategory = (overrides: Partial<Category> = {}): Category => ({
  id: 'cat-1',
  name: 'Books',
  description: null,
  icon: '📚',
  icon_url: null,
  bonus_badge_icon_url: null,
  is_active: true,
  item_count: 5,
  display_order: 1,
  sp_earning_multiplier: 1.1,
  sp_spending_cap_percent: 70,
  sp_config_notes: null,
  sp_rate_change_notify: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

function renderRow(overrides: Partial<Category> = {}, props: Record<string, unknown> = {}) {
  const onMove = vi.fn();
  const onEdit = vi.fn();
  const onToggleActive = vi.fn();
  const onDelete = vi.fn();
  const onToggleSelect = vi.fn();

  render(
    <table>
      <tbody>
        <CategoryRow
          category={makeCategory(overrides)}
          selected={false}
          onToggleSelect={onToggleSelect}
          onEdit={onEdit}
          onToggleActive={onToggleActive}
          onDelete={onDelete}
          onMove={onMove}
          {...(props as Record<string, never>)}
        />
      </tbody>
    </table>
  );

  return { onMove, onEdit, onToggleActive, onDelete };
}

describe('CategoryRow', () => {
  it('renders drag-free Move Up / Move Down buttons with the QA testIDs', () => {
    renderRow();
    expect(screen.getByTestId('btn-move-up-cat-1')).toBeInTheDocument();
    expect(screen.getByTestId('btn-move-down-cat-1')).toBeInTheDocument();
  });

  it('calls onMove(id, "up") when Move Up is clicked and not at the first row', () => {
    const { onMove } = renderRow({}, { isFirst: false, isLast: true });
    fireEvent.click(screen.getByTestId('btn-move-up-cat-1'));
    expect(onMove).toHaveBeenCalledWith('cat-1', 'up');
  });

  it('calls onMove(id, "down") when Move Down is clicked and not at the last row', () => {
    const { onMove } = renderRow({}, { isFirst: true, isLast: false });
    fireEvent.click(screen.getByTestId('btn-move-down-cat-1'));
    expect(onMove).toHaveBeenCalledWith('cat-1', 'down');
  });

  it('disables Move Up when the row is first, and Move Down when the row is last', () => {
    renderRow({}, { isFirst: true, isLast: true });
    expect(screen.getByTestId('btn-move-up-cat-1')).toBeDisabled();
    expect(screen.getByTestId('btn-move-down-cat-1')).toBeDisabled();
  });
});
