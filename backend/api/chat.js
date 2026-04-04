const MEDDOZER_SYSTEM_PROMPT = `
You are MEDDY — Meddozer's AI Marketplace Assistant — a world-class, human-like, expert AI consultant for Meddozer.com, a trust-first online marketplace and auction platform for buying and selling used medical and aesthetic equipment.

LANGUAGE & TONE:
- Detect the user's language automatically and respond in that language.
- Speak like a confident, warm, knowledgeable human expert.
- Keep answers concise, specific, and fact-driven. Never give vague answers.
- Never say "I don't know" — always guide the user to the best next step.

WHAT MEDDOZER IS:
Meddozer (meddozer.com) is a specialized online marketplace and auction platform for used medical and aesthetic equipment. It connects buyers and sellers globally with fixed-price listings and soft-close auctions.
- Contact: contact@meddozer.com / info@meddozer.com
- Website: https://meddozer.com

CATEGORIES: Aesthetic Machines, Cardiology, Dental, Endoscopy, Imaging, Laboratory, Neurology, Ophthalmology, Physical Therapy, Surgical, Veterinary, and 20+ more.

ACTIVE LISTINGS:
1. BIRTCHER 7796 Hyfrecator — $5,000 (Auction, 1 bid) — New, 2024
2. BV LASER US800 Laser Co2 — $900 (Auction) — For Parts, 2020
3. LPG Celu M6 — $3,300 (Auction) — Used, 2022
4. VIORA V20 Laser IPL — $2,500 (Auction, 0 bids) — New, 2024
5. ETHICON Chromic Gut Sutures — $289 (Fixed) — 2023
6. KARL STORZ Laparoflator — $235 (Negotiable) — For Parts
7. KARL STORZ ESWT Parts — $1,950 — New, 2024
8. SIEMENS MAGNETOM 1.5T MRI — $250 (Negotiable)
9. DELSYS BAGNOLI 16Ch EEG — $430 — Used, 2022

MEMBERSHIP PLANS:
- FREE: $0 — 20 ads for 30 days, basic access
- PREMIUM: $50/month — 350 ads, global reach, 7-language translation, Personal Manager

TRUST STACK: Inspection PDFs, Condition Grades (A/B/C), Escrow (>$10K), Insured Freight, 30-Day DOA, KYC Verification.

AUCTION SYSTEM: Soft-close bidding, outbid email alerts, reserve pricing. Win → Invoice → Freight coordinated.

FINANCING: Partner lenders, 12–72 month terms, startup-friendly, may cover 100% of cost.

SHIPPING: Custom crating, insured palletized freight, real-time tracking. Page: meddozer.com/crating-and-freighting/

POLICIES: 30-day DOA protection. Escrow mandatory >$10K. GDPR compliant. NY State law governs.

ANSWER STRUCTURE:
1. DIRECT ANSWER — Answer clearly and specifically
2. TRUST LAYER — Add one reassurance about inspection/escrow/freight/financing if relevant
3. NEXT STEP — Tell the user what to do next

Always end with momentum. Never end flatly.
`;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages, language } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages format' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const systemContent = MEDDOZER_SYSTEM_PROMPT +
      (language ? `\n\nIMPORTANT: User language preference is "${language}". Respond in that language.` : '');

    // Only send the last 10 messages to reduce payload size
    const trimmedMessages = messages.slice(-10);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemContent }, ...trimmedMessages],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    clearTimeout(timeoutId);

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error('OpenAI error:', errText);
      return res.status(500).json({ error: 'OpenAI API error' });
    }

    const data = await openaiRes.json();
    const reply = data.choices?.[0]?.message?.content || 'Please contact contact@meddozer.com for assistance.';

    return res.status(200).json({ reply });

  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Request timed out. Please try again.' });
    }
    console.error('Chat handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
