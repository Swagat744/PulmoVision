import React, { useCallback, useEffect, useState } from 'react';
import { apiClient, getStoredToken, setStoredToken } from './api/client';
import {
  DashboardSummaryDTO,
  ModelVersionDTO,
  ScanMetadataDTO,
  SegmentationJobStatusDTO,
  SegmentationResultDTO,
  StudyDTO,
  UserDTO,
} from './types/api';
import { Navbar, NavTab } from './components/layout/Navbar';
import { ResearchDashboard } from './components/dashboard/ResearchDashboard';
import { StudiesManager } from './components/studies/StudiesManager';
import { RadiologyWorkspace } from './components/workspace/RadiologyWorkspace';
import { QuantitativeAnalysisView } from './components/analysis/QuantitativeAnalysisView';
import { ReportsExportView } from './components/reports/ReportsExportView';
import { PlatformSettingsView } from './components/settings/PlatformSettingsView';
import { CreateStudyModal } from './components/modals/CreateStudyModal';
import { UploadScanModal } from './components/modals/UploadScanModal';
import { GenerateSampleModal } from './components/modals/GenerateSampleModal';
import { LandingPage } from './components/landing/LandingPage';
import { AuthPage } from './components/auth/AuthPage';

export const App: React.FC = () => {
  // Authentication & Public View State
  const [user, setUser] = useState<UserDTO | null>(null);
  const [publicView, setPublicView] = useState<'landing' | 'auth'>('landing');
  const [showLandingShowcase, setShowLandingShowcase] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Navigation & Core Entities
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardSummaryDTO | null>(null);
  const [studies, setStudies] = useState<StudyDTO[]>([]);
  const [models, setModels] = useState<ModelVersionDTO[]>([]);
  const [selectedStudyId, setSelectedStudyId] = useState<string | null>(null);
  const [selectedScan, setSelectedScan] = useState<ScanMetadataDTO | null>(null);
  const [scanResults, setScanResults] = useState<SegmentationResultDTO[]>([]);
  const [selectedResult, setSelectedResult] = useState<SegmentationResultDTO | null>(null);
  const [activeJob, setActiveJob] = useState<SegmentationJobStatusDTO | null>(null);

  // Modals Visibility
  const [isCreateStudyOpen, setIsCreateStudyOpen] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isSampleOpen, setIsSampleOpen] = useState<boolean>(false);

  // Upload & Sample Synthesis Progress
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);

  const [generatingSample, setGeneratingSample] = useState<boolean>(false);
  const [sampleStatusMsg, setSampleStatusMsg] = useState<string | null>(null);
  const [sampleErrorMsg, setSampleErrorMsg] = useState<string | null>(null);

  // User Preferences & DL Guardrails
  const [selectedModelKey, setSelectedModelKey] = useState<string>('lungmask_r231');
  const [batchSize, setBatchSize] = useState<number>(4);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.48);
  const [showCrosshairs, setShowCrosshairs] = useState<boolean>(true);

  // Data Refresh
  const refreshAllData = useCallback(async () => {
    try {
      const [dashData, studiesData, modelsData] = await Promise.all([
        apiClient.getDashboardSummary(),
        apiClient.listStudies(),
        apiClient.listModels(),
      ]);
      setDashboard(dashData);
      setStudies(studiesData);
      setModels(modelsData);

      if (studiesData.length > 0 && !selectedStudyId) {
        const firstStudy = studiesData[0];
        setSelectedStudyId(firstStudy.id);
        if (firstStudy.scans.length > 0 && !selectedScan) {
          setSelectedScan(firstStudy.scans[0]);
        }
      }
    } catch {
      // Ignore if session expired
    }
  }, [selectedStudyId, selectedScan]);

  // Check stored auth token on startup
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    apiClient
      .getMe()
      .then((u) => {
        setUser(u);
      })
      .catch(() => {
        setStoredToken(null);
      });
  }, []);

  // Fetch data when authenticated
  useEffect(() => {
    if (user) {
      refreshAllData();
    }
  }, [user, refreshAllData]);

  // Load results and running jobs when selected scan changes
  useEffect(() => {
    if (!selectedScan) {
      setScanResults([]);
      setSelectedResult(null);
      return;
    }

    apiClient
      .listScanSegmentationResults(selectedScan.id)
      .then((resList) => {
        setScanResults(resList);
        setSelectedResult(resList.length > 0 ? resList[0] : null);
      })
      .catch(() => {
        setScanResults([]);
        setSelectedResult(null);
      });

    apiClient
      .listJobs(selectedScan.id)
      .then((jobs) => {
        const running = jobs.find((j) => j.status === 'QUEUED' || j.status === 'PROCESSING');
        if (running) setActiveJob(running);
      })
      .catch(() => {});
  }, [selectedScan]);

  // Poll running segmentation job
  useEffect(() => {
    if (!activeJob || (activeJob.status !== 'QUEUED' && activeJob.status !== 'PROCESSING')) {
      return;
    }
    const timer = setInterval(async () => {
      try {
        const updated = await apiClient.getJobStatus(activeJob.id);
        setActiveJob(updated);
        if (updated.status === 'COMPLETED' && updated.result_id) {
          const resDto = await apiClient.getSegmentationResult(updated.result_id);
          setScanResults((prev) => [resDto, ...prev.filter((r) => r.id !== resDto.id)]);
          setSelectedResult(resDto);
          refreshAllData();
        } else if (updated.status === 'FAILED' || updated.status === 'CANCELLED') {
          refreshAllData();
        }
      } catch {
        // Transient poll error
      }
    }, 1500);

    return () => clearInterval(timer);
  }, [activeJob, refreshAllData]);

  // Auth Handlers
  const handleLogin = async (email: string, pass: string) => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const resp = await apiClient.login(email, pass);
      setUser(resp.user);
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRegister = async (email: string, pass: string, name: string) => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      const resp = await apiClient.register(email, pass, name);
      setUser(resp.user);
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setStoredToken(null);
    setUser(null);
    setDashboard(null);
    setStudies([]);
    setSelectedScan(null);
    setSelectedResult(null);
    setPublicView('landing');
    setShowLandingShowcase(false);
  };

  // Study Handlers
  const handleCreateStudy = async (data: {
    patient_anon_id: string;
    title: string;
    clinical_notes: string;
  }) => {
    const created = await apiClient.createStudy({
      patient_anon_id: data.patient_anon_id,
      title: data.title,
      clinical_notes: data.clinical_notes,
      modality: 'CT',
    });
    setStudies((prev) => [created, ...prev]);
    setSelectedStudyId(created.id);
    await refreshAllData();
  };

  const handleDeleteStudy = async (studyId: string) => {
    await apiClient.deleteStudy(studyId);
    const updated = studies.filter((s) => s.id !== studyId);
    setStudies(updated);
    if (selectedStudyId === studyId) {
      const nextStudy = updated[0] || null;
      setSelectedStudyId(nextStudy?.id || null);
      setSelectedScan(nextStudy?.scans[0] || null);
    }
    await refreshAllData();
  };

  const handleSelectStudy = (studyId: string) => {
    setSelectedStudyId(studyId);
    const study = studies.find((s) => s.id === studyId);
    if (study && study.scans.length > 0) {
      setSelectedScan(study.scans[0]);
    } else {
      setSelectedScan(null);
    }
  };

  // Upload Scan Handler
  const handleFileUpload = async (file: File, studyId: string | null) => {
    let targetStudyId = studyId || selectedStudyId;
    setUploading(true);
    setUploadErrorMsg(null);
    setUploadStatusMsg(`Ingesting & calibrating ${file.name}...`);

    try {
      if (!targetStudyId) {
        const autoStudy = await apiClient.createStudy({
          patient_anon_id: 'PV-AUTO-' + Math.floor(100 + Math.random() * 900),
          title: 'Thoracic CT Cohort Study',
          modality: 'CT',
        });
        targetStudyId = autoStudy.id;
        setSelectedStudyId(autoStudy.id);
      }

      const scanDto = await apiClient.uploadScan(targetStudyId, file);
      setSelectedScan(scanDto);
      setUploadStatusMsg(
        `Ingested ${scanDto.original_filename} (${scanDto.dimensions.x}×${scanDto.dimensions.y}×${scanDto.dimensions.z})`
      );
      await refreshAllData();
      setIsUploadOpen(false);
    } catch (err: any) {
      setUploadErrorMsg(err.message || 'Scan validation failed');
    } finally {
      setUploading(false);
    }
  };

  // Sample Benchmark Generator Handler
  const handleGenerateSample = async (
    preset: 'nifti_standard' | 'dicom_axial' | 'dicom_oblique',
    sliceCount: number,
    studyId: string | null
  ) => {
    let targetStudyId = studyId || selectedStudyId;
    setGeneratingSample(true);
    setSampleErrorMsg(null);
    setSampleStatusMsg(`Synthesizing calibrated 3D volume (${preset}, ${sliceCount} slices)...`);

    try {
      if (!targetStudyId) {
        const autoStudy = await apiClient.createStudy({
          patient_anon_id: 'PV-BENCH-' + Math.floor(100 + Math.random() * 900),
          title: 'Calibrated Thoracic Benchmark Cohort',
          clinical_notes: 'Physical phantom benchmark for deep learning evaluation',
          modality: 'CT',
        });
        targetStudyId = autoStudy.id;
        setSelectedStudyId(autoStudy.id);
      }

      const scanDto = await apiClient.generateSampleScan(targetStudyId, preset, sliceCount);
      setSelectedScan(scanDto);
      setSampleStatusMsg(`Benchmark volume ready: ${scanDto.original_filename}`);
      await refreshAllData();
      setIsSampleOpen(false);
    } catch (err: any) {
      setSampleErrorMsg(err.message || 'Sample generation failed');
    } finally {
      setGeneratingSample(false);
    }
  };

  // Launch Segmentation Job
  const handleStartSegmentation = async () => {
    if (!selectedScan) return;
    try {
      const job = await apiClient.submitSegmentationJob(
        selectedScan.id,
        selectedModelKey,
        batchSize
      );
      setActiveJob(job);
    } catch (err: any) {
      alert(err.message || 'Failed to submit segmentation job');
    }
  };

  // Export File Download Actions
  const handleDownloadMask = () => {
    if (!selectedResult) return;
    apiClient.downloadMaskNifti(selectedResult.id).catch((err) => alert(err.message));
  };

  const handleDownloadReport = () => {
    if (!selectedResult) return;
    apiClient.downloadReportPdf(selectedResult.id).catch((err) => alert(err.message));
  };

  const handleDownloadMetrics = () => {
    if (!selectedResult) return;
    apiClient.downloadMetricsJson(selectedResult.id).catch((err) => alert(err.message));
  };

  // Active Study Entity
  const currentStudy = studies.find((s) => s.id === selectedStudyId) || studies[0] || null;

  // Unauthenticated Views: Landing Page or Split-Screen Auth Page
  if (!user) {
    if (publicView === 'auth') {
      return (
        <AuthPage
          onLogin={handleLogin}
          onRegister={handleRegister}
          onBackToLanding={() => setPublicView('landing')}
          loading={authLoading}
          error={authError}
        />
      );
    }
    return (
      <LandingPage
        onEnterAuth={() => setPublicView('auth')}
      />
    );
  }

  // Unified Dark Medical AI Architecture
  const isWorkstation = activeTab === 'workspace';

  return (
    <div className="min-h-screen flex flex-col bg-[#080B10] text-[#F8FAFC] selection:bg-[#0D9488]/30 selection:text-[#38BDF8]">
      {/* Universal Responsive Medical AI Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        onOpenNewStudy={() => setIsCreateStudyOpen(true)}
        onOpenUpload={() => setIsUploadOpen(true)}
        onOpenSample={() => setIsSampleOpen(true)}
        onOpenLanding={() => setShowLandingShowcase(true)}
      />

      {/* Main Section Content Area */}
      <main
        className={`flex-1 ${
          isWorkstation ? 'p-1 sm:p-2' : 'p-3 sm:p-6 max-w-[1720px] mx-auto w-full'
        }`}
      >
        {activeTab === 'dashboard' && (
          <ResearchDashboard
            dashboard={dashboard}
            studies={studies}
            models={models}
            user={user}
            onOpenStudy={handleSelectStudy}
            onOpenWorkstation={() => setActiveTab('workspace')}
            onOpenUpload={() => setIsUploadOpen(true)}
            onOpenSample={() => setIsSampleOpen(true)}
            onOpenNewStudy={() => setIsCreateStudyOpen(true)}
          />
        )}

        {activeTab === 'studies' && (
          <StudiesManager
            studies={studies}
            selectedStudyId={selectedStudyId}
            onSelectStudy={handleSelectStudy}
            onOpenWorkstation={() => setActiveTab('workspace')}
            onDeleteStudy={handleDeleteStudy}
            onOpenNewStudy={() => setIsCreateStudyOpen(true)}
            onOpenUpload={() => setIsUploadOpen(true)}
            onOpenSample={() => setIsSampleOpen(true)}
          />
        )}

        {activeTab === 'workspace' && (
          <RadiologyWorkspace
            study={currentStudy}
            scan={selectedScan}
            results={scanResults}
            selectedResult={selectedResult}
            onSelectResult={setSelectedResult}
            models={models}
            selectedModelKey={selectedModelKey}
            setSelectedModelKey={setSelectedModelKey}
            batchSize={batchSize}
            setBatchSize={setBatchSize}
            onStartSegmentation={handleStartSegmentation}
            activeJob={activeJob}
            onDownloadMask={handleDownloadMask}
            onDownloadReport={handleDownloadReport}
            onDownloadMetrics={handleDownloadMetrics}
            onSelectScan={setSelectedScan}
            onOpenSampleModal={() => setIsSampleOpen(true)}
            onOpenUploadModal={() => setIsUploadOpen(true)}
          />
        )}

        {activeTab === 'analysis' && (
          <QuantitativeAnalysisView
            study={currentStudy}
            scan={selectedScan}
            selectedResult={selectedResult}
            results={scanResults}
            onSelectResult={setSelectedResult}
            onDownloadMetrics={handleDownloadMetrics}
            onOpenWorkstation={() => setActiveTab('workspace')}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsExportView
            study={currentStudy}
            scan={selectedScan}
            selectedResult={selectedResult}
            user={user}
            onDownloadMask={handleDownloadMask}
            onDownloadReport={handleDownloadReport}
            onDownloadMetrics={handleDownloadMetrics}
          />
        )}

        {activeTab === 'settings' && (
          <PlatformSettingsView
            user={user}
            batchSize={batchSize}
            setBatchSize={setBatchSize}
            overlayOpacity={overlayOpacity}
            setOverlayOpacity={setOverlayOpacity}
            showCrosshairs={showCrosshairs}
            setShowCrosshairs={setShowCrosshairs}
          />
        )}
      </main>

      {/* Global Modals */}
      <CreateStudyModal
        isOpen={isCreateStudyOpen}
        onClose={() => setIsCreateStudyOpen(false)}
        onSubmit={handleCreateStudy}
      />

      <UploadScanModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        studies={studies}
        selectedStudyId={selectedStudyId}
        onUpload={handleFileUpload}
        uploading={uploading}
        uploadStatusMsg={uploadStatusMsg}
        uploadErrorMsg={uploadErrorMsg}
      />

      <GenerateSampleModal
        isOpen={isSampleOpen}
        onClose={() => setIsSampleOpen(false)}
        studies={studies}
        selectedStudyId={selectedStudyId}
        onGenerate={handleGenerateSample}
        generating={generatingSample}
        statusMsg={sampleStatusMsg}
        errorMsg={sampleErrorMsg}
      />

      {/* Landing Showcase Modal for Authenticated Users */}
      {showLandingShowcase && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#080B10]">
          <div className="fixed top-4 right-4 z-50">
            <button
              type="button"
              onClick={() => setShowLandingShowcase(false)}
              className="px-4 py-2 rounded-lg bg-[#111722] text-[#E5EDF5] hover:bg-[#18212D] border border-[#263445] text-xs font-semibold shadow-2xl transition"
            >
              Close Showcase & Return to Workstation ✕
            </button>
          </div>
          <LandingPage onEnterAuth={() => setShowLandingShowcase(false)} />
        </div>
      )}
    </div>
  );
};
