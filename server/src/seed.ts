import { pool, initializeDatabase } from "./db";

const vocabulary: Record<string, string[]> = {
  Noun: ["fox", "garden", "story", "moon", "coffee", "river", "idea", "friend"],
  Verb: [
    "wanders",
    "builds",
    "dreams",
    "finds",
    "writes",
    "dances",
    "notices",
    "creates",
  ],
  Adjective: [
    "quiet",
    "curious",
    "bright",
    "tiny",
    "thoughtful",
    "wild",
    "gentle",
    "clever",
  ],
  Adverb: [
    "softly",
    "boldly",
    "carefully",
    "often",
    "suddenly",
    "happily",
    "almost",
    "together",
  ],
  Pronoun: ["she", "they", "we", "it", "you", "he"],
  Preposition: ["beneath", "beside", "through", "beyond", "inside", "after"],
  Conjunction: ["and", "but", "because", "while", "although", "or"],
  Determiner: ["the", "a", "this", "every", "some", "those"],
  Exclamation: ["oh", "aha", "wow", "hey", "hurray"],
};

export async function seedVocabulary(): Promise<void> {
  await initializeDatabase();
  for (const [name, words] of Object.entries(vocabulary)) {
    const { rows } = await pool.query<{ id: number }>(
      "INSERT INTO word_types(name) VALUES($1) ON CONFLICT(name) DO UPDATE SET name = EXCLUDED.name RETURNING id",
      [name],
    );
    for (const value of words) {
      await pool.query(
        "INSERT INTO words(word_type_id, value) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM words WHERE word_type_id = $1 AND value = $2)",
        [rows[0].id, value],
      );
    }
  }
  console.log("Database schema and vocabulary are ready.");
}

const startedDirectly = /seed\.[cm]?js$/i.test(process.argv[1] ?? "");
if (startedDirectly) {
  seedVocabulary()
    .catch((error: unknown) => {
      console.error("Database seed failed:", error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
