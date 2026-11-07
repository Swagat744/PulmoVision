import { LabelMeta } from '../types/api';

export const CANONICAL_STRUCTURE_COLORS: Record<string, string> = {
  // Bilateral segmentation
  left_lung: '#38BDF8',
  right_lung: '#14B8A6',
  total_lung: '#0D9488',

  // Five-lobe segmentation
  right_upper_lobe: '#14B8A6',
  right_middle_lobe: '#F59E0B',
  right_lower_lobe: '#8B5CF6',
  left_upper_lobe: '#38BDF8',
  left_lower_lobe: '#EC4899',
};

export const BILATERAL_DEFAULT_LABELS: Record<string, LabelMeta> = {
  '1': { key: 'right_lung', name: 'Right Lung', color: '#14B8A6' },
  '2': { key: 'left_lung', name: 'Left Lung', color: '#38BDF8' },
};

export const FIVE_LOBE_DEFAULT_LABELS: Record<string, LabelMeta> = {
  '1': { key: 'left_upper_lobe', name: 'Left Upper Lobe (LUL)', color: '#38BDF8' },
  '2': { key: 'left_lower_lobe', name: 'Left Lower Lobe (LLL)', color: '#EC4899' },
  '3': { key: 'right_upper_lobe', name: 'Right Upper Lobe (RUL)', color: '#14B8A6' },
  '4': { key: 'right_middle_lobe', name: 'Right Middle Lobe (RML)', color: '#F59E0B' },
  '5': { key: 'right_lower_lobe', name: 'Right Lower Lobe (RLL)', color: '#8B5CF6' },
};

export function resolveStructureColor(structureKey?: string, fallbackHex?: string): string {
  if (structureKey && CANONICAL_STRUCTURE_COLORS[structureKey]) {
    return CANONICAL_STRUCTURE_COLORS[structureKey];
  }
  return fallbackHex || '#0D9488';
}

export function normalizeLabelMapColors(
  labelMap?: Record<string, LabelMeta>,
  taskType?: string
): Record<string, LabelMeta> {
  if (!labelMap || Object.keys(labelMap).length === 0) {
    return taskType === 'five_lobes' ? FIVE_LOBE_DEFAULT_LABELS : BILATERAL_DEFAULT_LABELS;
  }
  const normalized: Record<string, LabelMeta> = {};
  Object.entries(labelMap).forEach(([id, meta]) => {
    normalized[id] = {
      ...meta,
      color: resolveStructureColor(meta.key, meta.color),
    };
  });
  return normalized;
}

export function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  if (Number.isNaN(num)) return [13, 148, 136];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export interface ResultMorphometrySummary {
  total_lung_volume_ml: number;
  right_lung_volume_ml: number;
  left_lung_volume_ml: number;
  attenuation_profile: {
    mean_hu: number;
    std_hu: number;
    min_hu: number;
    max_hu: number;
  };
  lobes?: Record<string, number>;
}

export function extractMorphometrySummary(
  measurements?: Array<{
    structure_key: string;
    display_name: string;
    physical_volume_ml: number;
    voxel_count: number;
    mean_hu: number;
    std_hu: number;
    min_hu: number;
    max_hu: number;
  }>
): ResultMorphometrySummary {
  if (!measurements || measurements.length === 0) {
    return {
      total_lung_volume_ml: 0,
      right_lung_volume_ml: 0,
      left_lung_volume_ml: 0,
      attenuation_profile: { mean_hu: 0, std_hu: 0, min_hu: 0, max_hu: 0 },
    };
  }

  const directRight = measurements.find((m) => m.structure_key === 'right_lung');
  const directLeft = measurements.find((m) => m.structure_key === 'left_lung');

  const rightLobes = measurements.filter((m) => m.structure_key.startsWith('right_') && m.structure_key !== 'right_lung');
  const leftLobes = measurements.filter((m) => m.structure_key.startsWith('left_') && m.structure_key !== 'left_lung');

  const rightVol = directRight
    ? directRight.physical_volume_ml
    : rightLobes.reduce((acc, m) => acc + m.physical_volume_ml, 0);

  const leftVol = directLeft
    ? directLeft.physical_volume_ml
    : leftLobes.reduce((acc, m) => acc + m.physical_volume_ml, 0);

  const totalVol = rightVol + leftVol > 0
    ? rightVol + leftVol
    : measurements.reduce((acc, m) => acc + m.physical_volume_ml, 0);

  const totalVox = measurements.reduce((acc, m) => acc + m.voxel_count, 0);
  const weightedMean = totalVox > 0
    ? measurements.reduce((acc, m) => acc + m.mean_hu * m.voxel_count, 0) / totalVox
    : -700;

  const lobesMap: Record<string, number> = {};
  measurements.forEach((m) => {
    if (m.structure_key !== 'right_lung' && m.structure_key !== 'left_lung' && m.structure_key !== 'total_lung') {
      lobesMap[m.structure_key] = m.physical_volume_ml;
    }
  });

  return {
    total_lung_volume_ml: totalVol,
    right_lung_volume_ml: rightVol,
    left_lung_volume_ml: leftVol,
    attenuation_profile: {
      mean_hu: weightedMean,
      std_hu: measurements[0]?.std_hu || 50,
      min_hu: Math.min(...measurements.map((m) => m.min_hu)),
      max_hu: Math.max(...measurements.map((m) => m.max_hu)),
    },
    lobes: Object.keys(lobesMap).length > 0 ? lobesMap : undefined,
  };
}

