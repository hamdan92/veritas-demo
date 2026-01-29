'use client';

import { useEffect, useRef } from 'react';

export interface LogEntry {
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error' | 'step';
  message: string;
}

interface LogPanelProps {
  logs: LogEntry[];
}

export default function LogPanel({ logs }: LogPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return 'text-slate-400';
      case 'success': return 'text-green-400';
      case 'warning': return 'text-amber-400';
      case 'error': return 'text-red-400';
      case 'step': return 'text-blue-400';
      default: return 'text-slate-400';
    }
  };

  const getLevelPrefix = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return '[INFO]';
      case 'success': return '[OK]';
      case 'warning': return '[WARN]';
      case 'error': return '[ERROR]';
      case 'step': return '[STEP]';
      default: return '[LOG]';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border-b border-slate-700">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <span className="text-slate-400 text-sm font-mono ml-2">VerITAS Protocol Log</span>
      </div>
      <div 
        ref={scrollRef}
        className="p-4 h-64 overflow-y-auto font-mono text-sm"
      >
        {logs.length === 0 ? (
          <div className="text-slate-600">
            <p>$ Waiting for input...</p>
            <p className="animate-pulse">_</p>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <div key={index} className="flex gap-2">
                <span className="text-slate-600 shrink-0">{formatTime(log.timestamp)}</span>
                <span className={`shrink-0 ${getLevelColor(log.level)}`}>
                  {getLevelPrefix(log.level)}
                </span>
                <span className={getLevelColor(log.level)}>{log.message}</span>
              </div>
            ))}
            <div className="text-slate-600 animate-pulse">_</div>
          </div>
        )}
      </div>
    </div>
  );
}
