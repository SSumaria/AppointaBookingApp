
'use server';
/**
 * @fileOverview An audio transcription AI flow.
 *
 * - transcribeAudio - A function that handles the audio transcription process.
 * - TranscribeAudioInput - The input type for the transcribeAudio function.
 * - TranscribeAudioOutput - The return type for the transcribeAudio function.
 */

import { ai } from '@/ai/ai-instance';
import { z } from 'genkit';
import * as ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';

const TranscribeAudioInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "A WebM audio file encoded as a data URI. Expected format: 'data:audio/webm;base64,<encoded_data>'."
    ),
});
export type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;

const TranscribeAudioOutputSchema = z.object({
  transcription: z.string().describe('The transcribed text from the audio.'),
});
export type TranscribeAudioOutput = z.infer<
  typeof TranscribeAudioOutputSchema
>;

const speechToTextPrompt = ai.definePrompt({
    name: 'speechToTextPrompt',
    input: { schema: TranscribeAudioInputSchema },
    output: { schema: TranscribeAudioOutputSchema },
    prompt: `Transcribe the following audio recording to text.
  
  Audio: {{media url=audioDataUri}}
  `,
});

const convertWebmToWav = (base64Webm: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const audioBuffer = Buffer.from(base64Webm, 'base64');
    const inputStream = new PassThrough();
    inputStream.end(audioBuffer);

    const chunks: Buffer[] = [];
    const outputStream = new PassThrough();

    outputStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    outputStream.on('end', () => {
      const wavBuffer = Buffer.concat(chunks);
      resolve(wavBuffer.toString('base64'));
    });

    ffmpeg(inputStream)
      .fromFormat('webm')
      .toFormat('wav')
      .audioCodec('pcm_s16le')
      .audioFrequency(16000)
      .audioChannels(1)
      .on('error', (err) => {
        console.error('An error occurred: ' + err.message);
        reject(err);
      })
      .pipe(outputStream, { end: true });
  });
};


const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeAudioInputSchema,
    outputSchema: TranscribeAudioOutputSchema,
  },
  async ({ audioDataUri }) => {
    const base64Audio = audioDataUri.split(',')[1];
    const wavBase64 = await convertWebmToWav(base64Audio);
    const wavDataUri = `data:audio/wav;base64,${wavBase64}`;

    const { output } = await speechToTextPrompt({ audioDataUri: wavDataUri });
    return output!;
  }
);

export async function transcribeAudio(
  input: TranscribeAudioInput
): Promise<TranscribeAudioOutput> {
  return transcribeAudioFlow(input);
}
