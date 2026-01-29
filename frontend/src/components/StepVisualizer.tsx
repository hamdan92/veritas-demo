'use client';

import { Step } from '@/app/page';

interface StepVisualizerProps {
  currentStep: Step;
}

const steps = [
  { id: 'sign', label: 'Sign Image', description: 'Actor 1: C2PA Camera', actor: '📷' },
  { id: 'edit', label: 'Select Edit', description: 'Choose transformation', actor: '✏️' },
  { id: 'prove', label: 'Generate Proof', description: 'Actor 2: ZK Prover', actor: '🔐' },
  { id: 'verify', label: 'Verify', description: 'Actor 3: Verifier', actor: '✓' },
];

function getStepStatus(stepId: string, currentStep: Step): 'complete' | 'current' | 'upcoming' {
  const stepMap: Record<string, number> = {
    sign: 0,
    edit: 1,
    prove: 2,
    verify: 3,
  };

  const currentMap: Record<Step, number> = {
    idle: -1,
    uploading: 0,
    signing: 0,
    signed: 1,
    selecting_edit: 1,
    generating_proof: 2,
    proof_complete: 3,
    verifying: 3,
    verified: 4,
  };

  const stepIndex = stepMap[stepId];
  const currentIndex = currentMap[currentStep];

  if (currentIndex > stepIndex) return 'complete';
  if (currentIndex === stepIndex) return 'current';
  return 'upcoming';
}

export default function StepVisualizer({ currentStep }: StepVisualizerProps) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
      <h2 className="text-sm font-medium text-slate-400 mb-4">Protocol Flow</h2>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id, currentStep);
          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-all ${
                    status === 'complete'
                      ? 'bg-green-500 text-white'
                      : status === 'current'
                      ? 'bg-blue-500 text-white animate-pulse'
                      : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {status === 'complete' ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className={`text-sm font-medium ${status === 'upcoming' ? 'text-slate-500' : 'text-white'}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`w-24 h-0.5 mx-4 ${
                    getStepStatus(steps[index + 1].id, currentStep) !== 'upcoming'
                      ? 'bg-green-500'
                      : 'bg-slate-700'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
