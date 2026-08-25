// lib/claude.js
//
// Sends the raw search evidence to Gemini and gets back a structured,
// evidence-grounded scoring of the entity. The model is instructed to
// reason ONLY over the evidence it's given — no filling in gaps from its
// own training knowledge, no inventing sources or numbers.
//
// Requires GEMINI_API_KEY in the environment.
// Get a free key at https://aistudio.google.com

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are the scoring engine behind Notable, a product that measures a
person's, brand's, or company's "Online Notability" from real search evidence.

Rules you must follow exactly:
- Only use the evidence items provided in the user message. Never use outside knowledge about
  the entity, and never invent a source, title, URL, date, or statistic that is not in the
  evidence list.
- If the evidence is thin, insufficient, or clearly about a different entity with the same
  name, say so honestly in the scores rather than inflating them.
- Detect near-duplicate / syndicated coverage (the same underlying story appearing on multiple
  outlets) and count it separately from independent coverage.
- Classify each source's likely nature only from what's observable (title, snippet, publication,
  domain) — use "likely editorial", "likely promotional", "possible syndication", or "uncertain".
  Never assert something is fake, paid, or fraudulent without clear evidence in the snippet.
- Respond with STRICT JSON only. No prose, no markdown code fences, no commentary before or
  after the JSON object.

Output this exact JSON shape:
{
  "entityConfirmed": boolean,
  "matchConfidence": number (0-100),
  "overallScore": number (0-100),
  "tier": "Very Low" | "Emerging" | "Developing" | "Established" | "Strong" | "Exceptional",
  "components": {
    "mediaPresence": number (0-100),
    "sourceQuality": number (0-100),
    "coverageDiversity": number (0-100),
    "recency": number (0-100),
    "originality": number (0-100),
    "entityConsistency": number (0-100)
  },
  "mentionsFound": number,
  "independentMentions": number,
  "duplicateMentions": number,
  "strongestPublication": string | null,
  "topGaps": [ { "title": string, "detail": string, "priority": "HIGH" | "MEDIUM" | "LOW" } ],
  "sources": [ { "title": string, "url": string, "publication": string, "classification": string, "relevant": boolean } ],
  "notes": string
}`;

function buildUserPrompt(query, evidence) {
  const trimmed = evidence.slice(0, 40); // keep the prompt bounded
  return `Entity to score: "${query}"

Evidence (${trimmed.length} items, deduplicated by URL):
${JSON.stringify(trimmed, null, 2)}

Score this entity's Online Notability using only the evidence above. Return the JSON object only.`;
}

function extractJSON(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in model output.');
  return JSON.parse(text.slice(start, end + 1));
}

async function scoreEntity(query, evidence) {
  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: buildUserPrompt(query, evidence) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini API request failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return extractJSON(text);
}

module.exports = { scoreEntity };
