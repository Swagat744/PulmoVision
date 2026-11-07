import React, { useState } from 'react';
import {
  Activity,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Printer,
  ShieldAlert,
} from 'lucide-react';
import { ScanMetadataDTO, SegmentationResultDTO, StudyDTO, UserDTO } from '../../types/api';
import { extractMorphometrySummary } from '../../utils/segmentationColors';

interface ReportsExportViewProps {
  study: StudyDTO | null;
  scan: ScanMetadataDTO | null;
  selectedResult: SegmentationResultDTO | null;
  user: UserDTO | null;
  onDownloadMask: () => void;
  onDownloadReport: () => void;
  onDownloadMetrics: () => void;
}

export const ReportsExportView: React.FC<ReportsExportViewProps> = ({
  study,
  scan,
  selectedResult,
  user,
  onDownloadMask,
  onDownloadReport,
  onDownloadMetrics,
}) => {
  const [downloadLog, setDownloadLog] = useState<{ id: string; name: string; type: string; time: string }[]>([
    {
      id: 'init-1',
      name: 'Initial Study Registration Telemetry',
      type: 'METADATA_JSON',
      time: new Date().toLocaleTimeString(),
    },
  ]);

  const morphometry = extractMorphometrySummary(selectedResult?.measurements);

  const handleLoggedDownload = (type: 'pdf' | 'mask' | 'json') => {
    const timestamp = new Date().toLocaleTimeString();
    if (type === 'pdf') {
      onDownloadReport();
      setDownloadLog((prev) => [
        {
          id: String(Date.now()),
          name: `${study?.patient_anon_id || 'PV'}_volumetric_report.pdf`,
          type: 'CLINICAL_REPORT_PDF',
          time: timestamp,
        },
        ...prev,
      ]);
    } else if (type === 'mask') {
      onDownloadMask();
      setDownloadLog((prev) => [
        {
          id: String(Date.now()),
          name: `${study?.patient_anon_id || 'PV'}_segmentation_mask.nii.gz`,
          type: 'NIFTI_MASK_GZ',
          time: timestamp,
        },
        ...prev,
      ]);
    } else if (type === 'json') {
      onDownloadMetrics();
      setDownloadLog((prev) => [
        {
          id: String(Date.now()),
          name: `${study?.patient_anon_id || 'PV'}_morphometry_metrics.json`,
          type: 'RESEARCH_METRICS_JSON',
          time: timestamp,
        },
        ...prev,
      ]);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto select-none text-[#F8FAFC]">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#222F43]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#FFFFFF] tracking-tight">
            Study Reports & Data Export Center
          </h1>
          <p className="text-xs sm:text-sm text-[#CBD5E1] mt-1">
            Generate formal quantitative volumetric reports and export standardized medical imaging artifacts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleLoggedDownload('pdf')}
            disabled={!selectedResult}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#14B8A6] rounded-lg transition shadow-md disabled:opacity-40 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Generate PDF Report</span>
          </button>
          <button
            type="button"
            onClick={() => handleLoggedDownload('mask')}
            disabled={!selectedResult}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#FFFFFF] bg-[#0F1523] border border-[#222F43] hover:border-[#38BDF8] rounded-lg transition shadow-sm disabled:opacity-40 cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Export NIfTI (.nii.gz)</span>
          </button>
          <button
            type="button"
            onClick={() => handleLoggedDownload('json')}
            disabled={!selectedResult}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-[#FFFFFF] bg-[#0F1523] border border-[#222F43] hover:border-[#14B8A6] rounded-lg transition shadow-sm disabled:opacity-40 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#14B8A6]" />
            <span>Export JSON Metrics</span>
          </button>
        </div>
      </div>

      {/* Main Report Document Sheet Preview */}
      <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl shadow-2xl p-6 sm:p-10 max-w-4xl mx-auto space-y-6 text-[#F8FAFC]">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b-2 border-[#222F43] pb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0D9488] to-[#38BDF8] flex items-center justify-center text-[#080B10] font-black text-lg shadow-md">
              PV
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[#FFFFFF]">
                PulmoVision AI Volumetric Assessment Report
              </h2>
              <p className="text-xs text-[#38BDF8] font-mono">
                Automated Thoracic CT Segmentation & Quantitative Morphometry
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right text-xs font-mono text-[#CBD5E1]">
            <div>Report Date: {new Date().toLocaleDateString()}</div>
            <div>Investigator: {user?.full_name || 'Dr. Elena Vance'}</div>
          </div>
        </div>

        {/* Study & Patient Identification */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-[#161F30] border border-[#222F43] rounded-xl text-xs font-mono">
          <div>
            <span className="text-[#94A3B8] block text-[11px]">Subject ID:</span>
            <strong className="text-[#38BDF8] text-sm sm:text-base">{study?.patient_anon_id || 'PV-UNKNOWN'}</strong>
          </div>
          <div>
            <span className="text-[#94A3B8] block text-[11px]">Modality:</span>
            <strong className="text-[#FFFFFF]">{study?.modality || 'CT'}</strong>
          </div>
          <div>
            <span className="text-[#94A3B8] block text-[11px]">Matrix Dimensions:</span>
            <strong className="text-[#FFFFFF]">
              {scan ? `${scan.dimensions.x}×${scan.dimensions.y}×${scan.dimensions.z}` : '—'}
            </strong>
          </div>
          <div>
            <span className="text-[#94A3B8] block text-[11px]">Voxel Spacing:</span>
            <strong className="text-[#FFFFFF]">
              {scan
                ? `${scan.spacing_mm.x.toFixed(2)}×${scan.spacing_mm.y.toFixed(2)}×${scan.spacing_mm.z.toFixed(2)} mm`
                : '—'}
            </strong>
          </div>
        </div>

        {/* AI Segmentation Pipeline Summary */}
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-[#FFFFFF] uppercase tracking-wider text-xs">
            1. AI Segmentation Methodology
          </h3>
          <p className="text-[#CBD5E1] leading-relaxed">
            Segmentation executed utilizing <strong className="text-[#38BDF8]">{selectedResult?.model_key || 'lungmask'}</strong> pre-trained ResNet-34 2D U-Net architecture. Volumetric integration performed on standardized LPS+ coordinate grid with physical slice thickness preservation.
          </p>
        </div>

        {/* Volumetric Findings Table */}
        <div className="space-y-2 text-xs">
          <h3 className="font-bold text-[#FFFFFF] uppercase tracking-wider text-xs">
            2. Volumetric Findings & Compartmentalization
          </h3>
          {selectedResult ? (
            <div className="overflow-x-auto border border-[#222F43] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#161F30] font-mono text-[11px] border-b border-[#222F43] text-[#CBD5E1]">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Anatomical Structure</th>
                    <th className="px-4 py-2.5 font-medium">Volume (mL)</th>
                    <th className="px-4 py-2.5 font-medium">Volume (L)</th>
                    <th className="px-4 py-2.5 font-medium">Distribution (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222F43] font-mono text-xs">
                  <tr className="bg-[#0D9488]/15 font-bold text-[#14B8A6]">
                    <td className="px-4 py-3">Total Bilateral Lung (TLV)</td>
                    <td className="px-4 py-3">
                      {morphometry.total_lung_volume_ml.toFixed(1)} mL
                    </td>
                    <td className="px-4 py-3">
                      {(morphometry.total_lung_volume_ml / 1000).toFixed(2)} L
                    </td>
                    <td className="px-4 py-3">100.0%</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-[#FFFFFF]">Right Lung</td>
                    <td className="px-4 py-3 text-[#CBD5E1]">
                      {morphometry.right_lung_volume_ml.toFixed(1)} mL
                    </td>
                    <td className="px-4 py-3 text-[#CBD5E1]">
                      {(morphometry.right_lung_volume_ml / 1000).toFixed(2)} L
                    </td>
                    <td className="px-4 py-3 text-[#CBD5E1]">
                      {(
                        (morphometry.right_lung_volume_ml /
                          Math.max(1, morphometry.total_lung_volume_ml)) *
                        100
                      ).toFixed(1)}
                      %
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-[#FFFFFF]">Left Lung</td>
                    <td className="px-4 py-3 text-[#CBD5E1]">
                      {morphometry.left_lung_volume_ml.toFixed(1)} mL
                    </td>
                    <td className="px-4 py-3 text-[#CBD5E1]">
                      {(morphometry.left_lung_volume_ml / 1000).toFixed(2)} L
                    </td>
                    <td className="px-4 py-3 text-[#CBD5E1]">
                      {(
                        (morphometry.left_lung_volume_ml /
                          Math.max(1, morphometry.total_lung_volume_ml)) *
                        100
                      ).toFixed(1)}
                      %
                    </td>
                  </tr>
                  {morphometry.lobes &&
                    Object.entries(morphometry.lobes).map(([k, v]) => {
                      const volVal = Number(v);
                      return (
                        <tr key={k} className="text-[#94A3B8]">
                          <td className="px-4 py-2 capitalize pl-8 text-[#CBD5E1]">
                            • {k.replace('_', ' ')}
                          </td>
                          <td className="px-4 py-2">{volVal.toFixed(1)} mL</td>
                          <td className="px-4 py-2">{(volVal / 1000).toFixed(2)} L</td>
                          <td className="px-4 py-2">
                            {(
                              (volVal /
                                Math.max(1, morphometry.total_lung_volume_ml)) *
                              100
                            ).toFixed(1)}
                            %
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[#94A3B8] italic">No segmentation data available to report.</p>
          )}
        </div>

        {/* HU Profile Section */}
        {selectedResult && (
          <div className="space-y-2 text-xs">
            <h3 className="font-bold text-[#FFFFFF] uppercase tracking-wider text-xs">
              3. Parenchyma Radiodensity (HU) Profile
            </h3>
            <p className="text-[#CBD5E1]">
              Mean attenuation across segmented pulmonary parenchyma:{' '}
              <strong className="font-mono text-[#38BDF8]">
                {morphometry.attenuation_profile.mean_hu.toFixed(1)} HU
              </strong>{' '}
              (SD: ±{morphometry.attenuation_profile.std_hu.toFixed(1)} HU, Range:{' '}
              {morphometry.attenuation_profile.min_hu} to{' '}
              {morphometry.attenuation_profile.max_hu} HU).
            </p>
          </div>
        )}

        {/* Legal Disclaimer */}
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong className="text-amber-300">SCIENTIFIC RESEARCH NOTICE:</strong> PulmoVision AI is an experimental medical imaging platform engineered for computer vision research, volume quantitation, and educational inspection. The quantitative parameters generated herein do not constitute a clinical medical diagnosis.
          </div>
        </div>
      </div>

      {/* Export History Log Table */}
      <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wide flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#38BDF8]" />
          <span>Session Export History</span>
        </h2>
        <div className="divide-y divide-[#222F43] text-xs">
          {downloadLog.map((item) => (
            <div key={item.id} className="py-2.5 flex items-center justify-between font-mono text-[11px]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-bold text-[#FFFFFF]">{item.name}</span>
                <span className="px-2 py-0.5 rounded bg-[#161F30] text-[#38BDF8] text-[10px] border border-[#222F43]">
                  {item.type}
                </span>
              </div>
              <span className="text-[#94A3B8]">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
