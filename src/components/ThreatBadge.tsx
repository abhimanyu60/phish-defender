import { type AICategory } from "@/services/api";

const categoryConfig: Record<AICategory, { label: string; className: string }> = {
  high_malicious: { label: "High Malicious", className: "threat-badge-high" },
  low_malicious: { label: "Low Malicious", className: "threat-badge-low" },
  safe: { label: "Safe", className: "threat-badge-safe" },
};

export function ThreatBadge({ category, className = "" }: { category: AICategory; className?: string }) {
  const config = categoryConfig[category];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className} ${className}`}>
      {config.label}
    </span>
  );
}
