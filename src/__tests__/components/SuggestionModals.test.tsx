// FILE: p2p-kids-admin/src/__tests__/components/SuggestionModals.test.tsx
// Unit tests for Approve/Merge/Reject modals
// ADMIN-V3-005

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ApproveSuggestionModal } from '../../app/categories/components/ApproveSuggestionModal';
import { MergeSuggestionModal } from '../../app/categories/components/MergeSuggestionModal';
import { RejectSuggestionModal } from '../../app/categories/components/RejectSuggestionModal';
import * as categorySuggestionService from '../../lib/categorySuggestionService';
import * as categoryService from '../../lib/categoryService';

vi.mock('../../lib/categorySuggestionService');
vi.mock('../../lib/categoryService');

const mockSuggestion = {
  id: 'sug-001',
  suggested_name: 'Vintage Toys',
  seller_id: 'seller-001',
  item_id: 'item-001',
  status: 'pending' as const,
  approved_by: null,
  merged_to_category_id: null,
  admin_note: null,
  created_at: new Date().toISOString(),
  reviewed_at: null,
  seller: {
    id: 'seller-001',
    full_name: 'John Doe',
    email: 'john@example.com',
  },
  item: {
    id: 'item-001',
    name: 'Vintage Robot Toy',
    status: 'available',
  },
};

const mockCategories = [
  {
    id: 'cat-001',
    name: 'Toys',
    description: null,
    icon: null,
    icon_url: null,
    bonus_badge_icon_url: null,
    is_active: true,
    item_count: 10,
    display_order: 0,
    sp_earning_multiplier: 1.1,
    sp_spending_cap_percent: 70,
    sp_config_notes: null,
    sp_rate_change_notify: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'cat-002',
    name: 'Books',
    description: null,
    icon: null,
    icon_url: null,
    bonus_badge_icon_url: null,
    is_active: true,
    item_count: 5,
    display_order: 1,
    sp_earning_multiplier: 1.1,
    sp_spending_cap_percent: 70,
    sp_config_notes: null,
    sp_rate_change_notify: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

describe('ApproveSuggestionModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders modal with suggestion info', () => {
    render(
      <ApproveSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByTestId('approve-modal-title')).toBeInTheDocument();
    expect(screen.getByText(/Vintage Toys/)).toBeInTheDocument();
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    expect(screen.getByText(/Vintage Robot Toy/)).toBeInTheDocument();
  });

  test('pre-fills name field with suggested name', () => {
    render(
      <ApproveSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const nameInput = screen.getByTestId('approve-form-name') as HTMLInputElement;
    expect(nameInput.value).toBe('Vintage Toys');
  });

  test('defaults active checkbox to checked', () => {
    render(
      <ApproveSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const activeCheckbox = screen.getByTestId('approve-form-active') as HTMLInputElement;
    expect(activeCheckbox.checked).toBe(true);
  });

  test('validates required name field', async () => {
    render(
      <ApproveSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const nameInput = screen.getByTestId('approve-form-name');
    fireEvent.change(nameInput, { target: { value: '' } });

    const submitBtn = screen.getByTestId('approve-form-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('name-error')).toBeInTheDocument();
      expect(screen.getByText('Name is required')).toBeInTheDocument();
    });
  });

  test('validates name length (3-50 chars)', async () => {
    render(
      <ApproveSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const nameInput = screen.getByTestId('approve-form-name');
    fireEvent.change(nameInput, { target: { value: 'AB' } }); // Too short

    const submitBtn = screen.getByTestId('approve-form-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Name must be 3-50 characters/)).toBeInTheDocument();
    });
  });

  test('validates name regex (alphanumeric + spaces only)', async () => {
    render(
      <ApproveSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const nameInput = screen.getByTestId('approve-form-name');
    fireEvent.change(nameInput, { target: { value: 'Invalid@Name!' } });

    const submitBtn = screen.getByTestId('approve-form-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Name can only contain letters, numbers, and spaces/)
      ).toBeInTheDocument();
    });
  });

  test('closes modal when cancel clicked', () => {
    render(
      <ApproveSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const cancelBtn = screen.getByTestId('approve-form-cancel');
    fireEvent.click(cancelBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('closes modal when X clicked', () => {
    render(
      <ApproveSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const closeBtn = screen.getByTestId('approve-modal-close');
    fireEvent.click(closeBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });

  test('submits form with valid data', async () => {
    (categorySuggestionService.approveCategorySuggestion as any).mockResolvedValue(
      undefined
    );

    render(
      <ApproveSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const submitBtn = screen.getByTestId('approve-form-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(categorySuggestionService.approveCategorySuggestion).toHaveBeenCalled();
    });
  });
});

describe('MergeSuggestionModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (categoryService.getCategories as any).mockResolvedValue(mockCategories);
  });

  test('renders modal with suggestion info', async () => {
    render(
      <MergeSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByTestId('merge-modal-title')).toBeInTheDocument();
    expect(screen.getByText(/Vintage Toys/)).toBeInTheDocument();
  });

  test('loads and displays active categories', async () => {
    render(
      <MergeSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Toys \(10 items\)/)).toBeInTheDocument();
      expect(screen.getByText(/Books \(5 items\)/)).toBeInTheDocument();
    });
  });

  test('requires category selection', async () => {
    render(
      <MergeSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('merge-category-select')).toBeInTheDocument();
    });

    const submitBtn = screen.getByTestId('merge-form-submit');
    expect(submitBtn).toBeDisabled();
    expect(screen.queryByTestId('merge-modal-error')).not.toBeInTheDocument();
  });

  test('allows optional admin note up to 500 chars', async () => {
    render(
      <MergeSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const noteTextarea = screen.getByTestId('merge-note') as HTMLTextAreaElement;
    const longNote = 'a'.repeat(500);
    fireEvent.change(noteTextarea, { target: { value: longNote } });

    expect(noteTextarea.value).toBe(longNote);
    expect(screen.getByText('500/500 characters')).toBeInTheDocument();
  });

  test('submits merge with selected category', async () => {
    (categorySuggestionService.mergeCategorySuggestion as any).mockResolvedValue(
      undefined
    );

    render(
      <MergeSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      const categorySelect = screen.getByTestId('merge-category-select');
      fireEvent.change(categorySelect, { target: { value: 'cat-001' } });
    });

    const submitBtn = screen.getByTestId('merge-form-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(categorySuggestionService.mergeCategorySuggestion).toHaveBeenCalledWith(
        'sug-001',
        {
          target_category_id: 'cat-001',
          admin_note: null,
        }
      );
    });
  });
});

