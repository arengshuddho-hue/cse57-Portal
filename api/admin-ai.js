// Vercel Serverless Function: Admin AI Copilot (Vision + Text OCR + Post Preparer)
const RTDB_URL = 'https://cse-57-portal-default-rtdb.firebaseio.com/portalData.json';

const VALID_CATEGORIES = [
  'TICKER', 'DSA2', 'SE', 'MATH', 'NUM', 'DCOM', 'IPLAB', 'LINKS',
  'COURSES', 'FACULTY', 'CLASSROOM', 'GCLASSROOM', 'CLSROUTINE',
  'HACKATHON', 'CP', 'PQS', 'ROUTINE', 'NOTES', 'SUG', 'BOOKS', 'SECRETC'
];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, image, makePdf } = req.body || {};

  if (!prompt && !image) {
    return res.status(400).json({ error: 'Either prompt or image is required' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY is not configured in environment' });
  }

  const systemInstruction = `You are an intelligent Admin Assistant for the CSE-57 Section C Academic Portal.
Your task is to analyze admin instructions and images (class notices, routines, handwritten notes, exam schedules).
Extract and structure the content into an academic portal post.

Allowed Category Keys:
- TICKER (Scrolling Notice)
- DSA2 (DSA 2)
- SE (Software Engineering)
- MATH (Complex Variables)
- NUM (Numerical Methods)
- DCOM (Data Communication)
- IPLAB (Internet Programming Lab)
- LINKS (Reference Links)
- COURSES (Upcoming Courses)
- FACULTY (Teachers List)
- CLASSROOM (Classroom Code)
- CLSROUTINE (Class Routine)
- HACKATHON (Upcoming Hackathons)
- CP (Competitive Programming)
- PQS (Previous Question Solutions)
- ROUTINE (Exam Routine)
- NOTES (General Notes)
- SUG (Exam Suggestions)
- BOOKS (Library Books)
- SECRETC (Section C Secret Private Notes)

Output MUST be ONLY valid JSON in this exact structure with NO markdown fences, no backticks:
{
  "reply": "Short friendly explanation in Banglish explaining what you extracted and where it will be posted",
  "category": "ONE_OF_THE_ALLOWED_KEYS",
  "title": "Clear concise English/Banglish title",
  "type": "text", // "text" for text notices/routines, "link" for urls, or "file" if pdf requested
  "content": "Fully extracted text, neatly formatted with clear headings, bullet points, and timings",
  "makePdf": false // true if user asked for a PDF or if image contains extensive handwritten notes
}`;

  try {
    let model = 'llama-3.3-70b-versatile';
    let userContent = [];

    if (image) {
      // Vision model for processing images
      model = 'llama-3.2-11b-vision-preview';
      userContent = [
        {
          type: 'text',
          text: `Admin instruction: ${prompt || 'Extract all text, notices, or routines from this image and format as a portal post.'}
If user mentions making a PDF, set "makePdf": true.
Remember to respond with PURE JSON matching the requested schema.`
        },
        {
          type: 'image_url',
          image_url: {
            url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}`
          }
        }
      ];
    } else {
      userContent = `Admin instruction: ${prompt}
Remember to respond with PURE JSON matching the requested schema.`;
    }

    const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: userContent }
        ],
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: 'json_object' }
      })
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      console.error('Groq API Error:', errText);
      return res.status(500).json({ error: 'AI processing failed: ' + errText });
    }

    const groqData = await groqResponse.json();
    const rawResult = groqData.choices?.[0]?.message?.content || '{}';
    
    let parsed;
    try {
      parsed = JSON.parse(rawResult);
    } catch (e) {
      // Clean possible markdown code fences
      const clean = rawResult.replace(/```json\s*|```/gi, '').trim();
      parsed = JSON.parse(clean);
    }

    // Validate category
    if (!VALID_CATEGORIES.includes(parsed.category)) {
      parsed.category = 'NOTES';
    }

    if (makePdf) {
      parsed.makePdf = true;
    }

    return res.status(200).json({
      success: true,
      data: parsed
    });

  } catch (err) {
    console.error('Admin AI Handler Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};

