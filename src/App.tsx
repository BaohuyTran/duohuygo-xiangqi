import { useMemo, useState } from 'react';
import { Home } from './components/Home';
import { LessonPlayer } from './components/LessonPlayer';
import { findLesson, units } from './content';
import { I18nProvider, isLanguage } from './i18n/I18nProvider';
import { lessonStates } from './lessons/progress';
import { createLocalStore, createProgressRepository, createSettingsRepository, type KeyValueStore } from './storage';

export default function App({ store }: { store?: KeyValueStore }) {
  const repos = useMemo(() => {
    const s = store ?? createLocalStore();
    return { progress: createProgressRepository(s), settings: createSettingsRepository(s) };
  }, [store]);
  const savedLang = repos.settings.language();

  return (
    <I18nProvider initial={isLanguage(savedLang) ? savedLang : 'en'} onChange={repos.settings.setLanguage}>
      <Screens progress={repos.progress} />
    </I18nProvider>
  );
}

function Screens({ progress }: { progress: ReturnType<typeof createProgressRepository> }) {
  const [completed, setCompleted] = useState(() => progress.completedLessons());
  const [lessonId, setLessonId] = useState<string | null>(null);
  const states = useMemo(() => lessonStates(units, completed), [completed]);
  const lesson = lessonId ? findLesson(lessonId) : undefined;

  if (lesson) {
    return (
      <LessonPlayer
        key={lesson.id}
        lesson={lesson}
        onExit={() => setLessonId(null)}
        onComplete={() => {
          setCompleted(progress.markCompleted(lesson.id));
          setLessonId(null);
        }}
      />
    );
  }

  return (
    <Home
      units={units}
      states={states}
      onStart={(id) => {
        if (states.get(id) !== 'locked') setLessonId(id);
      }}
      onReset={() => {
        progress.reset();
        setCompleted([]);
      }}
    />
  );
}
