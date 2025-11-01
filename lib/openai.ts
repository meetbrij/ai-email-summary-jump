import OpenAI from 'openai';
import pRetry from 'p-retry';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

interface Category {
  id: string;
  name: string;
  description: string;
}

interface EmailData {
  subject: string;
  from: string;
  body: string;
}

interface ClassificationResult {
  categoryId: string | null;
  confidence: number;
  reasoning: string;
}

/**
 * Classify an email into the most appropriate category using AI
 * @param email - Email data (subject, from, body)
 * @param categories - Available categories
 * @returns Classification result with category ID, confidence, and reasoning
 */
export async function classifyEmail(
  email: EmailData,
  categories: Category[]
): Promise<ClassificationResult> {
  return await pRetry(
    async () => {
      // Truncate body to 1000 chars to reduce API costs
      const truncatedBody = email.body.substring(0, 1000);

      const prompt = `Analyze this email and classify it into the most appropriate category.

Email:
From: ${email.from}
Subject: ${email.subject}
Body: ${truncatedBody}${email.body.length > 1000 ? '... (truncated)' : ''}

Categories:
${categories.map((cat) => `ID: ${cat.id}, Name: ${cat.name}, Description: ${cat.description}`).join('\n')}

Return JSON with:
{
  "categoryId": "<category_id>" or null if no good match,
  "confidence": <number between 0 and 1>,
  "reasoning": "<brief explanation>"
}`;

      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are an email classification assistant. Analyze emails and categorize them accurately based on their content and the provided category descriptions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result: ClassificationResult = JSON.parse(content);

      // Only return categoryId if confidence is high enough
      if (result.confidence < 0.7) {
        return {
          categoryId: null,
          confidence: result.confidence,
          reasoning: result.reasoning,
        };
      }

      return result;
    },
    {
      retries: 3,
      onFailedAttempt: (error) => {
        console.log(
          `Classification attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
        );
      },
      minTimeout: 1000,
      maxTimeout: 5000,
    }
  );
}

/**
 * Generate a concise summary of an email using AI
 * @param email - Email data (subject, from, body)
 * @returns Email summary (1-2 sentences)
 */
export async function summarizeEmail(email: EmailData): Promise<string> {
  return await pRetry(
    async () => {
      // Truncate body to 1500 chars
      const truncatedBody = email.body.substring(0, 1500);

      const prompt = `Summarize this email in 1-2 concise sentences. Focus on key information and action items.

From: ${email.from}
Subject: ${email.subject}
Body: ${truncatedBody}${email.body.length > 1500 ? '... (truncated)' : ''}`;

      const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are an email summarization assistant. Create brief, informative summaries that capture the essence of emails.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 100,
        temperature: 0.5,
      });

      const summary = response.choices[0]?.message?.content?.trim();

      if (!summary) {
        throw new Error('No summary generated');
      }

      return summary;
    },
    {
      retries: 3,
      onFailedAttempt: (error) => {
        console.log(
          `Summarization attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`
        );
      },
      minTimeout: 1000,
      maxTimeout: 5000,
    }
  );
}
