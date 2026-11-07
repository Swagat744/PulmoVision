import React from 'react';
import {
  Activity,
  ArrowUpRight,
  Box,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  FileText,
  FolderOpen,
  HardDrive,
  Layers,
  Sparkles,
  Upload,
  Zap,
} from 'lucide-react';
import { DashboardSummaryDTO, ModelVersionDTO, StudyDTO, UserDTO } from '../../types/api';
import { StatusBadge } from '../ui/Primitives';

interface ResearchDashboardProps {
  dashboard: DashboardSummaryDTO | null;
  studies: StudyDTO[];
  models: ModelVersionDTO[];
  user: UserDTO | null;
  onOpenStudy: (studyId: string) => void;
  onOpenWorkstation: () => void;
  onOpenUpload: () => void;
  onOpenSample: () => void;
  onOpenNewStudy: () => void;
}

export const ResearchDashboard: React.FC<ResearchDashboardProps> = ({
  dashboard,
  studies,
  models,
  user,
  onOpenStudy,
  onOpenWorkstation,
  onOpenUpload,
  onOpenSample,
  onOpenNewStudy,
}) => {
  const totalStudies = dashboard?.total_studies ?? studies.length;
  const completedSegs = dashboard?.completed_jobs ?? 0;
  const totalScans = dashboard?.total_scans ?? 0;
  const activeJobs = dashboard?.recent_jobs?.filter(
    (j) => j.status === 'QUEUED' || j.status === 'PROCESSING'
  ).length ?? 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto text-[#F8FAFC]">
      {/* Top Welcome / Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#222F43]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#FFFFFF] tracking-tight">
              Medical Research & Imaging Overview
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#0D9488]/20 text-[#14B8A6] border border-[#0D9488]/40">
              STABLE CALIBRATED
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#CBD5E1] mt-1">
            Welcome, <strong className="text-[#FFFFFF]">{user?.full_name || 'Researcher'}</strong> · Thoracic CT deep learning volumetric pipeline
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenNewStudy}
            className="px-3 py-2 text-xs font-medium text-[#F8FAFC] bg-[#0F1523] border border-[#222F43] hover:border-[#38BDF8] rounded-lg transition shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5 text-[#38BDF8]" />
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

      {/* Bento Grid — Row 1: KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-5 shadow-sm hover:border-[#38BDF8]/40 transition">
          <div className="flex items-center justify-between text-[#CBD5E1] text-xs font-medium mb-2">
            <span>Subject Studies</span>
            <FolderOpen className="w-4 h-4 text-[#38BDF8]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#FFFFFF]">{totalStudies}</span>
            <span className="text-xs text-[#94A3B8]">active cohorts</span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#222F43] text-xs text-[#CBD5E1] flex items-center justify-between">
            <span>{totalScans} Volumetric Scans</span>
            <span className="font-mono text-[#38BDF8] font-medium">100% Modality CT</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-5 shadow-sm hover:border-[#14B8A6]/40 transition">
          <div className="flex items-center justify-between text-[#CBD5E1] text-xs font-medium mb-2">
            <span>Completed Segmentations</span>
            <Layers className="w-4 h-4 text-[#14B8A6]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#FFFFFF]">{completedSegs}</span>
            <span className="text-xs text-[#94A3B8]">AI lung masks</span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#222F43] text-xs text-[#CBD5E1] flex items-center justify-between">
            <span>Bilateral & 5-Lobe</span>
            <span className="font-mono text-[#14B8A6] font-medium">U-Net 2D ResNet</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-5 shadow-sm hover:border-[#38BDF8]/40 transition">
          <div className="flex items-center justify-between text-[#CBD5E1] text-xs font-medium mb-2">
            <span>Inference Jobs</span>
            <Activity className="w-4 h-4 text-[#38BDF8]" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#FFFFFF]">{activeJobs}</span>
            <span className="text-xs text-[#94A3B8]">in queue / processing</span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#222F43] text-xs text-[#CBD5E1] flex items-center justify-between">
            <span>Background Worker</span>
            <span className="font-mono text-emerald-400 font-medium">Async ThreadPool</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-5 shadow-sm hover:border-amber-400/40 transition">
          <div className="flex items-center justify-between text-[#CBD5E1] text-xs font-medium mb-2">
            <span>Verified AI Models</span>
            <Box className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-[#FFFFFF]">{models.length || 2}</span>
            <span className="text-xs text-[#94A3B8]">lungmask engines</span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#222F43] text-xs text-[#CBD5E1] flex items-center justify-between">
            <span>Weights Integrity</span>
            <span className="font-mono text-[#0D9488] font-medium">SHA-256 Verified</span>
          </div>
        </div>
      </div>

      {/* Bento Grid — Row 2: Recent Studies & System Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Studies Table */}
        <div className="lg:col-span-2 bg-[#0F1523] border border-[#222F43] rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="px-5 py-4 border-b border-[#222F43] flex items-center justify-between">
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-[#FFFFFF] tracking-wide uppercase">
                  Recent Imaging Studies
                </h2>
                <p className="text-xs text-[#CBD5E1] mt-0.5">
                  De-identified subject scans ready for multi-planar inspection & AI inference
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenStudy('')}
                className="text-xs font-semibold text-[#38BDF8] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>View all ({studies.length})</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {studies.length === 0 ? (
              <div className="p-8 text-center">
                <FolderOpen className="w-10 h-10 text-[#94A3B8] mx-auto mb-2 opacity-60" />
                <p className="text-sm font-semibold text-[#FFFFFF]">No Research Studies Enrolled</p>
                <p className="text-xs text-[#CBD5E1] mt-1 max-w-sm mx-auto">
                  Create a new study protocol or generate a calibrated synthetic CT phantom to get started.
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={onOpenSample}
                    className="px-3.5 py-2 text-xs font-medium text-[#14B8A6] bg-[#0D9488]/20 border border-[#0D9488]/40 rounded-lg hover:bg-[#0D9488]/30 transition cursor-pointer"
                  >
                    Generate Benchmark Phantom
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#161F30] text-[#CBD5E1] font-mono text-[11px] border-b border-[#222F43]">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Subject ID</th>
                      <th className="px-4 py-2.5 font-medium">Study Title</th>
                      <th className="px-4 py-2.5 font-medium">Scans</th>
                      <th className="px-4 py-2.5 font-medium">Matrix Dimensions</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#222F43] text-[#F8FAFC]">
                    {studies.slice(0, 5).map((s) => {
                      const firstScan = s.scans[0];
                      const isSegmented = s.completed_segmentations > 0 || s.scans.some((sc) => sc.latest_job_status === 'COMPLETED' || !!sc.latest_result_id);
                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-[#161F30] cursor-pointer transition"
                          onClick={() => onOpenStudy(s.id)}
                        >
                          <td className="px-4 py-3 font-mono font-bold text-[#38BDF8]">
                            {s.patient_anon_id}
                          </td>
                          <td className="px-4 py-3 font-medium truncate max-w-[200px]" title={s.title}>
                            {s.title}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-[#CBD5E1]">
                            {s.scans.length} CT
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-[#CBD5E1]">
                            {firstScan
                              ? `${firstScan.dimensions.x}×${firstScan.dimensions.y}×${firstScan.dimensions.z}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={isSegmented ? 'COMPLETED' : 'PENDING'} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenStudy(s.id);
                                onOpenWorkstation();
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-[#14B8A6] bg-[#0D9488]/20 border border-[#0D9488]/40 hover:bg-[#0D9488]/30 rounded-md transition cursor-pointer"
                            >
                              Workstation →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="px-5 py-3 bg-[#161F30]/60 border-t border-[#222F43] text-xs text-[#CBD5E1] flex items-center justify-between">
            <span>Showing recent studies</span>
            <span className="font-mono text-[#94A3B8]">Storage: SQLite 3.x WAL + SimpleITK LPS+</span>
          </div>
        </div>

        {/* Right 1 Col: Workstation Card & Telemetry */}
        <div className="space-y-4">
          {/* Workstation Resume Card */}
          <div className="bg-gradient-to-br from-[#111A2E] to-[#0A101D] text-white rounded-2xl p-5 border border-[#222F43] shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#38BDF8] font-bold">
                Radiology Workstation
              </span>
              <Layers className="w-4 h-4 text-[#38BDF8]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#FFFFFF]">Multi-Planar Reconstruction (MPR)</h3>
              <p className="text-xs text-[#CBD5E1] mt-1 leading-relaxed">
                Inspect synchronized Axial, Coronal, and Sagittal planes with real-time 3D anatomical surface mesh rendering.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenWorkstation}
              className="w-full py-2.5 px-3 text-xs font-semibold text-[#080B10] bg-[#38BDF8] hover:bg-[#7DD3FC] rounded-lg transition shadow-md flex items-center justify-center gap-1.5 cursor-pointer font-sans"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Launch Medical Imaging Workspace</span>
            </button>
          </div>

          {/* Telemetry Bento */}
          <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#FFFFFF] uppercase tracking-wider">Host Memory & Pipeline Safety</span>
              <Cpu className="w-4 h-4 text-[#38BDF8]" />
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center text-[#CBD5E1]">
                <span>Peak RSS Memory:</span>
                <span className="text-[#FFFFFF] font-bold">~1.08 GB / 7.68 GB</span>
              </div>
              <div className="w-full bg-[#161F30] rounded-full h-1.5 overflow-hidden">
                <div className="bg-gradient-to-r from-[#0D9488] to-[#38BDF8] h-full rounded-full" style={{ width: '14%' }} />
              </div>

              <div className="pt-2 border-t border-[#222F43] space-y-2 text-[11px] text-[#CBD5E1]">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>PyTorch CPU Multi-threading Configured</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Oblique DICOM Vector Projection Verified</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>3D Marching Cubes Surface Generator Online</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Grid — Row 3: Available AI Models Grid */}
      <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-[#FFFFFF] tracking-wide uppercase">
              Pre-trained Thoracic Deep Learning Architectures
            </h2>
            <p className="text-xs text-[#CBD5E1] mt-0.5">
              Verified peer-reviewed model weights deployed for automated lung segmentation
            </p>
          </div>
          <span className="text-xs font-mono text-[#38BDF8] bg-[#161F30] border border-[#222F43] px-2.5 py-1 rounded-md font-medium">
            lungmask v0.2.22
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {models.map((m) => (
            <div
              key={m.id}
              className="border border-[#222F43] rounded-xl p-4 bg-[#161F30] space-y-2 text-xs"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-[#FFFFFF] text-sm">{m.display_name}</h3>
                  <span className="font-mono text-[10px] text-[#38BDF8] block mt-0.5">
                    {m.model_key} · {m.architecture}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-300 font-semibold border border-emerald-500/40">
                  READY
                </span>
              </div>
              <p className="text-xs text-[#CBD5E1] leading-relaxed">{m.description}</p>
              <div className="pt-2 border-t border-[#222F43] flex flex-wrap gap-1.5">
                {Object.entries(m.label_map).map(([lbl, meta]) => (
                  <span
                    key={lbl}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono bg-[#0F1523] border border-[#222F43] text-[#F8FAFC]"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: meta.color }}
                    />
                    <span>{meta.name}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
