// 단어 검색: 공용 사전에 있으면 그대로, 없으면 Gemini로 만들어 저장한 뒤 내 단어장에 담기
import {
  authenticate,
  consumeQuota,
  corsHeaders,
  errorResponse,
  gemini,
  HttpError,
  json,
  str,
} from "./_shared.ts";

type AiWord = {
  valid?: boolean;
  suggestion?: string | null;
  base_form?: string | null;
  ipa?: string;
  pos?: string;
  meaning_ko?: string;
  nuance?: string;
  etymology?: { parts?: { part?: string; meaning?: string }[]; note?: string };
  quote?: { text?: string; translation?: string; source?: string | null; note?: string };
  examples?: { en?: string; ko?: string }[];
};

function prompt(word: string) {
  return `You are an English vocabulary tutor for a Korean adult who reads English novels.
Explain the English word or phrase: "${word}"

Return ONLY a JSON object with exactly these keys:
{
  "valid": true or false (false if it is not a real English word or phrase, e.g. a typo or random letters),
  "suggestion": the most likely intended word if invalid and it looks like a typo, otherwise null,
  "base_form": the dictionary form if "${word}" is an inflected form (e.g. "ran" -> "run"), otherwise null,
  "ipa": IPA pronunciation in slashes, e.g. "/ˈsiːs.ləs.li/",
  "pos": part of speech in Korean, e.g. "명사", "동사", "형용사", "부사", "구동사",
  "meaning_ko": 2-3 short Korean meanings separated by ", ",
  "nuance": 2-3 Korean sentences that go beyond the dictionary: the feeling the word carries, when writers use it, and how it differs from a similar word,
  "etymology": {
    "parts": [{"part": "morpheme as written in the word, e.g. cease or -less", "meaning": "short Korean meaning"}],
    "note": 1-2 Korean sentences on its origin (Latin, Greek, Old English, French...) and how the parts build the meaning
  },
  "quote": {
    "text": one English sentence (max 30 words) using the word,
    "translation": natural Korean translation of that sentence,
    "source": "Author, Title (year)" or null,
    "note": 1-2 Korean sentences on what the word adds in that sentence
  },
  "examples": [{"en": "...", "ko": "..."}, {"en": "...", "ko": "..."}]
}

Rules:
- Write every Korean field in polite, friendly 해요체 where it is a sentence.
- quote: prefer a real sentence from a classic novel published before 1929 (public domain) that you know word-for-word. If you are not completely sure of the exact wording, write an original sentence in a literary novel style instead and set "source" to null. Never invent an author or a title.
- examples: two natural, modern sentences that show typical usage.
- etymology.parts: split into meaningful parts; use a single part if the word has one root.
- If valid is false, the other fields may be empty strings.`;
}

function clean(ai: AiWord, lemma: string, model: string) {
  const parts = (ai.etymology?.parts ?? [])
    .map((p) => ({ part: str(p.part, 40), meaning: str(p.meaning, 60) }))
    .filter((p) => p.part)
    .slice(0, 5);
  const examples = (ai.examples ?? [])
    .map((e) => ({ en: str(e.en, 300), ko: str(e.ko, 300) }))
    .filter((e) => e.en)
    .slice(0, 3);
  const quoteText = str(ai.quote?.text, 400);
  return {
    lemma,
    ipa: str(ai.ipa, 80),
    pos: str(ai.pos, 20),
    meaning_ko: str(ai.meaning_ko, 200) ?? "",
    nuance: str(ai.nuance, 800),
    etymology: { parts, note: str(ai.etymology?.note, 600), base_form: str(ai.base_form, 64) },
    quote: quoteText
      ? {
        text: quoteText,
        translation: str(ai.quote?.translation, 400),
        source: str(ai.quote?.source, 120),
        note: str(ai.quote?.note, 500),
      }
      : null,
    examples,
    model,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") throw new HttpError(405, "POST only");
    const { user, userClient, admin } = await authenticate(req);
    const body = await req.json().catch(() => ({}));

    const lemma = String(body.word ?? "")
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
    if (!/^[a-z][a-z' -]{0,63}$/.test(lemma)) {
      throw new HttpError(400, "영어 단어를 입력해 주세요.");
    }
    const source = body.source === "photo" ? "photo" : "search";
    const pageId = Number.isInteger(body.page_id) ? body.page_id : null;
    const save = body.save !== false;

    let { data: word, error } = await admin.from("words").select("*").eq("lemma", lemma).maybeSingle();
    if (error) throw error;
    const cached = !!word;

    if (!word) {
      await consumeQuota(userClient, "lookup");
      const { result, model } = await gemini<AiWord>([{ text: prompt(lemma) }]);
      if (result.valid === false || !str(result.meaning_ko)) {
        const suggestion = str(result.suggestion, 64)?.toLowerCase() ?? null;
        return json({ notFound: true, suggestion: suggestion && suggestion !== lemma ? suggestion : null });
      }
      const row = clean(result, lemma, model);
      const ins = await admin.from("words").upsert(row, { onConflict: "lemma", ignoreDuplicates: true })
        .select().maybeSingle();
      if (ins.error) throw ins.error;
      word = ins.data;
      if (!word) {
        const again = await admin.from("words").select("*").eq("lemma", lemma).single();
        if (again.error) throw again.error;
        word = again.data;
      }
    }

    let userWord = null;
    if (save) {
      const up = await userClient
        .from("user_words")
        .upsert(
          { user_id: user.id, word_id: word.id, source, page_id: pageId },
          { onConflict: "user_id,word_id", ignoreDuplicates: true },
        )
        .select()
        .maybeSingle();
      if (up.error) throw up.error;
      userWord = up.data;
    }
    if (!userWord) {
      const existing = await userClient.from("user_words").select("*").eq("word_id", word.id).maybeSingle();
      userWord = existing.data;
    }

    return json({ word, userWord, cached });
  } catch (e) {
    return errorResponse(e);
  }
});
