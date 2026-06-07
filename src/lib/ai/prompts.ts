export function graphPrompt(subject: string): string {
	return `
You are building a prerequisite knowledge graph for: "${subject}".

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
- Each node must be an atomic learnable concept.
- level 0 = foundational, level 1 = intermediate, level 2 = advanced.
- Edges point from prerequisite to dependent concept.
- Every level 1 or 2 node must have at least one incoming edge.
- The graph must be a DAG with no cycles.
- Use short labels, ideally 2-4 words.
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
Write a concise lesson on "${concept}" within "${subject}".

Student context:
- Level: ${levelLabel}
- Prerequisites: ${prerequisites.length ? prerequisites.join(', ') : 'none'}

Rules:
1. Start with a concrete example before theory.
2. Build intuition before formal definitions.
3. Include at least two worked examples.
4. Name 1-2 common mistakes.
5. Use LaTeX for math when relevant.
6. Keep it concise.

Return markdown with exactly these sections:

# ${concept}

## The core idea

## Definition

## Worked examples

### Example 1

### Example 2

## Common mistakes

## Check your understanding

**Q1:** The [BLANK] ...
**Answer:** ...

**Q2:** ...
**Answer:** ...

**Q3:** ...
**Answer:** ...

## Connection to prerequisites
`.trim();
}
