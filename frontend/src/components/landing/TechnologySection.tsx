import React from 'react';
import { ArrowRight, CheckCircle2, Cpu, Database, HardDrive, Layers, Server, ShieldCheck } from 'lucide-react';
import { CANONICAL_STRUCTURE_COLORS } from '../../utils/segmentationColors';

export const TechnologySection: React.FC = () => {
  const pipelineSteps = [
    {
      num: '01',
      title: 'CT Ingestion & Validation',
      desc: 'Parses standard DICOM series, oblique acquisitions, and 3D NIfTI volumes with slice gap and orientation checks.',
    },
    {
      num: '02',
      title: 'LPS+ Standardization',
      desc: 'Calibrates Hounsfield Units via RescaleSlope/Intercept and reorients spatial geometry to canonical LPS+ frame.',
    },
    {
      num: '03',
      title: 'Deep Learning Inference',
      desc: 'Executes 2D U-Net forward passes with batch size memory safety (~1.08 GB peak RSS) producing sub-voxel masks.',
    },
    {
      num: '04',
      title: '3D Surface Synthesis',
      desc: 'Generates triangulated anatomical surface meshes with normal vectors via scikit-image Marching Cubes.',
    },
    {
      num: '05',
      title: 'Quantitative Morphometry',
      desc: 'Integrates continuous volume in mL, assesses right-to-left pulmonary balance, and computes HU density profiles.',
    },
  ];

  return (
    <section id="technology" className="relative py-20 sm:py-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto select-none">
      {/* Header */}
      <div className="max-w-3xl mb-12 sm:mb-16">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0F1523] border border-[#222F43] text-xs font-mono text-[#14B8A6] tracking-wider uppercase mb-3 shadow-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] animate-pulse" />
          <span className="font-semibold">Scientific Pipeline</span>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#FFFFFF]">
          Intelligence Built Around Anatomy.
        </h2>
        <p className="mt-4 text-sm sm:text-base text-[#CBD5E1] leading-relaxed">
          From raw scanner projection data to physical 3D anatomical meshes, every stage of the pipeline preserves patient coordinates and physical voxel geometry.
        </p>
      </div>

      {/* Visual Pipeline Sequence Strip */}
      <div className="relative mb-12 p-6 sm:p-7 rounded-2xl bg-[#0F1523]/95 border border-[#222F43] backdrop-blur-md shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {pipelineSteps.map((step, idx) => (
            <div key={step.num} className="relative p-5 rounded-xl bg-[#161F30]/80 border border-[#222F43] flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono font-bold text-[#14B8A6] block mb-1.5">
                  STAGE {step.num}
                </span>
                <h4 className="text-sm font-bold text-[#FFFFFF] mb-2">{step.title}</h4>
                <p className="text-xs text-[#CBD5E1] leading-relaxed">{step.desc}</p>
              </div>
              {idx < pipelineSteps.length - 1 && (
                <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                  <div className="w-6 h-6 rounded-full bg-[#0F1523] border border-[#222F43] flex items-center justify-center text-[#38BDF8]">
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 5-Lobe Canonical Color Breakdown & Specs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div className="p-7 sm:p-8 rounded-2xl bg-[#0F1523]/95 border border-[#222F43] backdrop-blur-md shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#FFFFFF]">Lobar Anatomical Compartments</h3>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-[#161F30] text-[#38BDF8] border border-[#222F43] font-semibold">
                lungmask LTRCLobes
              </span>
            </div>
            <p className="text-sm text-[#CBD5E1] leading-relaxed mb-6">
              When five-lobe segmentation is executed, each anatomical lobe is isolated and color-coded using high-contrast scientific palettes across 2D multi-planar slices and 3D surface reconstructions.
            </p>

            <div className="space-y-3">
              {[
                { name: 'Right Upper Lobe (RUL)', color: CANONICAL_STRUCTURE_COLORS.right_upper_lobe, key: 'rul' },
                { name: 'Right Middle Lobe (RML)', color: CANONICAL_STRUCTURE_COLORS.right_middle_lobe, key: 'rml' },
                { name: 'Right Lower Lobe (RLL)', color: CANONICAL_STRUCTURE_COLORS.right_lower_lobe, key: 'rll' },
                { name: 'Left Upper Lobe (LUL)', color: CANONICAL_STRUCTURE_COLORS.left_upper_lobe, key: 'lul' },
                { name: 'Left Lower Lobe (LLL)', color: CANONICAL_STRUCTURE_COLORS.left_lower_lobe, key: 'lll' },
              ].map((lobe) => (
                <div key={lobe.key} className="flex items-center justify-between p-3 rounded-xl bg-[#161F30] border border-[#222F43] text-xs">
                  <div className="flex items-center gap-3">
                    <span className="w-4 h-4 rounded-sm shadow-xs shrink-0 border border-white/20" style={{ backgroundColor: lobe.color }} />
                    <span className="font-semibold text-[#FFFFFF]">{lobe.name}</span>
                  </div>
                  <span className="font-mono text-xs text-[#CBD5E1] font-medium">{lobe.color}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Technical Specs & Guardrails */}
        <div className="p-7 sm:p-8 rounded-2xl bg-[#0F1523]/95 border border-[#222F43] backdrop-blur-md shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#FFFFFF]">Engineering Guardrails & Standards</h3>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-[#161F30] text-emerald-400 border border-emerald-500/30 font-semibold">
                VERIFIED
              </span>
            </div>
            <p className="text-sm text-[#CBD5E1] leading-relaxed mb-6">
              Deterministic medical image processing designed for execution safety and scientific reproducibility on clinical workstations.
            </p>

            <div className="space-y-3.5 text-xs font-mono">
              <div className="p-3.5 rounded-xl bg-[#161F30] border border-[#222F43] flex items-center justify-between">
                <span className="text-[#94A3B8]">Coordinate Frame:</span>
                <span className="font-bold text-[#FFFFFF]">LPS+ (Left-Posterior-Superior)</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#161F30] border border-[#222F43] flex items-center justify-between">
                <span className="text-[#94A3B8]">DICOM Oblique Sorting:</span>
                <span className="font-bold text-[#FFFFFF]">d_i = p_i · (r_0 × c_0)</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#161F30] border border-[#222F43] flex items-center justify-between">
                <span className="text-[#94A3B8]">Peak RAM Footprint:</span>
                <span className="font-bold text-[#14B8A6]">~1.08 GB RSS (Batch Size 4)</span>
              </div>
              <div className="p-3.5 rounded-xl bg-[#161F30] border border-[#222F43] flex items-center justify-between">
                <span className="text-[#94A3B8]">Weights Integrity:</span>
                <span className="font-bold text-[#38BDF8]">SHA-256 Checksum Verified</span>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#222F43] text-xs text-[#CBD5E1] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>SimpleITK native spatial geometry restored upon mask export</span>
          </div>
        </div>
      </div>
    </section>
  );
};
