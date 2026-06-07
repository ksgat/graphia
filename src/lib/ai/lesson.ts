import { requestOpenRouter } from './openrouter';
import { lessonPrompt } from './prompts';

export async function generateLesson(
	subject: string,
	concept: string,
	prerequisites: string[],
	level: number
): Promise<string> {
	return await requestOpenRouter([
		{ role: 'user', content: lessonPrompt(subject, concept, prerequisites, level) }
	]);
}
