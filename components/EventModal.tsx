import React, { useState, useEffect } from 'react';
import { X, Clock, MapPin, Video, Users, ChevronDown, Calendar as CalendarIcon, Building } from 'lucide-react';
import { TeamMember } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (eventData: EventData) => void;
    initialDate?: Date;
    teamMembers: TeamMember[];
}

export interface EventData {
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

export const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSave, initialDate, teamMembers }) => {
    const { t } = useLanguage();
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [startTime, setStartTime] = useState('09:00');
    const [endDate, setEndDate] = useState('');
    const [endTime, setEndTime] = useState('10:00');
    const [isAllDay, setIsAllDay] = useState(false);
    const [participants, setParticipants] = useState<string[]>([]);
    const [location, setLocation] = useState('');
    const [hasVideoMeeting, setHasVideoMeeting] = useState(false);
    const [belongTo, setBelongTo] = useState('Company');

    useEffect(() => {
        if (isOpen) {
            const d = initialDate || new Date();
            const dateStr = d.toISOString().split('T')[0];
            setStartDate(dateStr);
            setEndDate(dateStr);
            setTitle('');
            setParticipants([]);
            setLocation('');
            setHasVideoMeeting(false);
        }
    }, [isOpen, initialDate]);

    if (!isOpen) return null;

    const handleSave = () => {
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
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="border-none p-0 text-gray-600 focus:ring-0 font-medium"
                                    />
                                    {!isAllDay && (
                                        <input
                                            type="time"
                                            value={startTime}
                                            onChange={(e) => setStartTime(e.target.value)}
                                            className="border-none p-0 text-gray-600 focus:ring-0 font-medium w-16"
                                        />
                                    )}
                                </div>
                                <span className="text-gray-400">-</span>
                                <div className="flex items-center gap-2">
                                    {!isAllDay && (
                                        <input
                                            type="time"
                                            value={endTime}
                                            onChange={(e) => setEndTime(e.target.value)}
                                            className="border-none p-0 text-gray-600 focus:ring-0 font-medium w-16"
                                        />
                                    )}
                                </div>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isAllDay}
                                    onChange={(e) => setIsAllDay(e.target.checked)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-600">All day</span>
                            </label>
                        </div>
                    </div>

                    {/* Participants */}
                    <div className="flex items-center gap-4">
                        <Users className="text-gray-400" size={20} />
                        <div className="flex-1 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {participants.length > 0 ? (
                                    <div className="flex -space-x-2">
                                        {participants.map(pid => {
                                            const member = teamMembers.find(m => m.id === pid);
                                            return (
                                                <div key={pid} className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs text-white font-bold ${member?.color || 'bg-gray-400'}`} title={member?.name}>
                                                    {member?.name.substring(0, 2).toUpperCase()}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <span className="text-gray-400">Add required participants...</span>
                                )}
                            </div>
                            <button className="px-3 py-1.5 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50">
                                Batch adding
                            </button>
                        </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-center gap-4">
                        <MapPin className="text-gray-400" size={20} />
                        <div className="flex-1 flex items-center justify-between">
                            <input
                                type="text"
                                placeholder="Add Location or map"
                                className="flex-1 border-none p-0 focus:ring-0 text-gray-600 placeholder-gray-400"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                            />
                            <button className="px-3 py-1.5 border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-gray-50">
                                Select Rooms
                            </button>
                        </div>
                    </div>

                    {/* Video Meeting */}
                    <div className="flex items-center gap-4">
                        <Video className="text-gray-400" size={20} />
                        <div className="flex-1">
                            <button
                                onClick={() => setHasVideoMeeting(!hasVideoMeeting)}
                                className="flex items-center gap-2 text-gray-600 hover:text-blue-600"
                            >
                                <span>Add video meeting</span>
                                <ChevronDown size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Belong to */}
                    <div className="flex items-center gap-4">
                        <Building className="text-gray-400" size={20} />
                        <div className="flex-1 flex items-center gap-2">
                            <span className="text-gray-600">Belong to</span>
                            <div className="flex items-center gap-1 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                                <span className="text-gray-800 font-medium">My Company</span>
                                <ChevronDown size={16} className="text-gray-400" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
                    >
                        More
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-full hover:bg-blue-700 shadow-lg shadow-blue-200"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};
