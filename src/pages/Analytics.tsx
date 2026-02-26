import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from "recharts";
import { Download, TrendingUp, Target, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function Analytics() {
  const { data: accuracy } = useQuery({ queryKey: ["analytics-accuracy"], queryFn: api.analytics.getAccuracy });
  const { data: topDomains } = useQuery({ queryKey: ["analytics-domains"], queryFn: api.analytics.getTopDomains });
  const { data: categoryTrend } = useQuery({ queryKey: ["analytics-trend"], queryFn: () => api.analytics.getCategoryTrend("30d") });
  const { data: keywords } = useQuery({ queryKey: ["analytics-keywords"], queryFn: api.analytics.getKeywords });
  const { data: analystActivity } = useQuery({ queryKey: ["analytics-activity"], queryFn: api.analytics.getAnalystActivity });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground">AI performance metrics and threat intelligence</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { toast.info("Exporting CSV..."); }}>
          <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
        </Button>
      </div>

      {/* Accuracy Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">AI Accuracy</span>
          </div>
          <p className="text-3xl font-bold font-mono text-primary">{accuracy?.agreementRate ?? "—"}%</p>
          <p className="text-xs text-muted-foreground mt-1">Analyst agreement rate</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="h-4 w-4 text-threat-safe" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Reviewed</span>
          </div>
          <p className="text-3xl font-bold font-mono text-foreground">{accuracy?.totalReviewed?.toLocaleString() ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">Emails analyzed by analysts</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-threat-low" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Overrides</span>
          </div>
          <p className="text-3xl font-bold font-mono text-threat-low">{accuracy?.totalOverrides ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1">AI categorization corrections</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Trend */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Category Distribution (30 Days)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={categoryTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 18%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }} tickFormatter={(v) => format(new Date(v), "MMM d")} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(222, 20%, 12%)", border: "1px solid hsl(222, 15%, 18%)", borderRadius: 8, fontSize: 12 }} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="safe" name="Safe" stackId="1" fill="hsl(145, 70%, 42%)" stroke="hsl(145, 70%, 42%)" fillOpacity={0.3} />
                <Area type="monotone" dataKey="lowMalicious" name="Low Malicious" stackId="1" fill="hsl(35, 90%, 55%)" stroke="hsl(35, 90%, 55%)" fillOpacity={0.3} />
                <Area type="monotone" dataKey="highMalicious" name="High Malicious" stackId="1" fill="hsl(0, 80%, 55%)" stroke="hsl(0, 80%, 55%)" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Domains */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Top Malicious Sender Domains</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topDomains?.slice(0, 8) ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 15%, 18%)" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(215, 15%, 55%)" }} />
                <YAxis type="category" dataKey="domain" tick={{ fontSize: 9, fill: "hsl(215, 15%, 55%)" }} width={150} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(222, 20%, 12%)", border: "1px solid hsl(222, 15%, 18%)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="hsl(0, 80%, 55%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Keywords */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Top Phishing Keywords</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {keywords?.map((kw) => (
                <div key={kw.keyword} className="flex items-center justify-between">
                  <span className="text-sm text-foreground/80">{kw.keyword}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-threat-high" style={{ width: `${(kw.frequency / 234) * 100}%` }} />
                    </div>
                    <span className="text-xs font-mono text-muted-foreground w-8 text-right">{kw.frequency}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Analyst Activity */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Analyst Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analystActivity?.map((a) => (
                <div key={a.analyst} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium">{a.analyst}</p>
                    <p className="text-xs text-muted-foreground">{a.reviewedCount} emails reviewed</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono">{a.avgReviewTimeMinutes}m</p>
                    <p className="text-[10px] text-muted-foreground">avg. review</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