describe('RejectSuggestionModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders modal with warning', () => {
    render(
      <RejectSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByTestId('reject-modal-title')).toBeInTheDocument();
    expect(screen.getByText(/You are about to reject this category suggestion/)).toBeInTheDocument();
  });

  test('displays suggestion details', () => {
    render(
      <RejectSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByText(/Vintage Toys/)).toBeInTheDocument();
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    expect(screen.getByText(/Vintage Robot Toy/)).toBeInTheDocument();
  });

  test('allows optional admin note up to 500 chars', () => {
    render(
      <RejectSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const noteTextarea = screen.getByTestId('reject-note') as HTMLTextAreaElement;
    const note = 'Not appropriate for our category structure';
    fireEvent.change(noteTextarea, { target: { value: note } });

    expect(noteTextarea.value).toBe(note);
  });

  test('submits rejection with note', async () => {
    (categorySuggestionService.rejectCategorySuggestion as any).mockResolvedValue(
      undefined
    );

    render(
      <RejectSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const noteTextarea = screen.getByTestId('reject-note');
    fireEvent.change(noteTextarea, { target: { value: 'Too specific' } });

    const submitBtn = screen.getByTestId('reject-form-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(categorySuggestionService.rejectCategorySuggestion).toHaveBeenCalledWith(
        'sug-001',
        {
          admin_note: 'Too specific',
        }
      );
    });
  });

  test('submits rejection without note (empty note becomes null)', async () => {
    (categorySuggestionService.rejectCategorySuggestion as any).mockResolvedValue(
      undefined
    );

    render(
      <RejectSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const submitBtn = screen.getByTestId('reject-form-submit');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(categorySuggestionService.rejectCategorySuggestion).toHaveBeenCalledWith(
        'sug-001',
        {
          admin_note: null,
        }
      );
    });
  });

  test('closes modal when cancel clicked', () => {
    render(
      <RejectSuggestionModal
        suggestion={mockSuggestion}
        onClose={mockOnClose}
        onSuccess={mockOnSuccess}
      />
    );

    const cancelBtn = screen.getByTestId('reject-form-cancel');
    fireEvent.click(cancelBtn);

    expect(mockOnClose).toHaveBeenCalled();
  });
});
