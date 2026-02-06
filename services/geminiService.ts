
import { GoogleGenAI } from "@google/genai";
import { Message, DocumentChunk } from "../types";

export class GeminiService {
  private ai: any;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateResponse(
    userMessage: string,
    history: Message[],
    relevantChunks: DocumentChunk[]
  ): Promise<string> {
    const context = relevantChunks.length > 0 
      ? `Use the following context to answer the user question. If the answer is not in the context, say you don't know based on the documents.
      
      CONTEXT:
      ${relevantChunks.map(c => `[From ${c.fileName}]: ${c.content}`).join('\n\n')}
      `
      : 'No specific document context found. Answer from your general knowledge but mention that no relevant document sections were found.';

    const systemInstruction = `You are a helpful AI assistant. 
    You have access to a knowledge base of uploaded documents.
    ${context}
    
    Always be concise, accurate, and citation-friendly. Use markdown for formatting.`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...history.map(m => ({ 
            role: m.role === 'user' ? 'user' : 'model', 
            parts: [{ text: m.content }] 
          })),
          { role: 'user', parts: [{ text: userMessage }] }
        ],
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      return response.text || "I'm sorry, I couldn't generate a response.";
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw error;
    }
  }
}
