import React, { useState, useEffect } from 'react';
import { X, Clock, MapPin, Video, Users, Calendar as CalendarIcon, Building, Trash2 } from 'lucide-react';
import { TeamMember, Project } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useDialog } from '../contexts/DialogContext';

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (eventData: EventData) => void;
    initialDate?: Date;
    teamMembers: TeamMember[];
    projects?: Project[];
    eventToEdit?: EventData;
    onDelete?: (event: EventData) => void;
}

export interface EventData {
    id?: string;
    title: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    isAllDay: boolean;
    participants: string[]; // IDs
    location: string;
    hasVideoMeeting: boolean;
    belongTo: string;
}

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSave, initialDate, teamMembers, projects = [], eventToEdit, onDelete }) => {
    const { t } = useLanguage();
    const { ask } = useDialog();
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('10:00');
    const [isAllDay, setIsAllDay] = useState(false);
    const [participants, setParticipants] = useState<string[]>([]);
    const [location, setLocation] = useState('');
    const [hasVideoMeeting, setHasVideoMeeting] = useState(false);
    const [belongTo, setBelongTo] = useState(projects[0]?.info.name || 'Company');

    useEffect(() => {
        if (isOpen) {
            if (eventToEdit) {
                setTitle(eventToEdit.title);
                setStartDate(eventToEdit.startDate);
                setStartTime(eventToEdit.startTime);
                setEndDate(eventToEdit.endDate);
                setEndTime(eventToEdit.endTime);
                setIsAllDay(eventToEdit.isAllDay);
                setParticipants(eventToEdit.participants);
                setLocation(eventToEdit.location);
                setHasVideoMeeting(eventToEdit.hasVideoMeeting);
                setBelongTo(eventToEdit.belongTo);
            } else {
                const d = initialDate || new Date();
                const dateStr = d.toISOString().split('T')[0];
                setStartDate(dateStr);
                setEndDate(dateStr);
                setTitle('');
                setParticipants([]);
                setLocation('');
                setHasVideoMeeting(false);
                setBelongTo(projects[0]?.info.name || 'Company');
            }
        }
    }, [isOpen, initialDate, projects, eventToEdit]);

    if (!isOpen) return null;

    const handleSave = () => {
        // Validate required fields
        if (!title.trim()) {
            alert('Please enter an event title');
            return;
        }
        if (!startDate || !endDate) {
            alert('Please select start and end dates');
            return;
        }

        onSave({
            title,
            startDate,
            startTime,
            endDate,
            endTime,
            isAllDay,
            participants,
            location,
            hasVideoMeeting,
            belongTo
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-800">New Event</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Title */}
                    <div>
                        <input
                            type="text"
                            placeholder="Add Title"
                            className="w-full text-2xl font-medium placeholder-gray-300 border-none focus:ring-0 p-0 text-gray-800"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            autoFocus
                        />
                        <div className="h-0.5 w-10 bg-blue-500 mt-2"></div>
                    </div>

                    {/* Time */}
                    <div className="flex items-start gap-4">
                        <Clock className="text-gray-400 mt-1" size={20} />
                        <div className="flex-1 space-y-3">
                            {/* Start Date/Time */}
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-500 w-12">Start:</span>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                {!isAllDay && (
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                )}
                            </div>

                            {/* End Date/Time */}
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-500 w-12">End:</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                                {!isAllDay && (
                                    <input
                                        type="time"
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                )}
                            </div>

                            {/* All Day Toggle */}
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isAllDay}
                                    onChange={(e) => setIsAllDay(e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-600">All day event</span>
                            </label>
                        </div>
                    </div>

                    {/* Participants */}
                    <div className="flex items-center gap-4">
                        <Users className="text-gray-400" size={20} />
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                {participants.length > 0 ? (
                                    <div className="flex -space-x-2">
                                        {participants.map(pid => {
                                            const member = teamMembers.find(m => m.id === pid);
                                            return (
                                                <div
                                                    key={pid}
                                                    className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs text-white font-bold ${member?.color || 'bg-gray-400'} cursor-pointer hover:scale-110 transition-transform`}
                                                    title={member?.name}
                                                    onClick={() => setParticipants(participants.filter(p => p !== pid))}
                                                >
                                                    {member?.name.substring(0, 2).toUpperCase()}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <span className="text-gray-400 text-sm">No participants selected</span>
                                )}
                            </div>
                            <select
                                value=""
                                onChange={(e) => {
                                    if (e.target.value && !participants.includes(e.target.value)) {
                                        setParticipants([...participants, e.target.value]);
                                    }
                                }}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">+ Add participant</option>
                                {teamMembers.filter(m => !participants.includes(m.id)).map(member => (
                                    <option key={member.id} value={member.id}>
                                        {member.name} - {member.role}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-4">
                        <MapPin className="text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Add location (optional)"
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-700 placeholder-gray-400"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                        />
                    </div>

                    {/* Video Meeting */}
                    <div className="flex items-center gap-4">
                        <Video className="text-gray-400" size={20} />
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                            <input
                                type="checkbox"
                                checked={hasVideoMeeting}
                                onChange={(e) => setHasVideoMeeting(e.target.checked)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                            />
                            <span className={`text-sm ${hasVideoMeeting ? 'text-blue-600 font-medium' : 'text-gray-600'}`}>
                                {hasVideoMeeting ? 'Video meeting enabled' : 'Add video meeting'}
                            </span>
                        </label>
                    </div>

                    {/* Belong to */}
                    <div className="flex items-center gap-4">
                        <Building className="text-gray-400" size={20} />
                        <div className="flex-1 flex items-center gap-2">
                            <span className="text-gray-600 text-sm">Project:</span>
                            <select
                                value={belongTo}
                                onChange={(e) => setBelongTo(e.target.value)}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 font-medium cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                {projects.length > 0 ? (
                                    projects.map(p => (
                                        <option key={p.id} value={p.info.name}>
                                            {p.info.name} ({p.info.code})
                                        </option>
                                    ))
                                ) : (
                                    <option value="Company">My Company</option>
                                )}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 flex justify-between gap-3">
                    {eventToEdit && onDelete ? (
                        <button
                            onClick={() => {
                                ask({
                                    title: 'Delete Event',
                                    message: 'Are you sure you want to delete this event? This action cannot be undone.',
                                    type: 'danger',
                                    confirmText: 'Delete',
                                    onConfirm: () => {
                                        onDelete(eventToEdit);
                                        onClose();
                                    }
                                });
                            }}
                            className="px-4 py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                        >
                            <Trash2 size={18} />
                            <span>Delete</span>
                        </button>
                    ) : <div></div>}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!title.trim() || !startDate || !endDate}
                            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none transition-all"
                        >
                            {eventToEdit ? 'Update Event' : 'Create Event'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
