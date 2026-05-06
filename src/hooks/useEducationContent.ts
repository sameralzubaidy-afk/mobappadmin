// FILE: p2p-kids-admin/src/hooks/useEducationContent.ts
// MODULE-18 V1 EDU-008: Custom hook for education content state management
// Note: Admin portal doesn't use React Query - this implements vanilla React state management

import { useState, useEffect, useCallback } from 'react';
import type { EducationSection, EducationExample } from '../types/education';
import { getAllSections } from '../lib/educationContentService';
import { getAllExamples } from '../lib/educationExampleService';

interface UseEducationContentReturn {
  sections: EducationSection[];
  examples: EducationExample[];
  loading: boolean;
  error: string | null;
  refreshSections: () => Promise<void>;
  refreshExamples: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

/**
 * Custom hook for managing education content state
 * Provides sections, examples, loading state, and refresh functions
 */
export function useEducationContent(): UseEducationContentReturn {
  const [sections, setSections] = useState<EducationSection[]>([]);
  const [examples, setExamples] = useState<EducationExample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSections = useCallback(async () => {
    try {
      setError(null);
      const data = await getAllSections();
      setSections(data);
    } catch (err: any) {
      console.error('[useEducationContent] Load sections error:', err);
      setError(err.message || 'Failed to load sections');
    }
  }, []);

  const refreshExamples = useCallback(async () => {
    try {
      setError(null);
      const data = await getAllExamples();
      setExamples(data);
    } catch (err: any) {
      console.error('[useEducationContent] Load examples error:', err);
      setError(err.message || 'Failed to load examples');
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [sectionsData, examplesData] = await Promise.all([
        getAllSections(),
        getAllExamples(),
      ]);

      setSections(sectionsData);
      setExamples(examplesData);
    } catch (err: any) {
      console.error('[useEducationContent] Load all error:', err);
      setError(err.message || 'Failed to load education content');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load data on mount
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  return {
    sections,
    examples,
    loading,
    error,
    refreshSections,
    refreshExamples,
    refreshAll,
  };
}
