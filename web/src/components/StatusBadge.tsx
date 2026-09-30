import { STATUS_LABEL } from "@/lib/format";
import type { JobStatus } from "@/lib/types";

export default function StatusBadge({ status }: { status: JobStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>;
}
