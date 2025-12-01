
import React, { useState, useRef, useEffect } from 'react';
import { Meeting, TeamMember, MeetingType, ProjectTask, TaskStatus, Project, ProjectPhase } from '../types';
import { Calendar, Clock, Users, CheckSquare, Plus, ChevronLeft, Play, Pause, RefreshCw, Sparkles, ArrowRight, Circle, Mic, Square, StopCircle, Bold, Italic, List, Heading1, Heading2, Eye, Edit2, Upload, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { transcribeMeetingAudio, generateMeetingSummary } from '../services/geminiService';

interface MeetingEditorProps {
  meeting?: Meeting | null;
  teamMembers: TeamMember[];
  linkedTasks: ProjectTask[]; // Tasks already linked to this meeting
  onSave: (meeting: Meeting) => void;
  onClose: () => void;
  onCreateTask: (taskName: string) => ProjectTask | null; // Callback to create a task in the main project
  onOpenTask: (taskId: string) => void;
}

// --- Phase Picker Modal (Local Component) ---
const PhasePickerModal = ({ 
    isOpen, 
    onClose, 
    phases, 
    onSelectPhase 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    phases: ProjectPhase[], 
    onSelectPhase: (phaseId: string | null, newName?: string) => void 
}) => {
    const { t } = useLanguage();
    const [newPhaseName, setNewPhaseName] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-96 overflow-hidden">
                <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                    <h3 className="font-bold text-gray-800">{t('mtg.select_phase_title')}</h3>
                    <button onClick={onClose}><X size={18} className="text-gray-400 hover:text-gray-600"/></button>
                </div>
                <div className="p-4 space-y-3">
                    <p className="text-xs text-gray-500">{t('mtg.select_phase_desc')}</p>
                    
                    <div className="max-h-40 overflow-y-auto space-y-1 border border-gray-100 rounded-lg p-1">
                        {phases.map(p => (
                            <button 
                                key={p.id} 
                                onClick={() => onSelectPhase(p.id)}
                                className="w-full text-left px-3 py-2 text-sm rounded hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                            >
                                {p.name}
                            </button>
                        ))}
                        {phases.length === 0 && <div className="text-gray-400 text-xs italic p-2">{t('mtg.no_phases')}</div>}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                        <input 
                            className="flex-1 text-sm border rounded px-2 py-1.5 outline-none focus:border-indigo-500"
                            placeholder={t('mtg.new_phase_name')}
                            value={newPhaseName}
                            onChange={(e) => setNewPhaseName(e.target.value)}
                        />
                        <button 
                            disabled={!newPhaseName.trim()}
                            onClick={() => onSelectPhase(null, newPhaseName)}
                            className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50"
                        >
                            {t('common.create')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const TEMPLATES: Record<string, string> = {
    Standup: `## Yesterday\n- \n\n## Today\n- \n\n## Blockers\n- `,
    Review: `## Objectives\n- \n\n## Feedback\n- \n\n## Decisions\n- `,
    Retrospective: `## Keep\n- \n\n## Drop\n- \n\n## Start\n- `
};

export const MeetingEditor: React.FC<MeetingEditorProps> = ({ 
    meeting: initialMeeting, 
    teamMembers, 
    linkedTasks,
    onSave, 
    onClose,
    onCreateTask,
    onOpenTask
}) => {
  const { t, language } = useLanguage();
  const { addToast } = useToast();
  
  // Form State
  const [title, setTitle] = useState(initialMeeting?.title || '');
  const [date, setDate] = useState(initialMeeting?.date ? initialMeeting.date.substring(0, 16) : new Date().toISOString().substring(0, 16));
  const [type, setType] = useState<MeetingType>(initialMeeting?.type || 'General');
  const [attendees, setAttendees] = useState<string[]>(initialMeeting?.attendees || []);
  const [content, setContent] = useState(initialMeeting?.content || '');
  const [status, setStatus] = useState<'Planned'|'In Progress'|'Completed'>(initialMeeting?.status || 'Planned');
  
  // Linking State
  const [relatedTaskIds, setRelatedTaskIds] = useState<string[]>(initialMeeting?.relatedTaskIds || []);
  const [createdTasks, setCreatedTasks] = useState<ProjectTask[]>([]);
  
  // UI State
  const [showAttendeePicker, setShowAttendeePicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selection, setSelection] = useState<string>('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Task Creation Phase Picker State
  const [pendingTaskName, setPendingTaskName] = useState<string | null>(null);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recordingMimeType, setRecordingMimeType] = useState('audio/webm');
  
  // File Upload State
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer State (for Meeting Duration)
  const [timerActive, setTimerActive] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  
  // Recording Timer
  const [recSeconds, setRecSeconds] = useState(0);

  useEffect(() => {
      let interval: any;
      if (timerActive) {
          interval = setInterval(() => setTimerSeconds(s => s + 1), 1000);
      }
      return () => clearInterval(interval);
  }, [timerActive]);

  useEffect(() => {
      let interval: any;
      if (isRecording) {
          interval = setInterval(() => setRecSeconds(s => s + 1), 1000);
      } else {
          setRecSeconds(0);
      }
      return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (secs: number) => {
      const m = Math.floor(secs / 60).toString().padStart(2, '0');
      const s = (secs % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
  };

  // --- Audio Recording Logic ---
  const startRecording = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          addToast(t('mtg.rec_not_supported'), 'warning');
          return;
      }

      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          // Check supported mime types
          let mimeType = 'audio/webm';
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
              mimeType = 'audio/webm;codecs=opus';
          } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
              mimeType = 'audio/mp4';
          }
          setRecordingMimeType(mimeType);

          const mediaRecorder = new MediaRecorder(stream, { mimeType });
          
          mediaRecorderRef.current = mediaRecorder;
          audioChunksRef.current = [];

          mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                  audioChunksRef.current.push(event.data);
              }
          };

          mediaRecorder.onstop = () => handleTranscription(mimeType);

          mediaRecorder.start();
          setIsRecording(true);
          addToast(t('mtg.rec_started'), 'info');
      } catch (err: any) {
          console.error("Audio Error:", err);
          if (err.name === 'NotFoundError' || err.message?.includes('device not found')) {
              addToast(t('mtg.mic_not_found'), 'warning');
          } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
              addToast(t('mtg.mic_denied'), 'error');
          } else {
              addToast(`${t('mtg.rec_error')}: ` + (err.message || "Unknown error"), 'error');
          }
          setIsRecording(false);
      }
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          // Stop all tracks to release the mic
          mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
          setIsRecording(false);
      }
  };

  // --- Audio File Upload Logic ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Limit file size (e.g., 20MB) to prevent browser issues with large Base64 strings
      if (file.size > 20 * 1024 * 1024) {
          addToast(t('mtg.file_too_large'), 'error');
          return;
      }

      setIsProcessingAudio(true);
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onloadend = async () => {
          try {
              const base64String = (reader.result as string).split(',')[1];
              
              // Retrieve saved config
              const savedConfig = localStorage.getItem('project_ai_config');
              const config = savedConfig ? JSON.parse(savedConfig) : undefined;

              const transcript = await transcribeMeetingAudio(base64String, file.type, config);
              
              const newContent = content ? `${content}\n\n---\n\n**[Audio Upload Transcript]**\n${transcript}` : `**[Audio Upload Transcript]**\n${transcript}`;
              setContent(newContent);
              addToast(t('mtg.transcribe_success'), 'success');
          } catch (error: any) {
              console.error("Upload Transcription error:", error);
              addToast(`${t('mtg.transcribe_fail')}: ` + (error.message || "Unknown error"), 'error');
          } finally {
              setIsProcessingAudio(false);
              if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
          }
      };
  };

  const handleTranscription = async (mimeType: string) => {
      setIsProcessingAudio(true);
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      
      // Convert Blob to Base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
          try {
              const base64String = (reader.result as string).split(',')[1];
              
              // Retrieve saved config
              const savedConfig = localStorage.getItem('project_ai_config');
              const config = savedConfig ? JSON.parse(savedConfig) : undefined;

              const transcript = await transcribeMeetingAudio(base64String, mimeType, config);
              
              // Append to content
              const newContent = content ? `${content}\n\n---\n\n**[Recording Transcript]**\n${transcript}` : `**[Recording Transcript]**\n${transcript}`;
              setContent(newContent);
              addToast(t('mtg.minutes_success'), 'success');
          } catch (error: any) {
              console.error("Transcription error:", error);
              addToast(`${t('mtg.transcribe_fail')}: ` + (error.message || "Check API Key/Network"), 'error');
          } finally {
              setIsProcessingAudio(false);
          }
      };
  };


  // --- AI Summary ---
  const handleGenerateSummary = async () => {
      if (!content.trim()) return;
      setIsGeneratingSummary(true);
      try {
          const savedConfig = localStorage.getItem('project_ai_config');
          const config = savedConfig ? JSON.parse(savedConfig) : undefined;
          
          const { summary, actionItems } = await generateMeetingSummary(content, config, language);
          
          const summaryBlock = `\n\n### ${t('mtg.ai_summary')}\n${summary}\n`;
          setContent(content + summaryBlock);

          if (actionItems && actionItems.length > 0) {
              // We can either automatically create tasks or just append them to text
              // For now, let's append them as a Todo list in the text
              const actionList = `\n### Suggested Action Items\n${actionItems.map(item => `- [ ] ${item}`).join('\n')}`;
              setContent(prev => prev + actionList);
              addToast(t('mtg.summary_success'), 'success');
          }

      } catch (e) {
          addToast(t('mtg.summary_fail'), 'error');
      } finally {
          setIsGeneratingSummary(false);
      }
  };


  // --- Saving ---
  const handleSave = () => {
      const newMeeting: Meeting = {
          id: initialMeeting?.id || `mtg-${Date.now()}`,
          title: title || t('wiki.untitled'),
          date,
          type,
          attendees,
          content,
          status,
          relatedTaskIds: relatedTaskIds
      };
      onSave(newMeeting);
  };

  const toggleAttendee = (id: string) => {
      setAttendees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // --- Markdown Toolbar Logic ---
  const insertMarkdown = (syntax: string, placeholder: string = '') => {
      if (!textareaRef.current) return;
      
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const text = textareaRef.current.value;
      
      const before = text.substring(0, start);
      const selected = text.substring(start, end) || placeholder;
      const after = text.substring(end);
      
      let newText = '';
      let newCursor = 0;

      if (syntax === 'h1') {
          newText = `${before}\n# ${selected}\n${after}`;
          newCursor = start + 3 + selected.length;
      } else if (syntax === 'h2') {
          newText = `${before}\n## ${selected}\n${after}`;
          newCursor = start + 4 + selected.length;
      } else if (syntax === 'bold') {
          newText = `${before}**${selected}**${after}`;
          newCursor = start + 2 + selected.length;
      } else if (syntax === 'italic') {
          newText = `${before}*${selected}*${after}`;
          newCursor = start + 1 + selected.length;
      } else if (syntax === 'list') {
          newText = `${before}\n- ${selected}${after}`;
          newCursor = start + 3 + selected.length;
      } else if (syntax === 'todo') {
          newText = `${before}\n- [ ] ${selected}${after}`;
          newCursor = start + 7 + selected.length;
      }

      setContent(newText);
      setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(newCursor, newCursor);
          }
      }, 0);
  };

  // Simple Markdown Renderer (Regex based for preview)
  const renderMarkdown = (md: string) => {
      let html = md
        .replace(/^### (.*$)/gim, '<h3 class="text-lg font-bold mt-4 mb-2 text-gray-800">$1</h3>')
        .replace(/^## (.*$)/gim, '<h2 class="text-xl font-bold mt-6 mb-3 text-gray-900 border-b pb-1">$1</h2>')
        .replace(/^# (.*$)/gim, '<h1 class="text-2xl font-bold mt-6 mb-4 text-indigo-900">$1</h1>')
        .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
        .replace(/\*(.*)\*/gim, '<i>$1</i>')
        .replace(/^- \[ \] (.*$)/gim, '<div class="flex items-center gap-2 my-1"><div class="w-4 h-4 border rounded"></div><span>$1</span></div>')
        .replace(/^- \[x\] (.*$)/gim, '<div class="flex items-center gap-2 my-1"><div class="w-4 h-4 border rounded bg-indigo-500 flex items-center justify-center text-white text-[10px]">✓</div><span class="line-through text-gray-400">$1</span></div>')
        .replace(/^- (.*$)/gim, '<li class="ml-4 list-disc text-gray-700 my-1">$1</li>')
        .replace(/\n/gim, '<br />');
      return { __html: html };
  };

  const handleApplyTemplate = (tplName: string) => {
      if (content.trim() && !confirm(t('mtg.overwrite_confirm'))) return;
      setContent(TEMPLATES[tplName] || '');
  };

  const handleTextSelect = () => {
      if (textareaRef.current) {
          const start = textareaRef.current.selectionStart;
          const end = textareaRef.current.selectionEnd;
          if (start !== end) {
              setSelection(content.substring(start, end));
          } else {
              setSelection('');
          }
      }
  };

  // Task Creation with Phase Selection
  const initiateTaskCreation = () => {
      if (!selection.trim()) {
          addToast(t('mtg.select_text_warn'), 'warning');
          return;
      }
      // Create task immediately without phase selection for now to simplify integration without breaking App.tsx props drilling
      const newTask = onCreateTask(selection.trim()); 
      if (newTask) {
          setSelection('');
          setCreatedTasks(prev => [newTask, ...prev]);
          setRelatedTaskIds(prev => [...prev, newTask.id]);
          addToast(t('mtg.task_created'), 'success');
      }
  };

  const getStatusColor = (s: TaskStatus) => {
      switch(s) {
          case TaskStatus.Completed: return 'text-emerald-600 bg-emerald-50 border-emerald-100';
          case TaskStatus.InProgress: return 'text-blue-600 bg-blue-50 border-blue-100';
          case TaskStatus.Delayed: return 'text-rose-600 bg-rose-50 border-rose-100';
          default: return 'text-gray-500 bg-gray-50 border-gray-100';
      }
  };

  return (
    <div className="h-full flex flex-col bg-white animate-in fade-in slide-in-from-right-4 duration-300">
        
        {/* Header Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/50">
            <div className="flex items-center gap-4">
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800 transition-colors">
                    <ChevronLeft size={24} />
                </button>
                <div className="h-8 w-px bg-gray-300 mx-2"></div>
                
                {/* Timer Controls */}
                <div className="flex items-center gap-2 text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm">
                    {timerActive ? <Play size={14} className="text-emerald-500 fill-emerald-500" /> : <Clock size={14} />}
                    <span className="font-mono font-bold text-sm min-w-[48px] text-center">{formatTime(timerSeconds)}</span>
                    <div className="w-px h-3 bg-gray-300 mx-1"></div>
                    <button onClick={() => setTimerActive(!timerActive)} className="p-1 hover:bg-gray-100 rounded transition-colors">
                        {timerActive ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                    <button onClick={() => {setTimerActive(false); setTimerSeconds(0)}} className="p-1 hover:bg-gray-100 rounded text-gray-400 transition-colors">
                        <RefreshCw size={12} />
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-3">
                 <div className="flex bg-gray-200 rounded-lg p-1">
                     {['Planned', 'In Progress', 'Completed'].map(s => (
                         <button 
                            key={s}
                            onClick={() => setStatus(s as any)}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${status === s ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                         >
                             {t(`mtg.status_${s.toLowerCase().replace(' ', '_')}`)}
                         </button>
                     ))}
                 </div>
                 <button onClick={handleSave} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-sm">
                     {t('common.save')}
                 </button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            {/* Main Editor Area */}
            <div className="flex-1 flex flex-col p-8 overflow-y-auto custom-scrollbar">
                {/* Meta Data Inputs */}
                <div className="mb-8 space-y-6">
                    <input 
                        className="text-4xl font-bold text-gray-800 placeholder-gray-300 outline-none w-full bg-transparent"
                        placeholder={t('mtg.title_placeholder')}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    
                    <div className="flex flex-wrap gap-6">
                        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-100 transition-all">
                            <Calendar size={16} className="text-gray-400" />
                            <input 
                                type="datetime-local"
                                className="text-sm font-medium text-gray-600 outline-none bg-transparent"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                            />
                        </div>

                        <div className="relative">
                             <div 
                                className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm cursor-pointer hover:bg-gray-50"
                                onClick={() => setShowAttendeePicker(!showAttendeePicker)}
                             >
                                 <Users size={16} className="text-gray-400" />
                                 <span className="text-sm font-medium text-gray-600">
                                     {attendees.length === 0 ? t('mtg.attendees') : `${attendees.length} ${t('mtg.attendees')}`}
                                 </span>
                             </div>
                             
                             {/* Attendee Dropdown */}
                             {showAttendeePicker && (
                                 <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 p-2">
                                     {teamMembers.map(tm => (
                                         <div 
                                            key={tm.id} 
                                            onClick={() => toggleAttendee(tm.id)}
                                            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded cursor-pointer"
                                         >
                                             <div className="flex items-center gap-2">
                                                 <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] ${tm.color}`}>
                                                     {tm.avatar}
                                                 </div>
                                                 <span className="text-sm text-gray-700">{tm.name}</span>
                                             </div>
                                             {attendees.includes(tm.id) && <CheckSquare size={14} className="text-indigo-600" />}
                                         </div>
                                     ))}
                                 </div>
                             )}
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">{t('mtg.type')}:</span>
                            <select 
                                className="bg-gray-100 border-transparent text-sm font-bold text-gray-700 rounded-lg px-3 py-2 outline-none cursor-pointer hover:bg-gray-200 transition-colors"
                                value={type}
                                onChange={(e) => setType(e.target.value as MeetingType)}
                            >
                                {['General', 'Standup', 'Review', 'Retrospective', 'Planning'].map(t => (
                                    <option key={t} value={t}>{t}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* AI & Recording Toolbar */}
                <div className="mb-6 flex flex-wrap items-center gap-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    
                    {/* Hidden File Input */}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="audio/*" 
                        onChange={handleFileUpload} 
                    />

                    {/* Recording Controls */}
                    <div className="flex items-center gap-2">
                        {!isRecording ? (
                            <>
                            <button 
                                onClick={startRecording}
                                disabled={isProcessingAudio}
                                className="flex items-center gap-2 bg-rose-500 text-white px-4 py-2 rounded-full text-xs font-bold hover:bg-rose-600 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {isProcessingAudio ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" /> Transcribing...
                                    </>
                                ) : (
                                    <>
                                        <Mic size={14} /> Record
                                    </>
                                )}
                            </button>
                            
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessingAudio}
                                className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-full text-xs font-bold hover:bg-indigo-50 shadow-sm disabled:opacity-50 transition-all"
                            >
                                <Upload size={14} /> Upload
                            </button>
                            </>
                        ) : (
                            <button 
                                onClick={stopRecording}
                                className="flex items-center gap-2 bg-rose-100 text-rose-600 border border-rose-200 px-4 py-2 rounded-full text-xs font-bold hover:bg-rose-200 shadow-sm transition-all animate-pulse"
                            >
                                <StopCircle size={14} /> Stop ({formatTime(recSeconds)})
                            </button>
                        )}
                        <div className="h-6 w-px bg-indigo-200 mx-2 hidden sm:block"></div>

                        <button
                            onClick={handleGenerateSummary}
                            disabled={isGeneratingSummary || !content.trim()}
                            className="flex items-center gap-2 bg-white text-indigo-600 border border-indigo-200 px-4 py-2 rounded-full text-xs font-bold hover:bg-indigo-50 shadow-sm disabled:opacity-50"
                        >
                            {isGeneratingSummary ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                            {isGeneratingSummary ? t('mtg.generating_summary') : t('mtg.ai_summary')}
                        </button>
                    </div>

                    <div className="h-6 w-px bg-indigo-200 mx-2 hidden sm:block"></div>

                    {/* Template Quick Actions */}
                    <div className="flex items-center gap-2 overflow-x-auto">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase">{t('mtg.templates')}:</span>
                        {Object.keys(TEMPLATES).map(tpl => (
                            <button 
                                key={tpl}
                                onClick={() => handleApplyTemplate(tpl)}
                                className="px-3 py-1 bg-white text-indigo-600 text-[10px] font-medium rounded-full border border-indigo-100 hover:bg-indigo-50 transition-colors whitespace-nowrap"
                            >
                                {t(`mtg.tpl_${tpl.toLowerCase()}`) || tpl}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Editor Toolbar (Rich Text / Markdown) */}
                <div className="mb-2 flex items-center justify-between bg-gray-50 p-1.5 rounded-t-lg border border-b-0 border-gray-200">
                    <div className="flex items-center gap-1">
                         <button onClick={() => insertMarkdown('bold')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Bold"><Bold size={14} /></button>
                         <button onClick={() => insertMarkdown('italic')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Italic"><Italic size={14} /></button>
                         <div className="w-px h-4 bg-gray-300 mx-1"></div>
                         <button onClick={() => insertMarkdown('h1', 'Title')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Heading 1"><Heading1 size={14} /></button>
                         <button onClick={() => insertMarkdown('h2', 'Subtitle')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Heading 2"><Heading2 size={14} /></button>
                         <div className="w-px h-4 bg-gray-300 mx-1"></div>
                         <button onClick={() => insertMarkdown('list', 'Item')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="List"><List size={14} /></button>
                         <button onClick={() => insertMarkdown('todo', 'Task')} className="p-1.5 hover:bg-gray-200 rounded text-gray-600" title="Todo"><Square size={14} /></button>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsPreviewMode(!isPreviewMode)} 
                            className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${isPreviewMode ? 'bg-indigo-100 text-indigo-700 font-bold' : 'text-gray-500 hover:bg-gray-200'}`}
                        >
                            {isPreviewMode ? <><Edit2 size={12} /> {t('common.edit')}</> : <><Eye size={12} /> Preview</>}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 relative group min-h-[400px]">
                    {isPreviewMode ? (
                        <div 
                            className="w-full h-full overflow-y-auto p-6 rounded-b-lg border border-gray-200 prose prose-sm max-w-none bg-gray-50"
                            dangerouslySetInnerHTML={renderMarkdown(content)}
                        />
                    ) : (
                        <textarea 
                            ref={textareaRef}
                            className="w-full h-full resize-none outline-none text-gray-700 leading-relaxed text-base p-4 rounded-b-xl border border-gray-200 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-50 transition-all font-mono text-sm"
                            placeholder="# Meeting Notes... (Markdown supported)"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onSelect={handleTextSelect}
                        />
                    )}
                    
                    {/* Floating Action Button for Selection */}
                    {!isPreviewMode && selection && (
                        <div className="absolute bottom-8 right-8 animate-in zoom-in duration-200 z-10">
                            <button 
                                onClick={initiateTaskCreation}
                                className="bg-indigo-600 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 hover:bg-indigo-700 hover:scale-105 transition-all font-bold text-sm"
                            >
                                <Plus size={16} /> {t('mtg.convert_task')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Sidebar: Action Items */}
            <div className="w-80 bg-gray-50 border-l border-gray-200 flex flex-col">
                <div className="p-4 border-b border-gray-200 bg-white">
                    <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                        <CheckSquare size={16} className="text-indigo-600" />
                        {t('mtg.action_items')}
                    </h3>
                    <p className="text-[10px] text-gray-400 mt-1">{t('mtg.convert_tip')}</p>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {linkedTasks.concat(createdTasks).length === 0 && (
                        <div className="text-center py-10 text-gray-400 text-xs italic">
                            No action items linked yet.
                        </div>
                    )}
                    
                    {linkedTasks.concat(createdTasks).map(task => (
                        <div 
                            key={task.id} 
                            onDoubleClick={() => onOpenTask(task.id)}
                            className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow group relative cursor-pointer"
                            title="Double click to edit task"
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${getStatusColor(task.status)}`}>
                                    {t(`status.${task.status}`)}
                                </span>
                                <ArrowRight size={12} className="text-gray-300 group-hover:text-indigo-400" />
                            </div>
                            <div className="text-sm font-medium text-gray-800 line-clamp-2 mb-2">
                                {task.subTaskName}
                            </div>
                            <div className="flex items-center justify-between mt-2 border-t border-gray-50 pt-2">
                                <div className="flex items-center gap-1 text-[10px] text-gray-500">
                                    <Users size={10} /> {task.owner}
                                </div>
                                {task.status === TaskStatus.Completed ? (
                                    <CheckSquare size={14} className="text-emerald-500" />
                                ) : (
                                    <Circle size={14} className="text-gray-300" />
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};
