import React from 'react';
import { Loader2 } from 'lucide-react';

const STEP_LABELS = {
  1: 'Reading the page…',
  2: 'Breaking it into sections…',
  3: 'Understanding the content…',
  4: 'Almost done…'
};

export default function StatusStepper({ currentStep }) {
  if (!currentStep || currentStep < 1) return null;

  const label = STEP_LABELS[currentStep] || 'Working…';
  const progress = Math.min(currentStep / 4, 1) * 100;

  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center gap-2 text-sm text-zinc-300">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400 shrink-0" />
        <span>{label}</span>
      </div>
      <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
