import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const analysts = ["All", "Sarah Chen", "Marcus Rivera", "Alex Kumar", "Jordan Peters", "Taylor Novak"];
const actionTypes = ["All", "reviewed", "override", "export"];

export default function AuditLog() {
  const [analyst, setAnalyst] = useState("All");
  const [action, setAction] = useState("All");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const { data } = useQuery({
    queryKey: ["audit-log", analyst, action, page],
    queryFn: () => api.auditLog.list({
      analyst: analyst === "All" ? undefined : analyst,
      action: action === "All" ? undefined : action,
      page,
      pageSize,
    }),
  });

  const totalPages = Math.ceil((data?.total ?? 0) / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-sm text-muted-foreground">Complete history of analyst actions</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { api.auditLog.export(); toast.info("Exporting..."); }}>
          <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={analyst} onValueChange={(v) => { setAnalyst(v); setPage(1); }}>
          <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue placeholder="Analyst" /></SelectTrigger>
          <SelectContent>
            {analysts.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
          <SelectTrigger className="w-36 bg-secondary border-border"><SelectValue placeholder="Action" /></SelectTrigger>
          <SelectContent>
            {actionTypes.map(a => <SelectItem key={a} value={a}>{a === "All" ? "All" : a.charAt(0).toUpperCase() + a.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-card border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Timestamp</th>
              <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Analyst</th>
              <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Action</th>
              <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Email</th>
              <th className="p-3 text-xs text-muted-foreground uppercase tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody>
            {data?.entries.map((entry) => (
              <tr key={entry.id} className="border-b border-border hover:bg-secondary/30 transition-colors">
                <td className="p-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{format(new Date(entry.timestamp), "MMM d, HH:mm:ss")}</td>
                <td className="p-3 text-sm">{entry.analyst}</td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    entry.action === "override" ? "bg-threat-low/15 text-threat-low" :
                    entry.action === "export" ? "bg-primary/10 text-primary" :
                    "bg-secondary text-muted-foreground"
                  }`}>
                    {entry.action}
                  </span>
                </td>
                <td className="p-3">
                  {entry.emailId ? (
                    <Link to={`/emails/${entry.emailId}`} className="text-xs font-mono text-primary hover:underline">{entry.emailId}</Link>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">{entry.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
