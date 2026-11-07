import React, { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../api/client';
import {
  BinaryCTSlicePayload,
  BinaryMaskSlicePayload,
  LabelMeta,
  MPRPlane,
} from '../../types/api';
import { hexToRgbTuple, resolveStructureColor } from '../../utils/segmentationColors';
import { Crosshair, Maximize2, Minimize2, RotateCcw } from 'lucide-react';

export type WorkstationTool =
  | 'pan'
  | 'zoom'
  | 'crosshair'
  | 'wl'
  | 'ruler'
  | 'angle'
  | 'roi'
  | 'ellipse'
  | 'text'
  | 'draw'
  | 'erase';

export interface ViewportMeasurementItem {
  id: string;
  plane: MPRPlane;
  sliceIndex: number;
  kind: 'ruler' | 'angle' | 'roi' | 'ellipse' | 'text' | 'draw';
  points: Array<{ x: number; y: number }>; // normalized [0..1] canvas coordinates
  label: string;
  details?: string;
}

interface MPRViewport2DProps {
  scanId: string;
  resultId: string | null;
  plane: MPRPlane;
  sliceIndex: number;
  maxSliceIndex: number;
  onSliceChange: (newIndex: number) => void;
  windowWidth: number;
  windowCenter: number;
  onWindowLevelChange?: (newWidth: number, newCenter: number) => void;
  overlayOpacity: number;
  showOverlay: boolean;
  visibleLabels: Record<number, boolean>;
  labelMap: Record<string, LabelMeta>;
  showCrosshairs: boolean;
  crosshairNormX: number;
  crosshairNormY: number;
  onCrosshairMove?: (normX: number, normY: number) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  activeTool?: WorkstationTool;
  rotationDeg?: number;
  flipH?: boolean;
  flipV?: boolean;
  contrastMultiplier?: number;
  brightnessOffset?: number;
  annotations?: ViewportMeasurementItem[];
  onAddAnnotation?: (item: ViewportMeasurementItem) => void;
  onClearPlaneAnnotations?: (plane: MPRPlane) => void;
  resetSignal?: number;
}

const PLANE_LABELS: Record<
  MPRPlane,
  {
    title: string;
    code: string;
    accentHex: string;
    badgeClass: string;
    top: string;
    bottom: string;
    left: string;
    right: string;
  }
> = {
  axial: {
    title: 'AXIAL',
    code: 'AX',
    accentHex: '#38BDF8',
    badgeClass: 'bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/40',
    top: 'A',
    bottom: 'P',
    left: 'R',
    right: 'L',
  },
  coronal: {
    title: 'CORONAL',
    code: 'COR',
    accentHex: '#0D9488',
    badgeClass: 'bg-[#0D9488]/20 text-[#14B8A6] border-[#0D9488]/50',
    top: 'S',
    bottom: 'I',
    left: 'R',
    right: 'L',
  },
  sagittal: {
    title: 'SAGITTAL',
    code: 'SAG',
    accentHex: '#F59E0B',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
    top: 'S',
    bottom: 'I',
    left: 'A',
    right: 'P',
  },
};

export const MPRViewport2D: React.FC<MPRViewport2DProps> = ({
  scanId,
  resultId,
  plane,
  sliceIndex,
  maxSliceIndex,
  onSliceChange,
  windowWidth,
  windowCenter,
  onWindowLevelChange,
  overlayOpacity,
  showOverlay,
  visibleLabels,
  labelMap,
  showCrosshairs,
  crosshairNormX,
  crosshairNormY,
  onCrosshairMove,
  isExpanded,
  onToggleExpand,
  activeTool = 'pan',
  rotationDeg = 0,
  flipH = false,
  flipV = false,
  contrastMultiplier = 1.0,
  brightnessOffset = 0,
  annotations = [],
  onAddAnnotation,
  onClearPlaneAnnotations,
  resetSignal = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [ctSlice, setCtSlice] = useState<BinaryCTSlicePayload | null>(null);
  const [maskSlice, setMaskSlice] = useState<BinaryMaskSlicePayload | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [probeInfo, setProbeInfo] = useState<{
    x: number;
    y: number;
    hu: number;
    labelId: number;
    labelName: string | null;
    labelColor: string | null;
  } | null>(null);

  // Monitor viewport stage size for responsive anatomical fitting
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        setStageSize({ width: el.clientWidth, height: el.clientHeight });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Interactive measurement drafting state
  const [draftPoints, setDraftPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [cursorNorm, setCursorNorm] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setDraftPoints([]);
  }, [resetSignal]);

  const dragStateRef = useRef<{
    mode: 'pan' | 'wl' | 'zoom' | 'crosshair' | 'draw' | null;
    startX: number;
    startY: number;
    initPanX: number;
    initPanY: number;
    initZoom: number;
    initWW: number;
    initWC: number;
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    initPanX: 0,
    initPanY: 0,
    initZoom: 1.0,
    initWW: windowWidth,
    initWC: windowCenter,
  });

  // Fetch binary Int16 CT slice and UInt8 mask slice
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const loadSlices = async () => {
      try {
        const isShowcase = scanId === 'showcase_scan' || scanId.startsWith('showcase');
        const ctPromise = isShowcase
          ? apiClient.fetchShowcaseCTSliceBinary(plane, sliceIndex)
          : apiClient.fetchCTSliceBinary(scanId, plane, sliceIndex);
        const maskPromise = resultId
          ? (resultId === 'showcase_result'
              ? apiClient.fetchShowcaseMaskSliceBinary(plane, sliceIndex)
              : apiClient.fetchMaskSliceBinary(resultId, plane, sliceIndex)
            ).catch(() => null)
          : Promise.resolve(null);

        const [ctData, maskData] = await Promise.all([ctPromise, maskPromise]);
        if (!cancelled) {
          setCtSlice(ctData);
          setMaskSlice(maskData);
        }
      } catch {
        // ignore transient cancel during rapid wheel scroll
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSlices();
    return () => {
      cancelled = true;
    };
  }, [scanId, resultId, plane, sliceIndex]);

  // Compute ROI statistics from ctSlice.huData
  const computeRegionHUStats = (
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    elliptical: boolean
  ) => {
    if (!ctSlice) return { mean: 0, std: 0, areaMM2: 0 };
    const { width, height, huData, spacingHorizMM, spacingVertMM } = ctSlice;
    const x0 = Math.max(0, Math.min(width - 1, Math.round(Math.min(p1.x, p2.x) * width)));
    const x1 = Math.max(0, Math.min(width - 1, Math.round(Math.max(p1.x, p2.x) * width)));
    const y0 = Math.max(0, Math.min(height - 1, Math.round(Math.min(p1.y, p2.y) * height)));
    const y1 = Math.max(0, Math.min(height - 1, Math.round(Math.max(p1.y, p2.y) * height)));

    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const rx = Math.max(1, (x1 - x0) / 2);
    const ry = Math.max(1, (y1 - y0) / 2);

    const vals: number[] = [];
    for (let r = y0; r <= y1; r++) {
      for (let c = x0; c <= x1; c++) {
        if (elliptical) {
          const normDist = (c - cx) ** 2 / rx ** 2 + (r - cy) ** 2 / ry ** 2;
          if (normDist > 1.0) continue;
        }
        vals.push(huData[r * width + c]);
      }
    }
    if (vals.length === 0) return { mean: 0, std: 0, areaMM2: 0 };
    const sum = vals.reduce((a, b) => a + b, 0);
    const mean = sum / vals.length;
    const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    const std = Math.sqrt(variance);
    const pixelAreaMM2 = spacingHorizMM * spacingVertMM;
    const areaMM2 = vals.length * pixelAreaMM2;
    return {
      mean: Math.round(mean),
      std: Math.round(std),
      areaMM2: Math.round(areaMM2),
    };
  };

  // Render Int16 HU + UInt8 Mask LUT + Crosshairs + Measurements onto HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ctSlice) return;

    const { width, height, huData } = ctSlice;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgData = ctx.createImageData(width, height);
    const out = imgData.data;

    // Precompute canonical RGB table for labels
    const labelRgbTable: Record<number, [number, number, number]> = {
      1: hexToRgbTuple('#14B8A6'),
      2: hexToRgbTuple('#38BDF8'),
      3: hexToRgbTuple('#14B8A6'),
      4: hexToRgbTuple('#F59E0B'),
      5: hexToRgbTuple('#8B5CF6'),
    };
    Object.entries(labelMap).forEach(([k, meta]) => {
      const hex = resolveStructureColor(meta.key, meta.color);
      labelRgbTable[parseInt(k, 10)] = hexToRgbTuple(hex);
    });

    const ww = Math.max(1, windowWidth);
    const lowBound = windowCenter - 0.5 - (ww - 1) / 2.0;
    const highBound = windowCenter - 0.5 + (ww - 1) / 2.0;
    const invRange = 255.0 / Math.max(1.0, ww - 1.0);

    const hasMask =
      showOverlay &&
      maskSlice !== null &&
      maskSlice.width === width &&
      maskSlice.height === height;
    const maskArr = hasMask ? maskSlice!.maskData : null;
    const alpha = Math.max(0, Math.min(1, overlayOpacity));

    for (let i = 0; i < huData.length; i++) {
      const hu = huData[i];
      let gray = 0;
      if (hu <= lowBound) {
        gray = 0;
      } else if (hu >= highBound) {
        gray = 255;
      } else {
        gray = (hu - lowBound) * invRange;
      }

      // Apply workstation contrast & brightness fine adjustment
      gray = (gray - 127.5) * contrastMultiplier + 127.5 + brightnessOffset;
      gray = Math.max(0, Math.min(255, Math.round(gray)));

      let r = gray;
      let g = gray;
      let b = gray;

      if (maskArr) {
        const lbl = maskArr[i];
        if (lbl > 0 && visibleLabels[lbl] !== false) {
          const rgb = labelRgbTable[lbl] || [13, 148, 136];
          const row = Math.floor(i / width);
          const col = i % width;
          const isBoundary =
            (col > 0 && maskArr[i - 1] !== lbl) ||
            (col < width - 1 && maskArr[i + 1] !== lbl) ||
            (row > 0 && maskArr[i - width] !== lbl) ||
            (row < height - 1 && maskArr[i + width] !== lbl);

          const effAlpha = isBoundary ? Math.min(1.0, alpha + 0.42) : alpha;
          r = Math.round(gray * (1.0 - effAlpha) + rgb[0] * effAlpha);
          g = Math.round(gray * (1.0 - effAlpha) + rgb[1] * effAlpha);
          b = Math.round(gray * (1.0 - effAlpha) + rgb[2] * effAlpha);
        }
      }

      const p = i * 4;
      out[p] = r;
      out[p + 1] = g;
      out[p + 2] = b;
      out[p + 3] = 255;
    }

    ctx.putImageData(imgData, 0, 0);

    // Draw synchronized crosshairs (#38BDF8)
    if (showCrosshairs) {
      const cx = Math.round(crosshairNormX * (width - 1));
      const cy = Math.round(crosshairNormY * (height - 1));
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();

      // Center target reticle gap
      ctx.setLineDash([]);
      ctx.strokeStyle = '#38BDF8';
      ctx.strokeRect(cx - 2, cy - 2, 4, 4);
      ctx.restore();
    }

    // Draw saved measurements & annotations on this plane
    const planeItems = annotations.filter((a) => a.plane === plane);
    const drawItem = (pts: Array<{ x: number; y: number }>, kind: string, label: string) => {
      if (pts.length === 0) return;
      ctx.save();
      ctx.strokeStyle = '#38BDF8';
      ctx.fillStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.font = '600 10px "IBM Plex Mono", monospace';

      if (kind === 'ruler' && pts.length >= 2) {
        const x1 = pts[0].x * width;
        const y1 = pts[0].y * height;
        const x2 = pts[1].x * width;
        const y2 = pts[1].y * height;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.fillRect(x1 - 2, y1 - 2, 4, 4);
        ctx.fillRect(x2 - 2, y2 - 2, 4, 4);
        ctx.fillText(label, (x1 + x2) / 2 + 4, (y1 + y2) / 2 - 4);
      } else if (kind === 'angle' && pts.length >= 2) {
        const x1 = pts[0].x * width;
        const y1 = pts[0].y * height;
        const x2 = pts[1].x * width;
        const y2 = pts[1].y * height;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        if (pts.length >= 3) {
          ctx.lineTo(pts[2].x * width, pts[2].y * height);
        }
        ctx.stroke();
        ctx.fillText(label, x2 + 5, y2 - 5);
      } else if (kind === 'roi' && pts.length >= 2) {
        const x1 = Math.min(pts[0].x, pts[1].x) * width;
        const y1 = Math.min(pts[0].y, pts[1].y) * height;
        const w = Math.abs(pts[1].x - pts[0].x) * width;
        const h = Math.abs(pts[1].y - pts[0].y) * height;
        ctx.strokeStyle = '#14B8A6';
        ctx.fillStyle = 'rgba(20, 184, 166, 0.12)';
        ctx.fillRect(x1, y1, w, h);
        ctx.strokeRect(x1, y1, w, h);
        ctx.fillStyle = '#14B8A6';
        ctx.fillText(label, x1 + 2, Math.max(10, y1 - 3));
      } else if (kind === 'ellipse' && pts.length >= 2) {
        const cx = ((pts[0].x + pts[1].x) / 2) * width;
        const cy = ((pts[0].y + pts[1].y) / 2) * height;
        const rx = (Math.abs(pts[1].x - pts[0].x) / 2) * width;
        const ry = (Math.abs(pts[1].y - pts[0].y) / 2) * height;
        ctx.strokeStyle = '#F59E0B';
        ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#F59E0B';
        ctx.fillText(label, cx - rx, Math.max(10, cy - ry - 4));
      } else if (kind === 'text' && pts.length >= 1) {
        const tx = pts[0].x * width;
        const ty = pts[0].y * height;
        ctx.fillStyle = '#F59E0B';
        ctx.fillRect(tx - 2, ty - 2, 4, 4);
        ctx.fillText(label, tx + 5, ty + 3);
      } else if (kind === 'draw' && pts.length >= 2) {
        ctx.strokeStyle = '#EC4899';
        ctx.beginPath();
        ctx.moveTo(pts[0].x * width, pts[0].y * height);
        for (let idx = 1; idx < pts.length; idx++) {
          ctx.lineTo(pts[idx].x * width, pts[idx].y * height);
        }
        ctx.stroke();
      }
      ctx.restore();
    };

    planeItems.forEach((item) => drawItem(item.points, item.kind, item.label));

    // Draw live in-progress measurement draft
    if (draftPoints.length > 0 && cursorNorm) {
      const previewPts = [...draftPoints, cursorNorm];
      if (activeTool === 'ruler') {
        const dxMM = (previewPts[1].x - previewPts[0].x) * width * ctSlice.spacingHorizMM;
        const dyMM = (previewPts[1].y - previewPts[0].y) * height * ctSlice.spacingVertMM;
        const distMM = Math.sqrt(dxMM ** 2 + dyMM ** 2);
        drawItem(previewPts, 'ruler', `${distMM.toFixed(1)} mm`);
      } else if (activeTool === 'roi') {
        const st = computeRegionHUStats(previewPts[0], previewPts[1], false);
        drawItem(previewPts, 'roi', `ROI: ${st.mean}±${st.std} HU (${st.areaMM2} mm²)`);
      } else if (activeTool === 'ellipse') {
        const st = computeRegionHUStats(previewPts[0], previewPts[1], true);
        drawItem(previewPts, 'ellipse', `Ell: ${st.mean}±${st.std} HU (${st.areaMM2} mm²)`);
      } else if (activeTool === 'angle') {
        drawItem(previewPts, 'angle', 'Angle...');
      } else if (activeTool === 'draw') {
        drawItem(previewPts, 'draw', '');
      }
    }
  }, [
    ctSlice,
    maskSlice,
    windowWidth,
    windowCenter,
    overlayOpacity,
    showOverlay,
    visibleLabels,
    labelMap,
    showCrosshairs,
    crosshairNormX,
    crosshairNormY,
    contrastMultiplier,
    brightnessOffset,
    annotations,
    draftPoints,
    cursorNorm,
    activeTool,
    plane,
  ]);

  const getCanvasNormCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { x: nx, y: ny };
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || activeTool === 'zoom') {
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      setZoom((z) => Math.max(0.4, Math.min(6.0, +(z * factor).toFixed(2))));
      return;
    }
    const delta = e.deltaY > 0 ? 1 : -1;
    const next = Math.max(0, Math.min(maxSliceIndex, sliceIndex + delta));
    if (next !== sliceIndex) {
      onSliceChange(next);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const norm = getCanvasNormCoords(e);

    // Right-click or Shift+Click always adjusts Window/Level
    if (e.button === 2 || e.shiftKey || activeTool === 'wl') {
      e.preventDefault();
      dragStateRef.current = {
        mode: 'wl',
        startX: e.clientX,
        startY: e.clientY,
        initPanX: pan.x,
        initPanY: pan.y,
        initZoom: zoom,
        initWW: windowWidth,
        initWC: windowCenter,
      };
      return;
    }

    if (activeTool === 'erase') {
      if (onClearPlaneAnnotations) onClearPlaneAnnotations(plane);
      setDraftPoints([]);
      return;
    }

    if (activeTool === 'crosshair' && norm && onCrosshairMove) {
      onCrosshairMove(norm.x, norm.y);
      dragStateRef.current = {
        mode: 'crosshair',
        startX: e.clientX,
        startY: e.clientY,
        initPanX: pan.x,
        initPanY: pan.y,
        initZoom: zoom,
        initWW: windowWidth,
        initWC: windowCenter,
      };
      return;
    }

    if (activeTool === 'zoom') {
      dragStateRef.current = {
        mode: 'zoom',
        startX: e.clientX,
        startY: e.clientY,
        initPanX: pan.x,
        initPanY: pan.y,
        initZoom: zoom,
        initWW: windowWidth,
        initWC: windowCenter,
      };
      return;
    }

    if (activeTool === 'text' && norm && onAddAnnotation) {
      const labelTxt = window.prompt('Enter anatomical annotation label:', 'ROI Marker');
      if (labelTxt && labelTxt.trim()) {
        onAddAnnotation({
          id: `${plane}-${Date.now()}`,
          plane,
          sliceIndex,
          kind: 'text',
          points: [norm],
          label: labelTxt.trim(),
        });
      }
      return;
    }

    if (activeTool === 'draw' && norm) {
      setDraftPoints([norm]);
      dragStateRef.current = {
        mode: 'draw',
        startX: e.clientX,
        startY: e.clientY,
        initPanX: pan.x,
        initPanY: pan.y,
        initZoom: zoom,
        initWW: windowWidth,
        initWC: windowCenter,
      };
      return;
    }

    if (
      (activeTool === 'ruler' || activeTool === 'roi' || activeTool === 'ellipse') &&
      norm &&
      ctSlice
    ) {
      if (draftPoints.length === 0) {
        setDraftPoints([norm]);
      } else {
        const p0 = draftPoints[0];
        const p1 = norm;
        if (activeTool === 'ruler') {
          const dxMM = (p1.x - p0.x) * ctSlice.width * ctSlice.spacingHorizMM;
          const dyMM = (p1.y - p0.y) * ctSlice.height * ctSlice.spacingVertMM;
          const distMM = Math.sqrt(dxMM ** 2 + dyMM ** 2);
          onAddAnnotation?.({
            id: `${plane}-${Date.now()}`,
            plane,
            sliceIndex,
            kind: 'ruler',
            points: [p0, p1],
            label: `${distMM.toFixed(1)} mm`,
          });
        } else if (activeTool === 'roi') {
          const st = computeRegionHUStats(p0, p1, false);
          onAddAnnotation?.({
            id: `${plane}-${Date.now()}`,
            plane,
            sliceIndex,
            kind: 'roi',
            points: [p0, p1],
            label: `${st.mean}±${st.std} HU (${st.areaMM2} mm²)`,
          });
        } else if (activeTool === 'ellipse') {
          const st = computeRegionHUStats(p0, p1, true);
          onAddAnnotation?.({
            id: `${plane}-${Date.now()}`,
            plane,
            sliceIndex,
            kind: 'ellipse',
            points: [p0, p1],
            label: `${st.mean}±${st.std} HU (${st.areaMM2} mm²)`,
          });
        }
        setDraftPoints([]);
      }
      return;
    }

    if (activeTool === 'angle' && norm && ctSlice) {
      if (draftPoints.length < 2) {
        setDraftPoints((prev) => [...prev, norm]);
      } else {
        const [p0, p1] = draftPoints;
        const p2 = norm;
        const v1x = (p0.x - p1.x) * ctSlice.width * ctSlice.spacingHorizMM;
        const v1y = (p0.y - p1.y) * ctSlice.height * ctSlice.spacingVertMM;
        const v2x = (p2.x - p1.x) * ctSlice.width * ctSlice.spacingHorizMM;
        const v2y = (p2.y - p1.y) * ctSlice.height * ctSlice.spacingVertMM;
        const dot = v1x * v2x + v1y * v2y;
        const mag = Math.max(1e-5, Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y));
        const deg = (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
        onAddAnnotation?.({
          id: `${plane}-${Date.now()}`,
          plane,
          sliceIndex,
          kind: 'angle',
          points: [p0, p1, p2],
          label: `${deg.toFixed(1)}°`,
        });
        setDraftPoints([]);
      }
      return;
    }

    // Default pan
    dragStateRef.current = {
      mode: 'pan',
      startX: e.clientX,
      startY: e.clientY,
      initPanX: pan.x,
      initPanY: pan.y,
      initZoom: zoom,
      initWW: windowWidth,
      initWC: windowCenter,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const norm = getCanvasNormCoords(e);
    if (norm) setCursorNorm(norm);

    const drag = dragStateRef.current;
    if (drag.mode === 'pan') {
      setPan({
        x: drag.initPanX + (e.clientX - drag.startX),
        y: drag.initPanY + (e.clientY - drag.startY),
      });
      return;
    }
    if (drag.mode === 'zoom') {
      const dy = drag.startY - e.clientY;
      const nextZoom = Math.max(0.4, Math.min(6.0, +(drag.initZoom * (1 + dy * 0.005)).toFixed(2)));
      setZoom(nextZoom);
      return;
    }
    if (drag.mode === 'wl' && onWindowLevelChange) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const nextWW = Math.max(10, Math.min(4000, Math.round(drag.initWW + dx * 4)));
      const nextWC = Math.max(-1024, Math.min(2000, Math.round(drag.initWC - dy * 3)));
      onWindowLevelChange(nextWW, nextWC);
      return;
    }
    if (drag.mode === 'crosshair' && norm && onCrosshairMove) {
      onCrosshairMove(norm.x, norm.y);
      return;
    }
    if (drag.mode === 'draw' && norm) {
      setDraftPoints((prev) => [...prev, norm]);
      return;
    }

    // Live cursor HU and anatomical structure readout
    if (!norm || !ctSlice) {
      setProbeInfo(null);
      return;
    }

    const px = Math.min(ctSlice.width - 1, Math.max(0, Math.floor(norm.x * ctSlice.width)));
    const py = Math.min(ctSlice.height - 1, Math.max(0, Math.floor(norm.y * ctSlice.height)));
    const idx = py * ctSlice.width + px;
    const hu = ctSlice.huData[idx];
    const lblId = maskSlice && maskSlice.maskData ? maskSlice.maskData[idx] : 0;
    const lblMeta = lblId > 0 ? labelMap[String(lblId)] : undefined;
    const lblColor = lblMeta ? resolveStructureColor(lblMeta.key, lblMeta.color) : null;

    setProbeInfo({
      x: px,
      y: py,
      hu,
      labelId: lblId,
      labelName: lblMeta ? lblMeta.name : lblId > 0 ? `Label ${lblId}` : null,
      labelColor: lblColor,
    });
  };

  const handleMouseUp = () => {
    if (dragStateRef.current.mode === 'draw' && draftPoints.length > 1) {
      onAddAnnotation?.({
        id: `${plane}-${Date.now()}`,
        plane,
        sliceIndex,
        kind: 'draw',
        points: draftPoints,
        label: 'Freehand',
      });
      setDraftPoints([]);
    }
    dragStateRef.current.mode = null;
  };

  const meta = PLANE_LABELS[plane];

  // Calculate physical mm aspect ratio and responsive canvas display dimensions
  let displayWidth = ctSlice ? ctSlice.width : 256;
  let displayHeight = ctSlice ? ctSlice.height : 256;

  if (ctSlice && stageSize.width > 0 && stageSize.height > 0) {
    const physW = ctSlice.width * (ctSlice.spacingHorizMM || 1.0);
    const physH = ctSlice.height * (ctSlice.spacingVertMM || 1.0);
    const targetW = stageSize.width * 0.94;
    const targetH = stageSize.height * 0.92;
    const fitScale = Math.min(targetW / Math.max(1, physW), targetH / Math.max(1, physH));
    displayWidth = Math.max(32, Math.round(physW * fitScale));
    displayHeight = Math.max(32, Math.round(physH * fitScale));
  }

  const scaleX = (flipH ? -1 : 1) * zoom;
  const scaleY = (flipV ? -1 : 1) * zoom;

  return (
    <div
      className="relative flex flex-col bg-[#000000] border border-[#263445] rounded-lg overflow-hidden select-none h-full"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top Radiology Viewport Header Bar */}
      <div className="flex items-center justify-between px-2.5 py-1 bg-[#111722] border-b border-[#263445] text-[11px] z-10 shrink-0">
        <div className="flex items-center gap-2">
          <span
            className={`px-1.5 py-0.5 rounded border font-mono font-semibold text-[10px] tracking-wider ${meta.badgeClass}`}
          >
            {meta.title}
          </span>
          <span className="font-mono text-[#94A3B8]">
            IM <strong className="text-[#E5EDF5]">{sliceIndex + 1}</strong>/{maxSliceIndex + 1}
          </span>
          {loading && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-ping"
              title="Streaming binary slice"
            />
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setZoom(1.0);
              setPan({ x: 0, y: 0 });
              setDraftPoints([]);
            }}
            className="p-1 text-[#94A3B8] hover:text-[#E5EDF5] hover:bg-[#18212D] rounded transition"
            title="Reset Viewport Zoom & Pan"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="p-1 text-[#94A3B8] hover:text-[#E5EDF5] hover:bg-[#18212D] rounded transition"
              title={isExpanded ? 'Restore Multi-Planar Grid' : 'Maximize Plane'}
            >
              {isExpanded ? (
                <Minimize2 className="w-3 h-3" />
              ) : (
                <Maximize2 className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Pure Black CT Canvas Stage */}
      <div
        ref={stageRef}
        className="relative flex-1 flex items-center justify-center overflow-hidden bg-[#000000] cursor-crosshair"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          handleMouseUp();
          setProbeInfo(null);
        }}
      >
        {/* Standard Radiological Orientation Markers */}
        <span className="absolute top-1.5 left-1/2 -translate-x-1/2 text-[10px] font-mono font-semibold text-[#38BDF8]/80 pointer-events-none z-10">
          {meta.top}
        </span>
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-mono font-semibold text-[#38BDF8]/80 pointer-events-none z-10">
          {meta.bottom}
        </span>
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-[#38BDF8]/80 pointer-events-none z-10">
          {meta.left}
        </span>
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-mono font-semibold text-[#38BDF8]/80 pointer-events-none z-10">
          {meta.right}
        </span>

        {/* Top-Left DICOM Technical Telemetry Overlay */}
        <div className="absolute top-2 left-2.5 text-[10px] font-mono text-[#94A3B8] leading-tight space-y-0.5 pointer-events-none z-10 bg-[#080B10]/70 px-1.5 py-1 rounded border border-[#263445]/60">
          <div>
            WL: <span className="text-[#E5EDF5]">{windowCenter}</span> / WW:{' '}
            <span className="text-[#E5EDF5]">{windowWidth}</span>
          </div>
          {ctSlice && (
            <div>
              {ctSlice.width}×{ctSlice.height}px • Δ {ctSlice.spacingHorizMM.toFixed(2)}×
              {ctSlice.spacingVertMM.toFixed(2)}mm
            </div>
          )}
          <div>
            Zoom: <span className="text-[#E5EDF5]">{(zoom * 100).toFixed(0)}%</span>
            {rotationDeg !== 0 ? ` • Rot: ${rotationDeg}°` : ''}
          </div>
        </div>

        {/* Bottom-Left Live Cursor HU & Structure Readout */}
        {probeInfo && (
          <div className="absolute bottom-2 left-2.5 text-[10px] font-mono bg-[#111722]/95 border border-[#263445] px-2 py-1 rounded pointer-events-none z-10 flex items-center gap-2 text-[#E5EDF5]">
            <Crosshair className="w-3 h-3 text-[#38BDF8]" />
            <span>
              X:{probeInfo.x} Y:{probeInfo.y} |{' '}
              <strong className="text-[#38BDF8]">{probeInfo.hu} HU</strong>
            </span>
            {probeInfo.labelName && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-[#18212D] border border-[#263445] font-medium">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: probeInfo.labelColor || '#0D9488' }}
                />
                {probeInfo.labelName}
              </span>
            )}
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{
            width: `${displayWidth}px`,
            height: `${displayHeight}px`,
            transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotationDeg}deg) scale(${scaleX}, ${scaleY})`,
            transformOrigin: 'center center',
            imageRendering: 'pixelated',
          }}
        />
      </div>

      {/* Bottom Precision Slice Scrubber Bar */}
      <div className="px-2.5 py-1 bg-[#111722] border-t border-[#263445] flex items-center gap-2 z-10 shrink-0">
        <span className="text-[10px] font-mono text-[#94A3B8] w-6">{meta.code}</span>
        <input
          type="range"
          min={0}
          max={Math.max(0, maxSliceIndex)}
          value={sliceIndex}
          onChange={(e) => onSliceChange(parseInt(e.target.value, 10))}
          className="w-full accent-[#0D9488] h-1 bg-[#18212D] rounded cursor-pointer"
        />
        <span className="text-[10px] font-mono text-[#E5EDF5] w-12 text-right">
          {sliceIndex + 1}/{maxSliceIndex + 1}
        </span>
      </div>
    </div>
  );
};
