'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { useTranslations } from '@/lib/i18n';
import { CheckCircle, Circle, Loader } from 'lucide-react';

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface WizardStep {
  id: string;
  label: string;
  description: string;
  status: StepStatus;
}

const STEP_IDS = ['health', 'admin', 'tenant', 'api_keys', 'validation', 'activate'] as const;

export function SetupWizard() {
  const { t } = useTranslations('setup');

  const INITIAL_STEPS: WizardStep[] = STEP_IDS.map((id) => ({
    id,
    label: t(`steps.${id}.label`),
    description: t(`steps.${id}.description`),
    status: 'pending',
  }));

  const [steps, setSteps] = useState<WizardStep[]>(INITIAL_STEPS);
  const [currentStep, setCurrentStep] = useState(0);
  const [adminForm, setAdminForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);

  const updateStep = (id: string, status: StepStatus) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  };

  const runHealthCheck = async () => {
    setLoading(true);
    updateStep('health', 'running');
    try {
      await apiClient.post('/setup/health-check');
      updateStep('health', 'done');
      setCurrentStep(1);
      toast.success(t('step1.toast.success'));
    } catch {
      updateStep('health', 'error');
      toast.error(t('step1.toast.error'));
    } finally {
      setLoading(false);
    }
  };

  const createAdmin = async () => {
    if (!adminForm.email || !adminForm.password) {
      toast.error(t('step2.toast.validation'));
      return;
    }
    setLoading(true);
    updateStep('admin', 'running');
    try {
      await apiClient.post('/setup/admin', adminForm);
      updateStep('admin', 'done');
      updateStep('tenant', 'done');
      updateStep('api_keys', 'done');
      updateStep('validation', 'done');
      setCurrentStep(5);
      toast.success(t('step2.toast.success'));
    } catch (err: any) {
      updateStep('admin', 'error');
      toast.error(err?.response?.data?.message ?? t('step2.toast.error'));
    } finally {
      setLoading(false);
    }
  };

  const activate = async () => {
    setLoading(true);
    updateStep('activate', 'running');
    try {
      await apiClient.post('/setup/activate');
      updateStep('activate', 'done');
      setComplete(true);
      toast.success(t('step6.toast.success'));
      setTimeout(() => { window.location.href = '/login'; }, 2000);
    } catch (err: any) {
      updateStep('activate', 'error');
      toast.error(err?.response?.data?.message ?? t('step6.toast.error'));
    } finally {
      setLoading(false);
    }
  };

  if (complete) {
    return (
      <div className="bg-white rounded-2xl p-10 text-center shadow-xl">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">{t('complete.title')}</h2>
        <p className="text-gray-500 mt-2">{t('complete.subtitle')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      {/* Step progress */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex gap-3 flex-wrap">
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-1.5 text-sm">
              {step.status === 'done' ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : step.status === 'running' ? (
                <Loader className="w-4 h-4 text-brand-500 animate-spin" />
              ) : step.status === 'error' ? (
                <Circle className="w-4 h-4 text-red-400" />
              ) : (
                <Circle className="w-4 h-4 text-gray-300" />
              )}
              <span className={
                step.status === 'done' ? 'text-green-600 font-medium' :
                i === currentStep ? 'text-brand-600 font-medium' :
                'text-gray-400'
              }>
                {step.label}
              </span>
              {i < steps.length - 1 && <span className="text-gray-200 ml-1">›</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="p-8">
        {currentStep === 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">{t('step1.title')}</h2>
            <p className="text-gray-500">{t('step1.subtitle')}</p>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm text-gray-600">
              <p>✓ {t('step1.checks.postgres')}</p>
              <p>✓ {t('step1.checks.redis')}</p>
              <p>✓ {t('step1.checks.worker')}</p>
            </div>
            <button
              onClick={runHealthCheck}
              disabled={loading}
              className="bg-brand-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition"
            >
              {loading ? t('step1.buttonRunning') : t('step1.button')}
            </button>
          </div>
        )}

        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">{t('step2.title')}</h2>
            <p className="text-gray-500">{t('step2.subtitle')}</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('step2.form.firstName')}</label>
                <input
                  value={adminForm.firstName}
                  onChange={(e) => setAdminForm({ ...adminForm, firstName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('step2.form.lastName')}</label>
                <input
                  value={adminForm.lastName}
                  onChange={(e) => setAdminForm({ ...adminForm, lastName: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('step2.form.email')}</label>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('step2.form.password')}</label>
                <input
                  type="password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 outline-none"
                />
              </div>
            </div>
            <button
              onClick={createAdmin}
              disabled={loading}
              className="bg-brand-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-brand-700 disabled:opacity-50 transition"
            >
              {loading ? t('step2.buttonRunning') : t('step2.button')}
            </button>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-900">{t('step6.title')}</h2>
            <p className="text-gray-500">{t('step6.subtitle')}</p>
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-800 text-sm">
              {t('step6.info')}
            </div>
            <button
              onClick={activate}
              disabled={loading}
              className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 transition"
            >
              {loading ? t('step6.buttonRunning') : t('step6.button')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
