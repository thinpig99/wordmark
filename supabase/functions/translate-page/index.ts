// 사진 번역: 책 페이지 사진을 읽어 문장별로 번역하고, 어려운 단어를 골라 저장
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

type AiPage = {
  readable?: boolean;
  book_title?: string | null;
  chapter?: string | null;
  sentences?: { orig?: string; trans?: string }[];
  hard_words?: { word?: string; meaning?: string }[];
};

const PROMPT = `This is a photo of a page from an English book (usually a novel), taken by a Korean reader.
Read the English body text in reading order. Ignore page numbers, running headers, and footnote markers.
If the photo shows two pages, read the left page first. Join words broken by end-of-line hyphens.

Return ONLY a JSON object:
{
  "readable": true or false (false if there is no readable English text),
  "book_title": the book title only if it is printed on the page (e.g. in a running header), otherwise null,
  "chapter": chapter number or title only if printed on the page, otherwise null,
  "sentences": [{"orig": "one English sentence exactly as printed", "trans": "natural, literary Korean translation of that sentence"}],
  "hard_words": [{"word": "dictionary form, lowercase", "meaning": "short Korean meaning in this context"}]
}

Rules:
- Keep the original sentence order. Translate faithfully, in the tone of a Korean novel translation.
- hard_words: 3-8 words on this page that an intermediate Korean learner (CEFR B1-B2) probably does not know. Skip proper nouns and very common words.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.method !== "POST") throw new HttpError(405, "POST only");
    const { user, userClient } = await authenticate(req);
    const body = await req.json().catch(() => ({}));

    const image = typeof body.image === "string" ? body.image.replace(/^data:[^,]+,/, "") : "";
    const mime = ["image/jpeg", "image/png", "image/webp"].includes(body.mime) ? body.mime : "image/jpeg";
    if (!image) throw new HttpError(400, "사진이 없어요.");
    if (image.length > 8_000_000) throw new HttpError(413, "사진이 너무 커요. 다시 찍어 주세요.");

    await consumeQuota(userClient, "photo");
    const { result } = await gemini<AiPage>([
      { inline_data: { mime_type: mime, data: image } },
      { text: PROMPT },
    ]);

    const sentences = (result.sentences ?? [])
      .map((s) => ({ orig: str(s.orig, 1200), trans: str(s.trans, 1200) }))
      .filter((s) => s.orig)
      .slice(0, 80);

    if (result.readable === false || sentences.length === 0) {
      return json({
        unreadable: true,
        message: "사진에서 영어 문장을 읽지 못했어요. 페이지가 잘 보이게 다시 찍어 주세요.",
      });
    }

    const seen = new Set<string>();
    const hardWords = (result.hard_words ?? [])
      .map((w) => ({ word: str(w.word, 64)?.toLowerCase() ?? null, meaning: str(w.meaning, 80) }))
      .filter((w) => w.word && /^[a-z][a-z' -]{0,63}$/.test(w.word) && !seen.has(w.word) && seen.add(w.word))
      .slice(0, 10);

    const { data: page, error } = await userClient
      .from("pages")
      .insert({
        user_id: user.id,
        book_title: str(body.book_title, 120) ?? str(result.book_title, 120),
        chapter: str(result.chapter, 60),
        sentences,
        hard_words: hardWords,
      })
      .select()
      .single();
    if (error) throw error;

    return json({ page });
  } catch (e) {
    return errorResponse(e);
  }
});
