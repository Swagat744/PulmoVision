import React, { useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Eye,
  FileSpreadsheet,
  Filter,
  FolderOpen,
  Layers,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { StudyDTO } from '../../types/api';
import { StatusBadge } from '../ui/Primitives';

interface StudiesManagerProps {
  studies: StudyDTO[];
  selectedStudyId: string | null;
  onSelectStudy: (studyId: string) => void;
  onOpenWorkstation: () => void;
  onDeleteStudy: (studyId: string) => Promise<void>;
  onOpenNewStudy: () => void;
  onOpenUpload: () => void;
  onOpenSample: () => void;
}

export const StudiesManager: React.FC<StudiesManagerProps> = ({
  studies,
  selectedStudyId,
  onSelectStudy,
  onOpenWorkstation,
  onDeleteStudy,
  onOpenNewStudy,
  onOpenUpload,
  onOpenSample,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SEGMENTED' | 'PENDING'>('ALL');
  const [studyToDelete, setStudyToDelete] = useState<string | null>(null);

  const filteredStudies = studies.filter((s) => {
    const matchesSearch =
      s.patient_anon_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.clinical_notes && s.clinical_notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const isSeg = s.completed_segmentations > 0 || s.scans.some((sc) => sc.latest_job_status === 'COMPLETED' || !!sc.latest_result_id);
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'SEGMENTED' && isSeg) ||
      (statusFilter === 'PENDING' && !isSeg);

    return matchesSearch && matchesStatus;
  });

  const confirmDelete = async () => {
    if (!studyToDelete) return;
    await onDeleteStudy(studyToDelete);
    setStudyToDelete(null);
  };

  return (
    <div className="space-y-4 max-w-[1600px] mx-auto text-[#F8FAFC]">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222F43]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#FFFFFF] tracking-tight">
            Imaging Studies & Subject Cohorts
          </h1>
          <p className="text-xs sm:text-sm text-[#CBD5E1] mt-1">
            Manage de-identified DICOM and NIfTI thoracic CT scans ({studies.length} total studies registered)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenNewStudy}
            className="px-3 py-2 text-xs font-medium text-[#F8FAFC] bg-[#0F1523] border border-[#222F43] hover:border-[#38BDF8] rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>New Study</span>
          </button>
          <button
            type="button"
            onClick={onOpenSample}
            className="px-3 py-2 text-xs font-medium text-[#F8FAFC] bg-[#0F1523] border border-[#222F43] hover:border-[#14B8A6] rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#14B8A6]" />
            <span>Sample Benchmark</span>
          </button>
          <button
            type="button"
            onClick={onOpenUpload}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#14B8A6] rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload CT Scan</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by subject ID, title or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#161F30] border border-[#222F43] rounded-lg text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span className="text-xs text-[#CBD5E1]">Segmentation Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs bg-[#161F30] border border-[#222F43] rounded-lg px-3 py-2 text-[#FFFFFF] focus:outline-none focus:border-[#38BDF8]"
          >
            <option value="ALL">All Cohorts ({studies.length})</option>
            <option value="SEGMENTED">Segmented Only</option>
            <option value="PENDING">Pending Segmentation</option>
          </select>
        </div>
      </div>

      {/* Studies Table */}
      <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl shadow-sm overflow-hidden">
        {filteredStudies.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="w-10 h-10 text-[#94A3B8] mx-auto mb-2 opacity-60" />
            <h3 className="text-sm font-semibold text-[#FFFFFF]">No Matching Studies Found</h3>
            <p className="text-xs text-[#CBD5E1] mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No subject cohort matches "${searchQuery}". Clear your search query or create a new study.`
                : 'No studies are registered in this category yet.'}
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3.5 py-2 text-xs text-[#CBD5E1] bg-[#161F30] border border-[#222F43] rounded-lg hover:text-[#FFFFFF] transition cursor-pointer"
                >
                  Clear Search
                </button>
              )}
              <button
                type="button"
                onClick={onOpenSample}
                className="px-3.5 py-2 text-xs font-semibold text-[#080B10] bg-[#14B8A6] hover:bg-[#2DD4BF] rounded-lg transition cursor-pointer"
              >
                Synthesize Benchmark Phantom
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#161F30] text-[#CBD5E1] font-mono text-[11px] border-b border-[#222F43]">
                <tr>
                  <th className="px-4 py-3 font-medium">Subject Code</th>
                  <th className="px-4 py-3 font-medium">Protocol Title & Notes</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Modality</th>
                  <th className="px-4 py-3 font-medium">Series / Scans</th>
                  <th className="px-4 py-3 font-medium">Matrix (X×Y×Z)</th>
                  <th className="px-4 py-3 font-medium">Voxel Spacing (mm)</th>
                  <th className="px-4 py-3 font-medium">AI Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222F43] text-[#F8FAFC]">
                {filteredStudies.map((s) => {
                  const firstScan = s.scans[0];
                  const isSegmented = s.completed_segmentations > 0 || s.scans.some((sc) => sc.latest_job_status === 'COMPLETED' || !!sc.latest_result_id);
                  const isSelected = selectedStudyId === s.id;

                  return (
                    <tr
                      key={s.id}
                      onClick={() => onSelectStudy(s.id)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? 'bg-[#0D9488]/20 font-medium'
                          : 'hover:bg-[#161F30]'
                      }`}
                    >
                      <td className="px-4 py-3.5 font-mono font-bold text-[#38BDF8]">
                        {s.patient_anon_id}
                      </td>
                      <td className="px-4 py-3.5 max-w-[240px]">
                        <div className="font-medium text-[#FFFFFF] truncate" title={s.title}>
                          {s.title}
                        </div>
                        {s.clinical_notes && (
                          <div
                            className="text-[11px] text-[#94A3B8] truncate mt-0.5"
                            title={s.clinical_notes}
                          >
                            {s.clinical_notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-[#CBD5E1] whitespace-nowrap">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#161F30] text-[#38BDF8] border border-[#222F43]">
                          {s.modality || 'CT'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-[#CBD5E1]">
                        {s.scans.length} {s.scans.length === 1 ? 'Volume' : 'Volumes'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-[#FFFFFF]">
                        {firstScan
                          ? `${firstScan.dimensions.x}×${firstScan.dimensions.y}×${firstScan.dimensions.z}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] text-[#CBD5E1]">
                        {firstScan
                          ? `${firstScan.spacing_mm.x.toFixed(2)}×${firstScan.spacing_mm.y.toFixed(2)}×${firstScan.spacing_mm.z.toFixed(2)}`
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusBadge status={isSegmented ? 'COMPLETED' : 'PENDING'} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectStudy(s.id);
                              onOpenWorkstation();
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-[#14B8A6] bg-[#0D9488]/20 border border-[#0D9488]/40 hover:bg-[#0D9488]/30 rounded-md transition flex items-center gap-1 cursor-pointer"
                            title="Open in Medical Imaging Workspace"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Workstation</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setStudyToDelete(s.id)}
                            className="p-1 text-[#94A3B8] hover:text-red-400 hover:bg-[#161F30] rounded-md transition cursor-pointer"
                            title="Delete Study"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-5 py-3 bg-[#161F30]/60 border-t border-[#222F43] text-xs text-[#CBD5E1] flex items-center justify-between">
          <span>Showing {filteredStudies.length} of {studies.length} studies</span>
          <span className="font-mono text-[#94A3B8]">Storage: DICOM Part 10 / NIfTI-1 GZ</span>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {studyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Confirm Study Deletion</span>
            </div>
            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              Are you sure you want to permanently delete this study and all associated CT scan volumes, segmentation masks, and 3D mesh files? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStudyToDelete(null)}
                className="px-3.5 py-2 text-xs font-medium text-[#CBD5E1] hover:text-[#FFFFFF] bg-[#161F30] border border-[#222F43] rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition cursor-pointer"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
