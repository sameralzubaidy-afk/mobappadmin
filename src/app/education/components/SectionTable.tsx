'use client';

// FILE: p2p-kids-admin/src/app/education/components/SectionTable.tsx
// MODULE-18 V1 EDU-008: Section Table Component
// Lists all sections (draft + published) with actions

import { useState } from 'react';
import { Edit, Eye, Globe, GlobeIcon, Trash2 } from 'lucide-react';
import type { EducationSection } from '../../../types/education';
import { publishSection, unpublishSection } from '../../../lib/educationContentService';
import { MobilePreview } from './MobilePreview';
import { PublishConfirmation } from './PublishConfirmation';

interface SectionTableProps {
  sections: EducationSection[];
  onEdit: (section: EducationSection) => void;
  onRefresh: () => void;
  onError: (message: string) => void;
}

export function SectionTable({ sections, onEdit, onRefresh, onError }: SectionTableProps) {
  const [previewSection, setPreviewSection] = useState<EducationSection | null>(null);
  const [publishingSection, setPublishingSection] = useState<EducationSection | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handlePublish = async (section: EducationSection) => {
    try {
      setActionLoading(section.id);
      await publishSection(section.id);
      onRefresh();
    } catch (error: any) {
      console.error('[SectionTable] Publish error:', error);
      onError(error.message || 'Failed to publish section');
    } finally {
      setActionLoading(null);
      setPublishingSection(null);
    }
  };

  const handleUnpublish = async (section: EducationSection) => {
    try {
      setActionLoading(section.id);
      await unpublishSection(section.id);
      onRefresh();
    } catch (error: any) {
      console.error('[SectionTable] Unpublish error:', error);
      onError(error.message || 'Failed to unpublish section');
    } finally {
      setActionLoading(null);
    }
  };

  if (sections.length === 0) {
    return (
      <div
        className="p-8 text-center rounded-lg border"
        style={{
          borderColor: 'var(--border-color)',
          background: 'var(--surface-bg)',
        }}
        data-testid="empty-sections"
      >
        <p style={{ color: 'var(--text-secondary)' }}>No sections yet. Click &quot;Add Section&quot; to create one.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
        <table className="w-full" data-testid="section-table">
          <thead style={{ background: 'var(--surface-bg)' }}>
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Title
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Type
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Status
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Updated
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section, index) => (
              <tr
                key={section.id}
                data-testid={`section-row-${section.id}`}
                className="border-t"
                style={{
                  borderColor: 'var(--border-color)',
                  background: index % 2 === 0 ? 'white' : 'var(--surface-bg)',
                }}
              >
                <td className="px-4 py-3">
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {section.title}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs px-2 py-1 rounded" style={{ background: 'var(--surface-bg)', color: 'var(--text-secondary)' }}>
                    {section.section_type}
                  </code>
                </td>
                <td className="px-4 py-3">
                  {section.is_published ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded"
                      style={{ background: '#d4edda', color: '#155724' }}
                      data-testid={`status-badge-${section.id}`}
                    >
                      <Globe size={12} />
                      Published
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded"
                      style={{ background: '#fff3cd', color: '#856404' }}
                      data-testid={`status-badge-${section.id}`}
                    >
                      Draft
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {new Date(section.updated_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onEdit(section)}
                      disabled={actionLoading === section.id}
                      data-testid={`btn-edit-${section.id}`}
                      className="p-2 rounded hover:bg-gray-100 transition-colors"
                      title="Edit"
                    >
                      <Edit size={16} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    <button
                      onClick={() => setPreviewSection(section)}
                      disabled={actionLoading === section.id}
                      data-testid={`btn-preview-${section.id}`}
                      className="p-2 rounded hover:bg-gray-100 transition-colors"
                      title="Preview"
                    >
                      <Eye size={16} style={{ color: 'var(--text-secondary)' }} />
                    </button>
                    {section.is_published ? (
                      <button
                        onClick={() => handleUnpublish(section)}
                        disabled={actionLoading === section.id}
                        data-testid={`btn-unpublish-${section.id}`}
                        className="p-2 rounded hover:bg-gray-100 transition-colors"
                        title="Unpublish"
                      >
                        <GlobeIcon size={16} style={{ color: '#dc3545' }} />
                      </button>
                    ) : (
                      <button
                        onClick={() => setPublishingSection(section)}
                        disabled={actionLoading === section.id}
                        data-testid={`btn-publish-${section.id}`}
                        className="px-3 py-1 text-sm font-medium rounded transition-colors"
                        style={{
                          background: 'var(--brand-primary)',
                          color: 'white',
                        }}
                      >
                        {actionLoading === section.id ? 'Publishing...' : 'Publish'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Preview Modal */}
      {previewSection && (
        <MobilePreview
          section={previewSection}
          onClose={() => setPreviewSection(null)}
        />
      )}

      {/* Publish Confirmation */}
      {publishingSection && (
        <PublishConfirmation
          section={publishingSection}
          onConfirm={() => handlePublish(publishingSection)}
          onCancel={() => setPublishingSection(null)}
        />
      )}
    </>
  );
}
