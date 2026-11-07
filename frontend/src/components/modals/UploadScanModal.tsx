import React, { useRef, useState } from 'react';
import { ModalDialog } from '../ui/Primitives';
import { AlertCircle, CheckCircle2, FileArchive, HardDrive, Upload } from 'lucide-react';
import { StudyDTO } from '../../types/api';

interface UploadScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  studies: StudyDTO[];
  selectedStudyId: string | null;
  onUpload: (file: File, studyId: string | null) => Promise<void>;
  uploading: boolean;
  uploadStatusMsg: string | null;
  uploadErrorMsg: string | null;
}

export const UploadScanModal: React.FC<UploadScanModalProps> = ({
  isOpen,
  onClose,
  studies,
  selectedStudyId,
  onUpload,
  uploading,
  uploadStatusMsg,
  uploadErrorMsg,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [targetStudyId, setTargetStudyId] = useState<string>(selectedStudyId || (studies[0]?.id || ''));
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleStartUpload = async () => {
    if (!selectedFile) return;
    await onUpload(selectedFile, targetStudyId || null);
    if (!uploadErrorMsg) {
      setSelectedFile(null);
    }
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Upload Medical CT Scan (DICOM / NIfTI)"
      size="lg"
    >
      <div className="space-y-4 text-xs text-[#F8FAFC]">
        {/* Target Study Selection */}
        <div>
          <label className="block text-xs font-semibold text-[#CBD5E1] mb-1.5">
            Associate with Study Protocol
          </label>
          <select
            value={targetStudyId}
            onChange={(e) => setTargetStudyId(e.target.value)}
            disabled={uploading}
            className="w-full px-3 py-2 text-xs bg-[#161F30] border border-[#222F43] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#38BDF8]"
          >
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.patient_anon_id} — {s.title} ({s.scans.length} scans)
              </option>
            ))}
            {studies.length === 0 && (
              <option value="">Auto-create new study protocol</option>
            )}
          </select>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition ${
            dragOver
              ? 'border-[#38BDF8] bg-[#38BDF8]/10'
              : selectedFile
              ? 'border-[#14B8A6] bg-[#14B8A6]/10'
              : 'border-[#222F43] hover:border-[#38BDF8] bg-[#161F30]/60'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".nii,.nii.gz,.dcm,.zip"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-col items-center">
            {selectedFile ? (
              <CheckCircle2 className="w-10 h-10 text-[#14B8A6] mb-2" />
            ) : (
              <Upload className="w-10 h-10 text-[#38BDF8] mb-2 opacity-80" />
            )}

            {selectedFile ? (
              <div>
                <p className="text-xs sm:text-sm font-bold text-[#FFFFFF] font-mono">{selectedFile.name}</p>
                <p className="text-xs text-[#CBD5E1] mt-1">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · Click to change file
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs sm:text-sm font-semibold text-[#FFFFFF]">
                  Drag and drop your CT volume or click to browse
                </p>
                <p className="text-xs text-[#94A3B8] mt-1 font-mono">
                  Supported: .nii, .nii.gz, .dcm, or .zip archive of DICOM slices
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Format & Validation Guidelines */}
        <div className="bg-[#161F30] border border-[#222F43] rounded-xl p-3.5 text-xs text-[#CBD5E1] space-y-1.5">
          <div className="font-semibold text-[#FFFFFF] flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-[#38BDF8]" />
            Pre-flight Validation & Coordinate Geometry:
          </div>
          <p>
            • <strong>DICOM Archives:</strong> Automatically sorts axial and oblique slices using <code>ImageOrientationPatient</code> and <code>ImagePositionPatient</code> projection.
          </p>
          <p>
            • <strong>NIfTI Files:</strong> Standardized to LPS+ canonical orientation with Hounsfield Unit intercept calibration.
          </p>
        </div>

        {/* Feedback Messages */}
        {uploadStatusMsg && (
          <div className="p-3 rounded-lg bg-[#0D9488]/20 border border-[#0D9488]/40 text-xs text-[#14B8A6] flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
            <span className="font-mono">{uploadStatusMsg}</span>
          </div>
        )}

        {uploadErrorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{uploadErrorMsg}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#222F43]">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-3.5 py-2 text-xs font-medium text-[#CBD5E1] hover:text-[#FFFFFF] bg-[#161F30] border border-[#222F43] rounded-lg transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleStartUpload}
            disabled={!selectedFile || uploading}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#14B8A6] rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{uploading ? 'Processing Volume...' : 'Upload & Calibrate'}</span>
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};
