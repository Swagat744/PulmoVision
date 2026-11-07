import React, { useEffect, useState } from 'react';
import {
  Activity,
  Box,
  Eye,
  EyeOff,
  Layers,
  RotateCcw,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { MPRViewport2D } from '../viewer/MPRViewport2D';
import { AnatomicalViewer3D } from '../viewer3d/AnatomicalViewer3D';
import { apiClient } from '../../api/client';
import { LabelMeta, MPRPlane } from '../../types/api';

const DEFAULT_LABEL_MAP: Record<string, LabelMeta> = {
  '1': {
    key: 'right_lung',
    name: 'Right Lung',
    color: '#14B8A6',
  },
  '2': {
    key: 'left_lung',
    name: 'Left Lung',
    color: '#38BDF8',
  },
};

export const WorkstationShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'4panel' | '3d' | 'volumetrics'>('4panel');

  // Showcase metadata loaded from backend API
  const [showcaseMeta, setShowcaseMeta] = useState<any>(null);
  const [axialIndex, setAxialIndex] = useState<number>(24);
  const [coronalIndex, setCoronalIndex] = useState<number>(128);
  const [sagittalIndex, setSagittalIndex] = useState<number>(128);

  const [windowWidth, setWindowWidth] = useState<number>(1500);
  const [windowCenter, setWindowCenter] = useState<number>(-600);
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.58);
  const [showCrosshairs, setShowCrosshairs] = useState<boolean>(true);
  const [crosshairNorm, setCrosshairNorm] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const [visibleLabels, setVisibleLabels] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
  });
  const [resetSignal, setResetSignal] = useState<number>(0);

  // Fetch showcase scan and result metadata from backend
  useEffect(() => {
    let cancelled = false;
    apiClient
      .fetchShowcaseInfo()
      .then((data) => {
        if (!cancelled && data) {
          setShowcaseMeta(data);
          const dims = data.dimensions || data.scan?.dimensions;
          if (dims) {
            setAxialIndex(Math.floor(dims.z / 2));
            setCoronalIndex(Math.floor(dims.y / 2));
            setSagittalIndex(Math.floor(dims.x / 2));
          }
        }
      })
      .catch(() => {
        // Defaults already safely seeded
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dimX = showcaseMeta?.dimensions?.x ?? showcaseMeta?.scan?.dimensions?.x ?? 256;
  const dimY = showcaseMeta?.dimensions?.y ?? showcaseMeta?.scan?.dimensions?.y ?? 256;
  const dimZ = showcaseMeta?.dimensions?.z ?? showcaseMeta?.scan?.dimensions?.z ?? 48;
  const labelMap: Record<string, LabelMeta> =
    showcaseMeta?.result?.label_map ?? DEFAULT_LABEL_MAP;

  const handleCrosshairMove = (normX: number, normY: number, sourcePlane: MPRPlane) => {
    setCrosshairNorm({ x: normX, y: normY });
    if (sourcePlane === 'axial') {
      setSagittalIndex(Math.min(dimX - 1, Math.max(0, Math.floor(normX * dimX))));
      setCoronalIndex(Math.min(dimY - 1, Math.max(0, Math.floor(normY * dimY))));
    } else if (sourcePlane === 'coronal') {
      setSagittalIndex(Math.min(dimX - 1, Math.max(0, Math.floor(normX * dimX))));
      setAxialIndex(Math.min(dimZ - 1, Math.max(0, Math.floor((1 - normY) * dimZ))));
    } else if (sourcePlane === 'sagittal') {
      setCoronalIndex(Math.min(dimY - 1, Math.max(0, Math.floor(normX * dimY))));
      setAxialIndex(Math.min(dimZ - 1, Math.max(0, Math.floor((1 - normY) * dimZ))));
    }
  };

  const handleReset = () => {
    setAxialIndex(Math.floor(dimZ / 2));
    setCoronalIndex(Math.floor(dimY / 2));
    setSagittalIndex(Math.floor(dimX / 2));
    setWindowWidth(1500);
    setWindowCenter(-600);
    setCrosshairNorm({ x: 0.5, y: 0.5 });
    setResetSignal((prev) => prev + 1);
  };

  return (
    <section id="imaging" className="relative py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto select-none">
      {/* Header */}
      <div className="max-w-3xl mb-10">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#18212D] border border-[#263445] text-[11px] font-mono text-[#38BDF8] tracking-wider uppercase mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />
          Interactive Research Workstation
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#E5EDF5]">
          Live Multi-Planar Reconstruction & 3D Analytics.
        </h2>
        <p className="mt-3 text-sm sm:text-base text-[#94A3B8] leading-relaxed">
          Interact directly with the live GPU/Canvas pipeline: stream calibrated Int16 CT voxel slices, evaluate AI bilateral lung segmentation masks, and inspect the continuous Marching Cubes 3D surface model in real time.
        </p>
      </div>

      {/* Feature Switcher Tabs & Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('4panel')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === '4panel'
                ? 'bg-[#0D9488] text-white shadow-sm'
                : 'bg-[#18212D] text-[#94A3B8] hover:text-[#E5EDF5] border border-[#263445]'
            }`}
          >
            4-Panel Synchronized MPR
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('3d')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === '3d'
                ? 'bg-[#0D9488] text-white shadow-sm'
                : 'bg-[#18212D] text-[#94A3B8] hover:text-[#E5EDF5] border border-[#263445]'
            }`}
          >
            3D Marching Cubes Mesh
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('volumetrics')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
              activeTab === 'volumetrics'
                ? 'bg-[#0D9488] text-white shadow-sm'
                : 'bg-[#18212D] text-[#94A3B8] hover:text-[#E5EDF5] border border-[#263445]'
            }`}
          >
            Quantitative Volumetrics & HU
          </button>
        </div>

        {/* Live Workstation Quick Controls */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <button
            type="button"
            onClick={() => setShowOverlay(!showOverlay)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition ${
              showOverlay
                ? 'bg-[#0D9488]/20 text-[#14B8A6] border-[#0D9488]/50'
                : 'bg-[#18212D] text-[#94A3B8] border-[#263445] hover:text-[#E5EDF5]'
            }`}
            title="Toggle AI Segmentation Mask Overlay"
          >
            {showOverlay ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>AI Mask {showOverlay ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCrosshairs(!showCrosshairs)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition ${
              showCrosshairs
                ? 'bg-[#38BDF8]/20 text-[#38BDF8] border-[#38BDF8]/50'
                : 'bg-[#18212D] text-[#94A3B8] border-[#263445] hover:text-[#E5EDF5]'
            }`}
            title="Toggle Synchronized Crosshairs"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Crosshairs</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#18212D] text-[#94A3B8] hover:text-[#E5EDF5] border border-[#263445] transition"
            title="Reset Slices & Windowing"
          >
            <RotateCcw className="w-3 h-3" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* Workstation Frame Preview */}
      <div className="rounded-2xl border border-[#263445] bg-[#080B10] overflow-hidden shadow-2xl">
        {/* Top Telemetry Toolbar */}
        <div className="px-4 py-2.5 bg-[#111722] border-b border-[#263445] flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-[#38BDF8]">BENCH-THORAX-01</span>
            <span className="text-[#94A3B8]">/</span>
            <span className="text-[#E5EDF5] font-mono text-[11px]">chest_ct_volume.nii.gz</span>
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#18212D] text-[#94A3B8] border border-[#263445]">
              {dimX}×{dimY}×{dimZ} · 1.25×1.25×5.00 mm
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0D9488]/20 text-[#14B8A6] border border-[#0D9488]/40 font-bold">
              STREAMING LIVE
            </span>
            <span className="text-[10px] font-mono text-[#94A3B8] hidden md:inline">
              WL: {windowCenter} / WW: {windowWidth} (Lung Parenchyma)
            </span>
          </div>
        </div>

        {/* Workstation Stage Display */}
        <div className="p-2 sm:p-3 bg-[#04070B] min-h-[580px] h-[640px] flex items-center justify-center">
          {activeTab === '4panel' && (
            <div className="grid grid-cols-1 md:grid-cols-2 grid-rows-2 gap-2 w-full h-full">
              {/* Axial View */}
              <div className="w-full h-full overflow-hidden">
                <MPRViewport2D
                  scanId="showcase_scan"
                  resultId={showOverlay ? 'showcase_result' : null}
                  plane="axial"
                  sliceIndex={axialIndex}
                  maxSliceIndex={dimZ - 1}
                  onSliceChange={setAxialIndex}
                  windowWidth={windowWidth}
                  windowCenter={windowCenter}
                  onWindowLevelChange={(w, c) => {
                    setWindowWidth(w);
                    setWindowCenter(c);
                  }}
                  overlayOpacity={overlayOpacity}
                  showOverlay={showOverlay}
                  visibleLabels={visibleLabels}
                  labelMap={labelMap}
                  showCrosshairs={showCrosshairs}
                  crosshairNormX={crosshairNorm.x}
                  crosshairNormY={crosshairNorm.y}
                  onCrosshairMove={(x, y) => handleCrosshairMove(x, y, 'axial')}
                  resetSignal={resetSignal}
                />
              </div>

              {/* Coronal View */}
              <div className="w-full h-full overflow-hidden">
                <MPRViewport2D
                  scanId="showcase_scan"
                  resultId={showOverlay ? 'showcase_result' : null}
                  plane="coronal"
                  sliceIndex={coronalIndex}
                  maxSliceIndex={dimY - 1}
                  onSliceChange={setCoronalIndex}
                  windowWidth={windowWidth}
                  windowCenter={windowCenter}
                  onWindowLevelChange={(w, c) => {
                    setWindowWidth(w);
                    setWindowCenter(c);
                  }}
                  overlayOpacity={overlayOpacity}
                  showOverlay={showOverlay}
                  visibleLabels={visibleLabels}
                  labelMap={labelMap}
                  showCrosshairs={showCrosshairs}
                  crosshairNormX={crosshairNorm.x}
                  crosshairNormY={crosshairNorm.y}
                  onCrosshairMove={(x, y) => handleCrosshairMove(x, y, 'coronal')}
                  resetSignal={resetSignal}
                />
              </div>

              {/* Sagittal View */}
              <div className="w-full h-full overflow-hidden">
                <MPRViewport2D
                  scanId="showcase_scan"
                  resultId={showOverlay ? 'showcase_result' : null}
                  plane="sagittal"
                  sliceIndex={sagittalIndex}
                  maxSliceIndex={dimX - 1}
                  onSliceChange={setSagittalIndex}
                  windowWidth={windowWidth}
                  windowCenter={windowCenter}
                  onWindowLevelChange={(w, c) => {
                    setWindowWidth(w);
                    setWindowCenter(c);
                  }}
                  overlayOpacity={overlayOpacity}
                  showOverlay={showOverlay}
                  visibleLabels={visibleLabels}
                  labelMap={labelMap}
                  showCrosshairs={showCrosshairs}
                  crosshairNormX={crosshairNorm.x}
                  crosshairNormY={crosshairNorm.y}
                  onCrosshairMove={(x, y) => handleCrosshairMove(x, y, 'sagittal')}
                  resetSignal={resetSignal}
                />
              </div>

              {/* 3D Surface Mesh Viewport */}
              <div className="w-full h-full overflow-hidden">
                <AnatomicalViewer3D
                  resultId="showcase_result"
                  visibleLabels={visibleLabels}
                  overlayOpacity={overlayOpacity}
                  resetSignal={resetSignal}
                />
              </div>
            </div>
          )}

          {activeTab === '3d' && (
            <div className="w-full h-full rounded-lg bg-[#000000] border border-[#263445] p-2 flex flex-col justify-between overflow-hidden">
              <div className="flex-1 w-full h-[520px]">
                <AnatomicalViewer3D
                  resultId="showcase_result"
                  visibleLabels={visibleLabels}
                  overlayOpacity={overlayOpacity}
                  resetSignal={resetSignal}
                />
              </div>
              <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8] border-t border-[#263445] px-4 py-2 bg-[#080B10]">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#14B8A6]" />
                    Right Lung: 2,420 mL
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-[#38BDF8]" />
                    Left Lung: 2,180 mL
                  </span>
                </div>
                <span>Total Pulmonary Volume: 4,600 mL (4.60 L)</span>
              </div>
            </div>
          )}

          {activeTab === 'volumetrics' && (
            <div className="w-full h-full rounded-lg bg-[#000000] border border-[#263445] p-6 flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-bold text-[#E5EDF5] mb-1">Parenchymal Quantitative Analysis</h4>
                <p className="text-xs text-[#94A3B8]">
                  Automated morphometric summary derived from whole-lung continuous integration
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-auto">
                <div className="p-4 rounded-xl bg-[#111722] border border-[#263445]">
                  <span className="text-[11px] font-mono text-[#94A3B8] block mb-1">TOTAL LUNG VOLUME</span>
                  <span className="text-2xl font-bold font-mono text-[#14B8A6]">4,600.4 mL</span>
                  <span className="text-xs text-[#94A3B8] block mt-1">4.60 Liters (100%)</span>
                </div>
                <div className="p-4 rounded-xl bg-[#111722] border border-[#263445]">
                  <span className="text-[11px] font-mono text-[#94A3B8] block mb-1">RIGHT LUNG VOLUME</span>
                  <span className="text-2xl font-bold font-mono text-[#14B8A6]">2,420.2 mL</span>
                  <span className="text-xs text-[#94A3B8] block mt-1">52.6% of Total Lung</span>
                </div>
                <div className="p-4 rounded-xl bg-[#111722] border border-[#263445]">
                  <span className="text-[11px] font-mono text-[#94A3B8] block mb-1">LEFT LUNG VOLUME</span>
                  <span className="text-2xl font-bold font-mono text-[#38BDF8]">2,180.2 mL</span>
                  <span className="text-xs text-[#94A3B8] block mt-1">47.4% of Total Lung</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[#111722] border border-[#263445] flex items-center justify-between text-xs font-mono">
                <span className="text-[#94A3B8]">Mean Attenuation: <strong className="text-[#E5EDF5]">-684.4 HU</strong></span>
                <span className="text-[#94A3B8]">Standard Deviation: <strong className="text-[#E5EDF5]">±142.1 HU</strong></span>
                <span className="text-[#94A3B8]">Density Range: <strong className="text-[#E5EDF5]">-1,024 to +673 HU</strong></span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
