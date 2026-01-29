'use client';

import { Step, EditParams, JobResult, Job } from '@/app/page';

interface TechnicalPanelProps {
  currentStep: Step;
  editParams: EditParams | null;
  result: JobResult | null;
  job: Job | null;
}

export default function TechnicalPanel({ currentStep, editParams, result, job }: TechnicalPanelProps) {
  const details = result?.technical_details;

  return (
    <div className="space-y-6">
      {/* Protocol Explanation */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">How It Works</h3>
        <div className="space-y-4 text-sm">
          <div className="p-3 bg-slate-700/50 rounded-lg">
            <h4 className="font-medium text-blue-400 mb-1">1. Image Signing (Camera/C2PA)</h4>
            <p className="text-slate-400">
              Original photo is hashed using Lattice + Poseidon hash, then signed with ECDSA.
            </p>
          </div>
          <div className="p-3 bg-slate-700/50 rounded-lg">
            <h4 className="font-medium text-blue-400 mb-1">2. Edit & Prove (Newsroom)</h4>
            <p className="text-slate-400">
              Editor applies transformation and generates a ZK proof that the edit was valid.
            </p>
          </div>
          <div className="p-3 bg-slate-700/50 rounded-lg">
            <h4 className="font-medium text-blue-400 mb-1">3. Verify (Reader)</h4>
            <p className="text-slate-400">
              Anyone can verify the proof in under 1 second without seeing the original.
            </p>
          </div>
        </div>
      </div>

      {/* Current Operation */}
      {editParams && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Current Operation</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-slate-400">Edit Type</span>
              <span className="text-white font-mono">{editParams.type}</span>
            </div>
            {editParams.type === 'crop' && (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-400">Region</span>
                  <span className="text-white font-mono">
                    ({editParams.x}, {editParams.y}) - {editParams.width}x{editParams.height}
                  </span>
                </div>
              </>
            )}
            {editParams.type === 'resize' && (
              <div className="flex justify-between">
                <span className="text-slate-400">New Size</span>
                <span className="text-white font-mono">
                  {editParams.new_width}x{editParams.new_height}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Technical Details */}
      {details && (
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Proof Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Proof System</span>
              <span className="text-white font-mono">{details.proof_system}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Hash Function</span>
              <span className="text-white font-mono">{details.hash_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Field Size</span>
              <span className="text-white font-mono">{details.field_size_bits} bits</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Security Level</span>
              <span className="text-white font-mono">~{details.security_bits} bits</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Image Pixels</span>
              <span className="text-white font-mono">{details.image_pixels.toLocaleString()}</span>
            </div>
            {result?.proof_size && (
              <div className="flex justify-between">
                <span className="text-slate-400">Proof Size</span>
                <span className="text-white font-mono">
                  {(result.proof_size / 1024).toFixed(2)} KB
                </span>
              </div>
            )}
            {result?.proving_time_ms && (
              <div className="flex justify-between">
                <span className="text-slate-400">Proving Time</span>
                <span className="text-white font-mono">
                  {(result.proving_time_ms / 1000).toFixed(2)}s
                </span>
              </div>
            )}
            {result?.verification_time_ms != null && (
              <div className="flex justify-between">
                <span className="text-slate-400">Verification Time</span>
                <span className="text-white font-mono">
                  {result.verification_time_ms}ms
                </span>
              </div>
            )}
            
            {/* Resource Metrics Section */}
            {(details.wall_time_ms || details.peak_memory_mb) && (
              <>
                <div className="border-t border-slate-600 my-3"></div>
                <h4 className="text-sm font-medium text-slate-300 mb-2">Resource Usage</h4>
              </>
            )}
            {details.wall_time_ms && (
              <div className="flex justify-between">
                <span className="text-slate-400">Wall Time</span>
                <span className="text-white font-mono">
                  {(details.wall_time_ms / 1000).toFixed(2)}s
                </span>
              </div>
            )}
            {details.cpu_time_ms && (
              <div className="flex justify-between">
                <span className="text-slate-400">CPU Time</span>
                <span className="text-white font-mono">
                  {(details.cpu_time_ms / 1000).toFixed(2)}s
                </span>
              </div>
            )}
            {details.peak_memory_mb && (
              <div className="flex justify-between">
                <span className="text-slate-400">Peak Memory</span>
                <span className="text-white font-mono">
                  {details.peak_memory_mb.toFixed(0)} MB
                </span>
              </div>
            )}
            {details.memory_before_mb !== undefined && details.memory_after_mb !== undefined && (
              <div className="flex justify-between">
                <span className="text-slate-400">Memory Delta</span>
                <span className="text-white font-mono">
                  +{(details.memory_after_mb - details.memory_before_mb).toFixed(0)} MB
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Paper Reference */}
      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
        <h3 className="text-lg font-semibold text-white mb-4">Paper Reference</h3>
        <div className="text-sm text-slate-400 space-y-2">
          <p className="font-medium text-white">
            &ldquo;VerITAS: Verifying Image Transformations at Scale&rdquo;
          </p>
          <p>Trisha Datta, Binyi Chen, Dan Boneh</p>
          <p>Stanford University, 2024</p>
          <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
            <p className="text-xs">
              Key innovation: First system to prove edits on 30MP images using a novel 
              Lattice + Poseidon hash for efficient SNARK circuits.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
