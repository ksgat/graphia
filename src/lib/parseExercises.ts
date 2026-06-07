export interface ParsedExercise {
	question: string;
	answer: string;
	displayQuestion: string;
}

export function parseExercises(markdown: string): ParsedExercise[] {
	const lines = markdown.split('\n');
	const exercises: ParsedExercise[] = [];

	for (let i = 0; i < lines.length; i += 1) {
		const qMatch = lines[i].match(/^\*\*Q\d+:\*\* (.+)$/);
		const aMatch = lines[i + 1]?.match(/^\*\*Answer:\*\* (.+)$/);

		if (qMatch && aMatch) {
			exercises.push({
				question: qMatch[1],
				answer: aMatch[1].toLowerCase().trim(),
				displayQuestion: qMatch[1].replace('[BLANK]', '___')
			});
		}
	}

	return exercises;
}

export function stripExerciseAnswers(markdown: string): string {
	return markdown
		.split('\n')
		.filter((line) => !/^\*\*Answer:\*\*/.test(line))
		.join('\n');
}
