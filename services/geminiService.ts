
import { GoogleGenAI, Type, Chat, GenerateContentResponse } from "@google/genai";
import { ProjectPhase, ProjectInfo, TaskStatus, Project, ProjectRisk } from "../types";

export interface AIConfig {
    provider: 'gemini' | 'deepseek';
    apiKey: string;
    baseUrl?: string;
    model?: string;
}

export interface GenerationOptions {
    duration: string;
    detailLevel: 'Brief' | 'Standard' | 'Detailed';
    domain: string;
    language?: 'en' | 'zh';
    structure?: 'full' | 'single';
    autoSchedule?: boolean;
}

const getGeminiClient = (apiKey?: string) => {
    const key = apiKey || process.env.API_KEY;
    if (!key) return null;
    return new GoogleGenAI({ apiKey: key });
};

// --- DeepSeek / OpenAI Compatible Handler ---
const generateWithDeepSeek = async (prompt: string, config: AIConfig): Promise<string | null> => {
    try {
        const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.deepseek.com';
        const model = config.model || 'deepseek-chat';

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: "You are a helpful project management assistant that outputs strict JSON." },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" },
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'DeepSeek API Request failed');
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (error) {
        console.error("DeepSeek API Error:", error);
        throw error;
    }
};

// --- Test Configuration Function ---
export const testAIConfiguration = async (config: AIConfig): Promise<{ success: boolean; message: string }> => {
    if (!config.apiKey) return { success: false, message: "API Key is missing" };

    try {
        if (config.provider === 'deepseek') {
            const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.deepseek.com';
            const response = await fetch(`${baseUrl}/models`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${config.apiKey}` }
            });

            if (response.ok) {
                return { success: true, message: "DeepSeek Connection Successful" };
            } else {
                await generateWithDeepSeek("Hi", config);
                return { success: true, message: "DeepSeek Generation Successful" };
            }
        } else {
            const client = new GoogleGenAI({ apiKey: config.apiKey });
            await client.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: 'Ping',
            });
            return { success: true, message: "Gemini Connection Successful" };
        }
    } catch (e: any) {
        console.error("Connection Test Failed:", e);
        return { success: false, message: e.message || "Connection failed" };
    }
};

// --- Schedule Analysis ---
export const analyzeSchedule = async (phases: ProjectPhase[], projectInfo: ProjectInfo) => {
    const client = getGeminiClient();
    if (!client) {
        return "Please configure your API Key in the environment variables to use the AI Assistant.";
    }

    // Simplified context to save tokens
    const scheduleContext = JSON.stringify(phases.map(p => ({
        phase: p.name,
        tasks: p.tasks.map(t => ({
            name: t.subTaskName,
            start: t.startDate,
            end: t.endDate,
            status: t.status,
            priority: t.score
        }))
    })));

    const prompt = `
    Analyze this project schedule for "${projectInfo.name}".
    1. Sanity Check (dates, logic).
    2. Top 2 Bottlenecks.
    3. 2 Recommendations.
    Keep it professional and concise.
    
    Data: ${scheduleContext}
  `;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text;
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "Failed to analyze schedule. Please check your internet connection or API key.";
    }
};

// --- Risk Generation ---
export const generateRisks = async (project: Project, config?: AIConfig): Promise<ProjectRisk[]> => {
    const isDeepSeek = config?.provider === 'deepseek';
    const apiKey = config?.apiKey || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing");

    const context = JSON.stringify({
        name: project.info.name,
        desc: project.info.description,
        tasks: project.phases.flatMap(p => p.tasks.map(t => ({
            name: t.subTaskName,
            desc: t.workContent,
            status: t.status,
            end: t.endDate
        }))).slice(0, 20) // Limit context
    });

    const prompt = `
        Identify 3-5 potential risks for this project.
        Return JSON array of objects with keys: description, probability (Low/Medium/High), impact (Low/Medium/High), mitigationPlan.
        Context: ${context}
    `;

    try {
        if (isDeepSeek && config) {
            const rawText = await generateWithDeepSeek(prompt + " JSON Array", config);
            if (!rawText) return [];
            const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } else {
            const client = getGeminiClient(apiKey);
            if (!client) throw new Error("Failed to initialize Gemini");

            const response = await client.models.generateContent({
                model: config?.model || 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                description: { type: Type.STRING },
                                probability: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
                                impact: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
                                mitigationPlan: { type: Type.STRING }
                            }
                        }
                    }
                }
            });

            const rawRisks = JSON.parse(response.text || '[]');

            // Hydrate IDs and Level
            return rawRisks.map((r: any, idx: number) => {
                let level: any = 'Low';
                if (r.impact === 'High' && r.probability === 'High') level = 'Critical';
                else if (r.impact === 'High' || r.probability === 'High') level = 'High';
                else if (r.impact === 'Medium' && r.probability === 'Medium') level = 'Medium';

                return {
                    id: `risk-${Date.now()}-${idx}`,
                    status: 'Open',
                    level,
                    ...r
                };
            });
        }
    } catch (error) {
        console.error("Risk Generation Error:", error);
        throw new Error("Failed to generate risks.");
    }
};

// --- Optimized: Task Breakdown with Schema ---
export const breakdownTask = async (taskName: string, description: string, config?: AIConfig): Promise<string[]> => {
    const isDeepSeek = config?.provider === 'deepseek';
    const apiKey = config?.apiKey || process.env.API_KEY;

    if (!apiKey) throw new Error("API Key is missing");

    const prompt = `
    Break down the task "${taskName}" (${description}) into 3-5 actionable checklist items.
    Return a JSON array of strings.
  `;

    try {
        if (isDeepSeek && config) {
            const rawText = await generateWithDeepSeek(prompt + " JSON format.", config);
            if (!rawText) return [];
            const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned).items || JSON.parse(cleaned);
        } else {
            const client = getGeminiClient(apiKey);
            if (!client) throw new Error("Failed to initialize Gemini Client");

            const response = await client.models.generateContent({
                model: config?.model || 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                }
            });

            return JSON.parse(response.text || '[]');
        }

    } catch (error) {
        console.error("Breakdown Error:", error);
        return ["Draft subtask 1", "Review subtask 2", "Finalize work"];
    }
};

// --- Optimized: Project Plan Generation with Schema ---
export const generateProjectPlan = async (description: string, config?: AIConfig, options?: GenerationOptions, teamMembers?: any[]): Promise<ProjectPhase[] | null> => {

    const isDeepSeek = config?.provider === 'deepseek';
    const apiKey = config?.apiKey || process.env.API_KEY;
    const outputLang = options?.language === 'zh' ? 'Chinese' : 'English';

    if (!apiKey) throw new Error("API Key is missing.");

    const prompt = `
    Create a project plan for: "${description}".
    Constraints: Duration ${options?.duration || "Flexible"}, Detail ${options?.detailLevel || "Standard"}, Language ${outputLang}.
    Structure: ${options?.structure === 'single' ? "Single phase 'Execution'" : "Logical phases"}.
    Return JSON.
  `;

    try {
        let rawPhases: any[] = [];

        if (isDeepSeek && config) {
            const deepSeekPrompt = prompt + `
            Output strictly JSON array:
            [{ "name": "Phase Name", "tasks": [{ "subTaskName": "Task", "workContent": "Desc", "owner": "Role", "duration": 3, "score": "High" }] }]
          `;
            const rawText = await generateWithDeepSeek(deepSeekPrompt, config);
            if (rawText) {
                const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleaned);
                rawPhases = Array.isArray(parsed) ? parsed : parsed.phases || [];
            }
        } else {
            // Optimized Gemini Call with Schema
            const client = getGeminiClient(apiKey);
            if (!client) throw new Error("Failed to initialize Gemini Client");

            const response = await client.models.generateContent({
                model: config?.model || 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                tasks: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            subTaskName: { type: Type.STRING },
                                            workContent: { type: Type.STRING },
                                            owner: { type: Type.STRING },
                                            duration: { type: Type.NUMBER },
                                            score: { type: Type.STRING, enum: ["High", "Med", "Low"] }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            if (response.text) {
                rawPhases = JSON.parse(response.text);
            }
        }

        if (!rawPhases || rawPhases.length === 0) return null;

        // Helper: Auto-schedule dates
        const autoScheduleDates = (duration: number, startDate: Date) => {
            const start = new Date(startDate);
            const end = new Date(start);
            end.setDate(end.getDate() + duration);
            return {
                startDate: start.toISOString().split('T')[0],
                endDate: end.toISOString().split('T')[0]
            };
        };

        // Helper: Assign owner based on team roles
        const assignOwner = (suggestedRole: string) => {
            if (!teamMembers || teamMembers.length === 0) return suggestedRole || 'Unassigned';

            // Try to find exact role match
            const exactMatch = teamMembers.find(m =>
                m.role.toLowerCase().includes(suggestedRole.toLowerCase()) ||
                suggestedRole.toLowerCase().includes(m.role.toLowerCase())
            );
            if (exactMatch) return exactMatch.name;

            // Try to find partial match
            const partialMatch = teamMembers.find(m => {
                const roleWords = suggestedRole.toLowerCase().split(/\s+/);
                const memberRoleWords = m.role.toLowerCase().split(/\s+/);
                return roleWords.some(word => memberRoleWords.includes(word));
            });
            if (partialMatch) return partialMatch.name;

            // Fallback to first team member or default role
            return teamMembers[0]?.name || suggestedRole || 'Unassigned';
        };

        // Hydrate IDs and apply auto-scheduling
        let currentDate = new Date();
        const phases: ProjectPhase[] = rawPhases.map((p: any, pIdx: number) => ({
            id: `gen-p-${Date.now()}-${pIdx}`,
            name: p.name,
            tasks: (p.tasks || []).map((t: any, tIdx: number) => {
                const duration = t.duration || 3;
                const dates = options?.autoSchedule
                    ? autoScheduleDates(duration, currentDate)
                    : { startDate: '-', endDate: '-' };

                // Update current date for next task
                if (options?.autoSchedule) {
                    currentDate = new Date(currentDate);
                    currentDate.setDate(currentDate.getDate() + duration);
                }

                return {
                    id: `gen-t-${Date.now()}-${pIdx}-${tIdx}`,
                    subTaskName: t.subTaskName,
                    deliverables: 'Generated',
                    workContent: t.workContent || 'Execute task',
                    owner: assignOwner(t.owner),
                    duration: duration,
                    startDate: dates.startDate,
                    endDate: dates.endDate,
                    status: TaskStatus.Pending,
                    score: t.score || 'Med',
                    remarks: [],
                    dependencies: [],
                    attachments: [],
                    checklist: [],
                    comments: []
                };
            })
        }));

        return phases;

    } catch (error) {
        console.error("Generation Error:", error);
        throw new Error(isDeepSeek ? "DeepSeek generation failed." : "Gemini generation failed.");
    }
};

// --- Meeting Summary ---
export const generateMeetingSummary = async (content: string, config?: AIConfig, language: 'en' | 'zh' = 'en'): Promise<{ summary: string, actionItems: string[] }> => {
    const isDeepSeek = config?.provider === 'deepseek';
    const apiKey = config?.apiKey || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing");

    const prompt = `Summarize meeting notes and extract action items. Lang: ${language}.`;

    try {
        if (isDeepSeek && config) {
            const rawText = await generateWithDeepSeek(prompt + " JSON: {summary, actionItems[]}", config);
            if (!rawText) return { summary: '', actionItems: [] };
            return JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
        } else {
            const client = getGeminiClient(apiKey);
            if (!client) throw new Error("Failed to initialize Gemini");
            const response = await client.models.generateContent({
                model: config?.model || 'gemini-2.5-flash',
                contents: prompt + "\n" + content,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            summary: { type: Type.STRING },
                            actionItems: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }
                    }
                }
            });
            return JSON.parse(response.text || '{}');
        }
    } catch (error) {
        console.error("Meeting Summary Error:", error);
        return { summary: "Failed to generate summary.", actionItems: [] };
    }
};

// --- HTML UI Generation ---
export const generateHtmlSnippet = async (description: string, config?: AIConfig): Promise<string> => {
    const apiKey = config?.apiKey || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing");

    const prompt = `Generate responsive Tailwind CSS HTML for: ${description}. Return ONLY raw HTML.`;

    // Note: HTML generation is less strict with Schema, but we can use it for safety or just text
    const client = getGeminiClient(apiKey);
    if (!client) throw new Error("Failed to initialize Gemini");

    const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    return response.text.replace(/```html/g, '').replace(/```/g, '').trim();
};

// --- Audio Transcription ---
export const transcribeMeetingAudio = async (audioBase64: string, mimeType: string = 'audio/webm', config?: AIConfig): Promise<string> => {
    const apiKey = config?.apiKey || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key missing");

    const client = getGeminiClient(apiKey);
    if (!client) throw new Error("Failed to initialize Gemini Client");

    const prompt = `Transcribe audio to Markdown notes. Identify Key Decisions & Action Items.`;

    try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: audioBase64 } },
                    { text: prompt }
                ]
            }
        });
        return response.text || "";
    } catch (error) {
        console.error("Audio Transcription Error:", error);
        throw new Error("Failed to transcribe audio.");
    }
};

// --- Smart Project Chat (Streaming) ---
export const chatStreamProject = async function* (
    userMessage: string,
    project: Project,
    config?: AIConfig,
    language: 'en' | 'zh' = 'en'
) {
    const apiKey = config?.apiKey || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing");

    const client = getGeminiClient(apiKey);
    if (!client) throw new Error("Failed to initialize Gemini");

    // 1. Serialize Project Data to Context (Minimize tokens by stripping unneeded fields)
    const contextData = {
        projectInfo: project.info,
        phases: project.phases.map(p => ({
            name: p.name,
            tasks: p.tasks.map(t => ({
                name: t.subTaskName,
                status: t.status,
                owner: t.owner,
                deadline: t.endDate,
                priority: t.score
            }))
        })),
        team: project.teamMembers.map(t => ({ name: t.name, role: t.role })),
        meetingCount: project.meetings.length,
        docsCount: project.docs.length,
        risks: project.risks,
        expenses: project.expenses
    };

    const systemPrompt = `
        You are a Project Manager Assistant for the project "${project.info.name}".
        Your goal is to help the user by querying the project data.
        
        Language: ${language === 'zh' ? 'Chinese' : 'English'}
        
        Project Context JSON:
        ${JSON.stringify(contextData)}

        Rules:
        - Be concise and professional.
        - Use Markdown formatting.
        - If asked about status, summarize based on the tasks provided.
    `;

    const chat: Chat = client.chats.create({
        model: config?.model || 'gemini-2.5-flash',
        config: {
            systemInstruction: systemPrompt,
        }
    });

    const responseStream = await chat.sendMessageStream({ message: userMessage });

    for await (const chunk of responseStream) {
        // Handle the chunk correctly as GenerateContentResponse
        const c = chunk as GenerateContentResponse;
        if (c.text) {

            yield c.text;
        }
    }
};

// --- Wiki AI System (Comprehensive) ---
export type WikiAIIntent =
    | 'continue' | 'polish' | 'tone_pro' | 'tone_casual' | 'shorten' | 'expand'
    | 'translate' | 'summary' | 'action_items' | 'critique' | 'explain_code'
    | 'diagram' | 'table' | 'chat' | 'custom';

export const performWikiAI = async (
    intent: WikiAIIntent,
    data: {
        selection?: string;
        context?: string;
        userPrompt?: string;
        language?: string;
    },
    config?: AIConfig
): Promise<string> => {
    const isDeepSeek = config?.provider === 'deepseek';
    const apiKey = config?.apiKey || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing");

    const client = getGeminiClient(apiKey);
    if (!client && !isDeepSeek) throw new Error("Failed to initialize Gemini");

    const lang = data.language || 'English';
    const contextSnippet = data.context ? data.context.slice(0, 5000) : ''; // Limit context
    const selection = data.selection || '';

    let systemPrompt = `You are an expert AI Wiki Assistant.Language: ${lang}.`;
    let userPrompt = "";

    switch (intent) {
        // --- Writing & Refinement ---
        case 'continue':
            userPrompt = `Context: \n${contextSnippet} \n\nTask: Continue writing logically from the end.Keep the style consistent.`;
            break;
        case 'polish':
            userPrompt = `Text: \n${selection} \n\nTask: Fix grammar, improve clarity, and make it professional.Maintain Markdown formatting.`;
            break;
        case 'tone_pro':
            userPrompt = `Text: \n${selection} \n\nTask: Rewrite in a formal, professional tone.`;
            break;
        case 'tone_casual':
            userPrompt = `Text: \n${selection} \n\nTask: Rewrite in a casual, easy - to - understand tone.`;
            break;
        case 'expand':
            userPrompt = `Text: \n${selection} \n\nTask: Expand this into a detailed paragraph or section.Add examples if relevant.`;
            break;
        case 'shorten':
            userPrompt = `Text: \n${selection} \n\nTask: Condense this into a concise summary or bullet points.`;
            break;
        case 'translate':
            userPrompt = `Text: \n${selection} \n\nTask: Translate to ${lang}. Preserve Markdown formatting exactly.`;
            break;

        // --- Analysis ---
        case 'summary':
            userPrompt = `Context: \n${contextSnippet} \n\nTask: Provide a concise summary of this document.`;
            break;
        case 'action_items':
            userPrompt = `Context: \n${contextSnippet} \n\nTask: Extract all action items and tasks.Return as a Markdown checklist.`;
            break;
        case 'critique':
            userPrompt = `Context: \n${contextSnippet} \n\nTask: Act as a reviewer.Identify logical gaps, inconsistencies, or missing information.Be constructive.`;
            break;
        case 'explain_code':
            userPrompt = `Code: \n${selection} \n\nTask: Explain what this code does in simple terms.`;
            break;

        // --- Visuals & Structure ---
        case 'diagram':
            userPrompt = `Description: \n${data.userPrompt || selection} \n\nTask: Generate a Mermaid.js diagram code block(e.g., sequence, flowchart, gantt) that represents this.Return ONLY the markdown code block.`;
            break;
        case 'table':
            userPrompt = `Description: \n${data.userPrompt || selection} \n\nTask: Generate a Markdown table based on this request.`;
            break;

        // --- Chat & Custom ---
        case 'chat':
            userPrompt = `Context: \n${contextSnippet} \n\nUser Question: ${data.userPrompt} \n\nAnswer based on the context provided.`;
            break;
        case 'custom':
        default:
            userPrompt = `Context: \n${contextSnippet} \n\nTask: ${data.userPrompt} `;
            break;
    }

    try {
        if (isDeepSeek && config) {
            return await generateWithDeepSeek(systemPrompt + "\n" + userPrompt, config) || "";
        } else {
            const response = await client!.models.generateContent({
                model: config?.model || 'gemini-2.5-flash',
                contents: systemPrompt + "\n" + userPrompt,
            });
            return response.text || "";
        }
    } catch (error) {
        console.error("Wiki AI Error:", error);
        throw new Error("AI Request Failed.");
    }
};

// --- Issue Analysis ---
export const analyzeIssue = async (description: string, config?: AIConfig, language: 'en' | 'zh' = 'en'): Promise<{ rootCause: string, rootSolution: string }> => {
    const isDeepSeek = config?.provider === 'deepseek';
    const apiKey = config?.apiKey || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing");

    const prompt = `
        Analyze the following issue description and provide:
        1. Root Cause Analysis (Why did this happen?)
        2. Root Solution (How to prevent this from happening again?)
        
        Description: "${description}"
        
        Language: ${language === 'zh' ? 'Chinese' : 'English'}
        
        Return strictly a JSON object with keys: "rootCause" and "rootSolution".
    `;

    try {
        if (isDeepSeek && config) {
            const rawText = await generateWithDeepSeek(prompt + " JSON Object", config);
            if (!rawText) return { rootCause: '', rootSolution: '' };
            const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleaned);
        } else {
            const client = getGeminiClient(apiKey);
            if (!client) throw new Error("Failed to initialize Gemini");

            const response = await client.models.generateContent({
                model: config?.model || 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            rootCause: { type: Type.STRING },
                            rootSolution: { type: Type.STRING }
                        }
                    }
                }
            });
            return JSON.parse(response.text || '{}');
        }
    } catch (error) {
        console.error("Issue Analysis Error:", error);
        return { rootCause: "Failed to analyze issue.", rootSolution: "Failed to generate solution." };
    }
};

// --- AI Form Generation from Table Data ---
export const generateFormSchemaFromData = async (
    headers: string[],
    sampleData: any[],
    config?: AIConfig
): Promise<any[]> => {
    const isDeepSeek = config?.provider === 'deepseek';
    const apiKey = config?.apiKey || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing");

    const context = JSON.stringify({
        headers: headers,
        sampleRows: sampleData.slice(0, 5) // Send first 5 rows for context
    });

    const prompt = `
        Analyze the table structure and generate a Form Schema JSON.
        
        Headers: ${JSON.stringify(headers)}
        Sample Data: ${context}
        
        Return a JSON ARRAY of Field objects.
        Field Properties:
        - id: string (snake_case, unique, based on header name)
        - label: string (Human readable, use original header)
        - type: "text" | "number" | "date" | "select" | "radio" | "checkbox" | "textarea" | "email"
        - width: "50%" | "100%"
        - required: boolean
        - options: string[] (if type is select/radio, infer unique values from sample data)
        - logic: { calculation?: string } (Optional. E.g., if a column looks like "Total", and there are "Price" and "Qty", suggest a calculation "{price} * {qty}")
        
        Rules:
        - Infer field types from sample data values.
        - Numbers -> "number", Dates -> "date", Emails -> "email"
        - If column has few unique values (< 5), use 'select' or 'radio'.
        - If column is long text, use 'textarea'.
        - Suggest logic if obvious math relationships exist.
        - Use 50% width by default, 100% for long text.
        
        Return ONLY a valid JSON array, no markdown or explanation.
    `;

    try {
        if (isDeepSeek && config) {
            // DeepSeek / OpenAI Compatible
            const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.deepseek.com';
            const model = config.model || 'deepseek-chat';

            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: "You are a helpful assistant that outputs strict JSON arrays for form schema generation." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'DeepSeek API Request failed');
            }

            const data = await response.json();
            const rawText = data.choices?.[0]?.message?.content || '[]';
            const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

            // Try to parse, handle if wrapped in object
            const parsed = JSON.parse(cleaned);
            return Array.isArray(parsed) ? parsed : (parsed.fields || parsed.schema || []);
        } else {
            // Gemini
            const client = getGeminiClient(apiKey);
            if (!client) throw new Error("Failed to initialize Gemini");

            const response = await client.models.generateContent({
                model: config?.model || 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                label: { type: Type.STRING },
                                type: { type: Type.STRING, enum: ["text", "number", "date", "select", "radio", "checkbox", "textarea", "email"] },
                                width: { type: Type.STRING, enum: ["50%", "100%"] },
                                required: { type: Type.BOOLEAN },
                                placeholder: { type: Type.STRING },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                logic: {
                                    type: Type.OBJECT,
                                    properties: {
                                        calculation: { type: Type.STRING }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            return JSON.parse(response.text || '[]');
        }
    } catch (error: any) {
        console.error("Form Generation Error:", error);
        throw new Error(error.message || "Failed to generate form schema.");
    }
};

// --- AI Form Generation from Natural Language Description ---
export const generateFormFromDescription = async (
    description: string,
    config?: AIConfig
): Promise<any[]> => {
    const isDeepSeek = config?.provider === 'deepseek';
    const apiKey = config?.apiKey || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing");

    const prompt = `
        You are a form builder assistant. Based on the user's description, generate a form schema.
        
        User Description: "${description}"
        
        Return a JSON ARRAY of Field objects.
        Field Properties:
        - id: string (snake_case, unique, based on field purpose)
        - label: string (Human readable, in the same language as the description)
        - type: "text" | "number" | "date" | "select" | "radio" | "checkbox" | "textarea" | "email" | "divider" | "notice"
        - width: "50%" | "100%"
        - required: boolean (true for important fields)
        - placeholder: string (helpful hint)
        - helpText: string (optional explanation)
        - options: string[] (if type is select/radio, provide sensible options)
        
        Rules:
        - Use "divider" type with label for section headers
        - Group related fields together
        - Infer appropriate field types from context
        - Use 50% width for short fields, 100% for long text
        - Include validation hints in helpText when appropriate
        - Match the language of labels to the input description
        
        Return ONLY a valid JSON array.
    `;

    try {
        if (isDeepSeek && config) {
            const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.deepseek.com';
            const model = config.model || 'deepseek-chat';

            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: "You are a form builder assistant that outputs strict JSON arrays." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.5
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'API Request failed');
            }

            const data = await response.json();
            const rawText = data.choices?.[0]?.message?.content || '[]';
            const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return Array.isArray(parsed) ? parsed : (parsed.fields || parsed.schema || []);
        } else {
            const client = getGeminiClient(apiKey);
            if (!client) throw new Error("Failed to initialize Gemini");

            const response = await client.models.generateContent({
                model: config?.model || 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                label: { type: Type.STRING },
                                type: { type: Type.STRING },
                                width: { type: Type.STRING },
                                required: { type: Type.BOOLEAN },
                                placeholder: { type: Type.STRING },
                                helpText: { type: Type.STRING },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } }
                            }
                        }
                    }
                }
            });

            return JSON.parse(response.text || '[]');
        }
    } catch (error: any) {
        console.error("Form Description Generation Error:", error);
        throw new Error(error.message || "Failed to generate form from description.");
    }
};

// --- AI Logic Configuration from Natural Language ---
export const generateFormLogic = async (
    currentSchema: any[],
    logicDescription: string,
    config?: AIConfig
): Promise<any[]> => {
    const isDeepSeek = config?.provider === 'deepseek';
    const apiKey = config?.apiKey || process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing");

    const schemaContext = currentSchema.map(f => ({
        id: f.id,
        label: f.label,
        type: f.type
    }));

    const prompt = `
        You are a form logic configuration assistant. Based on the user's description, add logic to the existing form fields.
        
        Current Form Fields:
        ${JSON.stringify(schemaContext, null, 2)}
        
        User's Logic Description: "${logicDescription}"
        
        Return the COMPLETE updated schema as a JSON ARRAY. For each field that needs logic, add a "logic" object with these possible properties:
        
        Logic Properties:
        - visibility: string (expression like "{field_id} === 'value'" to show/hide this field)
        - calculation: string (formula like "{price} * {quantity}" for auto-calculation)
        - validation: string (regex pattern for validation)
        - required: string (expression like "{other_field} !== ''" to make conditionally required)
        - readOnly: string (expression like "{status} === 'approved'" to make conditionally read-only)
        
        Expression Syntax:
        - Use {field_id} to reference other field values
        - Supported operators: ===, !==, >, <, >=, <=, &&, ||, +, -, *, /
        - String values should be in single quotes: 'value'
        
        Rules:
        - Return ALL fields from the original schema
        - Only add logic properties that are requested
        - Keep all existing field properties unchanged except logic
        - Match field references by id exactly
        
        Return ONLY a valid JSON array with the complete updated schema.
    `;

    try {
        if (isDeepSeek && config) {
            const baseUrl = config.baseUrl?.replace(/\/$/, '') || 'https://api.deepseek.com';
            const model = config.model || 'deepseek-chat';

            const response = await fetch(`${baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: "You are a form logic assistant that outputs strict JSON arrays." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" },
                    temperature: 0.3
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'API Request failed');
            }

            const data = await response.json();
            const rawText = data.choices?.[0]?.message?.content || '[]';
            const cleaned = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return Array.isArray(parsed) ? parsed : (parsed.fields || parsed.schema || []);
        } else {
            const client = getGeminiClient(apiKey);
            if (!client) throw new Error("Failed to initialize Gemini");

            const response = await client.models.generateContent({
                model: config?.model || 'gemini-2.5-flash',
                contents: prompt,
                config: {
                    responseMimeType: 'application/json'
                }
            });

            const text = response.text || '[]';
            const parsed = JSON.parse(text);
            return Array.isArray(parsed) ? parsed : (parsed.fields || parsed.schema || []);
        }
    } catch (error: any) {
        console.error("Form Logic Generation Error:", error);
        throw new Error(error.message || "Failed to generate form logic.");
    }
};
