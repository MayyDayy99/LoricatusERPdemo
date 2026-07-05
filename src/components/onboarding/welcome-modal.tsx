'use client';

import { useState } from 'react';
import { Rocket, Briefcase, HardHat, Shield, Eye, X } from 'lucide-react';
import { useOnboardingStore, type UserRole } from '@/lib/onboarding-store';
import { useCurrentUser } from '@/lib/hooks/use-users';
import { useT } from '@/lib/hooks/use-t';

const ROLE_OPTIONS: { value: UserRole; icon: typeof Rocket }[] = [
  { value: 'admin', icon: Shield },
  { value: 'ceo', icon: Briefcase },
  { value: 'manager', icon: Rocket },
  { value: 'operative', icon: HardHat },
  { value: 'client', icon: Eye },
];

export function WelcomeModal() {
  const t = useT();
  const tt = t.tutorial;
  const { welcomeModalOpen, startMainTour, dismissMainTour } = useOnboardingStore();
  const { currentUser } = useCurrentUser();
  const [selected, setSelected] = useState<UserRole | null>(null);

  if (!welcomeModalOpen) return null;

  const isAdmin = currentUser?.role === 'admin';

  const roleLabel: Record<UserRole, string> = {
    admin: tt.roleAdmin,
    ceo: tt.roleCeo,
    manager: tt.roleManager,
    operative: tt.roleOperative,
    client: tt.roleClient,
  };
  const roleDesc: Record<UserRole, string> = {
    admin: tt.roleAdminDesc,
    ceo: tt.roleCeoDesc,
    manager: tt.roleManagerDesc,
    operative: tt.roleOperativeDesc,
    client: tt.roleClientDesc,
  };

  const greeting = currentUser?.firstName
    ? tt.welcomeGreeting.replace('{name}', currentUser.firstName)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 animate-slide-in-up">
        {/* Close button */}
        <button
          onClick={dismissMainTour}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="mx-auto w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center mb-4">
            <Rocket className="w-7 h-7 text-brand-600" />
          </div>
          {greeting && (
            <p className="text-sm text-brand-600 font-medium mb-1">{greeting}</p>
          )}
          <h2 className="text-2xl font-bold text-loricatus-dark">{tt.welcomeTitle}</h2>
          <p className="text-gray-500 mt-1">{tt.welcomeSubtitle}</p>
        </div>

        {/* Role Cards — only visible to admin */}
        {isAdmin && (
          <div className="space-y-3 mb-6">
            {ROLE_OPTIONS.map(({ value, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setSelected(value)}
                className={`w-full flex items-center gap-4 rounded-xl border-2 px-4 py-3 text-left transition-all ${
                  selected === value
                    ? 'border-brand-500 bg-brand-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    selected === value ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{roleLabel[value]}</p>
                  <p className="text-sm text-gray-500">{roleDesc[value]}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={dismissMainTour}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            {tt.skipTour}
          </button>
          <button
            disabled={isAdmin && !selected}
            onClick={() => startMainTour(isAdmin ? selected! : (currentUser?.role as UserRole) ?? 'operative')}
            className="px-6 py-2.5 rounded-xl bg-brand-500 text-loricatus-dark font-semibold text-sm
                       hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed
                       transition-all shadow-sm hover:shadow"
          >
            {tt.startTour}
          </button>
        </div>
      </div>
    </div>
  );
}
