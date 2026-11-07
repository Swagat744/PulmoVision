import React from 'react';
import {
  Activity,
  BarChart3,
  Download,
  FileSpreadsheet,
  FolderOpen,
  Layers,
  PieChart,
  ShieldCheck,
} from 'lucide-react';
import { ScanMetadataDTO, SegmentationResultDTO, StudyDTO } from '../../types/api';
import { extractMorphometrySummary, resolveStructureColor } from '../../utils/segmentationColors';

interface QuantitativeAnalysisViewProps {
  study: StudyDTO | null;
  scan: ScanMetadataDTO | null;
  selectedResult: SegmentationResultDTO | null;
  results: SegmentationResultDTO[];
  onSelectResult: (r: SegmentationResultDTO) => void;
  onDownloadMetrics: () => void;
  onOpenWorkstation: () => void;
}

export const QuantitativeAnalysisView: React.FC<QuantitativeAnalysisViewProps> = ({
  study,
  scan,
  selectedResult,
  results,
  onSelectResult,
  onDownloadMetrics,
  onOpenWorkstation,
}) => {
  if (!selectedResult || !scan) {
    return (
      <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto shadow-2xl text-[#F8FAFC]">
        <BarChart3 className="w-12 h-12 text-[#38BDF8] mx-auto mb-3 opacity-80" />
        <h2 className="text-base sm:text-lg font-bold text-[#FFFFFF]">No Segmentation Results Available</h2>
        <p className="text-xs sm:text-sm text-[#CBD5E1] mt-1 leading-relaxed">
          Quantitative volumetric analysis and HU attenuation profiling require an executed AI lung segmentation mask.
        </p>
        <button
          type="button"
          onClick={onOpenWorkstation}
          className="mt-5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#0D9488] hover:bg-[#14B8A6] rounded-lg transition cursor-pointer shadow-md"
        >
          Open Radiology Workstation →
        </button>
      </div>
    );
  }

  const morphometry = extractMorphometrySummary(selectedResult.measurements);
  const totalMl = morphometry.total_lung_volume_ml;
  const leftMl = morphometry.left_lung_volume_ml;
  const rightMl = morphometry.right_lung_volume_ml;
  const leftPct = totalMl > 0 ? (leftMl / totalMl) * 100 : 0;
  const rightPct = totalMl > 0 ? (rightMl / totalMl) * 100 : 0;

  const referenceMetrics = (selectedResult as any).reference_metrics as
    | {
        dice_coefficient: number;
        jaccard_index: number;
        hausdorff_95_mm: number;
        average_surface_distance_mm: number;
      }
    | undefined;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto select-none text-[#F8FAFC]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222F43]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#FFFFFF] tracking-tight">
              Quantitative Lung Volumetry & Attenuation Analysis
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#0D9488]/20 text-[#14B8A6] border border-[#0D9488]/40">
              {selectedResult.model_key}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#CBD5E1] mt-1">
            Subject: <strong className="font-mono text-[#38BDF8]">{study?.patient_anon_id}</strong> · Volume ID:{' '}
            <span className="font-mono text-[#FFFFFF]">{scan.original_filename}</span> · Voxel:{' '}
            <span className="font-mono text-[#CBD5E1]">
              {scan.spacing_mm.x.toFixed(2)}×{scan.spacing_mm.y.toFixed(2)}×{scan.spacing_mm.z.toFixed(2)} mm
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Result Switcher if multiple */}
          {results.length > 1 && (
            <select
              value={selectedResult.id}
              onChange={(e) => {
                const found = results.find((r) => r.id === e.target.value);
                if (found) onSelectResult(found);
              }}
              className="text-xs bg-[#161F30] border border-[#222F43] rounded-lg px-3 py-2 text-[#FFFFFF] focus:outline-none focus:border-[#38BDF8]"
            >
              {results.map((r, i) => (
                <option key={r.id} value={r.id}>
                  Result {i + 1} ({r.model_key})
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={onDownloadMetrics}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#FFFFFF] bg-[#0F1523] border border-[#222F43] hover:border-[#38BDF8] rounded-lg transition shadow-sm cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Export JSON Metrics</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Total, Right, Left Volume */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Lung Volume */}
        <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-[#CBD5E1] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Total Lung Volume (TLV)</span>
            <Layers className="w-4 h-4 text-[#38BDF8]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#FFFFFF]">
            {totalMl.toFixed(1)} <span className="text-sm font-normal text-[#94A3B8]">mL</span>
          </div>
          <div className="mt-2 text-xs font-mono text-[#14B8A6] font-semibold">
            {(totalMl / 1000).toFixed(2)} Liters
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-1 font-mono">
            Voxel Integration: Sum(V_voxel)
          </p>
        </div>

        {/* Right Lung Volume */}
        <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-[#CBD5E1] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#14B8A6]" />
              Right Lung Volume
            </span>
            <span className="font-mono text-xs text-[#14B8A6] font-bold">{rightPct.toFixed(1)}%</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#FFFFFF]">
            {rightMl.toFixed(1)} <span className="text-sm font-normal text-[#94A3B8]">mL</span>
          </div>
          <div className="mt-2 text-xs font-mono text-[#CBD5E1]">
            {(rightMl / 1000).toFixed(2)} Liters
          </div>
          <div className="w-full bg-[#161F30] rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-[#14B8A6] h-full rounded-full" style={{ width: `${rightPct}%` }} />
          </div>
        </div>

        {/* Left Lung Volume */}
        <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-semibold text-[#CBD5E1] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
              Left Lung Volume
            </span>
            <span className="font-mono text-xs text-[#38BDF8] font-bold">{leftPct.toFixed(1)}%</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono text-[#FFFFFF]">
            {leftMl.toFixed(1)} <span className="text-sm font-normal text-[#94A3B8]">mL</span>
          </div>
          <div className="mt-2 text-xs font-mono text-[#CBD5E1]">
            {(leftMl / 1000).toFixed(2)} Liters
          </div>
          <div className="w-full bg-[#161F30] rounded-full h-1.5 mt-2 overflow-hidden">
            <div className="bg-[#38BDF8] h-full rounded-full" style={{ width: `${leftPct}%` }} />
          </div>
        </div>
      </div>

      {/* Lobar Distribution Breakdown */}
      {morphometry.lobes && Object.keys(morphometry.lobes).length > 0 && (
        <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-[#FFFFFF] uppercase tracking-wide">
                Five-Lobe Anatomical Compartmentalization
              </h2>
              <p className="text-xs text-[#CBD5E1] mt-0.5">
                Volumetric distribution across right and left pulmonary lobes
              </p>
            </div>
            <span className="text-xs font-mono text-[#38BDF8] font-semibold bg-[#161F30] border border-[#222F43] px-2.5 py-1 rounded-md">
              Lobar Partition
            </span>
          </div>

          <div className="space-y-3">
            {Object.entries(morphometry.lobes).map(([lobeKey, volVal]) => {
              const volMl = Number(volVal);
              const pct = totalMl > 0 ? (volMl / totalMl) * 100 : 0;
              const colorHex = resolveStructureColor(lobeKey);
              const labelName = lobeKey.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

              return (
                <div key={lobeKey} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="flex items-center gap-2 font-medium text-[#FFFFFF]">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: colorHex }} />
                      <span>{labelName}</span>
                    </span>
                    <span className="font-mono text-[#CBD5E1]">
                      <strong className="text-[#FFFFFF]">{volMl.toFixed(1)} mL</strong> ({pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#161F30] rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: colorHex }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Attenuation (HU) Profile Card */}
      <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="text-xs sm:text-sm font-bold text-[#FFFFFF] uppercase tracking-wide">
          Hounsfield Unit (HU) Radiodensity Profile
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
          <div className="p-3.5 bg-[#161F30] border border-[#222F43] rounded-xl">
            <span className="text-xs text-[#94A3B8] block">Mean Attenuation</span>
            <span className="text-base sm:text-lg font-bold font-mono text-[#FFFFFF]">
              {morphometry.attenuation_profile.mean_hu.toFixed(1)} HU
            </span>
          </div>
          <div className="p-3.5 bg-[#161F30] border border-[#222F43] rounded-xl">
            <span className="text-xs text-[#94A3B8] block">Standard Deviation</span>
            <span className="text-base sm:text-lg font-bold font-mono text-[#FFFFFF]">
              ±{morphometry.attenuation_profile.std_hu.toFixed(1)} HU
            </span>
          </div>
          <div className="p-3.5 bg-[#161F30] border border-[#222F43] rounded-xl">
            <span className="text-xs text-[#94A3B8] block">Minimum Density</span>
            <span className="text-base sm:text-lg font-bold font-mono text-[#FFFFFF]">
              {morphometry.attenuation_profile.min_hu} HU
            </span>
          </div>
          <div className="p-3.5 bg-[#161F30] border border-[#222F43] rounded-xl">
            <span className="text-xs text-[#94A3B8] block">Maximum Density</span>
            <span className="text-base sm:text-lg font-bold font-mono text-[#FFFFFF]">
              {morphometry.attenuation_profile.max_hu} HU
            </span>
          </div>
        </div>
      </div>

      {/* Reference Mask Evaluation Metrics */}
      {referenceMetrics && (
        <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-[#FFFFFF] uppercase tracking-wide">
                Reference Ground-Truth Validation Metrics
              </h2>
              <p className="text-xs text-[#CBD5E1] mt-0.5">
                Rigorous mathematical comparison against expert radiologist ground-truth mask
              </p>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-500/40 px-2.5 py-1 rounded-md font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              VERIFIED
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1 font-mono">
            <div className="p-3.5 bg-[#161F30] border border-[#222F43] rounded-xl">
              <span className="text-xs text-[#94A3B8] block">Dice Similarity Coeff</span>
              <span className="text-lg font-bold text-[#14B8A6]">
                {referenceMetrics.dice_coefficient.toFixed(4)}
              </span>
            </div>
            <div className="p-3.5 bg-[#161F30] border border-[#222F43] rounded-xl">
              <span className="text-xs text-[#94A3B8] block">Jaccard Index (IoU)</span>
              <span className="text-lg font-bold text-[#38BDF8]">
                {referenceMetrics.jaccard_index.toFixed(4)}
              </span>
            </div>
            <div className="p-3.5 bg-[#161F30] border border-[#222F43] rounded-xl">
              <span className="text-xs text-[#94A3B8] block">95% Hausdorff Distance</span>
              <span className="text-lg font-bold text-[#FFFFFF]">
                {referenceMetrics.hausdorff_95_mm.toFixed(2)} mm
              </span>
            </div>
            <div className="p-3.5 bg-[#161F30] border border-[#222F43] rounded-xl">
              <span className="text-xs text-[#94A3B8] block">Avg Surface Distance</span>
              <span className="text-lg font-bold text-[#FFFFFF]">
                {referenceMetrics.average_surface_distance_mm.toFixed(2)} mm
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
