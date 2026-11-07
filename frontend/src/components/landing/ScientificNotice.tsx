import React from 'react';
import { AlertTriangle, BookOpen, FileCheck, ShieldAlert } from 'lucide-react';

export const ScientificNotice: React.FC = () => {
  return (
    <section id="research" className="relative py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto select-none">
      <div className="p-8 sm:p-10 rounded-2xl bg-[#111722]/90 border border-[#263445] shadow-xl backdrop-blur-sm relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#0D9488]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-2 mb-4">
            <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <ShieldAlert className="w-5 h-5" />
            </span>
            <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
              Research & Scientific Responsibility Notice
            </span>
          </div>

          <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#E5EDF5] mb-4">
            Engineered for Scientific Exploration & Educational Volumetry.
          </h3>

          <p className="text-xs sm:text-sm text-[#94A3B8] leading-relaxed mb-6">
            PulmoVision AI is an experimental medical imaging research software application. It is developed solely to assist authorized computer vision researchers, medical physics teams, and healthcare educators in visualizing pulmonary anatomy, evaluating neural segmentation models, and deriving quantitative research metrics.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-[#18212D]/80 border border-[#263445] space-y-1">
              <strong className="text-amber-300 block font-sans font-semibold">Not a Clinical Diagnostic Device</strong>
              <p className="text-[#94A3B8] font-sans text-[11px]">
                PulmoVision AI has not received clearance or approval from the U.S. FDA, European CE, or equivalent regulatory bodies. It must not be utilized as the primary basis for diagnostic, surgical, or therapeutic patient-care decisions.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-[#18212D]/80 border border-[#263445] space-y-1">
              <strong className="text-[#38BDF8] block font-sans font-semibold">Model Provenance & Peer Review</strong>
              <p className="text-[#94A3B8] font-sans text-[11px]">
                Inference utilizes published, peer-reviewed U-Net architectures (Hofmanninger et al., <em>IEEE Transactions on Medical Imaging</em>, DOI: 10.1109/TMI.2020.2990378). Model weights are validated via cryptographic SHA-256 hashes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

