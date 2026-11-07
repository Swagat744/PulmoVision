import React, { useEffect, useState } from 'react';
import {
  Activity,
  Box,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Compass,
  Crosshair,
  Download,
  Eraser,
  Eye,
  EyeOff,
  FileText,
  FlipHorizontal,
  FlipVertical,
  Hand,
  HardDrive,
  Info,
  Layers,
  Maximize2,
  PenTool,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Ruler,
  Sliders,
  Sparkles,
  SplitSquareVertical,
  Square,
  Type,
  Wand2,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  LabelMeta,
  ModelVersionDTO,
  MPRPlane,
  ScanMetadataDTO,
  SegmentationJobStatusDTO,
  SegmentationResultDTO,
  StudyDTO,
} from '../../types/api';
import { MPRViewport2D, ViewportMeasurementItem, WorkstationTool } from '../viewer/MPRViewport2D';
import { AnatomicalViewer3D } from '../viewer3d/AnatomicalViewer3D';
import { CollapsibleSection, StatusBadge } from '../ui/Primitives';
import { extractMorphometrySummary, resolveStructureColor } from '../../utils/segmentationColors';

export type WorkspaceLayout =
  | '4_panel'
  | '3_mpr'
  | 'split_2d_3d'
  | 'side_by_side'
  | 'single_axial';

const WINDOW_LEVEL_PRESETS = [
  { name: 'Lung Parenchyma', ww: 1500, wc: -600 },
  { name: 'Mediastinum', ww: 350, wc: 40 },
  { name: 'Thoracic Bone', ww: 2000, wc: 500 },
  { name: 'Soft Tissue', ww: 400, wc: 50 },
];

interface RadiologyWorkspaceProps {
  study: StudyDTO | null;
  scan: ScanMetadataDTO | null;
  results: SegmentationResultDTO[];
  selectedResult: SegmentationResultDTO | null;
  onSelectResult: (r: SegmentationResultDTO) => void;
  models: ModelVersionDTO[];
  selectedModelKey: string;
  setSelectedModelKey: (k: string) => void;
  batchSize: number;
  setBatchSize: (b: number) => void;
  onStartSegmentation: () => Promise<void>;
  activeJob: SegmentationJobStatusDTO | null;
  onDownloadMask: () => void;
  onDownloadReport: () => void;
  onDownloadMetrics: () => void;
  onSelectScan: (scan: ScanMetadataDTO) => void;
  onOpenSampleModal: () => void;
  onOpenUploadModal: () => void;
}

