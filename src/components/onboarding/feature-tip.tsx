'use client';

import { useState } from 'react';
import { X, Lightbulb } from 'lucide-react';
import { useOnboardingStore } from '@/lib/onboarding-store';
import { useT } from '@/lib/hooks/use-t';

interface FeatureTipProps {
  /** Unique identifier persisted in onboarding store */
  tipId: string;
  /** i18n key path to the tip text (e.g. "tutorial.tips.kanbanDragTip") */
  textKey: keyof typeof import('@/lib/app-i18n').APP_T['hu']['tutorial']['tips'];
}

/**
 * A dismissible contextual tip that slides in once, then never shows again.
 * Place inside a relatively-positioned parent near the feature it describes.
 */
export function FeatureTip({ tipId, textKey }: FeatureTipProps) {
  const t = useT();
  const { seenTips, markTipSeen, mainTour } = useOnboardingStore();
  const [hiding, setHiding] = useState(false);

  // Don't show tips during the main tour or if already dismissed
  if (mainTour === 'in_progress' || seenTips[tipId]) return null;

  function dismiss() {
    setHiding(true);
    setTimeout(() => markTipSeen(tipId), 200);
  }

  const text = t.tutorial.tips[textKey] ?? textKey;

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-loricatus-dark shadow-sm transition-all duration-200 ${
        hiding ? 'opacity-0 translate-y-1' : 'animate-slide-in-up'
      }`}
    >
      <Lightbulb className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand-600" />
      <span className="flex-1">{text}</span>
      <button
        onClick={dismiss}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
        aria-label="Dismiss tip"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
