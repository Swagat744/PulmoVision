import {
  AnatomicalMeshResponseDTO,
  BinaryCTSlicePayload,
  BinaryMaskSlicePayload,
  DashboardSummaryDTO,
  ModelVersionDTO,
  MPRPlane,
  ScanMetadataDTO,
  SegmentationJobStatusDTO,
  SegmentationResultDTO,
  StudyDTO,
  TokenResponseDTO,
  UserDTO,
} from '../types/api';

const TOKEN_STORAGE_KEY = 'pulmovision_jwt_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra || {}) };
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function handleJsonResponse<T>(resp: Response): Promise<T> {
  if (!resp.ok) {
    let errDetail = `HTTP ${resp.status}: ${resp.statusText}`;
    try {
      const body = await resp.json();
      if (body && body.detail) {
        errDetail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      }
    } catch {
      // ignore parse error
    }
    throw new Error(errDetail);
  }
  if (resp.status === 204) {
    return undefined as unknown as T;
  }
  return resp.json() as Promise<T>;
}

export const apiClient = {
  async login(email: string, password: string): Promise<TokenResponseDTO> {
    const resp = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await handleJsonResponse<TokenResponseDTO>(resp);
    setStoredToken(data.access_token);
    return data;
  },

  async register(
    email: string,
    password: string,
    full_name: string,
    role: string = 'researcher'
  ): Promise<TokenResponseDTO> {
    const resp = await fetch('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name, role }),
    });
    const data = await handleJsonResponse<TokenResponseDTO>(resp);
    setStoredToken(data.access_token);
    return data;
  },

  async getMe(): Promise<UserDTO> {
    const resp = await fetch('/api/v1/auth/me', {
      headers: authHeaders(),
    });
    return handleJsonResponse<UserDTO>(resp);
  },

  async getDashboardSummary(): Promise<DashboardSummaryDTO> {
    const resp = await fetch('/api/v1/dashboard/summary', {
      headers: authHeaders(),
    });
    return handleJsonResponse<DashboardSummaryDTO>(resp);
  },

  async listStudies(): Promise<StudyDTO[]> {
    const resp = await fetch('/api/v1/studies', {
      headers: authHeaders(),
    });
    return handleJsonResponse<StudyDTO[]>(resp);
  },

  async createStudy(payload: {
    patient_anon_id: string;
    title: string;
    clinical_notes?: string;
    modality?: string;
    acquisition_date?: string;
  }): Promise<StudyDTO> {
    const resp = await fetch('/api/v1/studies', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    return handleJsonResponse<StudyDTO>(resp);
  },

  async deleteStudy(studyId: string): Promise<void> {
    const resp = await fetch(`/api/v1/studies/${studyId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return handleJsonResponse<void>(resp);
  },

  async uploadScan(studyId: string, file: File): Promise<ScanMetadataDTO> {
    const form = new FormData();
    form.append('study_id', studyId);
    form.append('file', file);
    const resp = await fetch('/api/v1/scans/upload', {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
    return handleJsonResponse<ScanMetadataDTO>(resp);
  },

  async generateSampleScan(
    studyId: string,
    preset: 'nifti_standard' | 'dicom_axial' | 'dicom_oblique' = 'nifti_standard',
    numSlices: number = 32
  ): Promise<ScanMetadataDTO> {
    const params = new URLSearchParams({
      study_id: studyId,
      preset,
      num_slices: String(numSlices),
    });
    const resp = await fetch(`/api/v1/scans/generate-sample?${params.toString()}`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return handleJsonResponse<ScanMetadataDTO>(resp);
  },

  async listModels(): Promise<ModelVersionDTO[]> {
    const resp = await fetch('/api/v1/models', {
      headers: authHeaders(),
    });
    return handleJsonResponse<ModelVersionDTO[]>(resp);
  },

  async submitSegmentationJob(
    scanId: string,
    modelKey: string = 'lungmask_r231',
    batchSize: number = 4
  ): Promise<SegmentationJobStatusDTO> {
    const resp = await fetch('/api/v1/segmentation/jobs', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        scan_id: scanId,
        model_key: modelKey,
        batch_size: batchSize,
      }),
    });
    return handleJsonResponse<SegmentationJobStatusDTO>(resp);
  },

  async getJobStatus(jobId: string): Promise<SegmentationJobStatusDTO> {
    const resp = await fetch(`/api/v1/segmentation/jobs/${jobId}`, {
      headers: authHeaders(),
    });
    return handleJsonResponse<SegmentationJobStatusDTO>(resp);
  },

  async listJobs(scanId?: string): Promise<SegmentationJobStatusDTO[]> {
    const q = scanId ? `?scan_id=${encodeURIComponent(scanId)}` : '';
    const resp = await fetch(`/api/v1/segmentation/jobs${q}`, {
      headers: authHeaders(),
    });
    return handleJsonResponse<SegmentationJobStatusDTO[]>(resp);
  },

  async getSegmentationResult(resultId: string): Promise<SegmentationResultDTO> {
    const resp = await fetch(`/api/v1/segmentation/results/${resultId}`, {
      headers: authHeaders(),
    });
    return handleJsonResponse<SegmentationResultDTO>(resp);
  },

  async listScanSegmentationResults(scanId: string): Promise<SegmentationResultDTO[]> {
    const resp = await fetch(`/api/v1/segmentation/scans/${scanId}/results`, {
      headers: authHeaders(),
    });
    return handleJsonResponse<SegmentationResultDTO[]>(resp);
  },

  async fetchCTSliceBinary(
    scanId: string,
    plane: MPRPlane,
    index: number
  ): Promise<BinaryCTSlicePayload> {
    const resp = await fetch(
      `/api/v1/viewer/scans/${scanId}/slice?plane=${plane}&index=${index}`,
      { headers: authHeaders() }
    );
    if (!resp.ok) {
      throw new Error(`Failed to fetch CT slice (${plane} #${index}): ${resp.statusText}`);
    }
    const width = parseInt(resp.headers.get('X-Slice-Width') || '256', 10);
    const height = parseInt(resp.headers.get('X-Slice-Height') || '256', 10);
    const spacingHorizMM = parseFloat(resp.headers.get('X-Spacing-Horizontal-MM') || '1.0');
    const spacingVertMM = parseFloat(resp.headers.get('X-Spacing-Vertical-MM') || '1.0');
    const buf = await resp.arrayBuffer();
    const huData = new Int16Array(buf);
    return {
      width,
      height,
      spacingHorizMM,
      spacingVertMM,
      plane,
      sliceIndex: index,
      huData,
    };
  },

  async fetchMaskSliceBinary(
    resultId: string,
    plane: MPRPlane,
    index: number
  ): Promise<BinaryMaskSlicePayload> {
    const resp = await fetch(
      `/api/v1/viewer/results/${resultId}/mask-slice?plane=${plane}&index=${index}`,
      { headers: authHeaders() }
    );
    if (!resp.ok) {
      throw new Error(`Failed to fetch mask slice (${plane} #${index}): ${resp.statusText}`);
    }
    const width = parseInt(resp.headers.get('X-Slice-Width') || '256', 10);
    const height = parseInt(resp.headers.get('X-Slice-Height') || '256', 10);
    const buf = await resp.arrayBuffer();
    const maskData = new Uint8Array(buf);
    return { width, height, maskData };
  },

  async fetchAnatomicalMesh3D(resultId: string): Promise<AnatomicalMeshResponseDTO> {
    const endpoint =
      resultId === 'showcase_result'
        ? '/api/v1/viewer/showcase/mesh'
        : `/api/v1/viewer/results/${resultId}/mesh`;
    const resp = await fetch(endpoint, {
      headers: resultId === 'showcase_result' ? {} : authHeaders(),
    });
    return handleJsonResponse<AnatomicalMeshResponseDTO>(resp);
  },

  async fetchShowcaseInfo(): Promise<any> {
    const resp = await fetch('/api/v1/viewer/showcase/info');
    return handleJsonResponse<any>(resp);
  },

  async fetchShowcaseCTSliceBinary(
    plane: MPRPlane,
    index: number
  ): Promise<BinaryCTSlicePayload> {
    const resp = await fetch(`/api/v1/viewer/showcase/slice?plane=${plane}&index=${index}`);
    if (!resp.ok) {
      throw new Error(`Failed to fetch showcase CT slice: ${resp.statusText}`);
    }
    const width = parseInt(resp.headers.get('X-Slice-Width') || '256', 10);
    const height = parseInt(resp.headers.get('X-Slice-Height') || '256', 10);
    const spacingHorizMM = parseFloat(resp.headers.get('X-Spacing-Horizontal-MM') || '1.25');
    const spacingVertMM = parseFloat(resp.headers.get('X-Spacing-Vertical-MM') || '1.25');
    const buf = await resp.arrayBuffer();
    const huData = new Int16Array(buf);
    return {
      width,
      height,
      spacingHorizMM,
      spacingVertMM,
      plane,
      sliceIndex: index,
      huData,
    };
  },

  async fetchShowcaseMaskSliceBinary(
    plane: MPRPlane,
    index: number
  ): Promise<BinaryMaskSlicePayload> {
    const resp = await fetch(`/api/v1/viewer/showcase/mask-slice?plane=${plane}&index=${index}`);
    if (!resp.ok) {
      throw new Error(`Failed to fetch showcase mask slice: ${resp.statusText}`);
    }
    const width = parseInt(resp.headers.get('X-Slice-Width') || '256', 10);
    const height = parseInt(resp.headers.get('X-Slice-Height') || '256', 10);
    const buf = await resp.arrayBuffer();
    const maskData = new Uint8Array(buf);
    return { width, height, maskData };
  },

  async downloadAuthenticatedFile(url: string, fallbackFilename: string): Promise<void> {
    const resp = await fetch(url, { headers: authHeaders() });
    if (!resp.ok) {
      throw new Error(`Export download failed (${resp.status}): ${resp.statusText}`);
    }
    const blob = await resp.blob();
    const disp = resp.headers.get('Content-Disposition');
    let filename = fallbackFilename;
    if (disp && disp.includes('filename=')) {
      const match = disp.match(/filename="?([^"]+)"?/);
      if (match && match[1]) {
        filename = match[1];
      }
    }
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  },

  async downloadMaskNifti(resultId: string): Promise<void> {
    await this.downloadAuthenticatedFile(
      `/api/v1/reports/${resultId}/export-mask`,
      `pulmovision_mask_${resultId.slice(0, 8)}.nii.gz`
    );
  },

  async downloadReportPdf(resultId: string): Promise<void> {
    await this.downloadAuthenticatedFile(
      `/api/v1/reports/${resultId}/export-pdf`,
      `pulmovision_report_${resultId.slice(0, 8)}.pdf`
    );
  },

  async downloadMetricsJson(resultId: string): Promise<void> {
    await this.downloadAuthenticatedFile(
      `/api/v1/reports/${resultId}/export-json`,
      `pulmovision_metrics_${resultId.slice(0, 8)}.json`
    );
  },
};

