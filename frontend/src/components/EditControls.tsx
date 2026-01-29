'use client';

import { useState } from 'react';
import { EditParams } from '@/app/page';

interface EditControlsProps {
  onEditSelect: (params: EditParams) => void;
}

export default function EditControls({ onEditSelect }: EditControlsProps) {
  const [selectedEdit, setSelectedEdit] = useState<string | null>(null);
  const [cropParams, setCropParams] = useState({ x: 10, y: 10, width: 100, height: 100 });
  const [blurParams, setBlurParams] = useState({ x: 20, y: 20, width: 50, height: 50 });
  const [resizeParams, setResizeParams] = useState({ new_width: 200, new_height: 150 });

  const edits = [
    {
      id: 'crop',
      name: 'Crop',
      description: 'Extract a rectangular region',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      ),
    },
    {
      id: 'grayscale',
      name: 'Grayscale',
      description: 'Convert to grayscale (0.30R + 0.59G + 0.11B)',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ),
    },
    {
      id: 'blur',
      name: 'Blur',
      description: '3x3 box blur on a region',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      ),
    },
    {
      id: 'resize',
      name: 'Resize',
      description: 'Bilinear interpolation resize',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      ),
    },
  ];

  const handleApply = () => {
    if (!selectedEdit) return;

    let params: EditParams;
    switch (selectedEdit) {
      case 'crop':
        params = { type: 'crop', ...cropParams };
        break;
      case 'blur':
        params = { type: 'blur', ...blurParams };
        break;
      case 'resize':
        params = { type: 'resize', ...resizeParams };
        break;
      case 'grayscale':
        params = { type: 'grayscale' };
        break;
      default:
        return;
    }
    onEditSelect(params);
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <h3 className="text-lg font-semibold text-white mb-4">Select an Edit Operation</h3>
      
      <div className="grid grid-cols-2 gap-3 mb-6">
        {edits.map((edit) => (
          <button
            key={edit.id}
            onClick={() => setSelectedEdit(edit.id)}
            className={`p-4 rounded-lg border transition-all text-left ${
              selectedEdit === edit.id
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-600 hover:border-slate-500 bg-slate-700/50'
            }`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span className={selectedEdit === edit.id ? 'text-blue-400' : 'text-slate-400'}>
                {edit.icon}
              </span>
              <span className="font-medium text-white">{edit.name}</span>
            </div>
            <p className="text-sm text-slate-400">{edit.description}</p>
          </button>
        ))}
      </div>

      {/* Parameters */}
      {selectedEdit === 'crop' && (
        <div className="space-y-4 mb-6">
          <h4 className="text-sm font-medium text-slate-400">Crop Parameters</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500">X Position</label>
              <input
                type="number"
                value={cropParams.x}
                onChange={(e) => setCropParams({ ...cropParams, x: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Y Position</label>
              <input
                type="number"
                value={cropParams.y}
                onChange={(e) => setCropParams({ ...cropParams, y: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Width</label>
              <input
                type="number"
                value={cropParams.width}
                onChange={(e) => setCropParams({ ...cropParams, width: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Height</label>
              <input
                type="number"
                value={cropParams.height}
                onChange={(e) => setCropParams({ ...cropParams, height: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {selectedEdit === 'blur' && (
        <div className="space-y-4 mb-6">
          <h4 className="text-sm font-medium text-slate-400">Blur Region</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500">X Position</label>
              <input
                type="number"
                value={blurParams.x}
                onChange={(e) => setBlurParams({ ...blurParams, x: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Y Position</label>
              <input
                type="number"
                value={blurParams.y}
                onChange={(e) => setBlurParams({ ...blurParams, y: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Width</label>
              <input
                type="number"
                value={blurParams.width}
                onChange={(e) => setBlurParams({ ...blurParams, width: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Height</label>
              <input
                type="number"
                value={blurParams.height}
                onChange={(e) => setBlurParams({ ...blurParams, height: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {selectedEdit === 'resize' && (
        <div className="space-y-4 mb-6">
          <h4 className="text-sm font-medium text-slate-400">New Dimensions</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-500">Width</label>
              <input
                type="number"
                value={resizeParams.new_width}
                onChange={(e) => setResizeParams({ ...resizeParams, new_width: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Height</label>
              <input
                type="number"
                value={resizeParams.new_height}
                onChange={(e) => setResizeParams({ ...resizeParams, new_height: parseInt(e.target.value) || 0 })}
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleApply}
        disabled={!selectedEdit}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
      >
        Generate ZK Proof
      </button>
    </div>
  );
}
