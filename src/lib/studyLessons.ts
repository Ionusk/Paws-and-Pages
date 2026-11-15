import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { API_URL, getErrorMessage, useApi } from './api';

/** A study material with its Gemini summary (GET /api/study/materials). */
export type StudyLesson = {
  id: number;
  fileName: string;
  title?: string;
  summary?: string;
  keyPoints?: string[];
};

export type LessonAudio = {
  materialId: number;
  characters: number;
  createdAt: string;
  /** Signed, short-lived link; prefix with API_URL. */
  url: string;
};

export function lessonTitle(lesson: StudyLesson) {
  return lesson.title || lesson.fileName || 'Your lesson';
}

export function audioUrl(path: string) {
  return `${API_URL}${path}`;
}

/** Same text the server reads aloud, used to show the character cost. */
export function lessonCharacters(lesson: StudyLesson) {
  const parts = [lessonTitle(lesson), lesson.summary ?? '', ...(lesson.keyPoints ?? [])];
  return Math.min(parts.join(' ').length + 40, 3000);
}

/** Loads the user's summaries and which of them already have audio. */
export function useStudyLessons() {
  const { request } = useApi();
  const [lessons, setLessons] = useState<StudyLesson[]>([]);
  const [audio, setAudio] = useState<LessonAudio[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;

    try {
      setLoading(true);
      setError('');

      const [materials, audioList] = await Promise.all([
        request<{ materials?: StudyLesson[] }>('/api/study/materials'),
        request<{ audio?: LessonAudio[]; remainingCharacters?: number | null }>(
          '/api/study/audio'
        ),
      ]);

      if (id !== requestId.current) return;

      setLessons(
        (materials.materials ?? []).filter((lesson) => lesson.summary?.trim())
      );
      setAudio(audioList.audio ?? []);
      setRemaining(audioList.remainingCharacters ?? null);
    } catch (err) {
      console.error('Lessons loading error:', err);
      if (id === requestId.current) {
        setError(getErrorMessage(err, "We couldn't load your lessons."));
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [request]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return { lessons, audio, remaining, loading, error, refresh, setAudio };
}
