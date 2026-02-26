import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AICategory, type ReviewStatus } from "@/services/api";
import { ThreatBadge } from "@/components/ThreatBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Search, Download, CheckCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";

const tabs: { label: string; category?: AICategory; status?: ReviewStatus }[] = [
  { label: "All" },
  { label: "High Malicious", category: "high_malicious" },
  { label: "Low Malicious", category: "low_malicious" },
  { label: "Safe", category: "safe" },
  { label: "Pending Review", status: "pending" },
];

export default function EmailQueue() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const pageSize = 10;

  const tab = tabs[activeTab];
  const { data, isLoading } = useQuery({
    queryKey: ["emails", tab.category, tab.status, search, page],
    queryFn: () => api.emails.list({ category: tab.category, status: tab.status, search, page, pageSize }),
  });

  const bulkReview = useMutation({
    mutationFn: (ids: string[]) => api.emails.bulkReview(ids),
    onSuccess: (res) => {
      toast.success(`${res.count} emails marked as reviewed`);
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    },
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const totalPages = Math.ceil((data?.total ?? 0) / pageSize);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email Queue</h1>
        <p className="text-sm text-muted-foreground">{data?.total ?? 0} emails in queue</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => { setActiveTab(i); setPage(1); setSelected([]); }}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px ${
              activeTab === i ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search & Actions */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by sender, subject, or keyword..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9 bg-secondary border-border"
          />
        </div>
        {selected.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selected.length} selected</span>
            <Button size="sm" variant="outline" onClick={() => bulkReview.mutate(selected)}>
              <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark Reviewed
            </Button>
          </div>
        )}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => { api.emails.export(); toast.info("Export started"); }}>
          <Download className="h-3.5 w-3.5 mr-1" /> Export
        </Button>
      </div>

      {/* Table */}
      <Card className="bg-card border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="p-3 w-10"><Checkbox checked={data?.emails?.length ? selected.length === data.emails.length : false} onCheckedChange={(c) => setSelected(c ? (data?.emails?.map(e => e.emailId) ?? []) : [])} /></th>
                <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Sender</th>
                <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Subject</th>
                <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Received</th>
                <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Category</th>
                <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Confidence</th>
                <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {data?.emails?.map((email) => (
                <tr key={email.emailId} className="data-table-row">
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selected.includes(email.emailId)} onCheckedChange={() => toggleSelect(email.emailId)} />
                  </td>
                  <td className="p-3">
                    <Link to={`/emails/${email.emailId}`} className="hover:text-primary transition-colors">
                      <span className="font-medium text-xs">{email.sender}</span>
                    </Link>
                  </td>
                  <td className="p-3">
                    <Link to={`/emails/${email.emailId}`} className="hover:text-primary transition-colors truncate block max-w-xs">
                      {email.subject}
                    </Link>
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{format(new Date(email.receivedAt), "MMM d, HH:mm")}</td>
                  <td className="p-3"><ThreatBadge category={email.aiCategory} /></td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${email.confidenceScore * 100}%` }} />
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{Math.round(email.confidenceScore * 100)}%</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${email.reviewStatus === "reviewed" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>
                      {email.reviewStatus === "reviewed" ? "Reviewed" : "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
