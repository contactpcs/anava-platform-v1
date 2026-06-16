"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ShieldCheck, ChevronLeft, CheckCircle, AlertCircle,
  FileText, Lock, ClipboardList,
} from "lucide-react";
import Link from "next/link";

const CONSENT_SECTIONS = [
  {
    title: "Data Collection & Storage",
    body: "Your responses will be stored securely on encrypted servers and shared only with your assigned clinician. No third party has access without your explicit written consent.",
  },
  {
    title: "Clinical Use of Responses",
    body: "Your responses are used to generate a clinical assessment report for your medical record. This report assists your clinician in diagnosis and treatment planning.",
  },
  {
    title: "Regulatory Compliance",
    body: "All data is retained in compliance with DISHA and HIPAA regulations. You have the right to request access, correction, or deletion of your data at any time.",
  },
  {
    title: "Voluntary Participation",
    body: "You may stop at any time and resume later — your progress is saved automatically. Withdrawing does not affect the quality of care you receive.",
  },
  {
    title: "Confidentiality",
    body: "Your responses are confidential and will not be shared with insurance providers, employers, or any third party without your explicit consent, except where required by law.",
  },
  {
    title: "Digital Signature",
    body: "By checking the box below you are providing a legally binding digital signature indicating you have read, understood, and agree to the terms of this consent.",
  },
];

export default function PatientConsentPage() {
  const { permissionId } = useParams<{ permissionId: string }>();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleContinue = () => {
    if (!agreed || isSubmitting || !permissionId) return;
    setIsSubmitting(true);
    try {
      router.push(`/patient/assessment/${permissionId}`);
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900">
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Back nav */}
        <Link
          href="/patient/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 mb-5"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Back to dashboard
        </Link>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Medical Consent Form</h1>
          <p className="text-xs text-gray-500 mt-1">
            Please review the following terms before proceeding with your assessment.
          </p>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700 leading-relaxed">
            This consent is required before your assessment session can begin. It is valid for the
            duration of your current treatment plan.
          </p>
        </div>

        {/* Consent document */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">
          {/* Document header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-400" />
            <div>
              <p className="text-xs font-semibold text-gray-900">Assessment Participation Consent</p>
              <p className="text-[10px] text-gray-400">Treatment consent document · DISHA & HIPAA compliant</p>
            </div>
            <div className="ml-auto flex items-center gap-1 text-[10px] text-gray-400">
              <Lock className="w-3 h-3" /> Secure
            </div>
          </div>

          {/* Sections */}
          <div className="divide-y divide-gray-50">
            {CONSENT_SECTIONS.map((section, i) => (
              <div key={i} className="px-4 py-3 flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-blue-600">{i + 1}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900 mb-0.5">{section.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{section.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* What you're consenting to */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-4">
          <p className="text-xs font-semibold text-gray-900 mb-2 flex items-center gap-1.5">
            <ClipboardList className="w-3.5 h-3.5 text-blue-500" />
            By signing you consent to:
          </p>
          <ul className="space-y-1.5">
            {[
              "Secure storage of your assessment responses",
              "Use of your data for clinical reporting",
              "Your clinician accessing your assessment results",
              "Retention of records per DISHA & HIPAA standards",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-xs text-gray-600">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Agreement checkbox */}
        <label className="flex items-start gap-3 cursor-pointer bg-white rounded-xl border border-gray-200 px-4 py-3 mb-4 hover:border-blue-300 transition-colors">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs text-gray-700 leading-relaxed">
            I have read and understood the above consent document. I voluntarily agree to
            participate in the assessment and consent to the terms described.
          </span>
        </label>

        {/* CTA buttons */}
        <div className="flex gap-3">
          <Link
            href="/patient/dashboard"
            className="flex-1 flex items-center justify-center py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
          <button
            onClick={handleContinue}
            disabled={!agreed || isSubmitting}
            className="flex-2 flex-1 flex items-center justify-center gap-1.5 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-xl text-xs font-medium transition-colors"
            style={{ background: "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)" }}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {isSubmitting ? "Redirecting…" : "Sign & Continue to Assessment"}
          </button>
        </div>

        <p className="text-center text-[10px] text-gray-400 mt-3">
          Your digital signature is recorded with a timestamp and IP address for compliance.
        </p>
      </div>
    </div>
  );
}
