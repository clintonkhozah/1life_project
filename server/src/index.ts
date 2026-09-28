import "dotenv/config";
import cors from "cors";
import express from "express";
import { initializeDatabase, pool } from "./db";
import { seedVocabulary } from "./seed";

interface SentenceWordInput {
  word_type_id: number;
  value: string;
}

interface SentenceRow {
  id: number;
  text: string;
  word_ids: number[];
  created_at: string;
  updated_at: string;
}

const app = express();
const port = Number(process.env.PORT ?? 3000);

const allowedOrigins = new Set(
  [
    process.env.CLIENT_ORIGIN,
    "http://localhost:4200",
    "http://127.0.0.1:4200",
    "https://clint-sentence-web-2026-ana0gpdehthue3g0.southafricanorth-01.azurewebsites.net",
  ].filter((origin): origin is string => Boolean(origin)),
);

app.use(
  cors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.has(origin) ||
        origin.endsWith(".azurewebsites.net")
      ) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
  }),
);
app.use(express.json({ limit: "32kb" }));

app.get("/api/health", (_request, response) => response.json({ status: "ok" }));

app.get("/api/word-types", async (_request, response, next) => {
  // A robot did this.
  try {
    const { rows } = await pool.query(
      "SELECT id, name FROM word_types ORDER BY id",
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/word-types/:id/words", async (request, response, next) => {
  const typeId = Number(request.params.id);
  if (!Number.isInteger(typeId) || typeId < 1)
    return response.status(400).json({ error: "Invalid word type id." });
  try {
    const { rows } = await pool.query(
      "SELECT id, word_type_id, value FROM words WHERE word_type_id = $1 ORDER BY value",
      [typeId],
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/word-types/:id/words", async (request, response, next) => {
  const typeId = Number(request.params.id);
  const value = typeof request.body?.value === "string" ? request.body.value.trim() : "";
  if (!Number.isInteger(typeId) || typeId < 1)
    return response.status(400).json({ error: "Invalid word type id." });
  if (!value || value.length > 80 || /\s/.test(value))
    return response.status(400).json({ error: "Provide a single word of 1 to 80 characters." });
  try {
    const { rows } = await pool.query(
      `INSERT INTO words(word_type_id, value)
       VALUES($1, $2)
       ON CONFLICT (word_type_id, (LOWER(value))) DO NOTHING
       RETURNING id, word_type_id, value, usage_count`,
      [typeId, value],
    );
    if (rows[0]) return response.status(201).json(rows[0]);
    const existing = await pool.query(
      "SELECT id, word_type_id, value, usage_count FROM words WHERE word_type_id = $1 AND LOWER(value) = LOWER($2)",
      [typeId, value],
    );
    if (!existing.rows[0]) return response.status(404).json({ error: "Word type not found." });
    response.json(existing.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.get("/api/words/suggestions", async (request, response, next) => {
  const prefix = typeof request.query.q === "string" ? request.query.q.trim() : "";
  if (!prefix || prefix.length > 80 || /\s/.test(prefix))
    return response.status(400).json({ error: "Provide a single-word prefix of 1 to 80 characters." });
  try {
    const { rows } = await pool.query(
            `SELECT w.id, w.word_type_id, wt.name AS word_type_name, w.value,
              w.usage_count
       FROM words w
       JOIN word_types wt ON wt.id = w.word_type_id
       WHERE LEFT(LOWER(w.value), CHAR_LENGTH($1)) = LOWER($1)
         ORDER BY (LOWER(w.value) = LOWER($1)) DESC,
            w.usage_count DESC, w.value
       LIMIT 12`,
      [prefix],
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get(
  "/api/word-types/:id/words/suggestions",
  async (request, response, next) => {
    const typeId = Number(request.params.id);
    const prefix = typeof request.query.q === "string" ? request.query.q.trim() : "";
    if (!Number.isInteger(typeId) || typeId < 1 || !prefix || prefix.length > 80)
      return response.status(400).json({ error: "Provide a word type id and a prefix of 1 to 80 characters." });
    try {
      const { rows } = await pool.query(
        `SELECT id, word_type_id, value, usage_count
         FROM words
         WHERE word_type_id = $1
           AND LEFT(LOWER(value), CHAR_LENGTH($2)) = LOWER($2)
         ORDER BY usage_count DESC, (LOWER(value) = LOWER($2)) DESC, value
         LIMIT 12`,
        [typeId, prefix],
      );
      response.json(rows);
    } catch (error) {
      next(error);
    }
  },
);

function isSentenceWordInput(value: unknown): value is SentenceWordInput[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (word) =>
        word !== null &&
        typeof word === "object" &&
        Number.isInteger((word as SentenceWordInput).word_type_id) &&
        (word as SentenceWordInput).word_type_id > 0 &&
        typeof (word as SentenceWordInput).value === "string" &&
        (word as SentenceWordInput).value.trim().length > 0 &&
        !(word as SentenceWordInput).value.trim().includes(" "),
    )
  );
}

async function resolveSentenceWords(body: {
  words?: unknown;
  word_ids?: unknown;
}): Promise<SentenceWordInput[] | null> {
  if (body.words !== undefined)
    return isSentenceWordInput(body.words) ? body.words : null;
  if (
    !Array.isArray(body.word_ids) ||
    !body.word_ids.length ||
    !body.word_ids.every((id) => Number.isInteger(id) && id > 0)
  )
    return null;

  const ids = body.word_ids as number[];
  const { rows } = await pool.query<SentenceWordInput & { id: number }>(
    "SELECT id, word_type_id, value FROM words WHERE id = ANY($1::int[])",
    [ids],
  );
  const wordsById = new Map(rows.map((word) => [word.id, word]));
  const orderedWords = ids.map((id) => wordsById.get(id));
  return orderedWords.every((word) => word !== undefined)
    ? (orderedWords as SentenceWordInput[])
    : null;
}

async function persistSentence(
  text: string,
  words: SentenceWordInput[],
  sentenceId?: number,
): Promise<SentenceRow | null> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (sentenceId !== undefined) {
      const existing = await client.query(
        "SELECT id FROM sentences WHERE id = $1 FOR UPDATE",
        [sentenceId],
      );
      if (!existing.rowCount) {
        await client.query("ROLLBACK");
        return null;
      }
    }

    const wordIds: number[] = [];
    for (const word of words) {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO words(word_type_id, value, usage_count)
         VALUES($1, $2, 1)
         ON CONFLICT (word_type_id, (LOWER(value)))
         DO UPDATE SET usage_count = words.usage_count + 1
         RETURNING id`,
        [word.word_type_id, word.value.trim()],
      );
      wordIds.push(rows[0].id);
    }

    const result = sentenceId === undefined
      ? await client.query<SentenceRow>(
          "INSERT INTO sentences(text, word_ids) VALUES($1, $2) RETURNING id, text, word_ids, created_at, updated_at",
          [text.trim(), wordIds],
        )
      : await client.query<SentenceRow>(
          "UPDATE sentences SET text = $1, word_ids = $2, updated_at = NOW() WHERE id = $3 RETURNING id, text, word_ids, created_at, updated_at",
          [text.trim(), wordIds, sentenceId],
        );
    await client.query("COMMIT");
    return result.rows[0] ?? null;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

app.post("/api/sentences", async (request, response, next) => {
  // A robot did this.
  const { text } = request.body as {
    text?: unknown;
  };
  try {
    const words = await resolveSentenceWords(request.body);
    if (typeof text !== "string" || !text.trim() || !words)
      return response.status(400).json({ error: "Provide sentence text and either a non-empty words array or word_ids array." });
    const sentence = await persistSentence(text, words);
    response.status(201).json(sentence);
  } catch (error) {
    next(error);
  }
});

app.get("/api/sentences", async (_request, response, next) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, text, word_ids, created_at, updated_at FROM sentences ORDER BY created_at DESC, id DESC",
    );
    response.json(rows);
  } catch (error) {
    next(error);
  }
});

app.get("/api/sentences/:id", async (request, response, next) => {
  const id = Number(request.params.id);
  if (!Number.isInteger(id) || id < 1)
    return response.status(400).json({ error: "Invalid sentence id." });
  try {
    const { rows } = await pool.query(
      "SELECT id, text, word_ids, created_at, updated_at FROM sentences WHERE id = $1",
      [id],
    );
    if (!rows[0])
      return response.status(404).json({ error: "Sentence not found." });
    response.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put("/api/sentences/:id", async (request, response, next) => {
  const id = Number(request.params.id);
  const { text } = request.body as { text?: unknown };
  if (!Number.isInteger(id) || id < 1)
    return response.status(400).json({ error: "Invalid sentence id." });
  try {
    const words = await resolveSentenceWords(request.body);
    if (typeof text !== "string" || !text.trim() || !words)
      return response.status(400).json({ error: "Provide sentence text and either a non-empty words array or word_ids array." });
    const sentence = await persistSentence(text, words, id);
    if (!sentence)
      return response.status(404).json({ error: "Sentence not found." });
    response.json(sentence);
  } catch (error) {
    next(error);
  }
});

app.use(
  (
    error: unknown,
    _request: express.Request,
    response: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(error);
    response
      .status(500)
      .json({ error: "An unexpected server error occurred." });
  },
);

initializeDatabase()
  .then(() => seedVocabulary())
  .then(() => {
    app.listen(port, "0.0.0.0", () =>
      console.log(`Sentence Builder API listening on port ${port}`),
    );
  })
  .catch((error: unknown) => {
    console.error("Could not initialize database:", error);
    process.exit(1);
  });
