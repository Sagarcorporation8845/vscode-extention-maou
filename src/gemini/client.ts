import * as vscode from 'vscode';
import { GoogleAuth } from '../auth/googleAuth';

export class GeminiClient {
  constructor(
    private readonly auth: GoogleAuth,
    private readonly getModel: () => string
  ) {}

  async generateText(prompt: string): Promise<string> {
    const model = this.getModel();
    const accessToken = await this.auth.getAccessToken();
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    };

    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Gemini API error: ${resp.status} ${text}`);
    }

    const json = await resp.json();
    const candidates = json.candidates as any[] | undefined;
    const first = candidates && candidates[0];
    const parts = first?.content?.parts as any[] | undefined;
    const textOut = parts?.map((p) => p.text).join('\n') ?? '';
    return textOut;
  }
}