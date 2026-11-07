import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, Cpu, HardDrive, Layers, Sparkles } from 'lucide-react';
import { LandingNavbar } from './LandingNavbar';
import { CinematicLungScene } from './CinematicLungScene';
import { PlatformStory } from './PlatformStory';
import { TechnologySection } from './TechnologySection';
import { WorkstationShowcase } from './WorkstationShowcase';
import { ScientificNotice } from './ScientificNotice';
import { LandingFooter } from './LandingFooter';

interface LandingPageProps {
  onEnterAuth: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterAuth }) => {
  const [scrollProgress, setScrollProgress] = useState<number>(0);

  // Smooth scroll tracking
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
          const current = totalHeight > 0 ? window.scrollY / totalHeight : 0;
          setScrollProgress(Math.min(1, Math.max(0, current)));
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#080B10] text-[#F8FAFC] overflow-x-hidden select-none">
      {/* Top Navbar */}
      <LandingNavbar
        onEnterAuth={onEnterAuth}
        onExplore={() => {
          const el = document.getElementById('platform');
          el?.scrollIntoView({ behavior: 'smooth' });
        }}
      />

      {/* Atmospheric Background 3D Lung Canvas (Controlled subtle opacity & vignette) */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Subtle opacity layer so it never competes with foreground text (+10% opacity) */}
        <div className="w-full h-full opacity-50 sm:opacity-55 transition-opacity duration-700">
          <CinematicLungScene scrollProgress={scrollProgress} interactive={true} />
        </div>
        {/* Dark radial vignette ensuring maximum text and card contrast */}
        <div className="absolute inset-0 bg-radial-vignette pointer-events-none" style={{
          background: 'radial-gradient(circle at 50% 50%, rgba(8, 11, 16, 0.4) 0%, rgba(8, 11, 16, 0.85) 75%, #080B10 100%)'
        }} />
      </div>

      {/* Content Stream (z-10 layer over the atmospheric 3D scene) */}
      <div className="relative z-10">
        {/* =========================================================================
            SECTION A — CINEMATIC HERO
        ========================================================================= */}
        <section className="relative min-h-[calc(100vh-64px)] flex flex-col justify-center pt-24 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="max-w-2xl space-y-6">
            {/* Technical Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0F1523]/90 border border-[#222F43] text-xs font-mono text-[#38BDF8] tracking-wider uppercase backdrop-blur-md shadow-lg">
              <span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
              <span className="font-semibold">NEXT-GENERATION THORACIC AI</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08] text-[#FFFFFF]">
              See Beyond <br />
              <span className="bg-gradient-to-r from-[#38BDF8] via-[#14B8A6] to-[#0D9488] bg-clip-text text-transparent">
                the Scan.
              </span>
            </h1>

            {/* Supporting Description with crisp contrast */}
            <p className="text-base sm:text-lg text-[#CBD5E1] max-w-lg leading-relaxed font-normal">
              Intelligent thoracic imaging. Anatomical segmentation. Three-dimensional pulmonary analysis.
            </p>

            {/* Actions */}
            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <button
                type="button"
                onClick={onEnterAuth}
                className="px-6 py-3.5 rounded-xl text-sm font-semibold text-white bg-[#0D9488] hover:bg-[#0F766E] shadow-xl shadow-[#0D9488]/30 transition-all duration-200 flex items-center justify-center gap-2 group active:scale-[0.98]"
              >
                <span>Enter Research Workspace</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('platform');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3.5 rounded-xl text-sm font-semibold text-[#F8FAFC] bg-[#0F1523]/90 hover:bg-[#161F30] border border-[#222F43] hover:border-[#38BDF8]/50 transition-all duration-200 flex items-center justify-center gap-2 backdrop-blur-md shadow-md active:scale-[0.98]"
              >
                <span>Explore Capabilities</span>
                <ArrowDown className="w-3.5 h-3.5 text-[#38BDF8]" />
              </button>
            </div>

            {/* Scientific Badges */}
            <div className="pt-8 border-t border-[#222F43] flex flex-wrap gap-2.5 text-xs font-mono text-[#CBD5E1]">
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0F1523]/90 border border-[#222F43] backdrop-blur-md shadow-xs">
                <Cpu className="w-4 h-4 text-[#0D9488]" />
                <span className="font-medium text-[#F8FAFC]">PyTorch 2D ResNet-34 U-Net</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0F1523]/90 border border-[#222F43] backdrop-blur-md shadow-xs">
                <Layers className="w-4 h-4 text-[#38BDF8]" />
                <span className="font-medium text-[#F8FAFC]">5-Lobe Compartmentalization</span>
              </div>
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0F1523]/90 border border-[#222F43] backdrop-blur-md shadow-xs">
                <HardDrive className="w-4 h-4 text-[#14B8A6]" />
                <span className="font-medium text-[#F8FAFC]">SimpleITK LPS+ Calibration</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION B — The Platform */}
        <PlatformStory />

        {/* SECTION C — The Technology */}
        <TechnologySection />

        {/* SECTION D — Workstation Showcase */}
        <WorkstationShowcase />

        {/* SECTION E — Scientific Integrity & Responsibility */}
        <ScientificNotice />

        {/* SECTION F & FOOTER — Final CTA */}
        <LandingFooter onEnterAuth={onEnterAuth} />
      </div>
    </div>
  );
};
