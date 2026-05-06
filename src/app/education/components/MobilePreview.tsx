'use client';

// FILE: p2p-kids-admin/src/app/education/components/MobilePreview.tsx
// MODULE-18 V1 EDU-008: Mobile Preview Component
// iPhone-shaped preview modal for section content

import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { EducationSection } from '../../../types/education';

interface MobilePreviewProps {
  section: EducationSection;
  onClose: () => void;
}

export function MobilePreview({ section, onClose }: MobilePreviewProps) {
  // Close modal on Esc key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Trap focus in modal
  useEffect(() => {
    const modal = document.querySelector('[data-testid="mobile-preview-modal"]');
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
      className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="mobile-preview-backdrop"
    >
      {/* Preview Container */}
      <div
        className="relative"
        onClick={(e) => e.stopPropagation()}
        data-testid="mobile-preview-modal"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          data-testid="btn-close-preview"
          className="absolute -top-12 right-0 px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          style={{
            background: 'white',
            color: 'var(--text-primary)',
          }}
        >
          <X size={16} />
          Close Preview
        </button>

        {/* iPhone Frame */}
        <div
          className="relative overflow-hidden shadow-2xl"
          style={{
            width: '375px',
            height: '667px',
            borderRadius: '36px',
            border: '12px solid #1f1f1f',
            background: '#1f1f1f',
          }}
        >
          {/* Screen */}
          <div
            className="w-full h-full overflow-y-auto"
            style={{ background: 'white' }}
          >
            {/* Status Bar */}
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{ background: 'var(--brand-primary)', color: 'white' }}
            >
              <span className="text-xs font-medium">9:41 AM</span>
              <span className="text-xs">📶 📶 📶 100%</span>
            </div>

            {/* Header */}
            <div
              className="px-4 py-3 border-b"
              style={{ borderColor: 'var(--border-color)' }}
            >
              <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                How Trading Works
              </h1>
            </div>

            {/* Content */}
            <div className="p-4">
              {/* Section Type Badge */}
              <div className="mb-3">
                <code
                  className="text-xs px-2 py-1 rounded"
                  style={{ background: 'var(--surface-bg)', color: 'var(--text-secondary)' }}
                >
                  {section.section_type}
                </code>
              </div>

              {/* Title */}
              <h2
                className="text-xl font-bold mb-3"
                style={{ color: 'var(--text-primary)' }}
              >
                {section.title}
              </h2>

              {/* Image (if provided) */}
              {section.image_url && (
                <div className="mb-4">
                  <img
                    src={section.image_url}
                    alt={section.title}
                    className="w-full rounded-lg"
                    style={{ maxHeight: '200px', objectFit: 'cover' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Body (plain text with newline preservation) */}
              <div
                className="text-base leading-relaxed whitespace-pre-wrap"
                style={{ color: 'var(--text-secondary)' }}
              >
                {section.body}
              </div>

              {/* Preview Indicator */}
              <div
                className="mt-6 p-3 rounded-lg border text-center"
                style={{
                  background: '#fff3cd',
                  borderColor: '#ffeeba',
                  color: '#856404',
                }}
              >
                <p className="text-sm font-medium">
                  📱 Preview Mode
                </p>
                <p className="text-xs mt-1">
                  This is how the section will appear in the mobile app
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Device Label */}
        <p
          className="text-center mt-4 text-sm"
          style={{ color: 'white' }}
        >
          iPhone 8 / SE (375×667)
        </p>
      </div>
    </div>
  );
}
