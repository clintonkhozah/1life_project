export interface WordType {
  id: number;
  name: string;
  color?: string;
}

export interface Word {
  id: number;
  word_type_id: number;
  value: string;
  usage_count?: number;
  word_type_name?: string;
}

export interface SentenceWordInput {
  word_type_id: number;
  value: string;
}

export interface Sentence {
  id: number;
  text: string;
  word_ids: number[];
  created_at: string;
  updated_at?: string;
}

export interface SentencePayload {
  text: string;
  words: SentenceWordInput[];
}
