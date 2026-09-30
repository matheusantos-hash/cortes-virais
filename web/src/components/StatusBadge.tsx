import { STATUS_LABEL } from "@/lib/format";
import type { JobStatus } from "@/lib/types";
import { CheckCircleIcon, AlertCircleIcon, ClockIcon } from "./Icons";

export default function StatusBadge({ status }: { status: JobStatus }) {
  const icon =
    status === "done" ? (
      <CheckCircleIcon size={13} />
    ) : status === "failed" ? (
      <AlertCircleIcon size={13} />
    ) : (
      <ClockIcon size={13} />
    );

  return (
    <span className={`badge-status badge-${status}`}>
      {icon}
      <span>{STATUS_LABEL[status]}</span>
    </span>
  );
}