export const RadiologyWorkspace: React.FC<RadiologyWorkspaceProps> = ({
  study,
  scan,
  results,
  selectedResult,
  onSelectResult,
  models,
  selectedModelKey,
  setSelectedModelKey,
  batchSize,
  setBatchSize,
  onStartSegmentation,
  activeJob,
  onDownloadMask,
  onDownloadReport,
  onDownloadMetrics,
  onSelectScan,
  onOpenSampleModal,
  onOpenUploadModal,
}) => {
  // Layout & View Mode
  const [layout, setLayout] = useState<WorkspaceLayout>('4_panel');
  const [bottomPanelExpanded, setBottomPanelExpanded] = useState<boolean>(true);
  const [mobileActivePlane, setMobileActivePlane] = useState<'axial' | 'coronal' | 'sagittal' | '3d'>('axial');
  const [mobileInfoDrawerOpen, setMobileInfoDrawerOpen] = useState<boolean>(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState<boolean>(false);

  // Active Tool & Transforms
  const [activeTool, setActiveTool] = useState<WorkstationTool>('crosshair');
  const [rotationDeg, setRotationDeg] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [contrastMultiplier, setContrastMultiplier] = useState<number>(1.0);
  const [brightnessOffset, setBrightnessOffset] = useState<number>(0);
  const [resetSignal, setResetSignal] = useState<number>(0);

  // MPR Slice Navigation & Crosshairs
  const [axialIndex, setAxialIndex] = useState<number>(scan ? Math.floor(scan.dimensions.z / 2) : 0);
  const [coronalIndex, setCoronalIndex] = useState<number>(scan ? Math.floor(scan.dimensions.y / 2) : 0);
  const [sagittalIndex, setSagittalIndex] = useState<number>(scan ? Math.floor(scan.dimensions.x / 2) : 0);
  const [windowWidth, setWindowWidth] = useState<number>(1500);
  const [windowCenter, setWindowCenter] = useState<number>(-600);
  const [showCrosshairs, setShowCrosshairs] = useState<boolean>(true);
  const [crosshairNorm, setCrosshairNorm] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });

  // Segmentation Overlays
  const [showOverlay, setShowOverlay] = useState<boolean>(true);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.58);
  const [visibleLabels, setVisibleLabels] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
  });

  // Active 2D Measurements Cache
  const [measurements, setMeasurements] = useState<ViewportMeasurementItem[]>([]);

  // Synchronize slice indices to volume midpoints whenever scan loads or switches
  useEffect(() => {
    if (scan && scan.dimensions) {
      setAxialIndex(Math.floor(scan.dimensions.z / 2));
      setCoronalIndex(Math.floor(scan.dimensions.y / 2));
      setSagittalIndex(Math.floor(scan.dimensions.x / 2));
    }
  }, [scan?.id, scan?.dimensions.z, scan?.dimensions.y, scan?.dimensions.x]);

  // Reset View Handler
  const handleResetView = () => {
    if (scan) {
      setAxialIndex(Math.floor(scan.dimensions.z / 2));
      setCoronalIndex(Math.floor(scan.dimensions.y / 2));
      setSagittalIndex(Math.floor(scan.dimensions.x / 2));
    }
    setWindowWidth(1500);
    setWindowCenter(-600);
    setRotationDeg(0);
    setFlipH(false);
    setFlipV(false);
    setContrastMultiplier(1.0);
    setBrightnessOffset(0);
    setCrosshairNorm({ x: 0.5, y: 0.5 });
    setResetSignal((prev) => prev + 1);
  };

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Crosshair move handler
  const handleCrosshairMove = (normX: number, normY: number, sourcePlane: MPRPlane) => {
    if (!scan) return;
    setCrosshairNorm({ x: normX, y: normY });
    if (sourcePlane === 'axial') {
      const newSagittal = Math.min(
        scan.dimensions.x - 1,
        Math.max(0, Math.floor(normX * scan.dimensions.x))
      );
      const newCoronal = Math.min(
        scan.dimensions.y - 1,
        Math.max(0, Math.floor(normY * scan.dimensions.y))
      );
      setSagittalIndex(newSagittal);
      setCoronalIndex(newCoronal);
    } else if (sourcePlane === 'coronal') {
      const newSagittal = Math.min(
        scan.dimensions.x - 1,
        Math.max(0, Math.floor(normX * scan.dimensions.x))
      );
      const newAxial = Math.min(
        scan.dimensions.z - 1,
        Math.max(0, Math.floor((1 - normY) * scan.dimensions.z))
      );
      setSagittalIndex(newSagittal);
      setAxialIndex(newAxial);
    } else if (sourcePlane === 'sagittal') {
      const newCoronal = Math.min(
        scan.dimensions.y - 1,
        Math.max(0, Math.floor(normX * scan.dimensions.y))
      );
      const newAxial = Math.min(
        scan.dimensions.z - 1,
        Math.max(0, Math.floor((1 - normY) * scan.dimensions.z))
      );
      setCoronalIndex(newCoronal);
      setAxialIndex(newAxial);
    }
  };

  // Resolve active label map
  const activeModelMeta =
    models.find((m) => m.model_key === (selectedResult?.model_key || selectedModelKey)) ||
    models[0];
  const activeLabelMap: Record<string, LabelMeta> = activeModelMeta?.label_map || {
    '1': { key: 'right_lung', name: 'Right Lung', color: '#14B8A6' },
    '2': { key: 'left_lung', name: 'Left Lung', color: '#38BDF8' },
  };

  const handleToggleLabel = (lbl: number) => {
    setVisibleLabels((prev) => ({
      ...prev,
      [lbl]: prev[lbl] === false ? true : false,
    }));
  };

  // Anatomical landmark jumps
  const jumpToAnatomicalZone = (zone: 'apex' | 'upper' | 'carina' | 'mid' | 'lower' | 'base') => {
    if (!scan) return;
    const maxZ = scan.dimensions.z - 1;
    const ratios = {
      apex: 0.15,
      upper: 0.3,
      carina: 0.45,
      mid: 0.6,
      lower: 0.75,
      base: 0.9,
    };
    setAxialIndex(Math.floor(maxZ * ratios[zone]));
  };

  const morphometry = extractMorphometrySummary(selectedResult?.measurements);

  // If no scan is selected
  if (!scan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] sm:min-h-[600px] bg-[#080B10] text-[#F8FAFC] border border-[#222F43] rounded-2xl p-6 sm:p-10 text-center select-none m-2 sm:m-4">
        <Layers className="w-12 h-12 text-[#38BDF8] mb-3 opacity-80" />
        <h2 className="text-lg font-bold text-[#FFFFFF]">No Thoracic CT Scan Selected</h2>
        <p className="text-xs sm:text-sm text-[#CBD5E1] mt-1 max-w-md">
          Select an active study from the Studies manager, upload a DICOM or NIfTI CT scan, or synthesize a calibrated benchmark phantom.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenSampleModal}
            className="px-4 py-2.5 text-xs font-semibold text-[#080B10] bg-[#14B8A6] hover:bg-[#2DD4BF] rounded-lg transition shadow-md flex items-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Calibrated Phantom</span>
          </button>
          <button
            type="button"
            onClick={onOpenUploadModal}
            className="px-4 py-2.5 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#14B8A6] rounded-lg transition shadow-md flex items-center gap-2 cursor-pointer"
          >
            <HardDrive className="w-4 h-4" />
            <span>Upload Medical Scan</span>
          </button>
        </div>
      </div>
    );
  }

  // Render Left Tool Panel controls
  const renderToolControls = () => (
    <>
      {/* Navigation Tools */}
      <div className="flex lg:flex-col items-center gap-1 pb-1 lg:pb-2 lg:border-b border-[#222F43]">
        <button
          type="button"
          onClick={() => setActiveTool('pan')}
          className={`p-2 rounded-lg transition flex justify-center cursor-pointer min-w-[38px] min-h-[38px] items-center ${
            activeTool === 'pan'
              ? 'bg-[#0D9488] text-white shadow-sm'
              : 'text-[#CBD5E1] hover:bg-[#161F30] hover:text-[#FFFFFF]'
          }`}
          title="Pan Tool"
        >
          <Hand className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('zoom')}
          className={`p-2 rounded-lg transition flex justify-center cursor-pointer min-w-[38px] min-h-[38px] items-center ${
            activeTool === 'zoom'
              ? 'bg-[#0D9488] text-white shadow-sm'
              : 'text-[#CBD5E1] hover:bg-[#161F30] hover:text-[#FFFFFF]'
          }`}
          title="Interactive Zoom"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTool('crosshair');
            setShowCrosshairs((prev) => !prev);
          }}
          className={`p-2 rounded-lg transition flex justify-center cursor-pointer min-w-[38px] min-h-[38px] items-center ${
            activeTool === 'crosshair' && showCrosshairs
              ? 'bg-[#38BDF8] text-[#080B10] font-bold shadow-sm'
              : 'text-[#CBD5E1] hover:bg-[#161F30] hover:text-[#FFFFFF]'
          }`}
          title="Synchronized Orthogonal Crosshairs"
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>

      {/* Image Controls */}
      <div className="flex lg:flex-col items-center gap-1 pb-1 lg:pb-2 lg:border-b border-[#222F43]">
        <button
          type="button"
          onClick={() => setActiveTool('wl')}
          className={`p-2 rounded-lg transition flex justify-center cursor-pointer min-w-[38px] min-h-[38px] items-center ${
            activeTool === 'wl'
              ? 'bg-[#0D9488] text-white shadow-sm'
              : 'text-[#CBD5E1] hover:bg-[#161F30] hover:text-[#FFFFFF]'
          }`}
          title="Drag Window / Level"
        >
          <Sliders className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setContrastMultiplier((c) => Math.min(2.5, c + 0.15))}
          className="px-1.5 py-1 text-[10px] font-mono text-[#CBD5E1] hover:text-[#FFFFFF] hover:bg-[#161F30] rounded cursor-pointer min-w-[32px] text-center"
          title="Increase Contrast"
        >
          C+
        </button>
        <button
          type="button"
          onClick={() => setContrastMultiplier((c) => Math.max(0.4, c - 0.15))}
          className="px-1.5 py-1 text-[10px] font-mono text-[#CBD5E1] hover:text-[#FFFFFF] hover:bg-[#161F30] rounded cursor-pointer min-w-[32px] text-center"
          title="Decrease Contrast"
        >
          C-
        </button>
      </div>

      {/* Transform Controls */}
      <div className="flex lg:flex-col items-center gap-1 pb-1 lg:pb-2 lg:border-b border-[#222F43]">
        <button
          type="button"
          onClick={() => setRotationDeg((r) => (r + 90) % 360)}
          className="p-2 rounded-lg transition flex justify-center cursor-pointer text-[#CBD5E1] hover:bg-[#161F30] hover:text-[#FFFFFF] min-w-[38px] min-h-[38px] items-center"
          title="Rotate 90° Clockwise"
        >
          <RotateCw className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setFlipH((f) => !f)}
          className={`p-2 rounded-lg transition flex justify-center cursor-pointer min-w-[38px] min-h-[38px] items-center ${
            flipH
              ? 'bg-[#0D9488]/30 text-[#14B8A6]'
              : 'text-[#CBD5E1] hover:bg-[#161F30] hover:text-[#FFFFFF]'
          }`}
          title="Flip Horizontal"
        >
          <FlipHorizontal className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setFlipV((f) => !f)}
          className={`p-2 rounded-lg transition flex justify-center cursor-pointer min-w-[38px] min-h-[38px] items-center ${
            flipV
              ? 'bg-[#0D9488]/30 text-[#14B8A6]'
              : 'text-[#CBD5E1] hover:bg-[#161F30] hover:text-[#FFFFFF]'
          }`}
          title="Flip Vertical"
        >
          <FlipVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Measurement Tools */}
      <div className="flex lg:flex-col items-center gap-1 pb-1 lg:pb-2 lg:border-b border-[#222F43]">
        <button
          type="button"
          onClick={() => setActiveTool('ruler')}
          className={`p-2 rounded-lg transition flex justify-center cursor-pointer min-w-[38px] min-h-[38px] items-center ${
            activeTool === 'ruler'
              ? 'bg-[#0D9488] text-white shadow-sm'
              : 'text-[#CBD5E1] hover:bg-[#161F30] hover:text-[#FFFFFF]'
          }`}
          title="Linear Calibrated Ruler (mm)"
        >
          <Ruler className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('angle')}
          className={`p-2 rounded-lg transition flex justify-center cursor-pointer min-w-[38px] min-h-[38px] items-center ${
            activeTool === 'angle'
              ? 'bg-[#0D9488] text-white shadow-sm'
              : 'text-[#CBD5E1] hover:bg-[#161F30] hover:text-[#FFFFFF]'
          }`}
          title="3-Point Angle Tool"
        >
          <Compass className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('roi')}
          className={`p-2 rounded-lg transition flex justify-center cursor-pointer min-w-[38px] min-h-[38px] items-center ${
            activeTool === 'roi'
              ? 'bg-[#0D9488] text-white shadow-sm'
              : 'text-[#CBD5E1] hover:bg-[#161F30] hover:text-[#FFFFFF]'
          }`}
          title="Rectangular ROI Area & Mean HU"
        >
          <Square className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('ellipse')}
          className={`p-2 rounded-lg transition flex justify-center cursor-pointer min-w-[38px] min-h-[38px] items-center ${
            activeTool === 'ellipse'
              ? 'bg-[#0D9488] text-white shadow-sm'
              : 'text-[#CBD5E1] hover:bg-[#161F30] hover:text-[#FFFFFF]'
          }`}
          title="Elliptical ROI Area & Mean HU"
        >
          <CircleDot className="w-4 h-4" />
        </button>
      </div>

      {/* Annotation Tools */}
      <div className="flex lg:flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => setActiveTool('text')}
          className={`p-2 rounded-lg transition flex justify-center cursor-pointer min-w-[38px] min-h-[38px] items-center ${
            activeTool === 'text'
              ? 'bg-[#0D9488] text-white shadow-sm'
              : 'text-[#CBD5E1] hover:bg-[#161F30] hover:text-[#FFFFFF]'
          }`}
          title="Text Annotation Callout"
        >
          <Type className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setActiveTool('draw')}
          className={`p-2 rounded-lg transition flex justify-center cursor-pointer min-w-[38px] min-h-[38px] items-center ${
            activeTool === 'draw'
              ? 'bg-[#0D9488] text-white shadow-sm'
              : 'text-[#CBD5E1] hover:bg-[#161F30] hover:text-[#FFFFFF]'
          }`}
          title="Freehand Drawing Path"
        >
          <PenTool className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTool('erase');
            setMeasurements([]);
          }}
          className={`p-2 rounded-lg transition flex justify-center cursor-pointer min-w-[38px] min-h-[38px] items-center ${
            activeTool === 'erase'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-[#CBD5E1] hover:bg-[#161F30] hover:text-rose-400'
          }`}
          title="Clear 2D Annotations"
        >
          <Eraser className="w-4 h-4" />
        </button>
      </div>
    </>
  );

  // Render Right Info & AI Control Panels content
  const renderInfoPanelContent = () => (
    <div className="flex flex-col text-xs overflow-y-auto ws-scroll">
      {/* Section 1: Study Information */}
      <CollapsibleSection title="Study Information" defaultOpen={true}>
        <div className="space-y-1.5 font-mono text-[11px]">
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Patient Code:</span>
            <span className="font-bold text-[#38BDF8]">{study?.patient_anon_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Protocol Title:</span>
            <span className="text-[#FFFFFF] truncate max-w-[150px]" title={study?.title}>
              {study?.title}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Acquisition Date:</span>
            <span className="text-[#CBD5E1]">
              {study ? new Date(study.created_at).toLocaleDateString() : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Modality:</span>
            <span className="text-[#14B8A6] font-bold">{study?.modality || 'CT'}</span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 2: Scan Metadata */}
      <CollapsibleSection title="Scan Metadata" defaultOpen={true}>
        <div className="space-y-1.5 font-mono text-[11px]">
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Matrix (X×Y×Z):</span>
            <span className="text-[#FFFFFF]">
              {scan.dimensions.x} × {scan.dimensions.y} × {scan.dimensions.z}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Voxel Spacing:</span>
            <span className="text-[#FFFFFF]">
              {scan.spacing_mm.x.toFixed(2)} × {scan.spacing_mm.y.toFixed(2)} × {scan.spacing_mm.z.toFixed(2)} mm
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Coordinate Frame:</span>
            <span className="text-[#14B8A6] font-bold">LPS+ Standard</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#94A3B8]">Oblique Acquisition:</span>
            <span className={scan.is_oblique ? 'text-amber-400 font-bold' : 'text-[#CBD5E1]'}>
              {scan.is_oblique ? 'Yes (Projection Calibrated)' : 'No (Strict Axial)'}
            </span>
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 3: AI Segmentation Controls */}
      <CollapsibleSection title="AI Segmentation Controls" defaultOpen={true}>
        <div className="space-y-3">
          {/* Model Selection */}
          <div>
            <label className="block text-[11px] font-semibold text-[#CBD5E1] mb-1">
              Segmentation Model
            </label>
            <select
              value={selectedModelKey}
              onChange={(e) => setSelectedModelKey(e.target.value)}
              disabled={activeJob?.status === 'QUEUED' || activeJob?.status === 'PROCESSING'}
              className="w-full text-xs bg-[#161F30] border border-[#222F43] text-[#FFFFFF] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#38BDF8]"
            >
              <option value="lungmask_r231">lungmask R231 (Bilateral Whole Lung)</option>
              <option value="lungmask_ltrclobes">lungmask LTRCLobes (5 Anatomical Lobes)</option>
            </select>
          </div>

          {/* Batch Size Slider */}
          <div>
            <div className="flex justify-between text-[11px] text-[#CBD5E1] mb-0.5">
              <span>Batch Size:</span>
              <span className="font-mono text-[#38BDF8]">{batchSize} slices/batch</span>
            </div>
            <input
              type="range"
              min={1}
              max={8}
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value, 10))}
              className="w-full accent-[#0D9488]"
            />
          </div>

          {/* Run Segmentation Button */}
          <button
            type="button"
            onClick={onStartSegmentation}
            disabled={activeJob?.status === 'QUEUED' || activeJob?.status === 'PROCESSING'}
            className="w-full py-2.5 px-3 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#14B8A6] rounded-lg transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            {activeJob?.status === 'QUEUED' || activeJob?.status === 'PROCESSING' ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Inference In Progress...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Run AI Segmentation</span>
              </>
            )}
          </button>

          {/* Active Job Progress Bar */}
          {activeJob && (activeJob.status === 'QUEUED' || activeJob.status === 'PROCESSING') && (
            <div className="p-2.5 rounded-lg bg-[#161F30] border border-[#222F43] space-y-1.5">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-[#38BDF8] flex items-center gap-1 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-ping" />
                  {activeJob.status}
                </span>
                <span className="text-[#CBD5E1]">{activeJob.progress_percent}%</span>
              </div>
              <div className="w-full bg-[#080B10] rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-[#0D9488] to-[#38BDF8] h-full transition-all duration-300"
                  style={{ width: `${Math.max(5, activeJob.progress_percent)}%` }}
                />
              </div>
              <p className="text-[10px] text-[#94A3B8] font-mono truncate">
                {activeJob.current_stage || 'Processing 2D U-Net forward pass...'}
              </p>
            </div>
          )}

          {/* Mask Display & Opacity */}
          <div className="pt-2 border-t border-[#222F43] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#CBD5E1]">Show Overlay:</span>
              <button
                type="button"
                onClick={() => setShowOverlay((o) => !o)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono transition cursor-pointer ${
                  showOverlay
                    ? 'bg-[#0D9488]/20 text-[#14B8A6] border border-[#0D9488]/40'
                    : 'bg-[#161F30] text-[#94A3B8] border border-[#222F43]'
                }`}
              >
                {showOverlay ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                <span>{showOverlay ? 'VISIBLE' : 'HIDDEN'}</span>
              </button>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-[#CBD5E1] mb-0.5">
                <span>Overlay Opacity:</span>
                <span className="font-mono text-[#38BDF8]">{Math.round(overlayOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0.05}
                max={1.0}
                step={0.05}
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                className="w-full accent-[#0D9488]"
              />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 4: Anatomical Labels */}
      <CollapsibleSection title="Anatomical Labels & Visibility" defaultOpen={true}>
        <div className="space-y-1.5">
          {Object.entries(activeLabelMap).map(([lblStr, meta]) => {
            const lbl = parseInt(lblStr, 10);
            const isVis = visibleLabels[lbl] !== false;
            const canonicalHex = resolveStructureColor(meta.key, meta.color);

            return (
              <div
                key={lbl}
                className="flex items-center justify-between p-2 rounded-lg bg-[#161F30] border border-[#222F43] text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded inline-block border border-white/20 shrink-0"
                    style={{ backgroundColor: canonicalHex }}
                  />
                  <span className="text-[#FFFFFF] font-medium">{meta.name}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleLabel(lbl)}
                  className={`p-1 rounded transition cursor-pointer ${
                    isVis
                      ? 'text-[#38BDF8] hover:bg-[#222F43]'
                      : 'text-[#94A3B8] hover:bg-[#222F43]'
                  }`}
                  title={isVis ? 'Hide Structure' : 'Show Structure'}
                >
                  {isVis ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      </CollapsibleSection>

      {/* Section 5: Measurements & Volumetrics */}
      <CollapsibleSection title="Quantitative Measurements" defaultOpen={true}>
        <div className="space-y-2">
          {selectedResult ? (
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between p-2 rounded bg-[#161F30]">
                <span className="text-[#CBD5E1]">Total Lung Volume:</span>
                <span className="font-bold text-[#14B8A6]">
                  {morphometry.total_lung_volume_ml.toFixed(1)} mL (
                  {(morphometry.total_lung_volume_ml / 1000).toFixed(2)} L)
                </span>
              </div>

              <div className="flex justify-between px-2 text-[10px]">
                <span className="text-[#94A3B8]">Right Lung:</span>
                <span className="text-[#FFFFFF]">
                  {morphometry.right_lung_volume_ml.toFixed(1)} mL
                </span>
              </div>

              <div className="flex justify-between px-2 text-[10px]">
                <span className="text-[#94A3B8]">Left Lung:</span>
                <span className="text-[#FFFFFF]">
                  {morphometry.left_lung_volume_ml.toFixed(1)} mL
                </span>
              </div>

              {morphometry.lobes &&
                Object.entries(morphometry.lobes).map(([k, v]) => (
                  <div key={k} className="flex justify-between px-2 text-[10px] text-[#94A3B8]">
                    <span className="capitalize">{k.replace('_', ' ')}:</span>
                    <span className="text-[#CBD5E1]">{Number(v).toFixed(1)} mL</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-[11px] text-[#94A3B8] italic">
              Run AI Segmentation to calculate 3D volume measurements.
            </p>
          )}

          {/* 2D Calibrated Viewport Measurements */}
          {measurements.length > 0 && (
            <div className="pt-2 border-t border-[#222F43] space-y-1">
              <span className="text-[10px] font-semibold text-[#38BDF8] uppercase tracking-wider block">
                Active 2D Measurements ({measurements.length})
              </span>
              {measurements.map((m) => (
                <div
                  key={m.id}
                  className="p-1.5 rounded bg-[#161F30] text-[10px] font-mono text-[#FFFFFF] flex justify-between"
                >
                  <span className="capitalize text-[#94A3B8]">{m.kind}:</span>
                  <span className="text-[#38BDF8] font-bold">{m.details || m.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 6: HU Statistics */}
      <CollapsibleSection title="Hounsfield Unit (HU) Statistics" defaultOpen={false}>
        {selectedResult ? (
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Mean Parenchyma HU:</span>
              <span className="text-[#FFFFFF]">
                {morphometry.attenuation_profile.mean_hu.toFixed(1)} HU
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">HU Standard Deviation:</span>
              <span className="text-[#FFFFFF]">
                ±{morphometry.attenuation_profile.std_hu.toFixed(1)} HU
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Min / Max Attenuation:</span>
              <span className="text-[#FFFFFF]">
                {morphometry.attenuation_profile.min_hu} to{' '}
                {morphometry.attenuation_profile.max_hu} HU
              </span>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-[#94A3B8] italic">
            Awaiting segmentation for HU histogram extraction.
          </p>
        )}
      </CollapsibleSection>

      {/* Section 7: Model Provenance Information */}
      <CollapsibleSection title="AI Model Provenance" defaultOpen={false}>
        <div className="space-y-1.5 text-[11px] text-[#CBD5E1] leading-relaxed">
          <div>
            <strong className="text-[#FFFFFF] block">{activeModelMeta?.display_name || activeModelMeta?.model_key}</strong>
            <span className="text-[#38BDF8] font-mono">{activeModelMeta?.architecture}</span>
          </div>
          <p className="text-[10px]">{activeModelMeta?.description}</p>
          {activeModelMeta?.citation_doi && (
            <div className="pt-1">
              <span className="block text-[10px] text-[#94A3B8]">Citation DOI:</span>
              <a
                href={activeModelMeta.citation_doi}
                target="_blank"
                rel="noreferrer"
                className="text-[#38BDF8] hover:underline text-[10px] font-mono break-all"
              >
                {activeModelMeta.citation_doi}
              </a>
            </div>
          )}
        </div>
      </CollapsibleSection>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-125px)] min-h-[580px] bg-[#080B10] text-[#F8FAFC] border border-[#222F43] rounded-2xl overflow-hidden select-none">
      {/* =========================================================================
          1. TOP RADIOLOGY TOOLBAR
      ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between px-3 sm:px-4 py-2 bg-[#0F1523] border-b border-[#222F43] text-xs gap-2 shrink-0">
        {/* Left: Study info badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-[#38BDF8] text-xs sm:text-sm tracking-wide">
              {study?.patient_anon_id || 'PV-UNKNOWN'}
            </span>
            <span className="text-[#94A3B8]">/</span>
            <span className="text-[#FFFFFF] font-medium truncate max-w-[140px] sm:max-w-[200px]" title={scan.original_filename}>
              {scan.original_filename}
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 font-mono text-[10px] sm:text-[11px] text-[#CBD5E1]">
            <span className="bg-[#161F30] px-1.5 py-0.5 rounded border border-[#222F43]">
              {scan.dimensions.x}×{scan.dimensions.y}×{scan.dimensions.z}
            </span>
            <span className="bg-[#161F30] px-1.5 py-0.5 rounded border border-[#222F43]">
              {scan.spacing_mm.x.toFixed(2)}×{scan.spacing_mm.y.toFixed(2)}×{scan.spacing_mm.z.toFixed(2)} mm
            </span>
            {scan.is_oblique && (
              <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/40 text-[10px]">
                OBLIQUE
              </span>
            )}
          </div>
        </div>

        {/* Center: Layout Selection & W/L Presets (Desktop) */}
        <div className="hidden lg:flex items-center gap-2">
          {/* Layout Selector */}
          <div className="flex items-center bg-[#161F30] rounded-lg border border-[#222F43] p-0.5">
            <button
              type="button"
              onClick={() => setLayout('4_panel')}
              className={`px-2 py-1 text-[11px] font-mono rounded-md transition cursor-pointer ${
                layout === '4_panel'
                  ? 'bg-[#0D9488] text-white font-bold'
                  : 'text-[#CBD5E1] hover:text-[#FFFFFF]'
              }`}
              title="4-Panel Synchronized MPR + 3D Reconstruction"
            >
              4-PANEL
            </button>
            <button
              type="button"
              onClick={() => setLayout('3_mpr')}
              className={`px-2 py-1 text-[11px] font-mono rounded-md transition cursor-pointer ${
                layout === '3_mpr'
                  ? 'bg-[#0D9488] text-white font-bold'
                  : 'text-[#CBD5E1] hover:text-[#FFFFFF]'
              }`}
              title="3-Plane MPR (Axial / Coronal / Sagittal)"
            >
              3-MPR
            </button>
            <button
              type="button"
              onClick={() => setLayout('split_2d_3d')}
              className={`px-2 py-1 text-[11px] font-mono rounded-md transition cursor-pointer ${
                layout === 'split_2d_3d'
                  ? 'bg-[#0D9488] text-white font-bold'
                  : 'text-[#CBD5E1] hover:text-[#FFFFFF]'
              }`}
              title="2D Axial / 3D Split View"
            >
              2D/3D
            </button>
            <button
              type="button"
              onClick={() => setLayout('side_by_side')}
              className={`px-2 py-1 text-[11px] font-mono rounded-md transition cursor-pointer ${
                layout === 'side_by_side'
                  ? 'bg-[#0D9488] text-white font-bold'
                  : 'text-[#CBD5E1] hover:text-[#FFFFFF]'
              }`}
              title="Side-by-Side (Original CT vs AI Lung Mask)"
            >
              COMPARE
            </button>
            <button
              type="button"
              onClick={() => setLayout('single_axial')}
              className={`px-2 py-1 text-[11px] font-mono rounded-md transition cursor-pointer ${
                layout === 'single_axial'
                  ? 'bg-[#0D9488] text-white font-bold'
                  : 'text-[#CBD5E1] hover:text-[#FFFFFF]'
              }`}
              title="Maximized Axial Viewport"
            >
              AXIAL
            </button>
          </div>

          {/* Window / Level Presets Dropdown */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-[#94A3B8] hidden xl:inline">W/L:</span>
            <select
              value={`${windowWidth}_${windowCenter}`}
              onChange={(e) => {
                const [w, c] = e.target.value.split('_').map(Number);
                setWindowWidth(w);
                setWindowCenter(c);
              }}
              className="text-[11px] font-mono bg-[#161F30] border border-[#222F43] text-[#FFFFFF] rounded-lg px-2 py-1 focus:outline-none focus:border-[#38BDF8]"
            >
              {WINDOW_LEVEL_PRESETS.map((p) => (
                <option key={p.name} value={`${p.ww}_${p.wc}`}>
                  {p.name} (W:{p.ww} C:{p.wc})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mobile Viewport Tabs Switcher (< 1024px) */}
        <div className="flex lg:hidden items-center bg-[#161F30] rounded-lg border border-[#222F43] p-0.5 text-xs font-medium">
          {(['axial', 'coronal', 'sagittal', '3d'] as const).map((plane) => (
            <button
              key={plane}
              type="button"
              onClick={() => setMobileActivePlane(plane)}
              className={`px-2 py-1 rounded capitalize font-mono text-[11px] transition ${
                mobileActivePlane === plane
                  ? 'bg-[#0D9488] text-white font-bold shadow-sm'
                  : 'text-[#CBD5E1] hover:text-[#FFFFFF]'
              }`}
            >
              {plane === '3d' ? '3D' : plane.slice(0, 3)}
            </button>
          ))}
        </div>

        {/* Right: Reset View, Export & Drawer Toggles */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleResetView}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-[#161F30] text-[#CBD5E1] hover:text-[#FFFFFF] border border-[#222F43] hover:border-[#38BDF8] rounded-md transition cursor-pointer"
            title="Reset Pan, Zoom, Transformations & Window/Level"
          >
            <RotateCcw className="w-3 h-3 text-[#38BDF8]" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-[#161F30] text-[#FFFFFF] border border-[#222F43] hover:border-[#0D9488] rounded-md transition cursor-pointer"
            >
              <Download className="w-3 h-3 text-[#14B8A6]" />
              <span className="hidden sm:inline">Export</span>
              <ChevronDown className="w-3 h-3 text-[#94A3B8]" />
            </button>
            <div className="absolute right-0 top-full mt-1 w-44 bg-[#0F1523] border border-[#222F43] rounded-xl shadow-2xl py-1 hidden group-hover:block z-50 text-[11px]">
              <button
                type="button"
                onClick={onDownloadMask}
                disabled={!selectedResult}
                className="w-full px-3 py-1.5 text-left text-[#F8FAFC] hover:bg-[#161F30] flex items-center gap-2 disabled:opacity-40"
              >
                <HardDrive className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>NIfTI Mask (.nii.gz)</span>
              </button>
              <button
                type="button"
                onClick={onDownloadMetrics}
                disabled={!selectedResult}
                className="w-full px-3 py-1.5 text-left text-[#F8FAFC] hover:bg-[#161F30] flex items-center gap-2 disabled:opacity-40"
              >
                <Activity className="w-3.5 h-3.5 text-[#14B8A6]" />
                <span>Volumetry JSON</span>
              </button>
              <button
                type="button"
                onClick={onDownloadReport}
                disabled={!selectedResult}
                className="w-full px-3 py-1.5 text-left text-[#F8FAFC] hover:bg-[#161F30] flex items-center gap-2 disabled:opacity-40"
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>Clinical PDF Report</span>
              </button>
            </div>
          </div>

          {/* Mobile Right Info Drawer Toggle */}
          <button
            type="button"
            onClick={() => setMobileInfoDrawerOpen(true)}
            className="lg:hidden flex items-center gap-1 px-2 py-1 text-[11px] font-medium bg-[#161F30] text-[#38BDF8] border border-[#222F43] rounded-md"
            title="Toggle AI Controls & Metrics"
          >
            <Sliders className="w-3 h-3" />
            <span>AI / Info</span>
          </button>

          <button
            type="button"
            onClick={handleFullscreen}
            className="p-1.5 bg-[#161F30] text-[#CBD5E1] hover:text-[#FFFFFF] border border-[#222F43] rounded-md transition cursor-pointer"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. WORKSTATION MAIN ROW (Left Tool Panel + Center Viewports + Right Info)
      ========================================================================= */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* -------------------------------------------------------------------
            A. LEFT TOOL PANEL (Desktop vertical bar, Mobile horizontal toolbar strip)
        ------------------------------------------------------------------- */}
        <aside className="hidden lg:flex w-12 sm:w-14 bg-[#0F1523] border-r border-[#222F43] flex-col items-center py-2 px-1 gap-2 overflow-y-auto shrink-0 select-none ws-scroll">
          {renderToolControls()}
        </aside>

        {/* -------------------------------------------------------------------
            B. CENTRAL IMAGING AREA (Multi-Viewport Grid on Desktop, Single View on Mobile)
        ------------------------------------------------------------------- */}
        <div className="flex-1 min-w-0 bg-[#000000] p-1 overflow-hidden flex flex-col">
          {/* Mobile Single Viewport (< 1024px) */}
          <div className="block lg:hidden w-full h-full">
            {mobileActivePlane === 'axial' && (
              <MPRViewport2D
                scanId={scan.id}
                resultId={selectedResult?.id || null}
                plane="axial"
                sliceIndex={axialIndex}
                maxSliceIndex={scan.dimensions.z - 1}
                onSliceChange={setAxialIndex}
                windowWidth={windowWidth}
                windowCenter={windowCenter}
                overlayOpacity={overlayOpacity}
                showOverlay={showOverlay}
                showCrosshairs={showCrosshairs}
                crosshairNormX={crosshairNorm.x}
                crosshairNormY={crosshairNorm.y}
                onCrosshairMove={(nx, ny) => handleCrosshairMove(nx, ny, 'axial')}
                visibleLabels={visibleLabels}
                labelMap={activeLabelMap}
                activeTool={activeTool}
                rotationDeg={rotationDeg}
                flipH={flipH}
                flipV={flipV}
                contrastMultiplier={contrastMultiplier}
                brightnessOffset={brightnessOffset}
                annotations={measurements}
                onAddAnnotation={(item) => setMeasurements((prev) => [...prev, item])}
                onClearPlaneAnnotations={() => setMeasurements([])}
                resetSignal={resetSignal}
              />
            )}
            {mobileActivePlane === 'coronal' && (
              <MPRViewport2D
                scanId={scan.id}
                resultId={selectedResult?.id || null}
                plane="coronal"
                sliceIndex={coronalIndex}
                maxSliceIndex={scan.dimensions.y - 1}
                onSliceChange={setCoronalIndex}
                windowWidth={windowWidth}
                windowCenter={windowCenter}
                overlayOpacity={overlayOpacity}
                showOverlay={showOverlay}
                showCrosshairs={showCrosshairs}
                crosshairNormX={crosshairNorm.x}
                crosshairNormY={crosshairNorm.y}
                onCrosshairMove={(nx, ny) => handleCrosshairMove(nx, ny, 'coronal')}
                visibleLabels={visibleLabels}
                labelMap={activeLabelMap}
                activeTool={activeTool}
                rotationDeg={rotationDeg}
                flipH={flipH}
                flipV={flipV}
                contrastMultiplier={contrastMultiplier}
                brightnessOffset={brightnessOffset}
                annotations={measurements}
                onAddAnnotation={(item) => setMeasurements((prev) => [...prev, item])}
                onClearPlaneAnnotations={() => setMeasurements([])}
                resetSignal={resetSignal}
              />
            )}
            {mobileActivePlane === 'sagittal' && (
              <MPRViewport2D
                scanId={scan.id}
                resultId={selectedResult?.id || null}
                plane="sagittal"
                sliceIndex={sagittalIndex}
                maxSliceIndex={scan.dimensions.x - 1}
                onSliceChange={setSagittalIndex}
                windowWidth={windowWidth}
                windowCenter={windowCenter}
                overlayOpacity={overlayOpacity}
                showOverlay={showOverlay}
                showCrosshairs={showCrosshairs}
                crosshairNormX={crosshairNorm.x}
                crosshairNormY={crosshairNorm.y}
                onCrosshairMove={(nx, ny) => handleCrosshairMove(nx, ny, 'sagittal')}
                visibleLabels={visibleLabels}
                labelMap={activeLabelMap}
                activeTool={activeTool}
                rotationDeg={rotationDeg}
                flipH={flipH}
                flipV={flipV}
                contrastMultiplier={contrastMultiplier}
                brightnessOffset={brightnessOffset}
                annotations={measurements}
                onAddAnnotation={(item) => setMeasurements((prev) => [...prev, item])}
                onClearPlaneAnnotations={() => setMeasurements([])}
                resetSignal={resetSignal}
              />
            )}
            {mobileActivePlane === '3d' && (
              <AnatomicalViewer3D
                resultId={selectedResult?.id || null}
                visibleLabels={visibleLabels}
                overlayOpacity={overlayOpacity}
                resetSignal={resetSignal}
              />
            )}
          </div>

          {/* Desktop Multi-Viewport Grid (>= 1024px) */}
          <div className="hidden lg:block w-full h-full">
            {layout === '4_panel' && (
              <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full">
                {/* Top-Left: Axial */}
                <MPRViewport2D
                  scanId={scan.id}
                  resultId={selectedResult?.id || null}
                  plane="axial"
                  sliceIndex={axialIndex}
                  maxSliceIndex={scan.dimensions.z - 1}
                  onSliceChange={setAxialIndex}
                  windowWidth={windowWidth}
                  windowCenter={windowCenter}
                  overlayOpacity={overlayOpacity}
                  showOverlay={showOverlay}
                  showCrosshairs={showCrosshairs}
                  crosshairNormX={crosshairNorm.x}
                  crosshairNormY={crosshairNorm.y}
                  onCrosshairMove={(nx, ny) => handleCrosshairMove(nx, ny, 'axial')}
                  visibleLabels={visibleLabels}
                  labelMap={activeLabelMap}
                  activeTool={activeTool}
                  rotationDeg={rotationDeg}
                  flipH={flipH}
                  flipV={flipV}
                  contrastMultiplier={contrastMultiplier}
                  brightnessOffset={brightnessOffset}
                  annotations={measurements}
                  onAddAnnotation={(item) => setMeasurements((prev) => [...prev, item])}
                  onClearPlaneAnnotations={() => setMeasurements([])}
                  resetSignal={resetSignal}
                />

                {/* Top-Right: Coronal */}
                <MPRViewport2D
                  scanId={scan.id}
                  resultId={selectedResult?.id || null}
                  plane="coronal"
                  sliceIndex={coronalIndex}
                  maxSliceIndex={scan.dimensions.y - 1}
                  onSliceChange={setCoronalIndex}
                  windowWidth={windowWidth}
                  windowCenter={windowCenter}
                  overlayOpacity={overlayOpacity}
                  showOverlay={showOverlay}
                  showCrosshairs={showCrosshairs}
                  crosshairNormX={crosshairNorm.x}
                  crosshairNormY={crosshairNorm.y}
                  onCrosshairMove={(nx, ny) => handleCrosshairMove(nx, ny, 'coronal')}
                  visibleLabels={visibleLabels}
                  labelMap={activeLabelMap}
                  activeTool={activeTool}
                  rotationDeg={rotationDeg}
                  flipH={flipH}
                  flipV={flipV}
                  contrastMultiplier={contrastMultiplier}
                  brightnessOffset={brightnessOffset}
                  annotations={measurements}
                  onAddAnnotation={(item) => setMeasurements((prev) => [...prev, item])}
                  onClearPlaneAnnotations={() => setMeasurements([])}
                  resetSignal={resetSignal}
                />

                {/* Bottom-Left: Sagittal */}
                <MPRViewport2D
                  scanId={scan.id}
                  resultId={selectedResult?.id || null}
                  plane="sagittal"
                  sliceIndex={sagittalIndex}
                  maxSliceIndex={scan.dimensions.x - 1}
                  onSliceChange={setSagittalIndex}
                  windowWidth={windowWidth}
                  windowCenter={windowCenter}
                  overlayOpacity={overlayOpacity}
                  showOverlay={showOverlay}
                  showCrosshairs={showCrosshairs}
                  crosshairNormX={crosshairNorm.x}
                  crosshairNormY={crosshairNorm.y}
                  onCrosshairMove={(nx, ny) => handleCrosshairMove(nx, ny, 'sagittal')}
                  visibleLabels={visibleLabels}
                  labelMap={activeLabelMap}
                  activeTool={activeTool}
                  rotationDeg={rotationDeg}
                  flipH={flipH}
                  flipV={flipV}
                  contrastMultiplier={contrastMultiplier}
                  brightnessOffset={brightnessOffset}
                  annotations={measurements}
                  onAddAnnotation={(item) => setMeasurements((prev) => [...prev, item])}
                  onClearPlaneAnnotations={() => setMeasurements([])}
                  resetSignal={resetSignal}
                />

                {/* Bottom-Right: 3D Anatomical Reconstruction */}
                <AnatomicalViewer3D
                  resultId={selectedResult?.id || null}
                  visibleLabels={visibleLabels}
                  overlayOpacity={overlayOpacity}
                  resetSignal={resetSignal}
                />
              </div>
            )}

            {layout === '3_mpr' && (
              <div className="grid grid-cols-3 gap-1 w-full h-full">
                <MPRViewport2D
                  scanId={scan.id}
                  resultId={selectedResult?.id || null}
                  plane="axial"
                  sliceIndex={axialIndex}
                  maxSliceIndex={scan.dimensions.z - 1}
                  onSliceChange={setAxialIndex}
                  windowWidth={windowWidth}
                  windowCenter={windowCenter}
                  overlayOpacity={overlayOpacity}
                  showOverlay={showOverlay}
                  showCrosshairs={showCrosshairs}
                  crosshairNormX={crosshairNorm.x}
                  crosshairNormY={crosshairNorm.y}
                  onCrosshairMove={(nx, ny) => handleCrosshairMove(nx, ny, 'axial')}
                  visibleLabels={visibleLabels}
                  labelMap={activeLabelMap}
                  activeTool={activeTool}
                  rotationDeg={rotationDeg}
                  flipH={flipH}
                  flipV={flipV}
                  contrastMultiplier={contrastMultiplier}
                  brightnessOffset={brightnessOffset}
                  annotations={measurements}
                  onAddAnnotation={(item) => setMeasurements((prev) => [...prev, item])}
                  onClearPlaneAnnotations={() => setMeasurements([])}
                  resetSignal={resetSignal}
                />
                <MPRViewport2D
                  scanId={scan.id}
                  resultId={selectedResult?.id || null}
                  plane="coronal"
                  sliceIndex={coronalIndex}
                  maxSliceIndex={scan.dimensions.y - 1}
                  onSliceChange={setCoronalIndex}
                  windowWidth={windowWidth}
                  windowCenter={windowCenter}
                  overlayOpacity={overlayOpacity}
                  showOverlay={showOverlay}
                  showCrosshairs={showCrosshairs}
                  crosshairNormX={crosshairNorm.x}
                  crosshairNormY={crosshairNorm.y}
                  onCrosshairMove={(nx, ny) => handleCrosshairMove(nx, ny, 'coronal')}
                  visibleLabels={visibleLabels}
                  labelMap={activeLabelMap}
                  activeTool={activeTool}
                  rotationDeg={rotationDeg}
                  flipH={flipH}
                  flipV={flipV}
                  contrastMultiplier={contrastMultiplier}
                  brightnessOffset={brightnessOffset}
                  annotations={measurements}
                  onAddAnnotation={(item) => setMeasurements((prev) => [...prev, item])}
                  onClearPlaneAnnotations={() => setMeasurements([])}
                  resetSignal={resetSignal}
                />
                <MPRViewport2D
                  scanId={scan.id}
                  resultId={selectedResult?.id || null}
                  plane="sagittal"
                  sliceIndex={sagittalIndex}
                  maxSliceIndex={scan.dimensions.x - 1}
                  onSliceChange={setSagittalIndex}
                  windowWidth={windowWidth}
                  windowCenter={windowCenter}
                  overlayOpacity={overlayOpacity}
                  showOverlay={showOverlay}
                  showCrosshairs={showCrosshairs}
                  crosshairNormX={crosshairNorm.x}
                  crosshairNormY={crosshairNorm.y}
                  onCrosshairMove={(nx, ny) => handleCrosshairMove(nx, ny, 'sagittal')}
                  visibleLabels={visibleLabels}
                  labelMap={activeLabelMap}
                  activeTool={activeTool}
                  rotationDeg={rotationDeg}
                  flipH={flipH}
                  flipV={flipV}
                  contrastMultiplier={contrastMultiplier}
                  brightnessOffset={brightnessOffset}
                  annotations={measurements}
                  onAddAnnotation={(item) => setMeasurements((prev) => [...prev, item])}
                  onClearPlaneAnnotations={() => setMeasurements([])}
                  resetSignal={resetSignal}
                />
              </div>
            )}

            {layout === 'split_2d_3d' && (
              <div className="grid grid-cols-2 gap-1 w-full h-full">
                <MPRViewport2D
                  scanId={scan.id}
                  resultId={selectedResult?.id || null}
                  plane="axial"
                  sliceIndex={axialIndex}
                  maxSliceIndex={scan.dimensions.z - 1}
                  onSliceChange={setAxialIndex}
                  windowWidth={windowWidth}
                  windowCenter={windowCenter}
                  overlayOpacity={overlayOpacity}
                  showOverlay={showOverlay}
                  showCrosshairs={showCrosshairs}
                  crosshairNormX={crosshairNorm.x}
                  crosshairNormY={crosshairNorm.y}
                  onCrosshairMove={(nx, ny) => handleCrosshairMove(nx, ny, 'axial')}
                  visibleLabels={visibleLabels}
                  labelMap={activeLabelMap}
                  activeTool={activeTool}
                  rotationDeg={rotationDeg}
                  flipH={flipH}
                  flipV={flipV}
                  contrastMultiplier={contrastMultiplier}
                  brightnessOffset={brightnessOffset}
                  annotations={measurements}
                  onAddAnnotation={(item) => setMeasurements((prev) => [...prev, item])}
                  onClearPlaneAnnotations={() => setMeasurements([])}
                  resetSignal={resetSignal}
                />
                <AnatomicalViewer3D
                  resultId={selectedResult?.id || null}
                  visibleLabels={visibleLabels}
                  overlayOpacity={overlayOpacity}
                  resetSignal={resetSignal}
                />
              </div>
            )}

            {layout === 'side_by_side' && (
              <div className="grid grid-cols-2 gap-1 w-full h-full">
                <div className="relative h-full flex flex-col">
                  <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded bg-[#0F1523]/90 border border-[#222F43] text-[10px] font-mono text-[#CBD5E1]">
                    ORIGINAL UNMASKED CT
                  </div>
                  <MPRViewport2D
                    scanId={scan.id}
                    resultId={null}
                    plane="axial"
                    sliceIndex={axialIndex}
                    maxSliceIndex={scan.dimensions.z - 1}
                    onSliceChange={setAxialIndex}
                    windowWidth={windowWidth}
                    windowCenter={windowCenter}
                    overlayOpacity={0}
                    showOverlay={false}
                    showCrosshairs={showCrosshairs}
                    crosshairNormX={crosshairNorm.x}
                    crosshairNormY={crosshairNorm.y}
                    onCrosshairMove={(nx, ny) => handleCrosshairMove(nx, ny, 'axial')}
                    visibleLabels={visibleLabels}
                    labelMap={activeLabelMap}
                    activeTool={activeTool}
                    rotationDeg={rotationDeg}
                    flipH={flipH}
                    flipV={flipV}
                    contrastMultiplier={contrastMultiplier}
                    brightnessOffset={brightnessOffset}
                    resetSignal={resetSignal}
                  />
                </div>

                <div className="relative h-full flex flex-col">
                  <div className="absolute top-2 left-2 z-20 px-2 py-0.5 rounded bg-[#0D9488]/30 border border-[#0D9488] text-[10px] font-mono text-[#14B8A6] font-bold">
                    AI SEGMENTATION OVERLAY
                  </div>
                  <MPRViewport2D
                    scanId={scan.id}
                    resultId={selectedResult?.id || null}
                    plane="axial"
                    sliceIndex={axialIndex}
                    maxSliceIndex={scan.dimensions.z - 1}
                    onSliceChange={setAxialIndex}
                    windowWidth={windowWidth}
                    windowCenter={windowCenter}
                    overlayOpacity={overlayOpacity}
                    showOverlay={true}
                    showCrosshairs={showCrosshairs}
                    crosshairNormX={crosshairNorm.x}
                    crosshairNormY={crosshairNorm.y}
                    onCrosshairMove={(nx, ny) => handleCrosshairMove(nx, ny, 'axial')}
                    visibleLabels={visibleLabels}
                    labelMap={activeLabelMap}
                    activeTool={activeTool}
                    rotationDeg={rotationDeg}
                    flipH={flipH}
                    flipV={flipV}
                    contrastMultiplier={contrastMultiplier}
                    brightnessOffset={brightnessOffset}
                    annotations={measurements}
                    onAddAnnotation={(item) => setMeasurements((prev) => [...prev, item])}
                    onClearPlaneAnnotations={() => setMeasurements([])}
                    resetSignal={resetSignal}
                  />
                </div>
              </div>
            )}

            {layout === 'single_axial' && (
              <div className="w-full h-full">
                <MPRViewport2D
                  scanId={scan.id}
                  resultId={selectedResult?.id || null}
                  plane="axial"
                  sliceIndex={axialIndex}
                  maxSliceIndex={scan.dimensions.z - 1}
                  onSliceChange={setAxialIndex}
                  windowWidth={windowWidth}
                  windowCenter={windowCenter}
                  overlayOpacity={overlayOpacity}
                  showOverlay={showOverlay}
                  showCrosshairs={showCrosshairs}
                  crosshairNormX={crosshairNorm.x}
                  crosshairNormY={crosshairNorm.y}
                  onCrosshairMove={(nx, ny) => handleCrosshairMove(nx, ny, 'axial')}
                  visibleLabels={visibleLabels}
                  labelMap={activeLabelMap}
                  activeTool={activeTool}
                  rotationDeg={rotationDeg}
                  flipH={flipH}
                  flipV={flipV}
                  contrastMultiplier={contrastMultiplier}
                  brightnessOffset={brightnessOffset}
                  annotations={measurements}
                  onAddAnnotation={(item) => setMeasurements((prev) => [...prev, item])}
                  onClearPlaneAnnotations={() => setMeasurements([])}
                  resetSignal={resetSignal}
                />
              </div>
            )}
          </div>
        </div>

        {/* -------------------------------------------------------------------
            C. RIGHT INFORMATION & CONTROL PANEL (Desktop Sidebar)
        ------------------------------------------------------------------- */}
        <aside className="hidden lg:flex w-72 lg:w-80 bg-[#0F1523] border-l border-[#222F43] flex-col overflow-y-auto shrink-0 select-none ws-scroll">
          {renderInfoPanelContent()}
        </aside>

        {/* Mobile / Tablet Slide-Over Drawer for Right Panel */}
        {mobileInfoDrawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
            <div className="w-80 max-w-[85vw] h-full bg-[#0F1523] border-l border-[#222F43] flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
              <div className="p-3 border-b border-[#222F43] flex items-center justify-between bg-[#161F30]">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#FFFFFF] flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#38BDF8]" />
                  <span>AI Controls & Volumetrics</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setMobileInfoDrawerOpen(false)}
                  className="p-1 rounded text-[#94A3B8] hover:text-[#FFFFFF]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderInfoPanelContent()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          3. BOTTOM SERIES & ANATOMICAL NAVIGATION PANEL (Collapsible)
      ========================================================================= */}
      <div className="bg-[#0F1523] border-t border-[#222F43] text-xs transition-all select-none">
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#161F30]/60 border-b border-[#222F43]/50">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBottomPanelExpanded((e) => !e)}
              className="text-[#CBD5E1] hover:text-[#FFFFFF] flex items-center gap-1 text-[11px] cursor-pointer"
            >
              {bottomPanelExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-[#38BDF8]" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#38BDF8]" />
              )}
              <span className="font-semibold uppercase tracking-wider text-[10px]">
                Series & Landmarks
              </span>
            </button>
            <span className="font-mono text-[10px] text-[#94A3B8] hidden sm:inline">
              Axial Slice: {axialIndex + 1} / {scan.dimensions.z} ({(axialIndex * scan.spacing_mm.z).toFixed(1)} mm)
            </span>
          </div>

          {/* Quick Anatomical Landmark Jump Buttons */}
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <span className="text-[#94A3B8] mr-1 hidden sm:inline">Jump:</span>
            <button
              type="button"
              onClick={() => jumpToAnatomicalZone('apex')}
              className="px-1.5 py-0.5 bg-[#161F30] text-[#CBD5E1] hover:text-[#38BDF8] hover:bg-[#222F43] rounded border border-[#222F43] transition cursor-pointer"
              title="Lung Apices"
            >
              APEX
            </button>
            <button
              type="button"
              onClick={() => jumpToAnatomicalZone('upper')}
              className="px-1.5 py-0.5 bg-[#161F30] text-[#CBD5E1] hover:text-[#38BDF8] hover:bg-[#222F43] rounded border border-[#222F43] transition cursor-pointer"
            >
              UPPER
            </button>
            <button
              type="button"
              onClick={() => jumpToAnatomicalZone('carina')}
              className="px-1.5 py-0.5 bg-[#161F30] text-[#14B8A6] hover:bg-[#222F43] rounded border border-[#222F43] transition font-bold cursor-pointer"
              title="Carina / Trachea Bifurcation"
            >
              CARINA
            </button>
            <button
              type="button"
              onClick={() => jumpToAnatomicalZone('mid')}
              className="px-1.5 py-0.5 bg-[#161F30] text-[#CBD5E1] hover:text-[#38BDF8] hover:bg-[#222F43] rounded border border-[#222F43] transition cursor-pointer"
            >
              MID
            </button>
            <button
              type="button"
              onClick={() => jumpToAnatomicalZone('lower')}
              className="px-1.5 py-0.5 bg-[#161F30] text-[#CBD5E1] hover:text-[#38BDF8] hover:bg-[#222F43] rounded border border-[#222F43] transition cursor-pointer"
            >
              LOWER
            </button>
            <button
              type="button"
              onClick={() => jumpToAnatomicalZone('base')}
              className="px-1.5 py-0.5 bg-[#161F30] text-[#CBD5E1] hover:text-[#38BDF8] hover:bg-[#222F43] rounded border border-[#222F43] transition cursor-pointer"
              title="Lung Bases / Costophrenic Angle"
            >
              BASE
            </button>
          </div>
        </div>

        {/* Collapsible Series Drawer */}
        {bottomPanelExpanded && (
          <div className="px-3 py-2 flex items-center gap-3 overflow-x-auto">
            {study?.scans.map((sc, idx) => {
              const isCurrent = sc.id === scan.id;
              const isSeg = sc.latest_job_status === 'COMPLETED' || !!sc.latest_result_id;
              return (
                <div
                  key={sc.id}
                  onClick={() => onSelectScan(sc)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition shrink-0 ${
                    isCurrent
                      ? 'bg-[#0D9488]/20 border-[#0D9488] text-[#FFFFFF]'
                      : 'bg-[#161F30] border-[#222F43] text-[#CBD5E1] hover:text-[#FFFFFF]'
                  }`}
                >
                  <div className="w-8 h-8 rounded bg-[#080B10] border border-[#222F43] flex items-center justify-center font-mono font-bold text-[10px] text-[#38BDF8]">
                    S{idx + 1}
                  </div>
                  <div className="text-left font-mono text-[10px] leading-tight">
                    <div className="font-semibold text-[#FFFFFF] truncate max-w-[130px]">
                      {sc.original_filename}
                    </div>
                    <div className="text-[#94A3B8]">
                      {sc.dimensions.z} sl · {isSeg ? 'Segmented' : 'Pending'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
