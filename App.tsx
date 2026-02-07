
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MissionState, MissionStatus, StepStatus, LogType, LogEntry, Step, Artifact 
} from './types';
import { MemoryService } from './services/memory';
import { GeminiService } from './services/geminiService';

const initialState: MissionState = {
  id: '',
  goal: '',
  status: MissionStatus.IDLE,
  currentStepIndex: -1,
  steps: [],
  logs: [],
  artifacts: [],
  lastExecutionOutput: '',
  memory: {
    decisionLog: [],
    learnedContext: ''
  }
};

// --- Sub-components ---

const StatusBadge: React.FC<{ status: MissionStatus }> = ({ status }) => {
  const styles = {
    [MissionStatus.COMPLETED]: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    [MissionStatus.FAILED]: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    [MissionStatus.IDLE]: 'bg-slate-800 text-slate-400 border-slate-700',
    [MissionStatus.PLANNING]: 'bg-blue-500/10 text-blue-400 border-blue-500/20 animate-pulse',
    [MissionStatus.EXECUTING]: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse',
    [MissionStatus.VERIFYING]: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    [MissionStatus.FIXING]: 'bg-orange-500/10 text-orange-400 border-orange-500/20 animate-bounce',
    [MissionStatus.RETRYING]: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };

  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all duration-500 ${styles[status] || styles[MissionStatus.IDLE]}`}>
      {status}
    </span>
  );
};

const MissionTimeline: React.FC<{ mission: MissionState }> = ({ mission }) => {
  return (
    <div className="flex flex-col gap-6 relative">
      <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-slate-800/50" />
      {mission.steps.map((step, idx) => {
        const isActive = step.status === StepStatus.ACTIVE || step.status === StepStatus.FIXING;
        const isDone = step.status === StepStatus.COMPLETED;
        return (
          <div key={step.id} className="flex gap-4 relative group">
            <div className={`z-10 w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all duration-700 ${
              isDone ? 'bg-emerald-500 border-emerald-500' :
              isActive ? 'bg-blue-600 border-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.4)]' :
              'bg-slate-900 border-slate-700'
            }`}>
              {isDone ? (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
              ) : (
                <span className="text-[10px] font-bold text-white">{idx + 1}</span>
              )}
            </div>
            <div className="flex-1 pb-1">
              <h4 className={`text-xs font-bold transition-colors duration-500 ${isActive ? 'text-blue-400' : isDone ? 'text-slate-400' : 'text-slate-500'}`}>
                {step.title}
              </h4>
              {isActive && (
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed animate-in fade-in slide-in-from-top-1 duration-700">
                  {step.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// --- Main Panels ---

const App: React.FC = () => {
  const [mission, setMission] = useState<MissionState>(() => {
    const saved = MemoryService.loadMission();
    return saved || { ...initialState, id: Math.random().toString(36).substring(7) };
  });

  const [inputGoal, setInputGoal] = useState('');
  const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview');
  const [selectedArtifactIdx, setSelectedArtifactIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  
  const missionRef = useRef<MissionState>(mission);
  const isLoopRunning = useRef(false);
  const logScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    missionRef.current = mission;
    if (mission.status !== MissionStatus.IDLE) MemoryService.saveMission(mission);
    if (logScrollRef.current) logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
  }, [mission]);

  const addLog = useCallback((message: string, type: LogType = LogType.INFO) => {
    setMission(prev => ({
      ...prev,
      logs: [...prev.logs, { id: Math.random().toString(36).substring(7), timestamp: new Date(), message, type }]
    }));
  }, []);

  const addArtifact = useCallback((name: string, content: string, type: Artifact['type']) => {
    setMission(prev => ({
      ...prev,
      artifacts: [...prev.artifacts, { id: Math.random().toString(36).substring(7), name, content, type, timestamp: new Date() }]
    }));
  }, []);

  const resetMission = () => {
    MemoryService.clearMission();
    const newEmptyState = { ...initialState, id: Math.random().toString(36).substring(7) };
    missionRef.current = newEmptyState;
    isLoopRunning.current = false;
    setMission(newEmptyState);
    setSelectedArtifactIdx(0);
  };

  const handleCopy = () => {
    const content = mission.artifacts[selectedArtifactIdx]?.content;
    if (content) {
      navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExport = () => {
    const content = mission.artifacts.map((a, i) => `ARTIFACT ${i+1}: ${a.name}\n\n${a.content}\n\n------------------\n`).join('\n');
    const blob = new Blob([`MISSION GOAL: ${mission.goal}\n\n${content}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `autolearn-mission-${mission.id}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const executeLoop = async () => {
    if (isLoopRunning.current) return;
    isLoopRunning.current = true;

    if (missionRef.current.status === MissionStatus.PLANNING) {
      addLog(`Developing tactical plan...`, LogType.PLAN);
      try {
        const plan = await GeminiService.planMission(missionRef.current.goal);
        if (missionRef.current.status === MissionStatus.IDLE) { isLoopRunning.current = false; return; }
        const steps: Step[] = plan.steps.map(s => ({ id: Math.random().toString(36).substring(7), title: s.title, description: s.description, status: StepStatus.PENDING, attempts: 0 }));
        addLog(`Mission initialized. ${steps.length} objectives set.`, LogType.SUCCESS);
        setMission(prev => ({ ...prev, steps, status: MissionStatus.EXECUTING, currentStepIndex: 0 }));
      } catch (err: any) {
        addLog(`Deployment failure: ${err.message}`, LogType.ERROR);
        setMission(prev => ({ ...prev, status: MissionStatus.FAILED }));
        isLoopRunning.current = false;
        return;
      }
    }

    while (true) {
      const currentM = missionRef.current;
      if (currentM.status === MissionStatus.IDLE || currentM.status === MissionStatus.COMPLETED || currentM.status === MissionStatus.FAILED) break;
      if (currentM.currentStepIndex >= currentM.steps.length && currentM.steps.length > 0) {
        addLog("Mission successful. All goals met.", LogType.SUCCESS);
        setMission(prev => ({ ...prev, status: MissionStatus.COMPLETED }));
        break;
      }

      const idx = currentM.currentStepIndex;
      if (idx < 0) { await new Promise(r => setTimeout(r, 200)); continue; }
      const step = currentM.steps[idx];
      
      addLog(`Commencing S${idx + 1}: ${step.title}`, LogType.ACTION);
      setMission(prev => {
        const newSteps = [...prev.steps];
        newSteps[idx] = { ...newSteps[idx], status: StepStatus.ACTIVE };
        return { ...prev, steps: newSteps };
      });

      try {
        const result = await GeminiService.executeStep(step, currentM);
        if (missionRef.current.status === MissionStatus.IDLE) break;
        setMission(prev => ({ ...prev, lastExecutionOutput: result.output }));
        if (result.artifact) {
          addArtifact(result.artifact.name, result.artifact.content, result.artifact.type);
          addLog(`Result committed to registry: ${result.artifact.name}`, LogType.SUCCESS);
        }
        addLog(`Verifying operational integrity...`, LogType.SYSTEM);
        const verification = await GeminiService.verifyStep(step, result, currentM.goal);
        if (missionRef.current.status === MissionStatus.IDLE) break;

        if (verification.passed) {
          addLog(`Verification passed: ${verification.feedback}`, LogType.SUCCESS);
          setMission(prev => {
            const newSteps = [...prev.steps];
            newSteps[idx] = { ...newSteps[idx], status: StepStatus.COMPLETED };
            return { ...prev, steps: newSteps, currentStepIndex: idx + 1 };
          });
        } else {
          addLog(`Verification failed: ${verification.feedback}`, LogType.ERROR);
          if (step.attempts >= 2) { setMission(prev => ({ ...prev, status: MissionStatus.FAILED })); break; }
          addLog(`Retrying with corrective logic...`, LogType.SYSTEM);
          const fixedResult = await GeminiService.fixStep(step, result, verification.feedback);
          if (missionRef.current.status === MissionStatus.IDLE) break;
          setMission(prev => ({ ...prev, lastExecutionOutput: `[REPAIR LOG]\n${fixedResult.output}` }));
          if (fixedResult.artifact) addArtifact(`REVISED_${fixedResult.artifact.name}`, fixedResult.artifact.content, fixedResult.artifact.type);
          setMission(prev => {
            const newSteps = [...prev.steps];
            newSteps[idx] = { ...newSteps[idx], attempts: step.attempts + 1, status: StepStatus.FIXING };
            return { ...prev, steps: newSteps };
          });
        }
      } catch (err: any) {
        addLog(`Operational Error: ${err.message}`, LogType.ERROR);
        setMission(prev => ({ ...prev, status: MissionStatus.FAILED }));
        break;
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    isLoopRunning.current = false;
  };

  const startMission = (goalString?: string) => {
    const finalGoal = goalString || inputGoal;
    if (!finalGoal.trim()) return;
    setMission({ ...initialState, id: Math.random().toString(36).substring(7), goal: finalGoal, status: MissionStatus.PLANNING });
    setInputGoal('');
  };

  useEffect(() => {
    if (mission.status === MissionStatus.PLANNING || mission.status === MissionStatus.EXECUTING) executeLoop();
  }, [mission.status]);

  const activeArtifact = mission.artifacts[selectedArtifactIdx];

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30">
      
      {/* --- HEADER --- */}
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/40 backdrop-blur-xl z-50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-blue-500/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tighter uppercase text-white leading-none">AutoLearn</h1>
            <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">For Everyone</span>
          </div>
          <div className="h-6 w-px bg-slate-800 mx-2" />
          <StatusBadge status={mission.status} />
        </div>

        <div className="flex-1 max-w-2xl px-8">
          {mission.status !== MissionStatus.IDLE && (
             <div className="flex items-center gap-3 bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-xs font-medium text-slate-300 truncate max-w-lg">Goal: {mission.goal}</span>
                <button onClick={resetMission} className="ml-auto text-[10px] font-bold text-rose-400 hover:text-rose-300 uppercase tracking-tighter transition-colors">Abort</button>
             </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-slate-500 font-black tracking-widest uppercase">Global Registry</span>
            <span className="text-xs font-mono text-blue-400 font-bold">{mission.artifacts.length} Items</span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        
        {/* --- LEFT PANEL: NAVIGATION & STATUS --- */}
        <section className="w-72 border-r border-slate-800 bg-slate-900/20 p-5 flex flex-col overflow-y-auto shrink-0 scrollbar-hide">
          <h2 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em] mb-6 border-b border-slate-800 pb-2">Sab Ke Liyee Hub</h2>
          
          {mission.status === MissionStatus.IDLE ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Objective</label>
                <textarea 
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 outline-none h-28 resize-none transition-all placeholder:text-slate-700 shadow-inner"
                  placeholder="Examples: 'Explain AI to my grandmother', 'Build a simple web game', 'Healthy diet plan for everyone'..."
                  value={inputGoal}
                  onChange={e => setInputGoal(e.target.value)}
                />
                <button 
                  onClick={() => startMission()}
                  disabled={!inputGoal}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-20 py-3 rounded-xl text-xs font-black text-white uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20 active:scale-95 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                  Initiate Learning
                </button>
              </div>

              <div className="pt-4 border-t border-slate-800 space-y-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Public Templates (Shared)</span>
                {[
                  { label: "AI Fundamentals (Hinglish)", goal: "Explain AI and Machine Learning basics for everyone in easy Hindi/English mixed language." },
                  { label: "Eco-Friendly Living", goal: "Complete guide on how a common person can live sustainably today." },
                  { label: "Beginner Coding Roadmap", goal: "Build a roadmap for a absolute beginner to get their first job in tech." },
                  { label: "Mental Well-being Tips", goal: "Practical daily habits for mental health that anyone can follow." }
                ].map(demo => (
                  <button 
                    key={demo.label}
                    onClick={() => startMission(demo.goal)}
                    className="w-full text-left p-3 rounded-lg border border-slate-800 bg-slate-900/40 hover:bg-slate-800 hover:border-slate-700 transition-all border-l-2 border-l-slate-800 hover:border-l-indigo-500 group"
                  >
                    <div className="text-[10px] font-bold text-slate-300 group-hover:text-white transition-colors">{demo.label}</div>
                    <div className="text-[9px] text-slate-500 line-clamp-1 mt-1">{demo.goal}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in duration-500">
               <MissionTimeline mission={mission} />
            </div>
          )}
        </section>

        {/* --- CENTER PANEL: INTELLIGENCE FEED --- */}
        <section className="flex-1 flex flex-col border-r border-slate-800 bg-slate-950/50 overflow-hidden">
          <div className="h-10 border-b border-slate-800 bg-slate-900/30 flex items-center px-4 shrink-0 justify-between">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Intelligence Stream</h2>
            <div className="flex gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_#10b981]" />
               <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Active Processing</span>
            </div>
          </div>
          
          <div ref={logScrollRef} className="flex-1 overflow-y-auto p-6 space-y-8 scroll-smooth custom-scrollbar">
            {mission.logs.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-20 italic space-y-4">
                <div className="relative">
                   <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                   <svg className="w-12 h-12 relative text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <p className="text-sm font-medium tracking-tight text-center">Awaiting command to empower everyone...</p>
              </div>
            )}
            
            {mission.logs.map((log) => (
              <div key={log.id} className="animate-in slide-in-from-left-4 duration-500">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[9px] font-mono text-slate-600 uppercase font-bold tracking-tighter">[{log.timestamp.toLocaleTimeString()}]</span>
                  <div className={`h-[1px] flex-1 bg-slate-800/30`} />
                  <span className={`text-[9px] font-black uppercase tracking-widest border px-1.5 py-0.5 rounded ${
                    log.type === LogType.ERROR ? 'text-rose-500 border-rose-500/20 bg-rose-500/5' :
                    log.type === LogType.SUCCESS ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' :
                    log.type === LogType.PLAN ? 'text-blue-500 border-blue-500/20 bg-blue-500/5' :
                    'text-slate-500 border-slate-800 bg-slate-800/20'
                  }`}>{log.type}</span>
                </div>
                <div className={`p-4 rounded-xl border ${
                   log.type === LogType.ERROR ? 'bg-rose-950/20 border-rose-500/10 text-rose-200' :
                   log.type === LogType.PLAN ? 'bg-blue-950/20 border-blue-500/10 text-blue-100 font-medium' :
                   'bg-slate-900/20 border-slate-800 text-slate-300'
                }`}>
                  <p className="text-[13px] leading-relaxed">
                    {log.message}
                  </p>
                </div>
              </div>
            ))}

            {mission.lastExecutionOutput && (
              <div className="mt-8 p-5 bg-blue-600/5 border border-blue-500/10 rounded-2xl animate-in fade-in zoom-in duration-700 ring-1 ring-blue-500/5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_#60a5fa]" />
                  <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Autonomous Thinking Trace</span>
                </div>
                <div className="font-mono text-[11px] text-blue-300/70 whitespace-pre-wrap leading-relaxed">
                  {mission.lastExecutionOutput}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* --- RIGHT PANEL: RESULTS WORKSPACE --- */}
        <section className="w-[45%] flex flex-col bg-slate-900/10 overflow-hidden">
          <div className="h-10 border-b border-slate-800 bg-slate-900/30 flex items-center justify-between px-4 shrink-0">
            <h2 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Shared Registry Workspace</h2>
            <div className="flex gap-3">
              <button 
                onClick={handleExport}
                disabled={mission.artifacts.length === 0}
                className="text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-widest disabled:opacity-20 flex items-center gap-2 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                Export Report
              </button>
              <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-800 gap-1">
                <button 
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-tighter transition-all ${activeTab === 'preview' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  View
                </button>
                <button 
                  onClick={() => setActiveTab('source')}
                  className={`px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-tighter transition-all ${activeTab === 'source' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Raw
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {mission.artifacts.length > 0 ? (
              <>
                <div className="p-3 bg-slate-950 border-b border-slate-800 flex gap-2 overflow-x-auto scrollbar-hide shrink-0 items-center">
                  <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hide">
                    {mission.artifacts.map((art, idx) => (
                      <button
                        key={art.id}
                        onClick={() => setSelectedArtifactIdx(idx)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-mono border transition-all whitespace-nowrap flex items-center gap-2 ${
                          selectedArtifactIdx === idx ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-[0_0_10px_rgba(99,102,241,0.1)]' : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <span className="opacity-40">{idx + 1}.</span>
                        {art.name}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={handleCopy}
                    className={`p-2 rounded-lg border border-slate-800 bg-slate-900 hover:bg-slate-800 transition-all text-slate-400 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest ml-2 ${copied ? 'text-emerald-400 border-emerald-500/30' : ''}`}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>

                <div className="flex-1 overflow-hidden relative">
                  {activeTab === 'source' ? (
                    <div className="absolute inset-0 bg-slate-950 p-6 overflow-auto custom-scrollbar animate-in fade-in duration-300">
                      <pre className="font-mono text-[11px] leading-6 text-slate-400">
                        {activeArtifact?.content.split('\n').map((line, i) => (
                          <div key={i} className="flex gap-4 group">
                            <span className="w-8 text-slate-800 text-right select-none font-bold">{i+1}</span>
                            <span className="text-slate-300 group-hover:text-indigo-200 transition-colors duration-200">{line || ' '}</span>
                          </div>
                        ))}
                      </pre>
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-slate-900/30 p-8 overflow-auto custom-scrollbar animate-in fade-in duration-500">
                      {activeArtifact?.type === 'markdown' || activeArtifact?.type === 'plan' ? (
                        <div className="max-w-none text-slate-300 text-[14px] leading-relaxed space-y-6">
                          {activeArtifact.content.split('\n').map((line, i) => {
                            if (line.startsWith('# ')) return <h1 key={i} className="text-3xl font-black text-white border-b border-slate-800 pb-4 mb-8 tracking-tighter uppercase">{line.replace('# ', '')}</h1>;
                            if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-black text-indigo-400 mt-10 mb-4 border-l-4 border-l-indigo-600 pl-4">{line.replace('## ', '')}</h2>;
                            if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-bold text-slate-100 mt-8 mb-3">{line.replace('### ', '')}</h3>;
                            if (line.startsWith('- ')) return (
                              <div key={i} className="flex gap-4 items-start group">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2.5 shrink-0 shadow-[0_0_5px_#6366f1]" />
                                <span className="group-hover:text-slate-100 transition-colors">{line.replace('- ', '')}</span>
                              </div>
                            );
                            if (line.trim() === '') return <div key={i} className="h-2" />;
                            return <p key={i} className="text-slate-400 hover:text-slate-200 transition-colors duration-300">{line}</p>;
                          })}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col">
                           <div className="mb-4 flex items-center justify-between">
                              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Registry Artifact Data</span>
                              <span className="text-[10px] font-mono text-indigo-500 font-bold">{activeArtifact.content.length} bytes</span>
                           </div>
                           <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950/80 font-mono text-xs text-indigo-300 whitespace-pre-wrap leading-relaxed shadow-2xl">
                              {activeArtifact?.content}
                           </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center opacity-10 italic gap-6 text-center px-10">
                <div className="relative">
                   <div className="absolute inset-0 bg-slate-400/10 blur-3xl rounded-full" />
                   <svg className="w-20 h-20 relative text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
                </div>
                <p className="text-sm font-bold tracking-widest uppercase">Registry Empty. <br/>Start a mission to build knowledge for everyone.</p>
              </div>
            )}
          </div>
        </section>
      </main>
      
      {/* --- FOOTER PROGRESS --- */}
      <footer className="h-1 bg-slate-900 shrink-0 relative overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-indigo-400 transition-all duration-1000 shadow-[0_0_20px_rgba(99,102,241,0.6)] z-10" 
          style={{ width: `${(Math.max(0, mission.currentStepIndex) / (mission.steps.length || 1)) * 100}%` }} 
        />
        <div className="absolute inset-0 bg-slate-800/10 animate-pulse" />
      </footer>
    </div>
  );
};

export default App;
