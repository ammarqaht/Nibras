'use client';

import { stages, form } from '@/content';

const getActiveStageStyles = (key: string) => {
  switch (key) {
    case 'ابتدائي':
      return '!border-2 !border-ncyan !bg-ncyan !text-white font-bold scale-[1.02] shadow-[0_6px_16px_rgba(18,179,213,0.25)]';
    case 'متوسط':
      return '!border-2 !border-brand !bg-brand !text-white font-bold scale-[1.02] shadow-[0_6px_16px_rgba(255,159,28,0.25)]';
    case 'ثانوي':
      return '!border-2 !border-nblue !bg-nblue !text-white font-bold scale-[1.02] shadow-[0_6px_16px_rgba(16,63,145,0.25)]';
    default:
      return '!border-2 !border-nblue !bg-nblue !text-white font-bold scale-[1.02] shadow-[0_6px_16px_rgba(16,63,145,0.25)]';
  }
};

const getInactiveStageStyles = (key: string) => {
  switch (key) {
    case 'ابتدائي':
      return 'border-ink-200 bg-white/70 hover:border-ncyan/40 hover:text-ncyan-600 hover:scale-[1.01]';
    case 'متوسط':
      return 'border-ink-200 bg-white/70 hover:border-brand/40 hover:text-brand-600 hover:scale-[1.01]';
    case 'ثانوي':
      return 'border-ink-200 bg-white/70 hover:border-nblue/40 hover:text-nblue hover:scale-[1.01]';
    default:
      return 'border-ink-200 bg-white/70 hover:border-nblue/40 hover:scale-[1.01]';
  }
};

const getGridLayoutClass = (count: number) => {
  if (count === 4) return 'grid grid-cols-2 sm:grid-cols-4 gap-3 w-full';
  if (count === 3) return 'grid grid-cols-3 gap-3 w-full';
  return 'grid grid-cols-2 gap-3 w-full';
};

/**
 * Dependent selection: pick a stage (ابتدائي / متوسط / ثانوي); the other two
 * collapse and only the chosen stage's grades appear. Changing the stage resets
 * the grade. Target group starts from 3rd grade (handled in content.ts).
 */
export default function StageGradeSelect({
  stage,
  grade,
  onStageChange,
  onGradeChange,
  invalid
}: {
  stage: string;
  grade: string;
  onStageChange: (s: string) => void;
  onGradeChange: (g: string) => void;
  invalid?: boolean;
}) {
  const active = stages.find((s) => s.key === stage);

  return (
    <div className="space-y-4">
      {/* Stage options — wide full-width layout */}
      <div className="flex gap-3 w-full">
        {stages.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`choice flex-1 py-3 text-center transition-all duration-300 ${
              stage === s.key
                ? getActiveStageStyles(s.key)
                : getInactiveStageStyles(s.key)
            }`}
            onClick={() => {
              onStageChange(s.key);
              onGradeChange('');
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Grade options for the chosen stage */}
      {active && (
        <div className="mt-4 fade-in">
          <label className="label">{form.labels.grade}</label>
          <div className={getGridLayoutClass(active.grades.length)}>
            {active.grades.map((g) => (
              <button
                key={g}
                type="button"
                className={`choice py-3 text-center transition-all duration-300 ${
                  grade === g
                    ? getActiveStageStyles(stage)
                    : getInactiveStageStyles(stage)
                }`}
                onClick={() => onGradeChange(g)}
              >
                {g}
              </button>
            ))}
          </div>
          {invalid && !grade && <p className="err-msg mt-2">يرجى اختيار الصف</p>}
        </div>
      )}
    </div>
  );
}
