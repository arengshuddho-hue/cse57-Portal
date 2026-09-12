const { PORTAL_INFO } = require('../knowledge-base.js');


const RTDB_URL = 'https://cse-57-portal-default-rtdb.firebaseio.com/portalData.json';


const CATEGORY_LABELS = {
  DSA2: 'DSA 2',
  SE: 'Software Engg',
  MATH: 'Complex Variables',
  NUM: 'Numerical Methods',
  DCOM: 'Data Communication',
  IPLAB: 'Internet Prog. Lab',
  LINKS: 'Reference Links',
  COURSES: 'Upcoming Courses',
  FACULTY: 'Faculty List',
  CLASSROOM: 'Classroom Code',
  GC_DSA_LAB: 'DSA Lab (Google Classroom)',
  GC_DSA_THEORY: 'DSA II Theory (Google Classroom)',
  GC_SE_THEORY: 'SE Theory (Google Classroom)',
  GC_SE_LAB: 'SE Lab (Google Classroom)',
  GC_DCOM_THEORY: 'Data Comm Theory (Google Classroom)',
  GC_IPLAB: 'IP Lab (Google Classroom)',
  CLSROUTINE: 'Class Routine',
  HACKATHON: 'Upcoming Hackathon',
  CP: 'Upcoming CP',
  PQS: 'PQ Solutions',
  ROUTINE: 'Exam Routine',
  NOTES: 'Notes',
  SUG: 'Suggestions',
  BOOKS: 'Books',
};


function buildResourceListing(portalData) {
  if (!portalData || typeof portalData !== 'object') return '(No live resource data available right now.)';

  const lines = [];

  for (const [catKey, items] of Object.entries(portalData)) {
    if (catKey === 'TICKER' || !Array.isArray(items)) continue;
    const label = CATEGORY_LABELS[catKey] || catKey;

    items.forEach((item) => {
      if (!item) return;

      if (typeof item === 'string') {
        lines.push(`- [${label}] ${label} -> ${item}`);
        return;
      }

      const title = item.title || item.label || item.name || label;
      const type = item.type || 'link';
      const value = item.content || item.file || item.link || item.code || '';
      if (!value) return;

      if (type === 'text') {
     return;
      }

      lines.push(`- [${label}] ${title} -> ${value}`);
    });
  }

  return lines.length ? lines.join('\n') : '(No live resource data available right now.)';
}

async function fetchLiveResources() {
  try {
    const res = await fetch(RTDB_URL);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch live portal data:', err);
    return null;
  }
}

module.exports = async function handler(req, res) {
  // Shudhu POST request allow kora hocche
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message required' });
  }

  const portalData = await fetchLiveResources();
  const resourceListing = buildResourceListing(portalData);

  const systemPrompt = `Tumi CSE-57 Section C Academic Portal er official assistant.
Tomar kaj holo website er feature, navigation, ebong "kivabe use korte hoy"
shongkranto question er answer deya.

Niche website er shob information deya ache. Shudhu ei information use kore
answer dibe. Kono kichu na jana thakle bole dibe je tumi nishchit na, admin er
sathe jogajog korte bolbe.

Bangla ebong English mixed kore (jevabe Bangladeshi students kotha bole) reply
dibe, shudhu jodi user Bangla te question na kore. Answer choto o clear rakhba.

Jodi user kono note, PQ solution, boi, link, ba onno kono resource chay,
tahole "RESOURCE LINKS" list theke matching item khuje ora direct link ta
shorasori diye dibe (ekdom URL soho). Kokhono bolba na "card e giye dekho" —
jodi list e link thake, seta shorasori paste kore dibe. Jodi kono matching
resource na paw, tahole bole dibe je ekhono eta available na, ebong "Update
Files" form ba admin er kache jogajog korte bolba.

=== WEBSITE INFORMATION ===
${PORTAL_INFO}

=== RESOURCE LINKS (live, up-to-date) ===
${resourceListing}
`;

  // Groq OpenAI-compatible format: 
  const messages = [
    { role: 'system', content: systemPrompt },
    ...(Array.isArray(history) ? history : []),
    { role: 'user', content: message },
  ];

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: messages,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API error:', errText);
      return res.status(500).json({ error: 'AI response failed' });
    }

    const data = await response.json();
    const reply =
      data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : 'Answer generate kora jayni.';

    return res.status(200).json({ reply });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Something went wrong' });
  }
};