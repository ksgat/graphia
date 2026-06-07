export function graphPrompt(subject: string): string {
	return `
You are an expert curriculum designer building a prerequisite knowledge graph for: "${subject}".

Your job is to choose the actual concepts a motivated beginner should learn, in the order that makes later ideas possible.
Do not create generic labels like "Core Vocabulary", "Basic Facts", "Worked Problems", "Advanced Synthesis", or "Applications".
Every node must name a real concept from "${subject}".

Return only valid JSON:
{
  "nodes": [
    {
      "id": "1",
      "label": "Concept name",
      "level": 0,
      "summary": "One sentence explaining the concept."
    }
  ],
  "edges": [
    { "from": "1", "to": "2" }
  ]
}

Rules:
- 12-18 nodes total.
- Each node must be an atomic, teachable concept from the subject.
- Prefer concrete concepts over broad survey topics.
- Labels must be specific enough to teach in one lesson.
- level 0 = foundational, level 1 = intermediate, level 2 = advanced.
- Edges point from prerequisite to dependent concept.
- Every level 1 or 2 node must have at least one incoming edge.
- The graph must be a DAG with no cycles.
- Use short labels, ideally 2-4 words.
- Summaries must explain what the learner will be able to do after learning the node.
- Do not include markdown fences or prose outside JSON.
`.trim();
}

export function lessonPrompt(
	subject: string,
	concept: string,
	prerequisites: string[],
	level: number
): string {
	const levelLabel = ['foundational', 'intermediate', 'advanced'][level] ?? 'foundational';

	return `
You are writing a high-quality tutoring lesson on "${concept}" within "${subject}".

Student context:
- Level: ${levelLabel}
- Prerequisites: ${prerequisites.length ? prerequisites.join(', ') : 'none'}

Teaching requirements:
- Teach the actual concept, not a generic study template.
- Start with a concrete scenario that makes the concept necessary.
- Build intuition before terminology.
- Define terms precisely after the intuition.
- Include 3 worked examples, each with step-by-step reasoning.
- Include a short "When to use this" section.
- Include common mistakes with corrections.
- Connect explicitly to prerequisites: ${prerequisites.length ? prerequisites.join(', ') : 'first principles'}.
- If math notation is useful, use LaTeX.
- Avoid filler, motivational fluff, and generic advice.

Return markdown with exactly these sections:

# ${concept}

## Why this matters

## Definition

## Worked examples

### Example 1

### Example 2

### Example 3

## When to use this

## Common mistakes

## Connection to prerequisites

## Check your understanding

Exactly 5 fill-in-the-blank questions. Each question must test a concrete point from this lesson.
Use this exact format:

**Q1:** The [BLANK] ...
**Answer:** ...

**Q2:** ...
**Answer:** ...

**Q3:** ...
**Answer:** ...

**Q4:** ...
**Answer:** ...

**Q5:** ...
**Answer:** ...
`.trim();
}
