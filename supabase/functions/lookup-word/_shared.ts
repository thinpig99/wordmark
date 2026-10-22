// Wordmark 서버 공용 코드: 인증, CORS, Gemini 호출
import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  console.error(e);
  return json({ error: "잠시 문제가 생겼어요. 다시 시도해 주세요." }, 500);
}

function firstKey(jsonEnv: string | undefined): string | undefined {
  if (!jsonEnv) return undefined;
  try {
    const parsed = JSON.parse(jsonEnv);
    if (typeof parsed === "string") return parsed;
    const values = Object.values(parsed ?? {});
    return typeof values[0] === "string" ? (values[0] as string) : undefined;
  } catch {
    return undefined;
  }
}

export async function authenticate(req: Request): Promise<{
  user: User;
  userClient: SupabaseClient;
  admin: SupabaseClient;
}> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? firstKey(Deno.env.get("SUPABASE_SECRET_KEYS"));
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ?? firstKey(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"));
  if (!serviceKey || !anonKey) throw new Error("Supabase keys are missing in the function env");

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "로그인이 필요해요.");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "로그인이 필요해요.");

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { user: data.user, userClient, admin };
}

export async function consumeQuota(userClient: SupabaseClient, kind: "lookup" | "photo") {
  const { data, error } = await userClient.rpc("consume_quota", { kind });
  if (error) throw error;
  if (!data) {
    throw new HttpError(
      429,
      kind === "lookup"
        ? "오늘 새 단어 검색 한도(30개)를 다 썼어요. 내일 다시 이용해 주세요."
        : "오늘 사진 번역 한도(5장)를 다 썼어요. 내일 다시 이용해 주세요.",
    );
  }
}

// 무료 등급에서 쓸 수 있는 Flash 모델을 순서대로 시도
const MODELS = (Deno.env.get("GEMINI_MODELS") ??
  "gemini-3.5-flash,gemini-3-flash-preview,gemini-2.5-flash,gemini-2.5-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function gemini<T>(parts: Part[]): Promise<{ result: T; model: string }> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new HttpError(500, "AI 키가 아직 설정되지 않았어요.");

  let rateLimited = false;
  for (const model of MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
        }),
      },
    );

    if (res.status === 429) {
      rateLimited = true;
      console.warn(`gemini ${model} rate limited`);
      continue;
    }
    if (!res.ok) {
      console.warn(`gemini ${model} failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
      continue;
    }

    const data = await res.json();
    const text: string = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    try {
      return { result: JSON.parse(text) as T, model };
    } catch {
      console.warn(`gemini ${model} returned non-JSON: ${text.slice(0, 200)}`);
      continue;
    }
  }

  if (rateLimited) {
    throw new HttpError(503, "지금 AI 사용량이 몰렸어요. 1분쯤 뒤에 다시 시도해 주세요.");
  }
  throw new HttpError(502, "AI 응답을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.");
}

export const str = (v: unknown, max = 2000): string | null =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
