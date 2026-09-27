import { TestBed } from '@angular/core/testing';
import { importProvidersFrom } from '@angular/core';
import { of } from 'rxjs';
import { LucideAngularModule } from 'lucide-angular';
import { AppComponent } from './app.component';
import { ApiService } from './core/services/api.service';
import { APP_ICONS } from './core/icons';
import { Sentence, Word, WordType } from './core/models';

const apiTypes: WordType[] = [
  { id: 7, name: 'Noun' },
  { id: 9, name: 'Verb' },
];
const apiWords: Word[] = [
  { id: 42, word_type_id: 7, value: 'fox' },
  { id: 43, word_type_id: 7, value: 'garden' },
];
const savedSentence: Sentence = {
  id: 55,
  text: 'Comet.',
  word_ids: [44],
  created_at: '2026-09-27T00:00:00.000Z',
};

describe('AppComponent', () => {
  let createSentenceSpy: jasmine.Spy;
  let createWordSpy: jasmine.Spy;

  beforeEach(async () => {
    localStorage.removeItem('words-game-guide-seen');
    createSentenceSpy = jasmine
      .createSpy('createSentence')
      .and.returnValue(of(savedSentence));
    createWordSpy = jasmine
      .createSpy('createWord')
      .and.returnValue(of({ id: 44, word_type_id: 7, value: 'comet', usage_count: 0 }));
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        {
          provide: ApiService,
          useValue: {
            getWordTypes: () => of(apiTypes),
            getSentences: () => of([]),
            getWords: (typeId: number) => of(typeId === 7 ? apiWords : []),
            getWordSuggestions: (prefix: string) =>
              of(
                apiWords.filter((word) =>
                  word.value.toLowerCase().startsWith(prefix.toLowerCase()),
                ),
              ),
            createWord: createWordSpy,
            createSentence: createSentenceSpy,
            updateSentence: () => of(savedSentence),
          },
        },
        importProvidersFrom(LucideAngularModule.pick(APP_ICONS)),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('shows the guide on first visit and lets the user skip it', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.guide-skip')?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    expect(localStorage.getItem('words-game-guide-seen')).toBe('true');
  });

  it('can reopen the guide from the top-right help button', () => {
    localStorage.setItem('words-game-guide-seen', 'true');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeNull();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.guide-trigger')?.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="dialog"]')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('drag a word across');
  });

  it('selects Noun by default and loads its word library', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.activeType()?.name).toBe('Noun');
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Words game');
    expect(compiled.querySelectorAll('.type-select option').length).toBe(2);
    expect(compiled.querySelectorAll('.word-tile').length).toBe(2);
    expect(compiled.querySelector('.word-section-heading')?.textContent).toContain('Noun words');
  });

  it('loads and filters the full word library after choosing a category', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.selectType(apiTypes[0]);
    app.libraryFilter.set('gar');
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('.word-tile').length).toBe(1);
    expect(compiled.querySelector('.word-section-heading')?.textContent).toContain('Noun words');
  });

  it('adds a selected library word to the sentence', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.addWord(apiWords[0]);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.sentence-preview')?.textContent,
    ).toContain('Fox.');
  });

  it('saves a newly typed word with its selected category', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.selectType(apiTypes[0]);
    app.search.set('comet');
    app.newWordTypeId.set(apiTypes[0].id);
    app.addTypedWord();

    await app.saveSentence();

    expect(createSentenceSpy).toHaveBeenCalledWith({
      text: 'Comet.',
      words: [{ word_type_id: 7, value: 'comet' }],
    });
  });

  it('adds a word directly to the selected category library', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.selectType(apiTypes[0]);
    fixture.detectChanges();
    app.addWordOpen.set(true);
    app.newLibraryWord.set('comet');

    await app.saveLibraryWord(apiTypes[0]);

    expect(createWordSpy).toHaveBeenCalledWith(7, 'comet');
    expect(app.addWordOpen()).toBeFalse();
  });
});
