import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { EEGReport, EEGReportListResponse, UploadEEGReportPayload } from "@/types/eeg.types";

export const eegService = {
  async uploadReport(payload: UploadEEGReportPayload): Promise<EEGReport> {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("patient_id", payload.patient_id);
    form.append("report_name", payload.report_name);
    if (payload.session_id) form.append("session_id", payload.session_id);
    if (payload.report_type) form.append("report_type", payload.report_type);

    const res = await apiClient.post(ENDPOINTS.EEG.UPLOAD, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.data as EEGReport;
  },

  async getReport(reportId: string): Promise<EEGReport> {
    const res = await apiClient.get(ENDPOINTS.EEG.REPORT(reportId));
    return res.data.data as EEGReport;
  },

  async getPatientReports(
    patientId: string,
    skip = 0,
    limit = 20
  ): Promise<EEGReportListResponse> {
    const res = await apiClient.get(ENDPOINTS.EEG.PATIENT_REPORTS(patientId), {
      params: { skip, limit },
    });
    return res.data as EEGReportListResponse;
  },

  async downloadReport(reportId: string, filename = "eeg_report.pdf"): Promise<void> {
    const res = await apiClient.get(ENDPOINTS.EEG.DOWNLOAD(reportId));
    const presignedUrl: string = res.data.url;
    const a = document.createElement("a");
    a.href = presignedUrl;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  async deleteReport(reportId: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.EEG.DELETE(reportId));
  },
};
