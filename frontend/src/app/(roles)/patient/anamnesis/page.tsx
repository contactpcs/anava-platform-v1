"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks";
import { PageLoader } from "@/components/ui";

const AnamnesisForm = dynamic(
  () => import("@/components/assessment/AnamnesisForm").then((m) => ({ default: m.AnamnesisForm })),
  { loading: () => <PageLoader />, ssr: false },
);

export default function PatientAnamnesisPage() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto py-4 space-y-2">
      <div className="mb-2">
        <h1 className="text-xl font-bold text-neutral-900">Medical History Intake</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Please complete this form before starting your assessment. It is submitted once and cannot be edited after submission.
        </p>
      </div>
      <AnamnesisForm
        patientId={user.id}
        mode="patient"
        onSubmitted={() => router.push("/patient/dashboard")}
      />
    </div>
  );
}
