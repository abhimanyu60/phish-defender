import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { ThreatBadge } from "@/components/ThreatBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Shield, AlertTriangle, AlertCircle, CheckCircle, Clock, Inbox, Activity, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

const StatCard = ({ title, value, icon: Icon, color }: { title: string; value: number | string; icon: React.ElementType; color: string }) => (
  <div className="stat-card cyber-glow">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-bold font-mono mt-1" style={{ color }}>{value}</p>
      </div>
      <Icon className="h-8 w-8 opacity-30" style={{ color }} />
    </div>
  </div>
);

export default function Dashboard() {
  const { data: summary } = useQuery({ queryKey: ["dashboard-summary"], queryFn: api.dashboard.getSummary });
  const { data: trend } = useQuery({ queryKey: ["dashboard-trend"], queryFn: () => api.dashboard.getTrend(7) });
  const { data: ingestion } = useQuery({ queryKey: ["dashboard-ingestion"], queryFn: api.dashboard.getIngestionStatus });
  const { data: recentMalicious } = useQuery({ queryKey: ["dashboard-recent"], queryFn: api.dashboard.getRecentMalicious });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Threat monitoring overview — {format(new Date(), "MMMM d, yyyy")}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Emails" value={summary?.totalEmails ?? "—"} icon={Inbox} color="hsl(190, 90%, 50%)" />
        <StatCard title="High Malicious" value={summary?.highMalicious ?? "—"} icon={AlertTriangle} color="hsl(0, 80%, 55%)" />
        <StatCard title="Low Malicious" value={summary?.lowMalicious ?? "—"} icon={AlertCircle} color="hsl(35, 90%, 55%)" />
        <StatCard title="Safe" value={summary?.safe ?? "—"} icon={CheckCircle} color="hsl(145, 70%, 42%)" />
        <StatCard title="Pending Review" value={summary?.pendingReview ?? "—"} icon={Clock} color="hsl(190, 90%, 50%)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Chart */}
        <Card className="lg:col-span-2 bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">7-Day Email Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 18%)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(215, 15%, 55%)" }} tickFormatter={(v) => format(new Date(v), "MMM d")} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(215, 15%, 55%)" }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(222, 20%, 12%)", border: "1px solid hsl(222, 15%, 18%)", borderRadius: 8, fontSize: 12 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="highMalicious" name="High Malicious" fill="hsl(0, 80%, 55%)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="lowMalicious" name="Low Malicious" fill="hsl(35, 90%, 55%)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="safe" name="Safe" fill="hsl(145, 70%, 42%)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Ingestion Status */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4" /> Ingestion Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${ingestion?.status === "idle" ? "bg-threat-safe" : ingestion?.status === "running" ? "bg-primary animate-pulse-glow" : "bg-threat-low"}`} />
              <span className="text-sm font-medium capitalize">{ingestion?.status ?? "—"}</span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Run</span>
                <span className="font-mono text-xs">{ingestion ? format(new Date(ingestion.lastRunTime), "HH:mm:ss") : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processed</span>
                <span className="font-mono text-xs">{ingestion?.emailsProcessed ?? "—"} emails</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Next Run</span>
                <span className="font-mono text-xs">{ingestion ? format(new Date(ingestion.nextScheduledRun), "HH:mm:ss") : "—"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent High Malicious */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Zap className="h-4 w-4 text-threat-high" /> Recent High-Threat Emails
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {recentMalicious?.map((email) => (
              <Link
                key={email.emailId}
                to={`/emails/${email.emailId}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-md hover:bg-secondary/50 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <ThreatBadge category={email.aiCategory} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{email.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">{email.sender}</p>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className="text-xs text-muted-foreground font-mono">{format(new Date(email.receivedAt), "HH:mm")}</span>
                  <p className="text-xs text-muted-foreground">{Math.round(email.confidenceScore * 100)}% conf.</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
