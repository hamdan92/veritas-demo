'use client';

interface SignedImageData {
  mode: string;
  signed_data: string;
  image_hash: string;
  signature: string;
  public_key: string;
  signing_time_ms: number;
  metadata: {
    timestamp: number;
    device_id: string;
    width: number;
    height: number;
    color_depth: number;
  };
}

interface JobResult {
  proof?: string;
  proof_size?: number;
  proving_time_ms?: number;
  verified?: boolean;
  verification_time_ms?: number;
  technical_details?: {
    image_pixels: number;
    hash_type: string;
    proof_system: string;
  };
}

interface EditParams {
  type: 'crop' | 'blur' | 'resize' | 'grayscale';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  new_width?: number;
  new_height?: number;
}

type Step = 'idle' | 'uploading' | 'signing' | 'signed' | 'selecting_edit' | 'generating_proof' | 'proof_complete' | 'verifying' | 'verified';

interface VerificationChainProps {
  currentStep: Step;
  signedImage: SignedImageData | null;
  editParams: EditParams | null;
  result: JobResult | null;
}

export default function VerificationChain({ currentStep, signedImage, editParams, result }: VerificationChainProps) {
  const getStepStatus = (step: number) => {
    if (step === 1) {
      if (['uploading', 'signing'].includes(currentStep)) return 'active';
      if (['signed', 'selecting_edit', 'generating_proof', 'proof_complete', 'verifying', 'verified'].includes(currentStep)) return 'complete';
      return 'pending';
    }
    if (step === 2) {
      if (['generating_proof'].includes(currentStep)) return 'active';
      if (['proof_complete', 'verifying', 'verified'].includes(currentStep)) return 'complete';
      if (['signed', 'selecting_edit'].includes(currentStep)) return 'ready';
      return 'pending';
    }
    if (step === 3) {
      if (['verifying'].includes(currentStep)) return 'active';
      if (['verified'].includes(currentStep)) return result?.verified ? 'complete' : 'failed';
      if (['proof_complete'].includes(currentStep)) return 'ready';
      return 'pending';
    }
    return 'pending';
  };

  const step1Status = getStepStatus(1);
  const step2Status = getStepStatus(2);
  const step3Status = getStepStatus(3);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900/50 px-6 py-4 border-b border-slate-700">
        <h2 className="text-lg font-semibold text-white">Verification Chain</h2>
        <p className="text-sm text-slate-400 mt-1">
          Cryptographic proof that this image is authentic and edits are verified
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Step 1: Camera Authentication */}
        <div className={`rounded-lg border-2 transition-all ${
          step1Status === 'complete' ? 'border-green-500/50 bg-green-500/5' :
          step1Status === 'active' ? 'border-blue-500 bg-blue-500/10' :
          'border-slate-700 bg-slate-800/50'
        }`}>
          <div className="p-4">
            <div className="flex items-start gap-4">
              {/* Step Number */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                step1Status === 'complete' ? 'bg-green-500 text-white' :
                step1Status === 'active' ? 'bg-blue-500 text-white animate-pulse' :
                'bg-slate-700 text-slate-400'
              }`}>
                {step1Status === 'complete' ? '✓' : '1'}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  📷 Camera Authentication
                  {step1Status === 'active' && <span className="text-xs text-blue-400 animate-pulse">Processing...</span>}
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                  Is this image authentic and untampered from the source?
                </p>
                
                {/* Real Data Display */}
                {signedImage && step1Status === 'complete' && (
                  <div className="mt-4 space-y-3">
                    <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 uppercase tracking-wide">Digital Seal</span>
                        <span className="text-xs text-green-400">✓ Verified</span>
                      </div>
                      <div className="font-mono text-xs text-slate-300 break-all bg-slate-800 rounded px-2 py-1">
                        {signedImage.signature.slice(0, 32)}...
                      </div>
                    </div>
                    
                    <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 uppercase tracking-wide">Image Fingerprint (Hash)</span>
                        <span className="text-xs text-green-400">✓ Locked</span>
                      </div>
                      <div className="font-mono text-xs text-slate-300 break-all bg-slate-800 rounded px-2 py-1">
                        {signedImage.image_hash}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-900/50 rounded p-2">
                        <span className="text-slate-500">Device</span>
                        <p className="text-slate-300 font-mono">{signedImage.metadata.device_id}</p>
                      </div>
                      <div className="bg-slate-900/50 rounded p-2">
                        <span className="text-slate-500">Mode</span>
                        <p className="text-slate-300 font-mono text-xs">{signedImage.mode}</p>
                      </div>
                    </div>

                    <div className="text-xs text-green-400 bg-green-500/10 rounded p-2">
                      ✓ Answer: This image is authentic from the source camera
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Connector */}
        <div className="flex justify-center">
          <div className={`w-0.5 h-8 ${step1Status === 'complete' ? 'bg-green-500' : 'bg-slate-700'}`}></div>
        </div>

        {/* Step 2: Edit Proof */}
        <div className={`rounded-lg border-2 transition-all ${
          step2Status === 'complete' ? 'border-green-500/50 bg-green-500/5' :
          step2Status === 'active' ? 'border-blue-500 bg-blue-500/10' :
          step2Status === 'ready' ? 'border-yellow-500/50 bg-yellow-500/5' :
          'border-slate-700 bg-slate-800/50'
        }`}>
          <div className="p-4">
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                step2Status === 'complete' ? 'bg-green-500 text-white' :
                step2Status === 'active' ? 'bg-blue-500 text-white animate-pulse' :
                step2Status === 'ready' ? 'bg-yellow-500 text-white' :
                'bg-slate-700 text-slate-400'
              }`}>
                {step2Status === 'complete' ? '✓' : '2'}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  ✏️ Edit Proof Generation
                  {step2Status === 'active' && <span className="text-xs text-blue-400 animate-pulse">Generating ZK Proof...</span>}
                  {step2Status === 'ready' && <span className="text-xs text-yellow-400">Select an edit</span>}
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                  Can we prove ONLY this specific edit was made?
                </p>
                
                {/* Edit Info & Proof Data */}
                {result?.proof && step2Status === 'complete' && (
                  <div className="mt-4 space-y-3">
                    {/* Editor's Claim - Made Explicit */}
                    {editParams && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-yellow-400 uppercase tracking-wide font-medium">📋 Editor&apos;s Claim</span>
                        </div>
                        <div className="text-white font-medium">
                          &ldquo;I applied ONLY: {editParams.type === 'grayscale' && 'Grayscale Conversion'}
                          {editParams.type === 'crop' && `Crop (${editParams.width}×${editParams.height} at position ${editParams.x},${editParams.y})`}
                          {editParams.type === 'blur' && `Blur on region (${editParams.width}×${editParams.height})`}
                          {editParams.type === 'resize' && `Resize to ${editParams.new_width}×${editParams.new_height}`}&rdquo;
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                          This claim is bundled with the proof. The proof is ONLY valid for this specific edit.
                        </p>
                      </div>
                    )}

                    {/* Proof that backs the claim */}
                    {editParams && (
                      <div className="bg-slate-900/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-slate-500 uppercase tracking-wide">Proof Backing This Claim</span>
                          <span className="text-xs text-green-400">✓ Valid</span>
                        </div>
                        <div className="text-slate-300 text-sm">
                          Circuit type: <span className="font-mono text-blue-400">{editParams.type}_transform</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          If the claim was false, this proof would fail verification
                        </p>
                      </div>
                    )}

                    <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500 uppercase tracking-wide">ZK-SNARK Proof</span>
                        <span className="text-xs text-green-400">{result.proof_size ? `${(result.proof_size / 1024).toFixed(1)} KB` : ''}</span>
                      </div>
                      <div className="font-mono text-xs text-slate-300 break-all bg-slate-800 rounded px-2 py-1 max-h-16 overflow-hidden">
                        {result.proof.slice(0, 80)}...
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-900/50 rounded p-2">
                        <span className="text-slate-500">Proof System</span>
                        <p className="text-slate-300">Plonky2 (PLONK + FRI)</p>
                      </div>
                      <div className="bg-slate-900/50 rounded p-2">
                        <span className="text-slate-500">Proving Time</span>
                        <p className="text-slate-300">{result.proving_time_ms ? `${(result.proving_time_ms / 1000).toFixed(2)}s` : '-'}</p>
                      </div>
                    </div>

                    <div className="text-xs text-green-400 bg-green-500/10 rounded p-2">
                      ✓ Answer: ONLY this edit was applied - mathematically proven
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Connector */}
        <div className="flex justify-center">
          <div className={`w-0.5 h-8 ${step2Status === 'complete' ? 'bg-green-500' : 'bg-slate-700'}`}></div>
        </div>

        {/* Step 3: Verification */}
        <div className={`rounded-lg border-2 transition-all ${
          step3Status === 'complete' ? 'border-green-500/50 bg-green-500/5' :
          step3Status === 'failed' ? 'border-red-500/50 bg-red-500/5' :
          step3Status === 'active' ? 'border-blue-500 bg-blue-500/10' :
          step3Status === 'ready' ? 'border-yellow-500/50 bg-yellow-500/5' :
          'border-slate-700 bg-slate-800/50'
        }`}>
          <div className="p-4">
            <div className="flex items-start gap-4">
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                step3Status === 'complete' ? 'bg-green-500 text-white' :
                step3Status === 'failed' ? 'bg-red-500 text-white' :
                step3Status === 'active' ? 'bg-blue-500 text-white animate-pulse' :
                step3Status === 'ready' ? 'bg-yellow-500 text-white' :
                'bg-slate-700 text-slate-400'
              }`}>
                {step3Status === 'complete' ? '✓' : step3Status === 'failed' ? '✗' : '3'}
              </div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  🔍 Final Verification
                  {step3Status === 'active' && <span className="text-xs text-blue-400 animate-pulse">Verifying...</span>}
                  {step3Status === 'ready' && <span className="text-xs text-yellow-400">Click Verify Proof</span>}
                </h3>
                <p className="text-slate-400 text-sm mt-1">
                  Can you trust this edited photo is legitimate?
                </p>
                
                {/* Verification Result */}
                {result?.verified !== undefined && result.verified !== null && (
                  <div className="mt-4 space-y-3">
                    <div className={`rounded-lg p-4 ${result.verified ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${result.verified ? 'bg-green-500' : 'bg-red-500'}`}>
                          {result.verified ? '✓' : '✗'}
                        </div>
                        <div>
                          <p className={`font-bold text-lg ${result.verified ? 'text-green-400' : 'text-red-400'}`}>
                            {result.verified ? 'VERIFIED AUTHENTIC' : 'VERIFICATION FAILED'}
                          </p>
                          <p className="text-sm text-slate-300">
                            {result.verified 
                              ? 'Complete chain of custody confirmed'
                              : 'Image may have been tampered with'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {result.verified && (
                      <>
                        <div className="bg-slate-900/50 rounded-lg p-3 space-y-2">
                          <span className="text-xs text-slate-500 uppercase tracking-wide">What Was Verified</span>
                          <ul className="text-sm text-slate-300 space-y-2 mt-2">
                            <li className="flex items-start gap-2">
                              <span className="text-green-400 mt-0.5">✓</span>
                              <div>
                                <span className="font-medium">Origin Verified</span>
                                <p className="text-xs text-slate-400">Original image came from a trusted signed device</p>
                              </div>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-400 mt-0.5">✓</span>
                              <div>
                                <span className="font-medium">Claim Verified</span>
                                <p className="text-xs text-slate-400">Editor&apos;s claim matches the proof circuit type</p>
                              </div>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-400 mt-0.5">✓</span>
                              <div>
                                <span className="font-medium">Proof Valid</span>
                                <p className="text-xs text-slate-400">ZK-SNARK proof is mathematically correct</p>
                              </div>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-green-400 mt-0.5">✓</span>
                              <div>
                                <span className="font-medium">No Hidden Edits</span>
                                <p className="text-xs text-slate-400">Proof guarantees ONLY the claimed edit was made</p>
                              </div>
                            </li>
                          </ul>
                        </div>

                        <div className="text-sm text-green-400 bg-green-500/10 rounded p-3 font-medium">
                          ✓ You can TRUST this photo. The editor claimed a specific edit, and the proof confirms that&apos;s ALL they did.
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
