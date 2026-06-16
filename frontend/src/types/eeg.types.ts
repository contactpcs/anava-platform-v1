export type ReportStatus = "UPLOADING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface EEGReport {
  id: string;
  patient_id: string;
  session_id: string | null;
  report_name: string;
  file_size_bytes: number;
  report_type: string;
  sha256_checksum: string;
  version: number;
  status: ReportStatus;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EEGReportListResponse {
  success: boolean;
  message: string;
  data: EEGReport[];
  meta: {
    total: number;
    skip: number;
    limit: number;
    has_more: boolean;
  };
}

export interface UploadEEGReportPayload {
  file: File;
  patient_id: string;
  session_id?: string;
  report_name: string;
  report_type?: string;
}
