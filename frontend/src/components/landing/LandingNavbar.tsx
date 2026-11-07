import React, { useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';

interface LandingNavbarProps {
  onEnterAuth: () => void;
  onExplore: () => void;
}

export const LandingNavbar: React.FC<LandingNavbarProps> = ({
  onEnterAuth,
  onExplore,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const handleNavClick = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    el?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#080B10]/90 backdrop-blur-md border-b border-[#222F43] transition-all select-none">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Monogram */}
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0D9488] to-[#38BDF8] flex items-center justify-center text-[#080B10] font-black text-sm shadow-md">
            PV
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-[#FFFFFF]">PulmoVision AI</span>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#161F30] text-[#38BDF8] border border-[#222F43] tracking-wider uppercase">
                RESEARCH v1.2
              </span>
            </div>
            <p className="text-[10px] text-[#94A3B8] leading-none hidden sm:block">
              Thoracic CT Segmentation & 3D Analytics
            </p>
          </div>
        </div>

        {/* Desktop Navigation Anchors */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-medium text-[#CBD5E1]">
          <button
            type="button"
            onClick={() => handleNavClick('platform')}
            className="hover:text-[#FFFFFF] transition"
          >
            Platform
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('technology')}
            className="hover:text-[#FFFFFF] transition"
          >
            Technology
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('imaging')}
            className="hover:text-[#FFFFFF] transition"
          >
            Workstation
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('research')}
            className="hover:text-[#FFFFFF] transition"
          >
            Scientific Notice
          </button>
        </nav>

        {/* Action CTAs */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onEnterAuth}
            className="text-xs font-semibold text-[#CBD5E1] hover:text-[#FFFFFF] px-3.5 py-2 rounded-lg hover:bg-[#161F30] border border-transparent hover:border-[#222F43] transition hidden sm:inline-block"
          >
            Researcher Sign In
          </button>
          <button
            type="button"
            onClick={onEnterAuth}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#0D9488] hover:bg-[#0F766E] rounded-lg shadow-md shadow-[#0D9488]/20 transition active:scale-[0.98]"
          >
            <span>Explore Platform</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="p-2 rounded-lg text-[#CBD5E1] hover:text-[#FFFFFF] hover:bg-[#161F30] border border-[#222F43] md:hidden transition"
            title="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[#222F43] bg-[#0B0F19] px-4 py-4 space-y-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-col space-y-2 text-sm font-medium text-[#CBD5E1]">
            <button
              type="button"
              onClick={() => handleNavClick('platform')}
              className="text-left py-2 px-3 rounded-lg hover:bg-[#161F30] hover:text-white transition"
            >
              Platform Capabilities
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('technology')}
              className="text-left py-2 px-3 rounded-lg hover:bg-[#161F30] hover:text-white transition"
            >
              Technology & Pipeline
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('imaging')}
              className="text-left py-2 px-3 rounded-lg hover:bg-[#161F30] hover:text-white transition"
            >
              Radiology Workstation
            </button>
            <button
              type="button"
              onClick={() => handleNavClick('research')}
              className="text-left py-2 px-3 rounded-lg hover:bg-[#161F30] hover:text-white transition"
            >
              Scientific Responsibility
            </button>
          </div>

          <div className="pt-3 border-t border-[#222F43] flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onEnterAuth();
              }}
              className="w-full py-2.5 text-center text-xs font-semibold text-[#FFFFFF] bg-[#161F30] rounded-lg border border-[#222F43]"
            >
              Researcher Sign In
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
