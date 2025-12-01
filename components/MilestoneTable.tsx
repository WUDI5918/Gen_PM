import React from 'react';
import { Milestone } from '../types';
import { CheckCircle2 } from 'lucide-react';

interface MilestoneTableProps {
  milestones: Milestone[];
  isEditing: boolean;
  onUpdateMilestones: (ms: Milestone[]) => void;
}

export const MilestoneTable: React.FC<MilestoneTableProps> = ({ milestones, isEditing, onUpdateMilestones }) => {
  
  const handleChange = (id: string, field: keyof Milestone, value: any) => {
    const updated = milestones.map(m => m.id === id ? { ...m, [field]: value } : m);
    onUpdateMilestones(updated);
  };

  return (
    <div className="mt-8 border border-gray-300 shadow-sm bg-white rounded-lg overflow-hidden">
      <div className="bg-gray-100 p-3 font-bold text-center border-b border-gray-300 text-sm flex justify-between items-center">
        <span>Milestone Summary</span>
        {isEditing && <span className="text-xs font-normal text-indigo-600">(Editable)</span>}
      </div>
      <table className="w-full text-xs text-center">
        <thead>
          <tr className="bg-gray-50">
            <th className="border border-gray-300 p-2 w-12">#</th>
            <th className="border border-gray-300 p-2">Project Phase</th>
            <th className="border border-gray-300 p-2">Milestone Event</th>
            <th className="border border-gray-300 p-2">Completion Date</th>
            <th className="border border-gray-300 p-2">Variance</th>
            <th className="border border-gray-300 p-2">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {milestones.map((m, idx) => (
            <tr key={m.id} className="hover:bg-gray-50">
              <td className="border border-gray-300 p-2">{idx + 1}</td>
              <td className="border border-gray-300 p-2">
                 {isEditing ? (
                     <input className="w-full text-center border rounded p-1" value={m.phaseName} onChange={(e) => handleChange(m.id, 'phaseName', e.target.value)} />
                 ) : m.phaseName}
              </td>
              <td className="border border-gray-300 p-2 font-medium">
                 {isEditing ? (
                     <input className="w-full text-center border rounded p-1" value={m.milestoneName} onChange={(e) => handleChange(m.id, 'milestoneName', e.target.value)} />
                 ) : m.milestoneName}
              </td>
              <td className="border border-gray-300 p-2">
                 {isEditing ? (
                     <input className="w-full text-center border rounded p-1" value={m.completionDate} onChange={(e) => handleChange(m.id, 'completionDate', e.target.value)} />
                 ) : m.completionDate}
              </td>
              <td className="border border-gray-300 p-2 text-gray-500">
                  {isEditing ? (
                     <input className="w-full text-center border rounded p-1" value={m.durationDiff} onChange={(e) => handleChange(m.id, 'durationDiff', e.target.value)} />
                 ) : m.durationDiff}
              </td>
              <td className="border border-gray-300 p-2 text-red-500">
                 {isEditing ? (
                     <input className="w-full text-center border rounded p-1" value={m.remarks} onChange={(e) => handleChange(m.id, 'remarks', e.target.value)} />
                 ) : m.remarks}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

       {/* Generic Approval Block */}
       <div className="p-4 border-t border-gray-200 bg-gray-50">
           <h4 className="text-xs font-bold text-gray-500 uppercase mb-3">Approvals / Sign-off</h4>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="border-b border-gray-400 pb-1">
                        <div className="text-[10px] text-gray-400 mb-6">Signature</div>
                        <div className="flex justify-between items-end">
                            <span className="text-xs font-medium text-gray-600">Stakeholder {i}</span>
                            <CheckCircle2 size={14} className="text-gray-300" />
                        </div>
                    </div>
                ))}
           </div>
       </div>
    </div>
  );
};