'use client';

// FILE: p2p-kids-admin/src/app/education/components/PublishConfirmation.tsx
// MODULE-18 V1 EDU-008: Publish Confirmation Component
// Confirmation modal before publishing a section

import { useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import type { EducationSection } from '../../../types/education';

interface PublishConfirmationProps {
  section: EducationSection;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PublishConfirmation({ section, onConfirm, onCancel }: PublishConfirmationProps) {
  // Close modal on Esc key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onCancel]);

  // Trap focus in modal
  useEffect(() => {
    const modal = document.querySelector('[data-testid="publish-confirmation-modal"]');
    if (!modal) return;

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    modal.addEventListener('keydown', handleTab as any);
    firstElement?.focus();

    return () => {
      modal.removeEventListener('keydown', handleTab as any);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
      onClick={onCancel}
      data-testid="publish-confirmation-backdrop"
    >
      {/* Modal Content */}
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
        data-testid="publish-confirmation-modal"
      >
        {/* Header */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: '#fff3cd' }}
            >
              <AlertCircle size={24} style={{ color: '#856404' }} />
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Publish Section
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Confirm publishing action
              </p>
            </div>
          </div>

          {/* Warning Message */}
          <div
            className="p-4 rounded-lg border mb-4"
            style={{
              background: '#fff3cd',
              borderColor: '#ffeeba',
              color: '#856404',
            }}
          >
            <p className="text-sm font-medium mb-2">
              ⚠️ This will replace the current live section
            </p>
            <p className="text-xs">
              Publishing &quot;{section.title}&quot; ({section.section_type}) will unpublish any other section of the same type and make this one live for all users.
            </p>
          </div>

          {/* Section Details */}
          <div
            className="p-3 rounded-lg border mb-4"
            style={{ background: 'var(--surface-bg)', borderColor: 'var(--border-color)' }}
          >
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Section Details:
            </p>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {section.title}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Type: <code className="px-1 rounded" style={{ background: 'white' }}>{section.section_type}</code>
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              {section.body.substring(0, 100)}{section.body.length > 100 ? '...' : ''}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              data-testid="btn-cancel-publish"
              className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                background: 'var(--surface-bg)',
                color: 'var(--text-secondary)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              data-testid="btn-confirm-publish"
              className="flex-1 px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                background: 'var(--brand-primary)',
                color: 'white',
              }}
            >
              Confirm Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
