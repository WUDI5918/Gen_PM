
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
