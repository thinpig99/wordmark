// 단어 검색 (2단계)
// 1) stage "quick": 뜻·발음·품사만 빠르게 만들어 저장하고 바로 돌려줌 → 화면에 즉시 표시
// 2) stage "detail": 뉘앙스·어원·소설 구절·예문을 채워 넣음 → 화면이 이어서 표시
// 공용 사전에 이미 있으면 AI를 부르지 않음
import {
  authenticate,
  consumeQuota,
  corsHeaders,
  errorResponse,
  gemini,
  HttpError,
  json,
  logUsage,
  str,
} from "./_shared.ts";

type AiQuick = {
  valid?: boolean;
  suggestion?: string | null;
  base_form?: string | null;
  ipa?: string;
  pos?: string;
  meaning_ko?: string;
};

type AiDetail = {
  nuance?: string;
  etymology?: { parts?: { part?: string; meaning?: string }[]; note?: string };
  quote?: { text?: string; translation?: string; source?: string | null; note?: string };
  examples?: { en?: string; ko?: string }[];
};

function quickPrompt(word: string) {
  return `You are an English dictionary for Korean learners. Word or phrase: "${word}"
Return ONLY this JSON, nothing else:
{"valid": true|false, "suggestion": string|null, "base_form": string|null, "ipa": "/.../", "pos": "명사|동사|형용사|부사|구동사|...", "meaning_ko": "2-3 short Korean meanings separated by ', '"}
- valid=false if it is not a real English word/phrase (typo or random letters); then suggestion = the most likely intended word, else null.
- base_form = dictionary form if "${word}" is inflected (e.g. "ran" -> "run"), else null.`;
}

function detailPrompt(word: string, meaning: string, pos: string | null) {
  return `You are an English vocabulary tutor for a Korean adult who reads English novels.
Word: "${word}" (${pos ?? ""}: ${meaning})

Return ONLY a JSON object:
{
  "nuance": 2-3 Korean sentences beyond the dictionary: the feeling the word carries, when writers use it, how it differs from a similar word,
  "etymology": {"parts": [{"part": "morpheme as written, e.g. cease or -less", "meaning": "short Korean"}], "note": 1-2 Korean sentences on its origin and how the parts build the meaning},
  "quote": {"text": one English sentence (max 30 words) using the word, "translation": natural Korean, "source": "Author, Title (year)" or null, "note": 1-2 Korean sentences on what the word adds there},
  "examples": [{"en": "...", "ko": "..."}, {"en": "...", "ko": "..."}]
}
Rules:
- Korean sentences in polite, friendly 해요체.
- quote: prefer a real sentence from a classic novel published before 1929 that you know word-for-word. If not completely sure of the exact wording, write an original literary sentence and set "source" to null. Never invent an author or title.
- examples: two natural, modern sentences.`;
}

function cleanDetail(ai: AiDetail) {
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
    nuance: str(ai.nuance, 800),
    etymology_parts: parts,
    etymology_note: str(ai.etymology?.note, 600),
    quote: quoteText
      ? {
        text: quoteText,
        translation: str(ai.quote?.translation, 400),
        source: str(ai.quote?.source, 120),
        note: str(ai.quote?.note, 500),
      }
      : null,
    examples,
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
    const stage = body.stage === "detail" ? "detail" : "quick";

    // ---- 2단계: 상세 설명 채우기 ----
    if (stage === "detail") {
      const { data: word, error } = await admin.from("words").select("*").eq("lemma", lemma).maybeSingle();
      if (error) throw error;
      if (!word) throw new HttpError(404, "단어를 찾지 못했어요.");
      if (word.detail_at) return json({ word });

      const { result, usage } = await gemini<AiDetail>([{ text: detailPrompt(lemma, word.meaning_ko, word.pos) }]);
      await logUsage(admin, user.id, "word_detail", usage);
      const d = cleanDetail(result);
      const { data: updated, error: upErr } = await admin
        .from("words")
        .update({
          nuance: d.nuance,
          etymology: { ...(word.etymology ?? {}), parts: d.etymology_parts, note: d.etymology_note },
          quote: d.quote,
          examples: d.examples,
          detail_at: new Date().toISOString(),
        })
        .eq("id", word.id)
        .is("detail_at", null)
        .select()
        .maybeSingle();
      if (upErr) throw upErr;
      if (updated) return json({ word: updated });
      const again = await admin.from("words").select("*").eq("id", word.id).single();
      return json({ word: again.data });
    }

    // ---- 1단계: 빠른 뜻 ----
    const source = body.source === "photo" ? "photo" : "search";
    const pageId = Number.isInteger(body.page_id) ? body.page_id : null;
    const save = body.save !== false;

    let { data: word, error } = await admin.from("words").select("*").eq("lemma", lemma).maybeSingle();
    if (error) throw error;
    const cached = !!word;

    if (!word) {
      await consumeQuota(userClient, "lookup");
      const { result, model, usage } = await gemini<AiQuick>([{ text: quickPrompt(lemma) }]);
      await logUsage(admin, user.id, "word_quick", usage);
      if (result.valid === false || !str(result.meaning_ko)) {
        const suggestion = str(result.suggestion, 64)?.toLowerCase() ?? null;
        return json({ notFound: true, suggestion: suggestion && suggestion !== lemma ? suggestion : null });
      }
      const row = {
        lemma,
        ipa: str(result.ipa, 80),
        pos: str(result.pos, 20),
        meaning_ko: str(result.meaning_ko, 200) ?? "",
        etymology: { parts: [], note: null, base_form: str(result.base_form, 64) },
        examples: [],
        model,
      };
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

    return json({ word, userWord, cached, needsDetail: !word.detail_at });
  } catch (e) {
    return errorResponse(e);
  }
});
