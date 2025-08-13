import { Attachment, ExecutionPlan, PlanAction } from './planTypes';
import { extractFirstJsonObject, tryParseJson } from '../utils/json';

export class Prompter {
  buildPlanPrompt(userRequest: string, attachments: Attachment[]): string {
    const filesSection = attachments
      .map((a) => `FILE: ${a.filePath}\n-----\n${a.content}\n-----`)
      .join('\n\n');

    const schema = `{
  "thought": string, // brief reasoning
  "actions": [
    { "type": "CREATE_FILE", "path": string, "content": string },
    { "type": "UPDATE_FILE", "path": string, "content": string },
    { "type": "DELETE_FILE", "path": string }
  ]
}`;

    const instructions = `You are Maou, an expert software agent in VS Code. Convert the user's request into a deterministic plan.
Rules:
- ONLY return a JSON object following the exact schema, no prose.
- Paths must be workspace-relative and use forward slashes.
- For UPDATE_FILE, provide the full new file content.
- Do not include comments in JSON.
- If no file changes are needed, return an empty actions array.
`;

    const prompt = [
      instructions,
      filesSection ? `Context files:\n${filesSection}` : '',
      `User request:\n${userRequest}`,
      `JSON schema:\n${schema}`,
      'Return ONLY the JSON.'
    ]
      .filter(Boolean)
      .join('\n\n');

    return prompt;
  }

  parsePlanFromModelText(text: string): ExecutionPlan | undefined {
    const jsonText = extractFirstJsonObject(text);
    if (!jsonText) return undefined;
    const obj = tryParseJson<ExecutionPlan>(jsonText);
    if (!obj || !Array.isArray(obj.actions) || typeof obj.thought !== 'string') return undefined;

    // Basic validation
    const valid = obj.actions.every((a: any) => typeof a.type === 'string' && typeof a.path === 'string');
    if (!valid) return undefined;
    return obj;
  }
}