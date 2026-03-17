const axios = require('axios');

exports.handler = async function(event, context) {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

    try {
        const body = JSON.parse(event.body || '{}');
        const userText = body.text;
        const style = body.style || 'none';
        const language = body.language || 'en-US';
        const level = body.level || '5';

        // --- YAHAN PASTE KIYA GAYA HAI ---
        let modelId = "openai/gpt-4o-mini"; // Default (Casual)
        let temp = 0.7;

        if (body.model === "deep-creative") {
            modelId = "meta-llama/llama-3.1-8b-instruct";
            temp = 0.85;
        } else if (body.model === "elite-humanist") {
            modelId = "meta-llama/llama-3.1-70b-instruct";
            temp = 1.0; 
        }
        // --------------------------------

        const apiKey = process.env.OPENROUTER_API_KEY;

        if (!apiKey || !userText) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing API Key or Text" }) };
        }

        const systemPrompt = `You are a professional AI Text Humanizer. 
Target Language: ${language}
Writing Style: ${style !== 'none' ? style : 'Natural and conversational'}
Intensity: ${level}/10

TASKS:
1. Rewrite the input text to be human-like and natural.
2. Maintain original meaning perfectly.
3. Output ONLY valid JSON. No markdown.
Format: {"humanizedText": "...", "aiSentences": [], "score": 98}`;

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: modelId,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userText }
                ],
                temperature: temp,
                max_tokens: 2000
            },
            {
                headers: { 
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 9000 
            }
        );

        let rawContent = response.data.choices[0].message.content;
        rawContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const content = JSON.parse(rawContent);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                output: content.humanizedText,
                humanScore: content.score || 95,
                aiSentences: content.aiSentences || []
            })
        };

    } catch (error) {
        console.error("Error:", error);
        return { 
            statusCode: 500, 
            headers, 
            body: JSON.stringify({ error: "Server Error", output: "Failed to process text." }) 
        };
    }
};
