import { createCohere } from '@ai-sdk/cohere';
import { generateText as aiGenerateText } from 'ai';
import { config } from './config';

export async function generateText(prompt: string): Promise<string> {
  const apiKey = config.getKey('COHERE_API_KEY');
  const cohere = createCohere({ apiKey });
  const { text } = await aiGenerateText({
    model: cohere(config.getKey('COHERE_MODEL')),
    prompt,
  });
  return text.trim();
}
