'use client';

import { stages, form } from '@/content';

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
    <div>
      {/* Stage chips — collapse to just the selected one once chosen */}
      <div className="flex flex-wrap gap-2.5">
        {stages
          .filter((s) => !stage || s.key === stage)
          .map((s) => (
            <button
              key={s.key}
              type="button"
              className={`choice ${stage === s.key ? 'is-active' : ''}`}
              onClick={() => {
                onStageChange(s.key);
                onGradeChange('');
              }}
            >
              {s.label}
            </button>
          ))}

        {stage && (
          <button
            type="button"
            className="btn btn-ghost text-sm"
            onClick={() => {
              onStageChange('');
              onGradeChange('');
            }}
          >
            تغيير المرحلة
          </button>
        )}
      </div>

      {/* Grade options for the chosen stage */}
      {active && (
        <div className="mt-4 fade-in">
          <label className="label">{form.labels.grade}</label>
          <div className="flex flex-wrap gap-2.5">
            {active.grades.map((g) => (
              <button
                key={g}
                type="button"
                className={`choice ${grade === g ? 'is-active' : ''}`}
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
