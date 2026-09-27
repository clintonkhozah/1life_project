import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Sentence, SentencePayload, Word, WordType } from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  getWordTypes(): Observable<WordType[]> {
    return this.http.get<WordType[]>(`${this.baseUrl}/word-types`);
  }

  getWords(typeId: number): Observable<Word[]> {
    return this.http.get<Word[]>(`${this.baseUrl}/word-types/${typeId}/words`);
  }

  createWord(typeId: number, value: string): Observable<Word> {
    return this.http.post<Word>(`${this.baseUrl}/word-types/${typeId}/words`, { value });
  }

  getWordSuggestions(prefix: string): Observable<Word[]> {
    const query = encodeURIComponent(prefix);
    return this.http.get<Word[]>(`${this.baseUrl}/words/suggestions?q=${query}`);
  }

  getSentences(): Observable<Sentence[]> {
    return this.http.get<Sentence[]>(`${this.baseUrl}/sentences`);
  }

  createSentence(payload: SentencePayload): Observable<Sentence> {
    return this.http.post<Sentence>(`${this.baseUrl}/sentences`, payload);
  }

  updateSentence(id: number, payload: SentencePayload): Observable<Sentence> {
    return this.http.put<Sentence>(`${this.baseUrl}/sentences/${id}`, payload);
  }
}
