"use client";

import { CheckCircle } from "lucide-react";
import type { AnamnesisRecord } from "@/types/domain.types";
import type { AnamnesisQuestion } from "@/lib/api/services/anamnesis.service";

interface AnamnesisReadOnlyViewProps {
  record: AnamnesisRecord;
  questions?: AnamnesisQuestion[];
  takenBy?: string;
}

function fmt(ts: string | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function fmtName(takenBy: string | null | undefined) {
  if (!takenBy) return "Unknown";
  if (takenBy === "doctor_on_behalf") return "Doctor (on behalf)";
  if (takenBy === "patient") return "Patient";
  return takenBy;
}

interface SummaryItem {
  question: string;
  answer: string;
  visible: boolean;
}

export function AnamnesisReadOnlyView({
  record,
  questions = [],
  takenBy,
}: AnamnesisReadOnlyViewProps) {
  // Build a map of responses from the record
  const responseMap: Record<string, { value: string; values: string[] }> = {};
  for (const r of record.responses ?? []) {
    responseMap[r.question_id] = {
      value: r.response_value ?? "",
      values: r.response_values ?? [],
    };
  }

  // Helper to check visibility (based on conditional logic)
  function isVisible(q: AnamnesisQuestion): boolean {
    if (!q.depends_on_question_id) return true;
    return responseMap[q.depends_on_question_id]?.value === q.depends_on_value;
  }

  // Build summary items from questions and responses
  const summaryItems: SummaryItem[] = [];
  for (const q of questions) {
    const visible = isVisible(q);
    const response = responseMap[q.question_id];
    
    let answer = "—";
    if (response) {
      if (response.values && response.values.length > 0) {
        // Multiple selections
        answer = response.values.join("; ");
      } else if (response.value) {
        // Single response
        answer = response.value;
      }
    }

    summaryItems.push({
      question: q.question_text,
      answer,
      visible,
    });
  }

  // Filter only visible and answered items
  const visibleItems = summaryItems.filter((item) => item.visible && item.answer !== "—");

  return (
    <div className="space-y-5">
      {/* Completion Header */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm px-6 py-4">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              completed by{" "}
              <span className="text-neutral-700">
                {fmtName(takenBy || record.taken_by)}
              </span>{" "}
              on{" "}
              <span className="text-neutral-700">
                {fmt(record.completed_at)}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Clinical Assessment Summary Banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-5 py-3">
        <p className="text-sm font-semibold text-yellow-800">
          Clinical Assessment Summary
        </p>
        <p className="text-xs text-yellow-700 mt-1">
          Patient completed comprehensive anamnesis assessment. All responses recorded and available for clinical review.
        </p>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-lg border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-600 border-r border-neutral-200">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-600">
                Information
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {visibleItems.length > 0 ? (
              visibleItems.map((item, idx) => (
                <tr
                  key={idx}
                  className="hover:bg-neutral-50 transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-semibold text-neutral-900 w-80 border-r border-neutral-200">
                    {item.question}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-700 leading-relaxed">
                    {item.answer}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="px-6 py-8 text-center text-sm text-neutral-500">
                  No assessment responses recorded
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
