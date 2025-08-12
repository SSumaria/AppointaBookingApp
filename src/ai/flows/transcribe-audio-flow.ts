
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
    prompt: `You are a medical transcriptionist specializing in physiotherapy. Convert the following transcript into a structured JSON object with the keys "subjective", "objective", "assessment", and "plan".
  
  Audio: {{media url=audioDataUri}}
  `,
});


const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeAudioInputSchema,
    outputSchema: TranscribeAudioOutputSchema,
  },
  async ({ audioDataUri }) => {
    // The Gemini model can handle webm directly, so no conversion is needed.
    const { output } = await speechToTextPrompt({ audioDataUri: audioDataUri });
    return output!;
  }
);

export async function transcribeAudio(
  input: TranscribeAudioInput
): Promise<TranscribeAudioOutput> {
  return transcribeAudioFlow(input);
}
