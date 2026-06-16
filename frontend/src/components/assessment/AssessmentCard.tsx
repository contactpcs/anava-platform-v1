"use client";

import Link from "next/link";
import { ClipboardList, Clock, ArrowRight, PlayCircle } from "lucide-react";
import { Card, CardContent, Badge, ProgressBar, Button } from "@/components/ui";
import { SeverityBadge } from "./SeverityBadge";
import { formatDate } from "@/lib/utils/format";
import type { AssessmentSession } from "@/types/prs.types";

interface AssessmentCardProps {
  session: AssessmentSession;
  basePath: string;
}

export function AssessmentCard({ session, basePath }: AssessmentCardProps) {
  const isPending = session.status === "assigned";
  const isInProgress = session.status === "in_progress";
  const isCompleted = session.status === "completed";

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="flex items-center justify-between">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
            <ClipboardList className="h-5 w-5 text-primary-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-neutral-900 truncate">
              {session.title || session.condition_id || "Assessment"}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-sm text-neutral-500">
              {session.due_date && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Due {formatDate(session.due_date)}
                </span>
              )}
              <span>{session.scales_total} scales</span>
            </div>
            {isInProgress && (
              <ProgressBar
                value={session.scales_completed}
                max={session.scales_total}
                className="mt-2 max-w-xs"
                showLabel
              />
            )}
            {isCompleted && session.overall_severity && (
              <div className="mt-2">
                <SeverityBadge level={session.overall_severity} />
              </div>
            )}
          </div>
        </div>

        <div className="flex-shrink-0 ml-4">
          {isPending && (
            <Link href={`${basePath}/sessions/${session.id}`}>
              <Button size="sm">
                Start <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
          {isInProgress && (
            <Link href={`${basePath}/sessions/${session.id}/questionnaire`}>
              <Button size="sm" variant="outline">
                <PlayCircle className="h-4 w-4" /> Resume
              </Button>
            </Link>
          )}
          {isCompleted && (
            <Link href={`${basePath}/sessions/${session.id}`}>
              <Button size="sm" variant="ghost">View</Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
