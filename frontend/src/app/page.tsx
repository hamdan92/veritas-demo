'use client';

import { useState, useCallback } from 'react';
import ImageUpload from '@/components/ImageUpload';
import EditControls from '@/components/EditControls';
import StepVisualizer from '@/components/StepVisualizer';
import TechnicalPanel from '@/components/TechnicalPanel';
import ResultPanel from '@/components/ResultPanel';
import LogPanel, { LogEntry } from '@/components/LogPanel';
import VerificationChain from '@/components/VerificationChain';

export interface EditParams {
  type: 'crop' | 'blur' | 'resize' | 'grayscale';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  new_width?: number;
  new_height?: number;
}

export interface SignedImageData {
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

export interface JobResult {
  edited_image?: string;
  proof?: string;
  proof_size?: number;
  proving_time_ms?: number;
  verification_time_ms?: number;
  verified?: boolean;
  technical_details?: {
    image_pixels: number;
    circuit_size?: number;
    num_constraints?: number;
    hash_type: string;
    proof_system: string;
    field_size_bits: number;
    security_bits: number;
    // Resource metrics
    peak_memory_mb?: number;
    memory_before_mb?: number;
    memory_after_mb?: number;
    cpu_time_ms?: number;
    wall_time_ms?: number;
  };
}

export interface Job {
  id: string;
  job_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  result?: JobResult;
  error?: string;
}

// Updated steps to reflect 3-actor flow
export type Step = 
  | 'idle'
  | 'uploading'
  | 'signing'          // Actor 1: Camera signs the image
  | 'signed'           // Image is now signed with C2PA
  | 'selecting_edit'
  | 'generating_proof' // Actor 2: Prover generates ZK proof
  | 'proof_complete'
  | 'verifying'        // Actor 3: Verifier checks proof
  | 'verified';

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_imageFile, setImageFile] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('idle');
  const [editParams, setEditParams] = useState<EditParams | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([
    { timestamp: new Date(), level: 'info', message: 'VerITAS Demo initialized' },
    { timestamp: new Date(), level: 'info', message: 'Ready for image upload' },
  ]);
  const [signedImage, setSignedImage] = useState<SignedImageData | null>(null);
  const [signingMode, setSigningMode] = useState<'lattice' | 'polynomial'>('lattice');

  // Use production URL directly since NEXT_PUBLIC_ vars need to be available at build time
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost' 
      ? 'https://backend-production-d99f.up.railway.app' 
      : 'http://localhost:8080');

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setLogs(prev => [...prev, { timestamp: new Date(), level, message }]);
  }, []);

  const handleImageUpload = async (file: File, dataUrl: string) => {
    addLog('step', 'STEP 1: Camera Authentication');
    addLog('info', `Image: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    
    // Check file type
    const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!supportedTypes.includes(file.type)) {
      addLog('error', `Unsupported format: ${file.type}`);
      addLog('warning', 'Supported formats: PNG, JPEG, WebP, GIF');
      addLog('warning', 'HEIC/HEIF is NOT supported');
      return;
    }
    
    addLog('success', 'Image format validated');
    
    // Check file size - be very strict for Railway's memory limits
    if (file.size > 10 * 1024) {
      addLog('warning', 'File may be too large for server memory limits');
      addLog('warning', 'Recommended: Use images under 10KB (32x32 to 64x64 pixels)');
    }
    
    setImage(dataUrl);
    setImageFile(file);
    setCurrentStep('signing');
    setJob(null);
    setResult(null);
    setSignedImage(null);
    
    // Sign the image (Actor 1: Camera/Signer)
    addLog('info', `Mode: ${signingMode === 'lattice' ? 'Lattice + Poseidon' : 'Polynomial Commitment'}`);
    addLog('info', 'Computing image hash...');
    
    try {
      const base64Data = dataUrl.split(',')[1];
      
      const response = await fetch(`${API_URL}/api/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data,
          mode: signingMode,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const signResult = await response.json();
      
      addLog('success', 'Image signed successfully');
      addLog('info', `Hash: ${signResult.image_hash}`);
      addLog('info', `Signature: ${signResult.signature.slice(0, 32)}...`);
      addLog('info', `Device: ${signResult.metadata.device_id}`);
      
      setSignedImage(signResult);
      setCurrentStep('signed');
      
      addLog('step', 'STEP 2: Select an edit');
    } catch (error) {
      console.error('Signing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Signing failed: ${errorMessage}`);
      addLog('info', 'Falling back to demo mode (simulated signature)');
      
      // Fall back to simulated signing for demo
      setSignedImage({
        mode: 'Demo Mode (Simulated)',
        signed_data: '',
        image_hash: 'demo_hash_' + Date.now(),
        signature: 'demo_sig_' + Date.now(),
        public_key: 'demo_pk_' + Date.now(),
        signing_time_ms: 0,
        metadata: {
          timestamp: Date.now(),
          device_id: 'Demo-Camera',
          width: 0,
          height: 0,
          color_depth: 8,
        },
      });
      setCurrentStep('signed');
    }
  };

  const handleEditSelect = async (params: EditParams) => {
    if (!image) return;
    
    setEditParams(params);
    setCurrentStep('generating_proof');
    
    addLog('info', `Edit: ${params.type.toUpperCase()}`);
    
    if (params.type === 'crop') {
      addLog('info', `Region: (${params.x}, ${params.y}) ${params.width}x${params.height}`);
    } else if (params.type === 'blur') {
      addLog('info', `Blur region: (${params.x}, ${params.y}) size ${params.width}x${params.height}`);
    } else if (params.type === 'resize') {
      addLog('info', `New dimensions: ${params.new_width}x${params.new_height}`);
    }
    
    addLog('step', 'Generating ZK proof that edit was applied correctly...');
    addLog('info', 'Proof shows: f(original) = edited WITHOUT revealing original');
    
    try {
      // Extract base64 data from data URL
      const base64Data = image.split(',')[1];
      
      addLog('info', `Sending image data (${(base64Data.length / 1024).toFixed(1)} KB base64)`);
      
      // Create the edit request body
      const editBody: Record<string, unknown> = { type: params.type };
      if (params.type === 'crop' || params.type === 'blur') {
        editBody.x = params.x;
        editBody.y = params.y;
        editBody.width = params.width;
        editBody.height = params.height;
      } else if (params.type === 'resize') {
        editBody.new_width = params.new_width;
        editBody.new_height = params.new_height;
      }
      
      const response = await fetch(`${API_URL}/api/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Data,
          edit: editBody,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }
      
      const { job_id } = await response.json();
      
      addLog('success', `Job created: ${job_id.slice(0, 8)}...`);
      addLog('step', 'Starting Plonky2 proof generation');
      addLog('info', 'This may take 30-120 seconds for small images');
      addLog('info', 'Building arithmetic circuit...');
      
      // Poll for job status
      pollJobStatus(job_id);
    } catch (error) {
      console.error('Fetch error:', error);
      let errorMessage = 'Unknown error';
      if (error instanceof TypeError) {
        errorMessage = `Network error: ${error.message}. Check if backend is reachable.`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      addLog('error', `Failed to create job: ${errorMessage}`);
      addLog('info', `Attempted URL: ${API_URL}/api/edit`);
      setCurrentStep('signed');
    }
  };

  const pollJobStatus = async (jobId: string) => {
    let lastProgress = 0;
    let pollCount = 0;
    
    const poll = async () => {
      try {
        const response = await fetch(`${API_URL}/api/job/${jobId}`);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const jobData: Job = await response.json();
        setJob(jobData);
        
        // Log progress updates
        if (jobData.progress > lastProgress) {
          if (jobData.progress >= 10 && lastProgress < 10) {
            addLog('info', 'Processing image pixels...');
          }
          if (jobData.progress >= 30 && lastProgress < 30) {
            addLog('info', 'Computing Poseidon hashes...');
          }
          if (jobData.progress >= 50 && lastProgress < 50) {
            addLog('info', 'Building PLONK gates...');
          }
          if (jobData.progress >= 70 && lastProgress < 70) {
            addLog('info', 'Generating FRI commitments...');
          }
          if (jobData.progress >= 90 && lastProgress < 90) {
            addLog('info', 'Finalizing proof...');
          }
          lastProgress = jobData.progress;
        }
        
        if (jobData.status === 'completed') {
          addLog('success', 'ZK proof generated');
          const details = jobData.result?.technical_details;
          if (details?.wall_time_ms) {
            addLog('info', `Time: ${(details.wall_time_ms / 1000).toFixed(2)}s`);
          }
          if (jobData.result?.proof_size) {
            addLog('info', `Size: ${(jobData.result.proof_size / 1024).toFixed(2)} KB`);
          }
          if (details?.peak_memory_mb) {
            addLog('info', `Memory: ${details.peak_memory_mb.toFixed(0)} MB`);
          }
          addLog('step', 'STEP 3: Verify the proof');
          setResult(jobData.result || null);
          setCurrentStep('proof_complete');
        } else if (jobData.status === 'failed') {
          addLog('error', `Job failed: ${jobData.error || 'Unknown error'}`);
          setCurrentStep('signed');
        } else {
          // Keep polling
          pollCount++;
          if (pollCount % 10 === 0) {
            addLog('info', `Still processing... (${pollCount * 2}s elapsed)`);
          }
          setTimeout(poll, 2000);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('404')) {
          addLog('error', 'Job lost - server may have restarted due to memory limits');
          addLog('warning', 'Plonky2 proof generation requires significant memory');
          addLog('info', 'Try a MUCH smaller image (32x32 or 64x64 pixels)');
          setCurrentStep('signed');
          return; // Stop polling
        }
        addLog('warning', `Poll error: ${errorMessage}, retrying...`);
        setTimeout(poll, 3000);
      }
    };
    
    poll();
  };

  const handleVerify = async () => {
    if (!result?.proof) return;
    
    setCurrentStep('verifying');
    addLog('info', 'Verifying proof...');
    
    try {
      const response = await fetch(`${API_URL}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proof: result.proof,
          public_inputs: [],
          edit_type: editParams?.type || 'unknown',
        }),
      });
      
      const verification = await response.json();
      
      if (verification.valid) {
        addLog('success', 'VERIFIED - Proof is valid');
        addLog('info', `Verification time: ${verification.verification_time_ms || '<1'}ms`);
      } else {
        addLog('error', 'FAILED - Proof invalid');
        addLog('warning', verification.error || 'Verification failed');
      }
      
      setResult(prev => prev ? { 
        ...prev, 
        verified: verification.valid, 
        verification_time_ms: verification.verification_time_ms 
      } : null);
      setCurrentStep('verified');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addLog('error', `Verification error: ${errorMessage}`);
      setCurrentStep('proof_complete');
    }
  };

  const handleReset = () => {
    addLog('info', 'Session reset');
    setImage(null);
    setImageFile(null);
    setCurrentStep('idle');
    setEditParams(null);
    setJob(null);
    setResult(null);
    setSignedImage(null);
    setLogs([
      { timestamp: new Date(), level: 'info', message: 'Session reset' },
      { timestamp: new Date(), level: 'info', message: 'Ready for new image' },
    ]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">VerITAS Demo</h1>
              <p className="text-slate-400 mt-1">
                Verifying Image Transformations at Scale using Zero-Knowledge Proofs
              </p>
            </div>
            <div className="text-right text-sm text-slate-500">
              <p>Stanford University</p>
              <p>Datta, Chen, Boneh (2024)</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Step Visualizer */}
        <StepVisualizer currentStep={currentStep} />
        
        {/* 3-Actor Flow Indicator */}
        <div className="flex justify-center gap-4 mt-4 mb-2">
          <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
            currentStep === 'signing' || currentStep === 'signed' 
              ? 'bg-blue-600 text-white' 
              : currentStep === 'idle' 
                ? 'bg-slate-700 text-slate-300'
                : 'bg-slate-800 text-slate-500'
          }`}>
            1. Signer (Camera)
          </div>
          <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
            currentStep === 'selecting_edit' || currentStep === 'generating_proof' || currentStep === 'proof_complete'
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-800 text-slate-500'
          }`}>
            2. Prover (Editor)
          </div>
          <div className={`px-4 py-2 rounded-lg text-sm font-medium ${
            currentStep === 'verifying' || currentStep === 'verified'
              ? 'bg-blue-600 text-white' 
              : 'bg-slate-800 text-slate-500'
          }`}>
            3. Verifier (Reader)
          </div>
        </div>

        {/* Main Content - New Layout */}
        {currentStep === 'idle' ? (
          /* Initial Upload Screen */
          <div className="max-w-4xl mx-auto mt-8 space-y-8">
            {/* Welcome Message */}
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-bold text-white">Can You Trust Edited Photos?</h2>
              <p className="text-slate-400 max-w-2xl mx-auto">
                This demo proves you can. Using zero-knowledge proofs, we verify that an edited photo 
                came from a real camera and only the claimed edits were made - no hidden manipulations.
              </p>
            </div>

            {/* How It Works */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📷</span>
                </div>
                <h3 className="text-white font-semibold mb-2">1. Camera Signs</h3>
                <p className="text-slate-400 text-sm">
                  The camera creates a digital seal - like a notary stamp. Any tampering breaks the seal.
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">✏️</span>
                </div>
                <h3 className="text-white font-semibold mb-2">2. Editor Proves</h3>
                <p className="text-slate-400 text-sm">
                  The editor creates mathematical proof that ONLY the claimed edit was made - nothing hidden.
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700 text-center">
                <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">🔍</span>
                </div>
                <h3 className="text-white font-semibold mb-2">3. You Verify</h3>
                <p className="text-slate-400 text-sm">
                  You verify the complete chain. If it passes, you can TRUST the photo is legitimate.
                </p>
              </div>
            </div>

            {/* Signing Mode Selection */}
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Select Signing Mode</h3>
              <div className="grid grid-cols-2 gap-4">
                <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  signingMode === 'lattice' 
                    ? 'border-blue-500 bg-blue-500/10' 
                    : 'border-slate-700 hover:border-slate-600'
                }`}>
                  <input
                    type="radio"
                    name="signingMode"
                    checked={signingMode === 'lattice'}
                    onChange={() => setSigningMode('lattice')}
                    className="mt-1"
                  />
                  <div>
                    <span className="text-white font-medium">Mode 1: Lattice + Poseidon</span>
                    <p className="text-xs text-slate-400 mt-1">
                      For resource-limited devices (cameras, phones). Uses lattice-based hashing.
                    </p>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  signingMode === 'polynomial' 
                    ? 'border-blue-500 bg-blue-500/10' 
                    : 'border-slate-700 hover:border-slate-600'
                }`}>
                  <input
                    type="radio"
                    name="signingMode"
                    checked={signingMode === 'polynomial'}
                    onChange={() => setSigningMode('polynomial')}
                    className="mt-1"
                  />
                  <div>
                    <span className="text-white font-medium">Mode 2: Polynomial Commitment</span>
                    <p className="text-xs text-slate-400 mt-1">
                      For powerful signers. Uses KZG polynomial commitments.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Upload */}
            <ImageUpload onUpload={handleImageUpload} />
          </div>
        ) : (
          /* Active Flow - Two Column Layout */
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">
            {/* Left: Images & Controls */}
            <div className="space-y-6">
              {/* Original/Edited Images */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    📷 Original Image
                    {signedImage && <span className="text-green-400 text-xs">✓ Signed</span>}
                  </h3>
                  {image && (
                    <img 
                      src={image} 
                      alt="Original" 
                      className="w-full h-auto rounded-lg"
                    />
                  )}
                </div>
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                  <h3 className="text-sm font-medium text-slate-400 mb-3 flex items-center gap-2">
                    ✏️ Edited Image
                    {result?.verified && <span className="text-green-400 text-xs">✓ Verified</span>}
                  </h3>
                  {result?.edited_image ? (
                    <img 
                      src={`data:image/png;base64,${result.edited_image}`}
                      alt="Edited" 
                      className="w-full h-auto rounded-lg"
                    />
                  ) : (
                    <div className="aspect-video bg-slate-700/50 rounded-lg flex items-center justify-center text-slate-500">
                      {currentStep === 'generating_proof' ? 'Processing...' : 'Select an edit below'}
                    </div>
                  )}
                </div>
              </div>

              {/* Edit Controls */}
              {(currentStep === 'signed' || currentStep === 'selecting_edit') && (
                <EditControls onEditSelect={handleEditSelect} />
              )}

              {/* Progress */}
              {currentStep === 'generating_proof' && job && (
                <div className="bg-slate-800 rounded-xl p-6 border border-blue-500/50">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="animate-pulse">⚡</span> Generating ZK Proof
                  </h3>
                  <div className="w-full bg-slate-700 rounded-full h-3 mb-3">
                    <div 
                      className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                  <p className="text-slate-400 text-sm">{job.message}</p>
                  <p className="text-xs text-slate-500 mt-2">This creates mathematical proof that the edit was applied correctly</p>
                </div>
              )}

              {/* Verify Button */}
              {currentStep === 'proof_complete' && result && (
                <button
                  onClick={handleVerify}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-xl transition-colors flex items-center justify-center gap-3 text-lg"
                >
                  <span className="text-2xl">🔍</span>
                  Verify the Complete Chain
                </button>
              )}

              {currentStep === 'verifying' && (
                <div className="w-full bg-blue-600 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-3 text-lg">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Verifying...
                </div>
              )}

              {/* Reset */}
              <button
                onClick={handleReset}
                className="text-slate-400 hover:text-white text-sm underline"
              >
                Start over with a new image
              </button>

              {/* Technical Log (collapsible) */}
              <details className="bg-slate-800/50 rounded-xl border border-slate-700">
                <summary className="px-4 py-3 cursor-pointer text-slate-400 hover:text-white text-sm">
                  Technical Log (click to expand)
                </summary>
                <div className="px-4 pb-4">
                  <LogPanel logs={logs} />
                </div>
              </details>
            </div>

            {/* Right: Verification Chain - THE MAIN FOCUS */}
            <div className="space-y-6">
              <VerificationChain 
                currentStep={currentStep}
                signedImage={signedImage}
                editParams={editParams}
                result={result}
              />

              {/* Technical Details (smaller) */}
              <details className="bg-slate-800/50 rounded-xl border border-slate-700" open>
                <summary className="px-4 py-3 cursor-pointer text-slate-400 hover:text-white text-sm font-medium">
                  Technical Details
                </summary>
                <div className="px-4 pb-4">
                  <TechnicalPanel 
                    currentStep={currentStep}
                    editParams={editParams}
                    result={result}
                    job={job}
                  />
                </div>
              </details>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center text-slate-500 text-sm">
          <p>Based on the paper: &ldquo;VerITAS: Verifying Image Transformations at Scale&rdquo;</p>
          <p className="mt-1">Implementation uses Plonky2 (PLONK + FRI) for zero-knowledge proofs</p>
        </div>
      </footer>
    </div>
  );
}
