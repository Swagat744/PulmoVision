import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  HardDrive,
  Layers,
  Lock,
  Mail,
  ShieldAlert,
  User,
} from 'lucide-react';
import { VolumetricSliceStack } from './VolumetricSliceStack';

interface AuthPageProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onRegister: (email: string, pass: string, name: string) => Promise<void>;
  onBackToLanding: () => void;
  loading: boolean;
  error: string | null;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onLogin,
  onRegister,
  onBackToLanding,
  loading,
  error,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState<string>('researcher@pulmovision.ai');
  const [password, setPassword] = useState<string>('PulmoVision2026!');
  const [fullName, setFullName] = useState<string>('Dr. Elena Vance');
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      await onLogin(email, password);
    } else {
      await onRegister(email, password, fullName);
    }
  };

  return (
    <div className="min-h-screen bg-[#080B10] text-[#F8FAFC] flex flex-col justify-between select-none relative overflow-x-hidden">
      {/* Top Header Strip with Return Link */}
      <header className="relative z-20 px-4 sm:px-6 py-3.5 flex items-center justify-between border-b border-[#222F43] bg-[#080B10]/90 backdrop-blur-md">
        <button
          type="button"
          onClick={onBackToLanding}
          className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#CBD5E1] hover:text-[#FFFFFF] transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#38BDF8]" />
          <span>Back to Overview</span>
        </button>

        <div className="flex items-center gap-2 text-[11px] sm:text-xs font-mono text-[#94A3B8]">
          <span className="w-2 h-2 rounded-full bg-[#14B8A6] animate-pulse" />
          <span className="hidden sm:inline">LPS+ Calibrated Inference Environment</span>
          <span className="sm:hidden">LPS+ Enclave</span>
        </div>
      </header>

      {/* Main Split-Screen Workspace: stacks vertically on mobile, side-by-side on lg */}
      <div className="flex-1 flex flex-col lg:flex-row items-stretch max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-10 gap-6 lg:gap-8 my-auto relative z-10">
        {/* LEFT COLUMN: Medical AI Volumetric Visualization */}
        <div className="lg:w-1/2 flex flex-col justify-between p-6 sm:p-8 rounded-2xl bg-[#0F1523]/80 border border-[#222F43] backdrop-blur-md relative overflow-hidden shadow-2xl min-h-[320px] sm:min-h-[420px]">
          {/* Volumetric CT Slice Stack Animation in background */}
          <div className="absolute inset-0 pointer-events-none opacity-80">
            <VolumetricSliceStack />
          </div>

          {/* Top Branding & Context */}
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0D9488] to-[#38BDF8] flex items-center justify-center text-[#080B10] font-black text-sm shadow-md">
                PV
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#FFFFFF]">PulmoVision AI</h1>
                <p className="text-[10px] text-[#38BDF8] font-mono uppercase tracking-wider">
                  Thoracic CT Segmentation & 3D Analytics
                </p>
              </div>
            </div>

            <div className="pt-4 sm:pt-6 max-w-md">
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-[#161F30] border border-[#222F43] text-[10px] font-mono text-[#38BDF8] uppercase tracking-wider mb-2">
                Secure Research Enclave
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-[#FFFFFF] leading-snug">
                Volumetric Thoracic AI Research Suite.
              </h2>
              <p className="text-xs sm:text-sm text-[#CBD5E1] mt-2 leading-relaxed">
                Access calibrated medical volumes, automated deep learning bilateral and 5-lobe segmentation, and interactive physical 3D mesh reconstruction.
              </p>
            </div>
          </div>

          {/* Bottom Technical Indicators */}
          <div className="relative z-10 pt-6 sm:pt-8 border-t border-[#222F43] grid grid-cols-2 gap-3 text-xs font-mono text-[#CBD5E1]">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-[#38BDF8]" />
              <span>lungmask v0.2.22</span>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-[#14B8A6]" />
              <span>DICOM / NIfTI Native</span>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#38BDF8]" />
              <span>5-Lobe Separation</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>LPS+ Physical Space</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Elegant High-Contrast Authentication Form */}
        <div className="lg:w-1/2 flex flex-col justify-center p-6 sm:p-8 lg:p-10 rounded-2xl bg-[#0F1523]/95 border border-[#222F43] backdrop-blur-xl shadow-2xl">
          <div className="max-w-md w-full mx-auto space-y-6">
            <div>
              <span className="text-xs font-mono text-[#38BDF8] uppercase tracking-wider font-semibold">
                Authorized Access
              </span>
              <h3 className="text-2xl font-bold text-[#FFFFFF] mt-1">
                {mode === 'login' ? 'Sign in to Workspace' : 'Register Researcher Account'}
              </h3>
              <p className="text-xs sm:text-sm text-[#CBD5E1] mt-1">
                {mode === 'login'
                  ? 'Enter your institutional credentials to access your thoracic research studies.'
                  : 'Enroll as an authorized investigator to access volumetric AI segmentation.'}
              </p>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex rounded-lg bg-[#080B10] p-1 border border-[#222F43] text-xs font-medium">
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 py-2 rounded-md transition font-medium ${
                  mode === 'login'
                    ? 'bg-[#0D9488] text-white font-semibold shadow-sm'
                    : 'text-[#94A3B8] hover:text-[#FFFFFF]'
                }`}
              >
                Researcher Sign In
              </button>
              <button
                type="button"
                onClick={() => setMode('register')}
                className={`flex-1 py-2 rounded-md transition font-medium ${
                  mode === 'register'
                    ? 'bg-[#0D9488] text-white font-semibold shadow-sm'
                    : 'text-[#94A3B8] hover:text-[#FFFFFF]'
                }`}
              >
                New Account
              </button>
            </div>

            {/* Error Feedback Alert */}
            {error && (
              <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/40 text-xs text-red-200 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Form with high-contrast inputs */}
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-[#CBD5E1] mb-1.5">
                    Full Name & Academic Title
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. Elena Vance"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#161F30] border border-[#222F43] text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8] transition text-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#CBD5E1] mb-1.5">
                  Institutional Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    placeholder="researcher@institution.org"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#161F30] border border-[#222F43] text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8] transition font-mono text-xs sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#CBD5E1] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3 top-2.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 rounded-lg bg-[#161F30] border border-[#222F43] text-[#FFFFFF] placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8] transition text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-3 text-[#94A3B8] hover:text-[#FFFFFF] transition cursor-pointer"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-[#0D9488] hover:bg-[#14B8A6] text-white font-semibold transition shadow-md shadow-[#0D9488]/20 disabled:opacity-50 text-sm mt-3 cursor-pointer"
              >
                {loading
                  ? 'Verifying Credentials...'
                  : mode === 'login'
                  ? 'Authenticate & Enter Workspace'
                  : 'Register Researcher Account'}
              </button>
            </form>

            <div className="pt-4 border-t border-[#222F43] text-[11px] text-[#94A3B8] text-center">
              Secured with SHA-256 JWT tokens & Argon2 password hashing
            </div>
          </div>
        </div>
      </div>

      {/* Subtle Bottom Research Ribbon */}
      <footer className="relative z-10 px-4 sm:px-6 py-3 border-t border-[#222F43] text-center text-[11px] text-[#94A3B8] font-mono">
        PulmoVision AI Research Suite · Academic & Educational Volumetric Platform
      </footer>
    </div>
  );
};
