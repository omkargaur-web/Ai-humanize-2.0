const axios = require('axios');

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    // userText ko scope se bahar rakha taaki catch block ise access kar sake
    let userText = "";

    try {
        const body = JSON.parse(event.body || '{}');
        userText = body.text;
        const selectedModel = body.model || 'casual';
        const level = body.level || '5';
        const style = body.style || 'none';
        const language = body.language || 'en-US';
        
        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey || !userText) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid Request: Text or API Key missing" }) };
        }

        let temperature = 0.7;
        if (selectedModel === 'deep-creative') temperature = 0.85;
        if (selectedModel === 'elite-humanist') temperature = 0.95;

        // PROMPT IMPROVEMENT: AI ko sakti se JSON dene ko bola gaya hai
        const systemPrompt = `You are a professional AI Text Humanizer. 
Target Language: ${language}
Writing Style: ${style !== 'none' ? style : 'Natural and conversational'}
Intensity: ${level}/10

TASKS:
1. Rewrite the input text to be 100% human-like, natural, and undetectable.
2. Maintain original meaning perfectly.
3. Identify exactly which sentences in your NEW humanized output still feel slightly robotic and put them in the aiSentences array.

OUTPUT FORMAT (STRICT JSON ONLY):
{
  "humanizedText": "Your full rewritten text here",
  "aiSentences": ["exact sentence from output that looks robotic"],
  "score": 98
}`;

        const freeModels = [
            "google/gemini-flash-1.5-8b:free",
            "meta-llama/llama-3.3-70b-instruct:free",
            "nvidia/nemotron-4-12b:free",
            "openchat/openchat-20b:free"
        ];
        
        let finalData = null;

        for (const modelId of freeModels) {
            try {
                console.log(`Trying model: ${modelId}`);
                
                const response = await axios.post(
                    'https://openrouter.ai/api/v1/chat/completions',
                    {
                        model: modelId,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userText }
                        ],
                        response_format: { type: "json_object" }, // Yeh ensure karega ki JSON hi mile
                        temperature: temperature,
                        max_tokens: 2000 // Thoda zyada tokens for long text
                    },
                    {
                        headers: { 
                            'Authorization': `Bearer ${apiKey}`,
                            'HTTP-Referer': 'https://yourdomain.com',
                            'X-Title': 'AI Humanizer Pro'
                        },
                        timeout: 35000 // Netlify limit ke andar
                    }
                );

                const content = JSON.parse(response.data.choices[0].message.content);
                
                if (content.humanizedText) {
                    finalData = content;
                    break;
                }
            } catch (err) {
                console.error(`Model ${modelId} failed:`, err.message);
                continue;
            }
        }

        if (!finalData) {
            const fallbackText = simpleHumanize(userText);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    output: fallbackText,
                    humanScore: 82,
                    aiSentences: [] // Fallback mein highlight nahi karenge
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                output: finalData.humanizedText.trim(),
                humanScore: finalData.score || 95,
                aiSentences: finalData.aiSentences || []
            })
        };

    } catch (error) {
        console.error("Fatal error:", error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ 
                error: "Server Error",
                output: userText || "Error processing text",
                humanScore: 0
            }) 
        };
    }
};

function simpleHumanize(text) {
    if (!text) return "";
    let result = text.trim();
    const replacements = [
        { from: /\bI am\b/g, to: "I'm" },
        { from: /\bdo not\b/g, to: "don't" },
        { from: /\bcannot\b/g, to: "can't" },
        { from: /\bit is\b/g, to: "it's" },
        { from: /\bIn conclusion,\b/gi, to: "To wrap up," },
        { from: /\bMoreover,\b/gi, to: "Plus," },
        { from: /\bHowever,\b/gi, to: "But," }
    ];
    for (const rep of replacements) {
        result = result.replace(rep.from, rep.to);
    }
    return result;
}
