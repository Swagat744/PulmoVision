import React from 'react';
import { ArrowRight, ArrowUpRight, Cpu, Layers } from 'lucide-react';

interface LandingFooterProps {
  onEnterAuth: () => void;
}

export const LandingFooter: React.FC<LandingFooterProps> = ({ onEnterAuth }) => {
  return (
    <footer className="relative border-t border-[#263445] bg-[#05080E] text-[#94A3B8] select-none">
      {/* SECTION F — Final CTA Strip */}
      <div className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center relative overflow-hidden">
        <div className="max-w-3xl mx-auto relative z-10 space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#111722] border border-[#263445] text-xs font-mono text-[#14B8A6]">
            <span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
            <span>PulmoVision AI Research Suite</span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#E5EDF5]">
            Explore a New Perspective on Thoracic Imaging.
          </h2>

          <p className="text-sm sm:text-base text-[#94A3B8] max-w-xl mx-auto leading-relaxed">
            Experience next-generation thoracic CT segmentation, multi-planar reconstruction, and quantitative volumetric intelligence in a single workstation.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onEnterAuth}
              className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-semibold text-white bg-[#0D9488] hover:bg-[#0F766E] shadow-lg shadow-[#0D9488]/20 transition flex items-center justify-center gap-2"
            >
              <span>Enter Research Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="w-full sm:w-auto px-6 py-3 rounded-lg text-sm font-semibold text-[#E5EDF5] bg-[#111722] hover:bg-[#18212D] border border-[#263445] transition"
            >
              Back to Overview ↑
            </button>
          </div>
        </div>
      </div>

      {/* Main Footer Links & Colophon */}
      <div className="border-t border-[#263445]/60 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#0D9488] to-[#38BDF8] flex items-center justify-center text-[#080B10] font-black text-xs">
            PV
          </div>
          <span className="text-[#E5EDF5] font-sans font-bold">PulmoVision AI</span>
          <span>·</span>
          <span>v1.2-research</span>
        </div>

        <div className="flex items-center gap-4 text-[#94A3B8]">
          <span>SimpleITK LPS+</span>
          <span>·</span>
          <span>PyTorch ResNet-34</span>
          <span>·</span>
          <span>Marching Cubes 3D</span>
        </div>

        <div className="text-[11px] text-[#94A3B8]/80 text-center md:text-right">
          For educational & scientific research purposes only.
        </div>
      </div>
    </footer>
  );
};

