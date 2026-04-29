'use client';

// FILE: p2p-kids-admin/src/app/categories/components/CategoryRow.tsx
// ADMIN-V3-004: Sortable category row renderer
// Module: MODULE-12-ADMIN-V3-CATEGORIES

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { Category } from '../../../types/category';

interface CategoryRowProps {
  category: Category;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onEdit: (category: Category) => void;
  onToggleActive: (category: Category) => void;
  onDelete: (category: Category) => void;
  disabled?: boolean;
}

export function CategoryRow({
  category,
  selected,
  onToggleSelect,
  onEdit,
  onToggleActive,
  onDelete,
  disabled,
}: CategoryRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const canDelete = category.item_count === 0 && category.name.toLowerCase() !== 'other';

  return (
    <tr
      ref={setNodeRef}
      style={style}
      data-testid={`category-row-${category.id}`}
      className={selected ? 'bg-blue-50' : ''}
    >
      {/* Drag Handle */}
      <td className="px-3 py-4">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
          aria-label="Drag to reorder"
          data-testid={`drag-handle-${category.id}`}
        >
          <GripVertical size={20} />
        </button>
      </td>

      {/* Checkbox */}
      <td className="px-3 py-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(category.id)}
          disabled={disabled}
          data-testid={`checkbox-${category.id}`}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
      </td>

      {/* Icon */}
      <td className="px-3 py-4">
        <div className="flex items-center space-x-2">
          {category.icon_url ? (
            <img
              src={category.icon_url}
              alt={category.name}
              className="w-8 h-8 rounded"
              data-testid={`icon-${category.id}`}
            />
          ) : category.icon ? (
            <span className="text-2xl" data-testid={`emoji-${category.id}`}>
              {category.icon}
            </span>
          ) : (
            <span className="text-2xl text-gray-300">📦</span>
          )}
          {category.sp_earning_multiplier > 1.10 && (
            <span className="text-yellow-500" title="Bonus category" data-testid={`bonus-badge-${category.id}`}>
              {category.bonus_badge_icon_url ? (
                <img src={category.bonus_badge_icon_url} alt="Bonus" className="w-4 h-4" />
              ) : (
                '⭐'
              )}
            </span>
          )}
        </div>
      </td>

      {/* Name */}
      <td className="px-3 py-4">
        <div className="text-sm font-medium text-gray-900">{category.name}</div>
        {category.description && (
          <div className="text-xs text-gray-500 mt-1">{category.description}</div>
        )}
      </td>

      {/* Item Count */}
      <td className="px-3 py-4 text-center">
        <span
          className={`text-sm ${category.item_count === 0 ? 'text-gray-400' : 'text-gray-900 font-medium'}`}
          data-testid={`item-count-${category.id}`}
        >
          {category.item_count}
        </span>
      </td>

      {/* SP Earn (inline editable — placeholder) */}
      <td className="px-3 py-4 text-center">
        <button
          onClick={() => onEdit(category)}
          className="text-sm text-blue-600 hover:text-blue-800"
          data-testid={`sp-earn-${category.id}`}
          title="Click to edit SP rates"
        >
          {category.sp_earning_multiplier.toFixed(2)}×
        </button>
      </td>

      {/* SP Spend Cap */}
      <td className="px-3 py-4 text-center">
        <button
          onClick={() => onEdit(category)}
          className="text-sm text-blue-600 hover:text-blue-800"
          data-testid={`sp-spend-${category.id}`}
          title="Click to edit SP rates"
        >
          {category.sp_spending_cap_percent}%
        </button>
      </td>

      {/* Active Toggle */}
      <td className="px-3 py-4 text-center">
        <button
          onClick={() => onToggleActive(category)}
          disabled={disabled || category.name.toLowerCase() === 'other'}
          data-testid={`active-toggle-${category.id}`}
          className={`${
            category.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          } px-3 py-1 rounded-full text-xs font-medium ${
            disabled || category.name.toLowerCase() === 'other' ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'
          }`}
        >
          {category.is_active ? 'Active' : 'Inactive'}
        </button>
      </td>

      {/* Actions */}
      <td className="px-3 py-4 text-center">
        <div className="flex items-center justify-center space-x-2">
          <button
            onClick={() => onEdit(category)}
            disabled={disabled}
            data-testid={`edit-btn-${category.id}`}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(category)}
            disabled={disabled || !canDelete}
            data-testid={`delete-btn-${category.id}`}
            className={`text-red-600 hover:text-red-800 text-sm font-medium ${
              !canDelete ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            title={!canDelete ? `Cannot delete: ${category.item_count} items or system category` : 'Delete category'}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
