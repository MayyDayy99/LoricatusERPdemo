'use client';

import { useEffect, useRef, useCallback } from 'react';
import { driver, type DriveStep, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useOnboardingStore, type UserRole } from '@/lib/onboarding-store';
import { useT } from '@/lib/hooks/use-t';
import { MAIN_TOURS, type TourStep } from './tour-definitions';

/**
 * Resolves a dot-path like "tutorial.ceoTour.step1Title" against the i18n object.
 */
function resolve(obj: Record<string, unknown>, path: string): string {
  const val = path.split('.').reduce<unknown>((o, k) => {
    if (o && typeof o === 'object') return (o as Record<string, unknown>)[k];
    return undefined;
  }, obj);
  return typeof val === 'string' ? val : path;
}

export function GuidedTour() {
  const t = useT() as unknown as Record<string, unknown>;
  const {
    mainTour,
    selectedRole,
    mainTourStep,
    advanceMainTour,
    completeMainTour,
    dismissMainTour,
  } = useOnboardingStore();

  const driverRef = useRef<Driver | null>(null);

  const cleanup = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Always destroy any prior instance before re-evaluating: a route change with
    // a leaked overlay would `pointer-events:none` the whole page.
    cleanup();

    if (mainTour !== 'in_progress' || !selectedRole) return;

    const tourSteps = MAIN_TOURS[selectedRole as UserRole];
    if (!tourSteps?.length) return;

    // SYNCHRONOUS anchor-detection BEFORE the 400ms timer: if the user navigated
    // to a route whose tour anchors don't exist (e.g. dashboard tour persisted as
    // in_progress, user now on /customers), the 400ms delay would mount driver.js
    // for those 400ms — and `.driver-active *{pointer-events:none}` would kill EVERY
    // click on the page (silent dead UI + brief overlay flicker). Snap-dismiss now.
    if (typeof document !== 'undefined') {
      const anyAnchorPresentNow = tourSteps.some((s: TourStep) => {
        try { return typeof s.element === 'string' && !!document.querySelector(s.element); }
        catch { return false; }
      });
      if (!anyAnchorPresentNow) {
        dismissMainTour();
        return;
      }
    }

    // Small delay to let the DOM settle after the welcome modal closes
    const timer = setTimeout(() => {
      // Defensive re-check: between the sync check above and the timer firing,
      // the route could have changed away from the anchor host.
      const anyAnchorPresent = tourSteps.some((s: TourStep) => {
        try { return typeof s.element === 'string' && !!document.querySelector(s.element); }
        catch { return false; }
      });
      if (!anyAnchorPresent) {
        dismissMainTour();
        return;
      }

      const steps: DriveStep[] = tourSteps.map((s: TourStep) => ({
        element: s.element,
        popover: {
          title: resolve(t, s.popover.title),
          description: resolve(t, s.popover.description),
          side: s.popover.side,
          align: s.popover.align ?? 'center',
        },
      }));

      const d = driver({
        showProgress: true,
        animate: true,
        overlayColor: 'rgba(43,59,70,0.6)',
        stagePadding: 8,
        stageRadius: 12,
        popoverClass: 'dimop-tour-popover',
        allowClose: true,
        steps,
        onHighlightStarted: (_el: unknown, step: DriveStep) => {
          const idx = steps.indexOf(step);
          if (idx >= 0) advanceMainTour(idx);
        },
        onDestroyStarted: () => {
          // Tour was closed by user
          if (driverRef.current && !driverRef.current.isLastStep()) {
            dismissMainTour();
          } else {
            completeMainTour();
          }
          cleanup();
        },
        onDestroyed: () => {
          driverRef.current = null;
        },
      });

      driverRef.current = d;

      // Resume from last step if possible
      if (mainTourStep > 0 && mainTourStep < steps.length) {
        d.drive(mainTourStep);
      } else {
        d.drive();
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      cleanup();
    };
    // We intentionally run this only when tour state changes, not on every t/step change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTour, selectedRole]);

  return null; // driver.js manages its own DOM
}
