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
  const where: ProblemListWhere = { status: "published" };
  if (subject) where.subject = subject;
  if (difficulty) where.difficulty = difficulty;
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
