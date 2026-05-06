'use client';

// FILE: p2p-kids-admin/src/app/education/page.tsx
// MODULE-18 V1 EDU-008: Education Content Management Page
// TASK: EDU-008 — Admin Portal EducationContentPage (Sections + Examples + Preview)

import { useState, useEffect } from 'react';
import { SectionTable } from './components/SectionTable';
import { SectionForm } from './components/SectionForm';
import { ExampleTable } from './components/ExampleTable';
import { ExampleForm } from './components/ExampleForm';
import { AnalyticsDashboard } from '../../components/education/AnalyticsDashboard';
import type { EducationSection, EducationExample } from '../../types/education';
import { useEducationContent } from '../../hooks/useEducationContent';

type ContentTab = 'sections' | 'examples' | 'analytics';

export default function EducationContentPage() {
  const [activeTab, setActiveTab] = useState<ContentTab>('sections');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Section state
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editingSection, setEditingSection] = useState<EducationSection | null>(null);

  // Example state
  const [showExampleForm, setShowExampleForm] = useState(false);
  const [editingExample, setEditingExample] = useState<EducationExample | null>(null);

  // Load data using custom hook
  const {
    sections,
    examples,
    loading,
    error,
    refreshSections,
    refreshExamples,
  } = useEducationContent();

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage || errorMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
        setErrorMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, errorMessage]);

  const handleSectionSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowSectionForm(false);
    setEditingSection(null);
    refreshSections();
  };

  const handleExampleSuccess = (message: string) => {
    setSuccessMessage(message);
    setShowExampleForm(false);
    setEditingExample(null);
    refreshExamples();
  };

  const handleSectionEdit = (section: EducationSection) => {
    setEditingSection(section);
    setShowSectionForm(true);
  };

  const handleExampleEdit = (example: EducationExample) => {
    setEditingExample(example);
    setShowExampleForm(true);
  };

  const handleSectionFormClose = () => {
    setShowSectionForm(false);
    setEditingSection(null);
  };

  const handleExampleFormClose = () => {
    setShowExampleForm(false);
    setEditingExample(null);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <p style={{ color: 'var(--text-secondary)' }}>Loading education content...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="education-content-page">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Education Content Management
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Manage trading education sections, examples, and view analytics
        </p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div
          className="mb-4 p-4 rounded-lg border"
          style={{
            background: '#d4edda',
            borderColor: '#c3e6cb',
            color: '#155724',
          }}
          data-testid="success-message"
        >
          <p className="font-medium">{successMessage}</p>
        </div>
      )}

      {(errorMessage || error) && (
        <div
          className="mb-4 p-4 rounded-lg border"
          style={{
            background: '#f8d7da',
            borderColor: '#f5c6cb',
            color: '#721c24',
          }}
          data-testid="error-message"
        >
          <p className="font-medium">{errorMessage || error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('sections')}
            data-testid="tab-sections"
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'sections'
                ? 'border-brand-primary font-medium'
                : 'border-transparent'
            }`}
            style={{
              color: activeTab === 'sections' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              borderColor: activeTab === 'sections' ? 'var(--brand-primary)' : 'transparent',
            }}
          >
            Sections ({sections.length})
          </button>
          <button
            onClick={() => setActiveTab('examples')}
            data-testid="tab-examples"
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'examples'
                ? 'border-brand-primary font-medium'
                : 'border-transparent'
            }`}
            style={{
              color: activeTab === 'examples' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              borderColor: activeTab === 'examples' ? 'var(--brand-primary)' : 'transparent',
            }}
          >
            Examples ({examples.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            data-testid="tab-analytics"
            className={`px-4 py-2 border-b-2 transition-colors relative ${
              activeTab === 'analytics'
                ? 'border-brand-primary font-medium'
                : 'border-transparent'
            }`}
            style={{
              color: activeTab === 'analytics' ? 'var(--brand-primary)' : 'var(--text-secondary)',
              borderColor: activeTab === 'analytics' ? 'var(--brand-primary)' : 'transparent',
            }}
          >
            Analytics
            <span
              className="absolute top-1 right-0 w-2 h-2 rounded-full"
              style={{ background: 'var(--brand-accent)' }}
              title="New metrics available"
            />
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'sections' && (
        <>
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Education Sections
            </h2>
            <button
              onClick={() => setShowSectionForm(true)}
              data-testid="btn-add-section"
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                background: 'var(--brand-primary)',
                color: 'white',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              + Add Section
            </button>
          </div>
          <SectionTable
            sections={sections}
            onEdit={handleSectionEdit}
            onRefresh={refreshSections}
            onError={setErrorMessage}
          />
        </>
      )}

      {activeTab === 'examples' && (
        <>
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Example Scenarios
            </h2>
            <button
              onClick={() => setShowExampleForm(true)}
              data-testid="btn-add-example"
              className="px-4 py-2 rounded-lg font-medium transition-colors"
              style={{
                background: 'var(--brand-primary)',
                color: 'white',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              + Add Example
            </button>
          </div>
          <ExampleTable
            examples={examples}
            onEdit={handleExampleEdit}
            onRefresh={refreshExamples}
            onError={setErrorMessage}
          />
        </>
      )}

      {activeTab === 'analytics' && <AnalyticsDashboard />}

      {/* Section Form Modal */}
      {showSectionForm && (
        <SectionForm
          section={editingSection}
          onClose={handleSectionFormClose}
          onSuccess={handleSectionSuccess}
        />
      )}

      {/* Example Form Modal */}
      {showExampleForm && (
        <ExampleForm
          example={editingExample}
          onClose={handleExampleFormClose}
          onSuccess={handleExampleSuccess}
        />
      )}
    </div>
  );
}
