import React from 'react';
import {
  CheckCircle2,
  Cpu,
  Database,
  HardDrive,
  Info,
  Layers,
  Lock,
  Save,
  Server,
  Settings,
  ShieldCheck,
  User,
} from 'lucide-react';
import { UserDTO } from '../../types/api';

interface PlatformSettingsViewProps {
  user: UserDTO | null;
  batchSize: number;
  setBatchSize: (b: number) => void;
  overlayOpacity: number;
  setOverlayOpacity: (o: number) => void;
  showCrosshairs: boolean;
  setShowCrosshairs: React.Dispatch<React.SetStateAction<boolean>>;
}

export const PlatformSettingsView: React.FC<PlatformSettingsViewProps> = ({
  user,
  batchSize,
  setBatchSize,
  overlayOpacity,
  setOverlayOpacity,
  showCrosshairs,
  setShowCrosshairs,
}) => {
  return (
    <div className="space-y-6 max-w-[1200px] mx-auto select-none text-[#F8FAFC]">
      {/* Top Header */}
      <div className="pb-4 border-b border-[#222F43]">
        <h1 className="text-xl sm:text-2xl font-bold text-[#FFFFFF] tracking-tight">
          Platform Settings & Computational Guardrails
        </h1>
        <p className="text-xs sm:text-sm text-[#CBD5E1] mt-1">
          Configure deep learning inference memory limits, medical imaging display defaults, and user profile
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: User Profile & Security */}
        <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#FFFFFF] uppercase tracking-wide">
            <User className="w-4 h-4 text-[#38BDF8]" />
            <span>Investigator Profile</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-[#CBD5E1] text-[11px] mb-1">Full Name & Credentials</label>
              <input
                type="text"
                disabled
                value={user?.full_name || 'Dr. Elena Vance'}
                className="w-full px-3 py-2 bg-[#161F30] border border-[#222F43] rounded-lg text-[#FFFFFF] font-medium"
              />
            </div>

            <div>
              <label className="block text-[#CBD5E1] text-[11px] mb-1">Institutional Email</label>
              <input
                type="email"
                disabled
                value={user?.email || 'researcher@pulmovision.ai'}
                className="w-full px-3 py-2 bg-[#161F30] border border-[#222F43] rounded-lg text-[#FFFFFF] font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-[#CBD5E1] text-[11px] mb-1">Role / Authorization</label>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/50 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                {user?.role || 'Principal Investigator (Read/Write/Inference)'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Imaging Display Preferences */}
        <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-[#FFFFFF] uppercase tracking-wide">
            <Settings className="w-4 h-4 text-[#14B8A6]" />
            <span>Workstation Display Defaults</span>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between text-[#FFFFFF] font-medium mb-1">
                <span>Default Segmentation Opacity:</span>
                <span className="font-mono text-[#38BDF8] font-bold">
                  {Math.round(overlayOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.1}
                max={0.9}
                step={0.05}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                className="w-full accent-[#0D9488]"
              />
              <p className="text-xs text-[#CBD5E1] mt-1">
                Recommended 45%–55% to inspect underlying parenchymal attenuation.
              </p>
            </div>

            <div className="pt-3 border-t border-[#222F43] flex items-center justify-between">
              <div>
                <span className="font-medium text-[#FFFFFF] block">Orthogonal Crosshairs</span>
                <span className="text-xs text-[#CBD5E1]">
                  Enable synchronized 3-plane navigation crosshairs by default
                </span>
              </div>
              <input
                type="checkbox"
                checked={showCrosshairs}
                onChange={(e) => setShowCrosshairs(e.target.checked)}
                className="w-4 h-4 accent-[#0D9488] rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Card 3: Deep Learning Memory Guardrail */}
        <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-6 shadow-sm space-y-4 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#FFFFFF] uppercase tracking-wide">
              <Cpu className="w-4 h-4 text-[#38BDF8]" />
              <span>Inference Memory Safety Guardrail</span>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-[#161F30] text-[#38BDF8] font-bold border border-[#222F43]">
              HOST MEMORY: 7.68 GB RAM
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="font-medium text-[#FFFFFF]">
                  U-Net Inference Batch Size:
                </span>
                <span className="font-mono text-sm font-bold text-[#14B8A6]">
                  {batchSize} slices per batch
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value, 10))}
                className="w-full accent-[#0D9488]"
              />
              <div className="flex justify-between text-[10px] text-[#94A3B8] font-mono mt-1">
                <span>1 (Ultra-low RAM ~420 MB)</span>
                <span>4 (Recommended on 8 GB ~1.08 GB)</span>
                <span>12 (High Throughput / 16+ GB)</span>
              </div>
            </div>

            <div className="p-4 bg-[#161F30] border border-[#222F43] rounded-xl text-xs text-[#CBD5E1] space-y-2">
              <p>
                • <strong className="text-[#FFFFFF]">Deterministic Execution:</strong> Batch size restricts transient PyTorch tensor activation memory during 2D slice forward passes, preventing out-of-memory crashes on host workstations.
              </p>
              <p>
                • <strong className="text-[#FFFFFF]">Model Weights Cache:</strong> Downloaded weights are verified via SHA-256 and cached locally in <code className="text-[#38BDF8]">backend/model_cache/</code>.
              </p>
            </div>
          </div>
        </div>

        {/* Card 4: Medical Coordinate Geometry & Engine Diagnostics */}
        <div className="bg-[#0F1523] border border-[#222F43] rounded-2xl p-6 shadow-sm space-y-3 md:col-span-2 text-xs">
          <h2 className="font-bold text-[#FFFFFF] uppercase tracking-wide text-xs flex items-center gap-2">
            <Server className="w-4 h-4 text-[#14B8A6]" />
            <span>Geometric Standardization & Backend Diagnostics</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs text-[#CBD5E1]">
            <div className="p-3.5 rounded-xl bg-[#161F30] border border-[#222F43]">
              <span className="block text-[#FFFFFF] font-bold mb-1">Coordinate System:</span>
              <span className="text-[#38BDF8]">LPS+ (Left-Posterior-Superior)</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#161F30] border border-[#222F43]">
              <span className="block text-[#FFFFFF] font-bold mb-1">DICOM Oblique Sorting:</span>
              <span className="text-[#38BDF8]">Vector Projection d_i = p_i · (r_0 × c_0)</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[#161F30] border border-[#222F43]">
              <span className="block text-[#FFFFFF] font-bold mb-1">3D Surface Generator:</span>
              <span className="text-[#14B8A6]">scikit-image Marching Cubes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
