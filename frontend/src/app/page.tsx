'use client';

import { useState } from 'react';
import ImageUpload from '@/components/ImageUpload';
import EditControls from '@/components/EditControls';
import StepVisualizer from '@/components/StepVisualizer';
import TechnicalPanel from '@/components/TechnicalPanel';
import ResultPanel from '@/components/ResultPanel';

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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

  const handleImageUpload = (file: File, dataUrl: string) => {
    setImage(dataUrl);
    setImageFile(file);
    setCurrentStep('image_ready');
    setJob(null);
    setResult(null);
  };

  const handleEditSelect = async (params: EditParams) => {
    if (!image) return;
    
    setEditParams(params);
    setCurrentStep('generating_proof');
    
    try {
      // Extract base64 data from data URL
      const base64Data = image.split(',')[1];
      
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
        throw new Error('Failed to create edit job');
      }
      
      const { job_id } = await response.json();
      
      // Poll for job status
      pollJobStatus(job_id);
    } catch (error) {
      console.error('Error:', error);
      setCurrentStep('image_ready');
    }
  };

  const pollJobStatus = async (jobId: string) => {
    const poll = async () => {
      try {
        const response = await fetch(`${API_URL}/api/job/${jobId}`);
        const jobData: Job = await response.json();
        setJob(jobData);
        
        if (jobData.status === 'completed') {
          setResult(jobData.result || null);
          setCurrentStep('proof_complete');
        } else if (jobData.status === 'failed') {
          setCurrentStep('image_ready');
        } else {
          // Keep polling
          setTimeout(poll, 1000);
        }
      } catch (error) {
        console.error('Polling error:', error);
        setTimeout(poll, 2000);
      }
    };
    
    poll();
  };

  const handleVerify = async () => {
    if (!result?.proof) return;
    
    setCurrentStep('verifying');
    
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
      setResult(prev => prev ? { ...prev, verified: verification.valid, verification_time_ms: verification.verification_time_ms } : null);
      setCurrentStep('verified');
    } catch (error) {
      console.error('Verification error:', error);
      setCurrentStep('proof_complete');
    }
  };

  const handleReset = () => {
    setImage(null);
    setImageFile(null);
    setCurrentStep('idle');
    setEditParams(null);
    setJob(null);
    setResult(null);
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
