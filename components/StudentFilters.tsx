'use client';

import { useState } from 'react';
import { stages } from '@/content';

export function StageMultiSelectDropdown({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggleGrade = (grade: string, stageKey: string) => {
    const gradeKey = `grade:${grade}`;
    let nextSelected = selected.includes(gradeKey)
      ? selected.filter((k) => k !== gradeKey)
      : [...selected, gradeKey];

    const stageInfo = stages.find((st) => st.key === stageKey);
    if (stageInfo) {
      const allGradesKeys = stageInfo.grades.map((g) => `grade:${g}`);
      const hasAllGrades = allGradesKeys.every((gk) => nextSelected.includes(gk));
      if (hasAllGrades) {
        if (!nextSelected.includes(`stage:${stageKey}`)) {
          nextSelected.push(`stage:${stageKey}`);
        }
      } else {
        nextSelected = nextSelected.filter((k) => k !== `stage:${stageKey}`);
      }
    }
    onChange(nextSelected);
  };

  const toggleStage = (stageKey: string) => {
    const stageKeyStr = `stage:${stageKey}`;
    const stageInfo = stages.find((st) => st.key === stageKey);
    if (!stageInfo) return;

    const allGradesKeys = stageInfo.grades.map((g) => `grade:${g}`);
    const isStageSelected = selected.includes(stageKeyStr);

    let nextSelected = selected;
    if (isStageSelected) {
      nextSelected = nextSelected.filter((k) => k !== stageKeyStr && !allGradesKeys.includes(k));
    } else {
      const toAdd = [stageKeyStr, ...allGradesKeys].filter((k) => !nextSelected.includes(k));
      nextSelected = [...nextSelected, ...toAdd];
    }
    onChange(nextSelected);
  };

  const selectedGradesCount = selected.filter((k) => k.startsWith('grade:')).length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="field flex items-center justify-between gap-2 text-right w-full bg-white select-none"
      >
        <span>
          {selectedGradesCount > 0
            ? `المراحل (${selectedGradesCount})`
            : 'تصفية المراحل'}
        </span>
        <span className="text-ink-400 text-xs">▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-full min-w-[240px] max-h-80 overflow-y-auto bg-white border border-ink-200 rounded-xl shadow-xl z-50 p-3 space-y-3 scroll-soft text-right" dir="rtl">
            {stages.map((stage) => {
              const stageKeyStr = `stage:${stage.key}`;
              const isStageChecked = selected.includes(stageKeyStr);

              return (
                <div key={stage.key} className="space-y-1">
                  <label className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-cream-50 cursor-pointer text-sm font-semibold select-none">
                    <input
                      type="checkbox"
                      checked={isStageChecked}
                      onChange={() => toggleStage(stage.key)}
                      className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                    />
                    <span className="text-ink-900">{stage.label}</span>
                  </label>

                  <div className="mr-6 space-y-1 border-r border-ink-100 pr-2">
                    {stage.grades.map((grade) => {
                      const gradeKeyStr = `grade:${grade}`;
                      const isGradeChecked = selected.includes(gradeKeyStr);
                      return (
                        <label
                          key={grade}
                          className="flex items-center gap-2 px-1.5 py-0.5 rounded-lg hover:bg-cream-50 cursor-pointer text-xs select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isGradeChecked}
                            onChange={() => toggleGrade(grade, stage.key)}
                            className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-3.5 h-3.5"
                          />
                          <span className="text-ink-700">{grade}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((s) => s !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="field flex items-center justify-between gap-2 text-right w-full bg-white select-none"
      >
        <span>{selected.length > 0 ? `${label} (${selected.length})` : label}</span>
        <span className="text-ink-400 text-xs">▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-full min-w-[200px] max-h-60 overflow-y-auto bg-white border border-ink-200 rounded-xl shadow-xl z-50 p-2 space-y-0.5 scroll-soft">
            {options.length === 0 ? (
              <p className="text-center py-4 text-ink-400 text-xs">لا توجد خيارات</p>
            ) : (
              options.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-cream-50 cursor-pointer text-sm select-none"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggle(opt.value)}
                    className="rounded border-ink-300 text-primary-600 focus:ring-primary-500 w-4 h-4"
                  />
                  <span className="text-ink-800">{opt.label}</span>
                </label>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
