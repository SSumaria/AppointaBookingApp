
'use server';
/**
 * @fileOverview An audio transcription AI flow that formats notes into SOAP format.
 *
 * - transcribeAudio - A function that handles the audio transcription process.
 * - TranscribeAudioInput - The input type for the transcribeAudio function.
 * - TranscribeAudioOutput - The return type for the transcribeAudio function.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';

const TranscribeAudioInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "A WebM audio file encoded as a data URI. Expected format: 'data:audio/webm;base64,<encoded_data>'."
    ),
  existingNoteText: z
    .string()
    .optional()
    .describe('An optional existing SOAP note draft to be amended or enriched with information from the new audio.'),
});
export type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;

const TranscribeAudioOutputSchema = z.object({
  subjective: z.string().describe("The subjective part of the SOAP note."),
  objective: z.string().describe("The objective part of the SOAP note."),
  assessment: z.string().describe("The assessment part of the SOAP note."),
  plan: z.string().describe("The plan part of the SOAP note."),
});
export type TranscribeAudioOutput = z.infer<
  typeof TranscribeAudioOutputSchema
>;

const speechToTextPrompt = ai.definePrompt({
    name: 'speechToTextPrompt',
    input: { schema: TranscribeAudioInputSchema },
    output: { schema: TranscribeAudioOutputSchema },
    prompt: `You are a medical transcriptionist specializing in physiotherapy. Your task is to process an audio recording and format the information into a structured JSON object with the keys "subjective", "objective", "assessment", and "plan".

{{#if existingNoteText}}
You have been provided with an existing draft of the note. The new audio recording contains additional information. Your goal is to intelligently merge the information from the new audio into the existing draft. Do not simply append the new information. Instead, integrate it into the correct sections of the SOAP note to create a single, cohesive, and updated document.

Existing Note Draft:
---
{{{existingNoteText}}}
---
{{else}}
Convert the following audio transcript into a structured JSON object. For each section, summarize the key points concisely, ensuring all critical medical details are retained while keeping the overall text brief.
{{/if}}

New Audio to process: {{media url=audioDataUri}}
`,
});


const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeAudioInputSchema,
    outputSchema: TranscribeAudioOutputSchema,
  },
  async (input) => {
    // The Gemini model can handle webm directly, so no conversion is needed.
    const { output } = await speechToTextPrompt(input);
    return output!;
  }
);

export async function transcribeAudio(
  input: TranscribeAudioInput
): Promise<TranscribeAudioOutput> {
  return transcribeAudioFlow(input);
}
