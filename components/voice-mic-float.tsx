'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface VoiceMicFloatProps {
  caseId: string;
  queryId: string;
  onUploaded?: () => void;
}

export function VoiceMicFloat({ caseId, queryId, onUploaded }: VoiceMicFloatProps) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);

  const stopRef = useCallback(() => (window as unknown as { __voiceFloatStop?: () => void }).__voiceFloatStop, []);

  const handleClick = useCallback(async () => {
    if (uploading) return;
    if (recording) {
      const stop = stopRef();
      if (stop) stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recMime =
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';
      const recorder = new MediaRecorder(stream, recMime ? { mimeType: recMime } : undefined);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const mimeType = recMime;
        const ext = mimeType === 'audio/mp4' ? 'm4a' : 'webm';
        const blob = new Blob(chunks, { type: mimeType });
        setUploading(true);
        try {
          const form = new FormData();
          form.append('queryId', queryId);
          form.append('file', blob, `recording.${ext}`);
          const res = await fetch(`/api/cases/${caseId}/voice`, {
            method: 'POST',
            body: form,
            credentials: 'include',
          });
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d?.error || 'Upload failed');
          }
          toast.success('Voice note saved');
          onUploaded?.();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Upload failed');
        } finally {
          setUploading(false);
        }
      };
      recorder.start();
      setRecording(true);
      const stop = () => {
        if (recorder.state !== 'inactive') recorder.stop();
        setRecording(false);
      };
      (window as unknown as { __voiceFloatStop?: () => void }).__voiceFloatStop = stop;
    } catch (e) {
      toast.error('Microphone access denied or failed');
      setRecording(false);
    }
  }, [caseId, queryId, uploading, recording, onUploaded, stopRef]);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Button
        type="button"
        size="icon"
        aria-label={recording ? 'Stop recording' : 'Record voice note'}
        disabled={uploading}
        className="h-14 w-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg border-2 border-emerald-700"
        onClick={handleClick}
      >
        {recording ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : uploading ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : (
          <Mic className="h-7 w-7" />
        )}
      </Button>
      {recording && (
        <p className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-mono text-emerald-700 whitespace-nowrap bg-white/90 px-2 py-1 rounded shadow">
          Recording... click to stop
        </p>
      )}
    </div>
  );
}
