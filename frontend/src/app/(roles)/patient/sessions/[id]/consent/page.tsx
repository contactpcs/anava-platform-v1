"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button, Card, CardContent } from "@/components/ui";
import { prsService } from "@/lib/api/services";

const CONSENT_TEXT = `By proceeding, you understand and agree that:

1. Your responses will be stored securely and shared only with your assigned clinician.
2. Your data will be used to generate a clinical assessment report for your medical record.
3. Data is retained in compliance with DISHA and HIPAA regulations.
4. You may stop at any time and resume later — your progress is saved automatically.
5. Your responses are confidential and will not be shared with third parties without your explicit consent.`;

export default function ConsentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConsent = async () => {
    setIsSubmitting(true);
    try {
      await prsService.recordConsent(id, "assessment_participation", true, CONSENT_TEXT);
      await prsService.startSession(id);
      router.push(`/patient/sessions/${id}/questionnaire`);
    } catch (err) {
      console.error("Consent error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="text-center">
        <ShieldCheck className="h-12 w-12 text-primary-500 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-neutral-900">Before You Begin</h1>
      </div>

      <Card>
        <CardContent>
          <pre className="text-sm text-neutral-700 whitespace-pre-wrap font-sans leading-relaxed">
            {CONSENT_TEXT}
          </pre>
        </CardContent>
      </Card>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary-500 focus:ring-primary-500"
        />
        <span className="text-sm text-neutral-700">
          I understand and consent to this assessment
        </span>
      </label>

      <Button
        size="lg"
        className="w-full"
        disabled={!agreed}
        isLoading={isSubmitting}
        onClick={handleConsent}
      >
        Continue to Assessment
      </Button>
    </div>
  );
}
