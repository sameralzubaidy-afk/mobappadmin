// FILE: p2p-kids-admin/src/types/faq.ts
// Types for FAQ management feature

export type FaqStatus = 'draft' | 'published';

export interface FaqCategory {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category_id: string;
  sort_order: number;
  status: FaqStatus;
  yes_count: number;
  no_count: number;
  created_at: string;
  updated_at: string;
  // Joined
  faq_categories?: FaqCategory;
}

export interface CreateFaqCategoryPayload {
  name: string;
  sort_order: number;
}

export interface UpdateFaqCategoryPayload {
  name?: string;
  sort_order?: number;
}

export interface CreateFaqItemPayload {
  question: string;
  answer: string;
  category_id: string;
  sort_order: number;
  status: FaqStatus;
}

export interface UpdateFaqItemPayload {
  question?: string;
  answer?: string;
  category_id?: string;
  sort_order?: number;
  status?: FaqStatus;
}
