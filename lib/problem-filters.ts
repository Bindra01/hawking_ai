/**
 * Builds the Prisma `where` clause for the published-problem listing.
 * Subject and class (difficulty) are optional and combine as an AND filter.
 * Empty / null values are omitted so they don't constrain the query.
 */
export interface ProblemListWhere {
  status: string;
  subject?: string;
  difficulty?: string;
}

export function buildProblemListWhere(
  subject?: string | null,
  difficulty?: string | null
): ProblemListWhere {
  // Trim so whitespace-only params (e.g. "?difficulty=%20") behave like "no
  // filter" instead of filtering out every problem, and padded valid values
  // still match.
  const where: ProblemListWhere = { status: "published" };
  const normalizedSubject = subject?.trim();
  const normalizedDifficulty = difficulty?.trim();
  if (normalizedSubject) where.subject = normalizedSubject;
  if (normalizedDifficulty) where.difficulty = normalizedDifficulty;
  return where;
}

/**
 * Composes the card subtitle: subject label, the topic (only when it adds
 * detail beyond the subject), and the step count.
 */
export function buildCardMeta(
  subjectLabel: string,
  topic: string | null | undefined,
  stepCount: number
): string {
  const showTopic =
    !!topic && topic.toLowerCase() !== subjectLabel.toLowerCase();
  return [subjectLabel, showTopic ? topic : null, `${stepCount} steps`]
    .filter(Boolean)
    .join(" · ");
}
