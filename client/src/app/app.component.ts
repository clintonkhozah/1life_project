import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { LucideAngularModule } from 'lucide-angular';
import {
  Subject,
  catchError,
  debounceTime,
  firstValueFrom,
  forkJoin,
  map,
  of,
  switchMap,
} from 'rxjs';
import { ApiService } from './core/services/api.service';
import { Sentence, Word, WordType } from './core/models';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DatePipe, FormsModule, MatButtonModule, LucideAngularModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly api = inject(ApiService);
  readonly types = signal<WordType[]>([]);
  readonly activeType = signal<WordType | null>(null);
  readonly categoryMotion = signal(0);
  readonly words = signal<Word[]>([]);
  readonly libraryFilter = signal('');
  readonly suggestions = signal<Word[]>([]);
  readonly selected = signal<Word[]>([]);
  readonly sentences = signal<Sentence[]>([]);
  readonly activeTab = signal<'build' | 'saved'>('build');
  readonly guideOpen = signal(false);
  readonly search = signal('');
  readonly editingId = signal<number | null>(null);
  readonly notice = signal('');
  readonly typesLoading = signal(true);
  readonly wordsLoading = signal(false);
  readonly sentencesLoading = signal(true);
  readonly editWordsLoading = signal(false);
  readonly typesError = signal('');
  readonly wordsError = signal('');
  readonly addWordOpen = signal(false);
  readonly newLibraryWord = signal('');
  readonly addWordError = signal('');
  readonly addingWord = signal(false);
  readonly sentencesError = signal('');
  readonly saveError = signal('');
  readonly editError = signal('');
  readonly suggestionsLoading = signal(false);
  readonly suggestionsError = signal(false);
  readonly wordInputError = signal('');
  readonly newWordTypeId = signal<number | null>(null);
  readonly saving = signal(false);
  readonly dragOver = signal(false);
  private temporaryWordId = -1;
  private readonly suggestionQueries = new Subject<{
    prefix: string;
  } | null>();
  readonly filteredWords = computed(() => {
    const query = this.libraryFilter().trim().toLowerCase();
    return this.words().filter((word) => !query || word.value.toLowerCase().includes(query));
  });

  constructor() {
    try {
      this.guideOpen.set(
        typeof window !== 'undefined' &&
          window.localStorage.getItem('words-game-guide-seen') !== 'true',
      );
    } catch {
      this.guideOpen.set(true);
    }
    this.suggestionQueries
      .pipe(
        debounceTime(120),
        switchMap((query) =>
          query
            ? this.api.getWordSuggestions(query.prefix).pipe(
                map((suggestions) => ({ suggestions, failed: false })),
                catchError(() => of({ suggestions: [] as Word[], failed: true })),
              )
            : of({ suggestions: [] as Word[], failed: false }),
        ),
      )
      .subscribe(({ suggestions, failed }) => {
        this.suggestions.set(suggestions);
        this.suggestionsError.set(failed);
        this.suggestionsLoading.set(false);
      });
    this.loadWordTypes();
    this.loadSentences();
  }

  closeGuide(): void {
    this.guideOpen.set(false);
    try {
      window.localStorage.setItem('words-game-guide-seen', 'true');
    } catch {
      return;
    }
  }

  loadWordTypes(): void {
    this.typesLoading.set(true);
    this.typesError.set('');
    this.api.getWordTypes().subscribe({
      next: (types) => {
        this.types.set(types);
        const defaultType =
          types.find((type) => type.name.toLowerCase() === 'noun') ??
          types[0] ??
          null;
        this.activeType.set(defaultType);
        this.words.set([]);
        if (defaultType) this.loadWords(defaultType);
      },
      error: () => {
        this.typesLoading.set(false);
        this.typesError.set(
          'Word types could not be loaded. Check that the API and database are running.',
        );
      },
      complete: () => this.typesLoading.set(false),
    });
  }

  loadSentences(): void {
    this.sentencesLoading.set(true);
    this.sentencesError.set('');
    this.api.getSentences().subscribe({
      next: (sentences) => this.sentences.set(sentences),
      error: () => {
        this.sentencesLoading.set(false);
        this.sentencesError.set(
          'Saved sentences could not be loaded. Check that the API and database are running.',
        );
      },
      complete: () => this.sentencesLoading.set(false),
    });
  }

  selectType(type: WordType): void {
    this.categoryMotion.update((value) => value + 1);
    this.activeType.set(type);
    this.search.set('');
    this.suggestions.set([]);
    this.suggestionsLoading.set(false);
    this.wordInputError.set('');
    this.libraryFilter.set('');
    this.suggestionQueries.next(null);
    this.words.set([]);
    this.loadWords(type);
  }

  selectTypeById(typeId: number | string): void {
    const selectedType = this.types().find((type) => type.id === Number(typeId));
    if (selectedType) this.selectType(selectedType);
  }

  onWordInput(value: string): void {
    this.search.set(value);
    this.suggestions.set([]);
    this.suggestionsError.set(false);
    const prefix = value.trim();
    if (!prefix) {
      this.wordInputError.set('');
      this.suggestionsLoading.set(false);
      this.suggestionQueries.next(null);
      return;
    }
    if (/\s/.test(prefix)) {
      this.wordInputError.set('Add one word at a time, then continue with the next one.');
      this.suggestionsLoading.set(false);
      this.suggestionQueries.next(null);
      return;
    }
    this.wordInputError.set('');
    this.suggestionsLoading.set(true);
    this.suggestionQueries.next({ prefix });
  }

  addTypedWord(): void {
    const type = this.types().find((item) => item.id === this.newWordTypeId());
    const value = this.search().trim();
    if (!type || !value || /\s/.test(value)) return;
    const existing = this.suggestions().find(
      (word) => word.value.toLowerCase() === value.toLowerCase(),
    ) ?? this.words().find(
      (word) => word.value.toLowerCase() === value.toLowerCase(),
    );
    if (existing) {
      this.addWord(existing);
    } else {
      this.addWord({
        id: this.temporaryWordId--,
        word_type_id: type.id,
        value,
        usage_count: 0,
      });
    }
    this.newWordTypeId.set(null);
    this.clearWordInput();
  }

  canAddTypedWord(): boolean {
    const value = this.search().trim();
    return !!value &&
      !/\s/.test(value) &&
      !this.suggestions().some((word) => word.value.toLowerCase() === value.toLowerCase());
  }

  wordTypeName(word: Word): string {
    return word.word_type_name ?? this.types().find((type) => type.id === word.word_type_id)?.name ?? '';
  }

  matchedPart(value: string, query: string): string {
    const prefix = query.trim();
    if (!prefix || !value.toLowerCase().startsWith(prefix.toLowerCase())) return '';
    return value.slice(0, prefix.length);
  }

  unmatchedPart(value: string, query: string): string {
    return value.slice(this.matchedPart(value, query).length);
  }

  clearWordInput(): void {
    this.search.set('');
    this.suggestions.set([]);
    this.suggestionsLoading.set(false);
    this.wordInputError.set('');
    this.suggestionQueries.next(null);
  }

  addWord(word: Word): void {
    this.selected.update((items) => [...items, word]);
  }

  startWordDrag(word: Word, event: DragEvent): void {
    event.dataTransfer?.setData(
      'application/x-sentence-word',
      JSON.stringify({ id: word.id, word_type_id: word.word_type_id, value: word.value }),
    );
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
  }

  allowWordDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  dropWord(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const data = event.dataTransfer?.getData('application/x-sentence-word');
    if (!data) return;
    try {
      const word = JSON.parse(data) as Word;
      if (Number.isInteger(word.word_type_id) && word.value?.trim()) this.addWord(word);
    } catch {
      return;
    }
  }

  removeWord(index: number): void {
    this.selected.update((items) => items.filter((_, i) => i !== index));
  }

  moveWord(index: number, offset: number): void {
    this.selected.update((items) => {
      const destination = index + offset;
      if (destination < 0 || destination >= items.length) return items;
      const reordered = [...items];
      [reordered[index], reordered[destination]] = [
        reordered[destination],
        reordered[index],
      ];
      return reordered;
    });
  }

  get preview(): string {
    const sentence = this.selected()
      .map((word) => word.value)
      .join(' ');
    return sentence
      ? sentence.charAt(0).toUpperCase() +
          sentence.slice(1) +
          (/[.!?]$/.test(sentence) ? '' : '.')
      : '';
  }

  async saveSentence(): Promise<void> {
    // A robot did this.
    if (!this.selected().length) return;
    this.saveError.set('');
    const payload = {
      text: this.preview,
      words: this.selected().map(({ word_type_id, value }) => ({
        word_type_id,
        value,
      })),
    };
    const editingId = this.editingId();
      this.saving.set(true);
    try {
      const saved = editingId
        ? await firstValueFrom(this.api.updateSentence(editingId, payload))
        : await firstValueFrom(this.api.createSentence(payload));
      this.upsertSentence(saved);
    } catch {
      this.saveError.set(
        'Your sentence was not saved. Check the API and database, then try again.',
      );
      return;
    } finally {
      this.saving.set(false);
    }
    this.notice.set(editingId ? 'Sentence updated' : 'Sentence saved');
    this.editingId.set(null);
    this.selected.set([]);
    const activeType = this.activeType();
    if (activeType) this.loadWords(activeType);
    this.activeTab.set('saved');
    window.setTimeout(() => this.notice.set(''), 2600);
  }

  editSentence(sentence: Sentence): void {
    this.editError.set('');
    this.selected.set([]);
    this.editingId.set(sentence.id);
    this.activeTab.set('build');
    if (!sentence.word_ids?.length || !this.types().length) {
      this.editingId.set(null);
      this.editError.set('This sentence has no saved word selections to edit.');
      return;
    }
    this.editWordsLoading.set(true);
    forkJoin(this.types().map((type) => this.api.getWords(type.id)))
      .pipe(
        map((groups) => new Map(groups.flat().map((word) => [word.id, word]))),
      )
      .subscribe({
        next: (wordById) => {
          const orderedWords = sentence.word_ids.map((id) => wordById.get(id));
          if (orderedWords.some((word) => !word)) {
            this.editingId.set(null);
            this.editError.set(
              'Some words in this sentence are no longer available.',
            );
            return;
          }
          this.selected.set(orderedWords as Word[]);
        },
        error: () => {
          this.editingId.set(null);
          this.editError.set(
            'Sentence words could not be loaded. Check the API and try again.',
          );
        },
        complete: () => this.editWordsLoading.set(false),
      });
  }

  trackWord(_: number, word: Word): number {
    return word.id;
  }
  trackType(_: number, type: WordType): number {
    return type.id;
  }

  loadWords(type: WordType): void {
    this.wordsLoading.set(true);
    this.wordsError.set('');
    this.api.getWords(type.id).subscribe({
      next: (words) => this.words.set(words),
      error: () => {
        this.wordsLoading.set(false);
        this.wordsError.set(
          'Words could not be loaded. Check the API and database, then try again.',
        );
      },
      complete: () => this.wordsLoading.set(false),
    });
  }

  async saveLibraryWord(type: WordType): Promise<void> {
    const value = this.newLibraryWord().trim();
    if (!value || /\s/.test(value) || this.addingWord()) return;
    this.addingWord.set(true);
    this.addWordError.set('');
    try {
      await firstValueFrom(this.api.createWord(type.id, value));
      this.newLibraryWord.set('');
      this.addWordOpen.set(false);
      this.loadWords(type);
    } catch {
      this.addWordError.set('Could not add that word. Check the spelling and try again.');
    } finally {
      this.addingWord.set(false);
    }
  }

  toggleLibraryAddForm(): void {
    this.addWordOpen.update((isOpen) => !isOpen);
    this.addWordError.set('');
  }

  private upsertSentence(sentence: Sentence): void {
    this.sentences.update((items) => [
      sentence,
      ...items.filter((item) => item.id !== sentence.id),
    ]);
  }
}
