/**
 * OpenAI Whisper transcription. Requires OPENAI_API_KEY.
 */

function getOpenAIKey(): string {
  const key = (process.env.OPENAI_API_KEY ?? '').trim();
  return key;
}

export async function transcribeAudio(audioBuffer: Buffer, mimeType?: string): Promise<string> {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const formData = new FormData();
  const blob = new Blob([audioBuffer], { type: mimeType || 'audio/webm' });
  formData.append('file', blob, 'recording.webm');
  formData.append('model', 'whisper-1');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Whisper API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = (await res.json()) as { text?: string };
  return (data?.text ?? '').trim();
}
