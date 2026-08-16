'use client';

// FILE: p2p-kids-admin/src/app/education/faq/components/FAQForm.tsx
// Modal for creating and editing a FAQ item.

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { FaqItem, FaqCategory, CreateFaqItemPayload, FaqStatus } from '../../../../types/faq';
import { createFaqItem, updateFaqItem } from '../../../../lib/faqService';

interface FAQFormProps {
  item: FaqItem | null; // null = create mode
  categories: FaqCategory[];
  nextSortOrder: number;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function FAQForm({ item, categories, nextSortOrder, onClose, onSuccess, onError }: FAQFormProps) {
  const isEdit = item !== null;

  const [question, setQuestion] = useState(item?.question ?? '');
  const [answer, setAnswer] = useState(item?.answer ?? '');
  const [categoryId, setCategoryId] = useState(item?.category_id ?? (categories[0]?.id ?? ''));
  const [status, setStatus] = useState<FaqStatus>(item?.status ?? 'draft');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Keep categoryId in sync if categories load after mount
  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (question.trim().length < 5)  e.question = 'Question must be at least 5 characters';
    if (question.trim().length > 500) e.question = 'Question must be at most 500 characters';
    if (answer.trim().length < 10)   e.answer = 'Answer must be at least 10 characters';
    if (answer.trim().length > 3000) e.answer = 'Answer must be at most 3000 characters';
    if (!categoryId)                 e.category = 'Please select a category';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      if (isEdit) {
        await updateFaqItem(item.id, { question: question.trim(), answer: answer.trim(), category_id: categoryId, status });
        onSuccess('FAQ updated successfully');
      } else {
        const payload: CreateFaqItemPayload = {
          question: question.trim(),
          answer: answer.trim(),
          category_id: categoryId,
          sort_order: nextSortOrder,
          status,
        };
        await createFaqItem(payload);
        onSuccess('FAQ created successfully');
      }
      onClose();
    } catch (err: any) {
      onError(err.message ?? 'Failed to save FAQ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit FAQ' : 'Add FAQ Question'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            data-testid="btn-faq-form-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-y-auto">
          <div className="px-6 py-5 space-y-5">
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="faq-form-category"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {errors.category && <p className="mt-1 text-xs text-red-500">{errors.category}</p>}
            </div>

            {/* Question */}
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5">
                Question <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g. How do I earn Swap Points?"
                maxLength={500}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                data-testid="faq-form-question"
              />
              <div className="flex justify-between mt-1">
                {errors.question ? (
                  <p className="text-xs text-red-500">{errors.question}</p>
                ) : <span />}
                <p className="text-xs text-gray-400">{question.length}/500</p>
              </div>
            </div>

            {/* Answer */}
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5">
                Answer <span className="text-red-500">*</span>
              </label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Write a clear, helpful answer..."
                maxLength={3000}
                rows={6}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                data-testid="faq-form-answer"
              />
              <div className="flex justify-between mt-1">
                {errors.answer ? (
                  <p className="text-xs text-red-500">{errors.answer}</p>
                ) : <span />}
                <p className="text-xs text-gray-400">{answer.length}/3000</p>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-gray-600 uppercase tracking-wide mb-1.5">
                Status
              </label>
              <div className="flex gap-3">
                {(['draft', 'published'] as FaqStatus[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    data-testid={`faq-form-status-${s}`}
                    className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors capitalize ${
                      status === s
                        ? s === 'published'
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-yellow-50 border-yellow-300 text-yellow-700'
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {s === 'published' ? '✓ Published' : '✎ Draft'}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                Only published FAQs appear in the mobile app.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              data-testid="btn-faq-form-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              data-testid="btn-faq-form-submit"
            >
              {submitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create FAQ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
