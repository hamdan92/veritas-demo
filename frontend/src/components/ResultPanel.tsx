'use client';

import { JobResult } from '@/app/page';

interface ResultPanelProps {
  result: JobResult;
  onVerify: () => void;
  isVerifying: boolean;
}

export default function ResultPanel({ result, onVerify, isVerifying }: ResultPanelProps) {
  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">Proof Generated</h3>
      
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-slate-700/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {result.proof_size ? (result.proof_size / 1024).toFixed(1) : '-'}
            </p>
            <p className="text-sm text-slate-400">Proof Size (KB)</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4 text-center">
            <p className="text-2xl font-bold text-white">
              {result.proving_time_ms ? (result.proving_time_ms / 1000).toFixed(2) : '-'}
            </p>
            <p className="text-sm text-slate-400">Proving Time (s)</p>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4 text-center">
            {/* Check for both undefined AND null - backend sends null for unset Option<bool> */}
            {result.verified != null ? (
              <>
                <p className={`text-2xl font-bold ${result.verified ? 'text-green-400' : 'text-red-400'}`}>
                  {result.verified ? 'Valid' : 'Invalid'}
                </p>
                <p className="text-sm text-slate-400">Verification</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-slate-400">-</p>
                <p className="text-sm text-slate-400">Not Verified</p>
              </>
            )}
          </div>
        </div>

        {/* Proof Preview */}
        {result.proof && (
          <div>
            <p className="text-sm font-medium text-slate-400 mb-2">Proof Data (Base64, truncated)</p>
            <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs text-slate-500 overflow-hidden">
              {result.proof.slice(0, 200)}...
            </div>
          </div>
        )}

        {/* Verify Button - show when verified is undefined OR null */}
        {result.verified == null && (
          <button
            onClick={onVerify}
            disabled={isVerifying}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isVerifying ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Verify Proof
              </>
            )}
          </button>
        )}

        {/* Verification Result - show when verified is actually set (not null/undefined) */}
        {result.verified != null && (
          <div className={`p-4 rounded-lg ${result.verified ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
            <div className="flex items-center gap-3">
              {result.verified ? (
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              <div>
                <p className={`font-medium ${result.verified ? 'text-green-400' : 'text-red-400'}`}>
                  {result.verified ? 'Proof Verified Successfully' : 'Proof Verification Failed'}
                </p>
                {result.verification_time_ms != null && (
                  <p className="text-sm text-slate-400">
                    Verified in {result.verification_time_ms}ms
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
