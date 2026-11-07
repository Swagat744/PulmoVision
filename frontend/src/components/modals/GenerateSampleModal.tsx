import React, { useState } from 'react';
import { ModalDialog } from '../ui/Primitives';
import { AlertCircle, CheckCircle2, Layers, Sparkles, Wand2 } from 'lucide-react';
import { StudyDTO } from '../../types/api';

interface GenerateSampleModalProps {
  isOpen: boolean;
  onClose: () => void;
  studies: StudyDTO[];
  selectedStudyId: string | null;
  onGenerate: (
    preset: 'nifti_standard' | 'dicom_axial' | 'dicom_oblique',
    sliceCount: number,
    studyId: string | null
  ) => Promise<void>;
  generating: boolean;
  statusMsg: string | null;
  errorMsg: string | null;
}

export const GenerateSampleModal: React.FC<GenerateSampleModalProps> = ({
  isOpen,
  onClose,
  studies,
  selectedStudyId,
  onGenerate,
  generating,
  statusMsg,
  errorMsg,
}) => {
  const [targetStudyId, setTargetStudyId] = useState<string>(selectedStudyId || (studies[0]?.id || ''));
  const [preset, setPreset] = useState<'nifti_standard' | 'dicom_axial' | 'dicom_oblique'>('nifti_standard');
  const [sliceCount, setSliceCount] = useState<number>(32);

  const presets = [
    {
      id: 'nifti_standard' as const,
      name: 'NIfTI 3D Standard Volume',
      desc: 'Canonical LPS+ coordinates, realistic thoracic HU calibration (-1000 to +300 HU), 2.5 mm spacing.',
      badge: 'NIfTI .nii.gz',
    },
    {
      id: 'dicom_axial' as const,
      name: 'Standard Axial DICOM Series',
      desc: 'Multi-slice DICOM series with genuine ImageOrientationPatient (1,0,0, 0,1,0) and RescaleIntercept -1024.',
      badge: 'DICOM .zip',
    },
    {
      id: 'dicom_oblique' as const,
      name: 'Oblique DICOM Series (12° Gantry Tilt)',
      desc: 'Rotated patient orientation test volume to verify 3D slice-normal projection sorting d_i = p_i · (r_0 × c_0).',
      badge: 'Oblique DICOM',
    },
  ];

  const handleGenerate = async () => {
    await onGenerate(preset, sliceCount, targetStudyId || null);
  };

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Synthesize Calibrated Thoracic CT Benchmark"
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
            disabled={generating}
            className="w-full px-3 py-2 text-xs bg-[#161F30] border border-[#222F43] rounded-lg text-[#FFFFFF] focus:outline-none focus:border-[#38BDF8]"
          >
            {studies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.patient_anon_id} — {s.title}
              </option>
            ))}
            {studies.length === 0 && (
              <option value="">Auto-create new benchmark study</option>
            )}
          </select>
        </div>

        {/* Preset Cards */}
        <div>
          <label className="block text-xs font-semibold text-[#CBD5E1] mb-2">
            Select Calibration Benchmark Preset
          </label>
          <div className="space-y-2">
            {presets.map((p) => {
              const isSelected = preset === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => !generating && setPreset(p.id)}
                  className={`p-3.5 rounded-xl border text-left cursor-pointer transition ${
                    isSelected
                      ? 'border-[#38BDF8] bg-[#38BDF8]/15 ring-1 ring-[#38BDF8]'
                      : 'border-[#222F43] hover:border-[#38BDF8]/50 bg-[#161F30]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#FFFFFF]">{p.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0F1523] text-[#38BDF8] border border-[#222F43] font-semibold">
                      {p.badge}
                    </span>
                  </div>
                  <p className="text-xs text-[#CBD5E1] leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Slice count slider */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-[#FFFFFF] mb-1">
            <span>Z-Axis Slice Count:</span>
            <span className="font-mono text-[#38BDF8] font-bold">{sliceCount} axial slices</span>
          </div>
          <input
            type="range"
            min={16}
            max={64}
            step={8}
            value={sliceCount}
            onChange={(e) => setSliceCount(parseInt(e.target.value, 10))}
            disabled={generating}
            className="w-full accent-[#0D9488]"
          />
          <div className="flex justify-between text-[10px] text-[#94A3B8] font-mono mt-1">
            <span>16 slices (Fastest)</span>
            <span>32 slices (Standard)</span>
            <span>64 slices (High Res)</span>
          </div>
        </div>

        {/* Feedback Messages */}
        {statusMsg && (
          <div className="p-3 rounded-lg bg-[#0D9488]/20 border border-[#0D9488]/40 text-xs text-[#14B8A6] flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
            <span className="font-mono">{statusMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#222F43]">
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="px-3.5 py-2 text-xs font-medium text-[#CBD5E1] hover:text-[#FFFFFF] bg-[#161F30] border border-[#222F43] rounded-lg transition cursor-pointer"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#14B8A6] rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{generating ? 'Generating Calibrated Volume...' : 'Generate Phantom'}</span>
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};
