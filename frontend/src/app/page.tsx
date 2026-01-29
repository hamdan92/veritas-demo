'use client';

import { useState, useCallback } from 'react';
import ImageUpload from '@/components/ImageUpload';
import EditControls from '@/components/EditControls';
import StepVisualizer from '@/components/StepVisualizer';
import TechnicalPanel from '@/components/TechnicalPanel';
import ResultPanel from '@/components/ResultPanel';
import LogPanel, { LogEntry } from '@/components/LogPanel';

export interface EditParams {
  type: 'crop' | 'blur' | 'resize' | 'grayscale';
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  new_width?: number;
  new_height?: number;
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

export type Step = 
  | 'idle'
  | 'uploading'
  | 'image_ready'
  | 'selecting_edit'
  | 'generating_proof'
  | 'proof_complete'
  | 'verifying'
  | 'verified';

export default function Home() {
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currentStep, setCurrentStep] = useState<Step>('idle');
  const [editParams, setEditParams] = useState<EditParams | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [result, setResult] = useState<JobResult | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setLogs(prev => [...prev, { timestamp: new Date(), level, message }]);
  }, []);

  const handleImageUpload = (file: File, dataUrl: string) => {
    addLog('step', 'Image upload initiated');
    addLog('info', `File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    addLog('info', `Type: ${file.type || 'unknown'}`);
    
    // Check file type
    const supportedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
    if (!supportedTypes.includes(file.type)) {
      addLog('error', `Unsupported format: ${file.type}`);
      addLog('warning', 'Supported formats: PNG, JPEG, WebP, GIF');
      addLog('warning', 'HEIC/HEIF is NOT supported');
      return;
    }
    
    addLog('success', 'Image format validated');
    
    // Check file size
    if (file.size > 500 * 1024) {
      addLog('warning', 'Large file detected - proof generation may take several minutes');
    }
    
    setImage(dataUrl);
    setImageFile(file);
    setCurrentStep('image_ready');
    setJob(null);
    setResult(null);
    
    addLog('step', 'Simulating C2PA signature verification...');
    addLog('info', 'Checking image provenance metadata');
    
    setTimeout(() => {
      addLog('success', 'Image loaded and ready for editing');
      addLog('info', 'In production: C2PA manifest would be verified here');
    }, 500);
  };

  const handleEditSelect = async (params: EditParams) => {
    if (!image) return;
    
    setEditParams(params);
    setCurrentStep('generating_proof');
    
    addLog('step', `Edit operation selected: ${params.type.toUpperCase()}`);
    
    if (params.type === 'crop') {
      addLog('info', `Crop region: (${params.x}, ${params.y}) size ${params.width}x${params.height}`);
    } else if (params.type === 'blur') {
      addLog('info', `Blur region: (${params.x}, ${params.y}) size ${params.width}x${params.height}`);
    } else if (params.type === 'resize') {
      addLog('info', `New dimensions: ${params.new_width}x${params.new_height}`);
    }
    
    addLog('step', 'Initiating ZK proof generation...');
    addLog('info', `Backend: ${API_URL}`);
    
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
      setCurrentStep('image_ready');
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
          addLog('success', 'ZK proof generated successfully!');
          if (jobData.result?.proving_time_ms) {
            addLog('info', `Proving time: ${(jobData.result.proving_time_ms / 1000).toFixed(2)}s`);
          }
          if (jobData.result?.proof_size) {
            addLog('info', `Proof size: ${(jobData.result.proof_size / 1024).toFixed(2)} KB`);
          }
          addLog('step', 'Proof ready for verification');
          setResult(jobData.result || null);
          setCurrentStep('proof_complete');
        } else if (jobData.status === 'failed') {
          addLog('error', `Job failed: ${jobData.error || 'Unknown error'}`);
          setCurrentStep('image_ready');
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
        addLog('warning', `Poll error: ${errorMessage}, retrying...`);
        setTimeout(poll, 3000);
      }
    };
    
    poll();
  };

  const handleVerify = async () => {
    if (!result?.proof) return;
    
    setCurrentStep('verifying');
    addLog('step', 'Initiating proof verification');
    addLog('info', 'Verifier checks PLONK equations + FRI proximity');
    
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
        addLog('success', 'PROOF VERIFIED SUCCESSFULLY');
        addLog('info', `Verification time: ${verification.verification_time_ms || '<1'}ms`);
        addLog('step', 'Image transformation is cryptographically proven');
      } else {
        addLog('error', 'Proof verification FAILED');
        addLog('warning', verification.error || 'Invalid proof');
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
    setLogs([{ timestamp: new Date(), level: 'info', message: 'Ready for new image' }]);
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
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Left Panel - Image & Controls */}
          <div className="lg:col-span-2 space-y-6">
            {currentStep === 'idle' ? (
              <ImageUpload onUpload={handleImageUpload} />
            ) : (
              <div className="space-y-6">
                {/* Original/Edited Images */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <h3 className="text-sm font-medium text-slate-400 mb-3">Original Image</h3>
                    {image && (
                      <img 
                        src={image} 
                        alt="Original" 
                        className="w-full h-auto rounded-lg"
                      />
                    )}
                  </div>
                  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <h3 className="text-sm font-medium text-slate-400 mb-3">Edited Image</h3>
                    {result?.edited_image ? (
                      <img 
                        src={`data:image/png;base64,${result.edited_image}`}
                        alt="Edited" 
                        className="w-full h-auto rounded-lg"
                      />
                    ) : (
                      <div className="aspect-video bg-slate-700/50 rounded-lg flex items-center justify-center text-slate-500">
                        {currentStep === 'generating_proof' ? 'Processing...' : 'Select an edit'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Controls */}
                {(currentStep === 'image_ready' || currentStep === 'selecting_edit') && (
                  <EditControls onEditSelect={handleEditSelect} />
                )}

                {/* Progress */}
                {currentStep === 'generating_proof' && job && (
                  <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Generating ZK Proof</h3>
                    <div className="w-full bg-slate-700 rounded-full h-3 mb-3">
                      <div 
                        className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    <p className="text-slate-400 text-sm">{job.message}</p>
                  </div>
                )}

                {/* Results */}
                {(currentStep === 'proof_complete' || currentStep === 'verifying' || currentStep === 'verified') && result && (
                  <ResultPanel 
                    result={result} 
                    onVerify={handleVerify}
                    isVerifying={currentStep === 'verifying'}
                  />
                )}

                {/* Reset Button */}
                <button
                  onClick={handleReset}
                  className="text-slate-400 hover:text-white text-sm underline"
                >
                  Start over with a new image
                </button>
              </div>
            )}

            {/* Log Panel */}
            <LogPanel logs={logs} />
          </div>

          {/* Right Panel - Technical Details */}
          <div className="space-y-6">
            <TechnicalPanel 
              currentStep={currentStep}
              editParams={editParams}
              result={result}
              job={job}
            />
          </div>
        </div>
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
