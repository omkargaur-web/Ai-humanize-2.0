const axios = require('axios');

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

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
            console.log("Error: Missing API Key or Text"); // Debug log
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid Request: Text or API Key missing" }) };
        }

        let temperature = 0.7;
        if (selectedModel === 'deep-creative') temperature = 0.85;
        if (selectedModel === 'elite-humanist') temperature = 0.95;

        // PROMPT IMPROVEMENT: Markdown JSON se bachne ke liye instruction
        const systemPrompt = `You are a professional AI Text Humanizer. 
Target Language: ${language}
Writing Style: ${style !== 'none' ? style : 'Natural and conversational'}
Intensity: ${level}/10

TASKS:
1. Rewrite the input text to be human-like, natural, and undetectable.
2. Maintain original meaning perfectly.
3. Identify sentences in your NEW output that still feel slightly robotic and put them in the aiSentences array.

CRITICAL: You MUST output ONLY valid JSON. Do not include any other text, no explanations, and NO markdown code blocks (do not use \`\`\`json).
Output Format:
{
  "humanizedText": "Your full rewritten text here",
  "aiSentences": ["exact sentence from output that looks robotic"],
  "score": 98
}`;

        const freeModels = [
            "google/gemini-flash-1.5-8b:free",
            "meta-llama/llama-3.3-70b-instruct:free"
        ];
        
        let finalData = null;

        for (const modelId of freeModels) {
            try {
                console.log(`Trying model: ${modelId}`); // Netlify Logs mein dikhega
                
                const response = await axios.post(
                    'https://openrouter.ai/api/v1/chat/completions',
                    {
                        model: modelId,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userText }
                        ],
                        // HATA DIYA: response_format: { type: "json_object" }
                        temperature: temperature,
                        max_tokens: 2000
                    },
                    {
                        headers: { 
                            'Authorization': `Bearer ${apiKey}`,
                            'HTTP-Referer': 'https://yourdomain.com', // Replace this if needed
                            'Content-Type': 'application/json'
                        },
                        timeout: 25000 // Thoda kam kiya taaki Netlify timeout (10s limit on free tier) se bache
                    }
                );

                // API response check karne ke liye log
                console.log("Raw Response received from OpenRouter.");

                let rawContent = response.data.choices[0].message.content;
                
                // Cleanup: Agar AI ne markdown (```json) diya hai, toh usko hatao
                rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();

                const content = JSON.parse(rawContent);
                
                if (content.humanizedText) {
                    finalData = content;
                    console.log("Success with model:", modelId);
                    break; // Success hone par loop break karo
                }
            } catch (err) {
                // Yahan tumhe Netlify logs mein exact reason dikhega ki model kyu fail hua
                console.error(`Model ${modelId} failed:`, err.response ? err.response.data : err.message);
                continue;
            }
        }

        if (!finalData) {
            console.log("All AI models failed, using fallback.");
            const fallbackText = simpleHumanize(userText);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    output: fallbackText,
                    humanScore: 82,
                    aiSentences: []
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
        { from: /\bit is\b/g, to: "it's" }
    ];
    for (const rep of replacements) {
        result = result.replace(rep.from, rep.to);
    }
    return result;
}
