import React, { useState } from 'react';
import {
  BarChart3,
  FileText,
  FolderOpen,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  ShieldAlert,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { UserDTO } from '../../types/api';

export type NavTab =
  | 'dashboard'
  | 'studies'
  | 'workspace'
  | 'analysis'
  | 'reports'
  | 'settings';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  user: UserDTO | null;
  onLogout: () => void;
  onOpenNewStudy: () => void;
  onOpenUpload: () => void;
  onOpenSample: () => void;
  onOpenLanding?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  onOpenNewStudy,
  onOpenUpload,
  onOpenSample,
  onOpenLanding,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'studies', label: 'Studies', icon: FolderOpen },
    { id: 'workspace', label: 'Workstation', icon: Layers },
    { id: 'analysis', label: 'Quantitative', icon: BarChart3 },
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleTabClick = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="border-b border-[#222F43] bg-[#080B10] text-[#F8FAFC] select-none sticky top-0 z-40 transition-colors">
      {/* Top Disclaimer Ribbon */}
      <div className="px-4 py-1 text-[11px] font-mono flex items-center justify-between border-b border-[#222F43] bg-[#0F1523] text-[#CBD5E1]">
        <div className="flex items-center gap-2 truncate">
          <ShieldAlert className="w-3.5 h-3.5 text-[#38BDF8] shrink-0" />
          <span className="truncate">
            <strong className="text-[#FFFFFF]">RESEARCH PROTOTYPE:</strong>{' '}
            Educational & volumetric analysis platform · Not for diagnostic use
          </span>
        </div>
        <div className="hidden md:flex items-center gap-3 shrink-0 text-[#94A3B8]">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] animate-pulse" />
            SimpleITK LPS+ Calibrated
          </span>
          <span>·</span>
          <span>lungmask v0.2.22</span>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-[1720px] mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Identity */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#0D9488] to-[#38BDF8] flex items-center justify-center text-[#080B10] font-black text-sm shadow-sm cursor-pointer"
            onClick={() => handleTabClick('dashboard')}
          >
            PV
          </div>
          <div className="cursor-pointer" onClick={() => handleTabClick('dashboard')}>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base tracking-tight text-[#FFFFFF]">PulmoVision AI</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded border uppercase tracking-wider font-semibold bg-[#161F30] text-[#38BDF8] border-[#222F43]">
                v1.2
              </span>
            </div>
            <p className="text-[10px] text-[#94A3B8] leading-none hidden sm:block">
              Thoracic CT Segmentation & 3D Analytics
            </p>
          </div>
        </div>

        {/* Desktop Section Navigation Tabs (hidden on < 1024px) */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleTabClick(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-[#0D9488] text-[#FFFFFF] shadow-sm font-semibold'
                    : 'text-[#CBD5E1] hover:text-[#FFFFFF] hover:bg-[#161F30]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.id === 'workspace' && (
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-mono uppercase font-semibold ${
                      isActive ? 'bg-black/30 text-white' : 'bg-[#161F30] text-[#38BDF8]'
                    }`}
                  >
                    2D/3D
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Desktop Quick Actions & User Profile */}
        <div className="hidden lg:flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenNewStudy}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-[#222F43] bg-[#0F1523] text-[#F8FAFC] hover:border-[#0D9488] hover:text-[#FFFFFF] transition cursor-pointer"
            title="Create New Subject Study"
          >
            <Plus className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Study</span>
          </button>

          <button
            type="button"
            onClick={onOpenUpload}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-[#222F43] bg-[#0F1523] text-[#F8FAFC] hover:border-[#38BDF8] hover:text-[#FFFFFF] transition cursor-pointer"
            title="Upload DICOM or NIfTI CT Scan"
          >
            <Upload className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Upload CT</span>
          </button>

          <button
            type="button"
            onClick={onOpenSample}
            className="hidden xl:flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-[#222F43] bg-[#0F1523] text-[#F8FAFC] hover:border-[#14B8A6] hover:text-[#FFFFFF] transition cursor-pointer"
            title="Generate Calibrated Synthetic CT Benchmark"
          >
            <Wand2 className="w-3.5 h-3.5 text-[#14B8A6]" />
            <span>Phantom</span>
          </button>

          {onOpenLanding && (
            <button
              type="button"
              onClick={onOpenLanding}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-[#222F43] bg-[#0F1523] text-[#38BDF8] hover:border-[#38BDF8] hover:bg-[#161F30] transition cursor-pointer"
              title="View Public 3D Showcase & Landing Page"
            >
              <span>3D Showcase</span>
            </button>
          )}

          {/* User Profile Pill & Logout */}
          <div className="flex items-center gap-2 pl-2 border-l border-[#222F43]">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] bg-[#161F30] text-[#38BDF8] border border-[#222F43]">
                {user?.full_name ? user.full_name[0] : 'R'}
              </div>
              <div className="text-left leading-tight">
                <div className="text-[11px] font-medium truncate max-w-[110px] text-[#FFFFFF]">
                  {user?.full_name || 'Researcher'}
                </div>
                <div className="text-[9px] font-mono text-[#94A3B8]">
                  {user?.role || 'Principal Investigator'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded text-[#94A3B8] hover:text-red-400 hover:bg-[#161F30] transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mobile Hamburger & Quick Upload Button */}
        <div className="flex lg:hidden items-center gap-2">
          <button
            type="button"
            onClick={onOpenUpload}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium border border-[#222F43] bg-[#0F1523] text-[#38BDF8] hover:border-[#38BDF8] transition cursor-pointer"
            title="Upload CT"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="text-xs">Upload</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-lg bg-[#0F1523] border border-[#222F43] text-[#CBD5E1] hover:text-[#FFFFFF] transition cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-[#38BDF8]" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#222F43] bg-[#080B10]/95 backdrop-blur-xl px-4 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabClick(item.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? 'bg-[#0D9488] text-[#FFFFFF] font-semibold'
                      : 'bg-[#0F1523] text-[#CBD5E1] hover:text-[#FFFFFF] border border-[#222F43]'
                  }`}
                >
                  <Icon className="w-4 h-4 text-[#38BDF8]" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Mobile Action Buttons */}
          <div className="pt-2 border-t border-[#222F43] flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                onOpenNewStudy();
                setMobileMenuOpen(false);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#0F1523] border border-[#222F43] text-[#FFFFFF]"
            >
              <Plus className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>New Study</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenSample();
                setMobileMenuOpen(false);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#0F1523] border border-[#222F43] text-[#FFFFFF]"
            >
              <Wand2 className="w-3.5 h-3.5 text-[#14B8A6]" />
              <span>Phantom</span>
            </button>
            {onOpenLanding && (
              <button
                type="button"
                onClick={() => {
                  onOpenLanding();
                  setMobileMenuOpen(false);
                }}
                className="w-full py-2 px-3 rounded-lg bg-[#161F30] border border-[#222F43] text-[#38BDF8] text-center font-medium"
              >
                Launch 3D Showcase
              </button>
            )}
          </div>

          {/* Mobile User Info & Logout */}
          <div className="pt-2 border-t border-[#222F43] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#161F30] text-[#38BDF8] flex items-center justify-center font-bold text-xs border border-[#222F43]">
                {user?.full_name ? user.full_name[0] : 'R'}
              </div>
              <div>
                <p className="text-xs font-medium text-[#FFFFFF]">{user?.full_name || 'Researcher'}</p>
                <p className="text-[10px] font-mono text-[#94A3B8]">{user?.role || 'Principal Investigator'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onLogout();
                setMobileMenuOpen(false);
              }}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg bg-red-950/30 border border-red-500/30"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
