import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AICategory } from "@/services/api";
import { ThreatBadge } from "@/components/ThreatBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Globe, Server, Link2, AlertTriangle, Clock, User, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function EmailDetail() {
  const { emailId } = useParams<{ emailId: string }>();
  const queryClient = useQueryClient();
  const [overrideCategory, setOverrideCategory] = useState<AICategory | "">("");
  const [overrideReason, setOverrideReason] = useState("");

  const { data: email, isLoading } = useQuery({
    queryKey: ["email", emailId],
    queryFn: () => api.emails.getById(emailId!),
    enabled: !!emailId,
  });

  const overrideMutation = useMutation({
    mutationFn: () => api.emails.override(emailId!, { newCategory: overrideCategory as AICategory, reason: overrideReason }),
    onSuccess: () => {
      toast.success("Override submitted successfully");
      setOverrideCategory("");
      setOverrideReason("");
      queryClient.invalidateQueries({ queryKey: ["email", emailId] });
    },
  });

  const { data: similarEmails } = useQuery({
    queryKey: ["similar-emails", email?.similarEmailIds],
    queryFn: async () => {
      if (!email?.similarEmailIds?.length) return [];
      const results = await Promise.all(email.similarEmailIds.map(id => api.emails.getById(id)));
      return results.filter(Boolean);
    },
    enabled: !!email?.similarEmailIds?.length,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="text-muted-foreground">Loading...</div></div>;
  if (!email) return <div className="text-center py-20 text-muted-foreground">Email not found</div>;

  const confidencePercent = Math.round(email.confidenceScore * 100);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link to="/emails"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button></Link>
        <span className="text-muted-foreground">/</span>
        <span className="text-sm text-muted-foreground font-mono">{email.emailId}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Email Content */}
        <div className="lg:col-span-2 space-y-4">
          {/* Metadata */}
          <Card className="bg-card border-border">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold pr-4">{email.subject}</h2>
                <ThreatBadge category={email.aiCategory} />
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">From: </span><span className="font-mono text-xs">{email.sender}</span></div>
                <div><span className="text-muted-foreground">To: </span><span className="font-mono text-xs">{email.recipient}</span></div>
                <div><span className="text-muted-foreground">Received: </span><span className="font-mono text-xs">{format(new Date(email.receivedAt), "MMM d, yyyy HH:mm:ss")}</span></div>
                <div><span className="text-muted-foreground">Status: </span><span className={`text-xs px-2 py-0.5 rounded ${email.reviewStatus === "reviewed" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}>{email.reviewStatus}</span></div>
              </div>
            </CardContent>
          </Card>

          {/* Email Body */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Email Body (Sandboxed)</CardTitle></CardHeader>
            <CardContent>
              <div className="bg-secondary/50 rounded-md p-4 border border-border">
                <div className="prose prose-invert prose-sm max-w-none text-foreground/80" dangerouslySetInnerHTML={{ __html: email.body }} />
              </div>
            </CardContent>
          </Card>

          {/* Audit Trail */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Clock className="h-3.5 w-3.5" /> Audit Trail</CardTitle></CardHeader>
            <CardContent>
              {email.auditTrail.length === 0 ? (
                <p className="text-sm text-muted-foreground">No actions recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {email.auditTrail.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-3 text-sm">
                      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><User className="h-3 w-3 text-primary" /></div>
                      <div>
                        <p><span className="font-medium">{entry.analyst}</span> <span className="text-muted-foreground">— {entry.action}</span></p>
                        <p className="text-xs text-muted-foreground">{entry.details}</p>
                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{format(new Date(entry.timestamp), "MMM d, HH:mm:ss")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Analysis & Actions */}
        <div className="space-y-4">
          {/* AI Analysis */}
          <Card className="bg-card border-border cyber-glow">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">AI Analysis</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <ThreatBadge category={email.aiCategory} />
                <span className="font-mono text-sm font-bold">{confidencePercent}%</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Confidence Score</p>
                <Progress value={confidencePercent} className="h-2" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Reasoning</p>
                <ul className="space-y-2">
                  {email.aiReasoning.map((reason, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="h-3.5 w-3.5 text-threat-low mt-0.5 shrink-0" />
                      <span className="text-foreground/80">{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Threat Indicators */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Threat Indicators</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {email.threatIndicators.urls.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Link2 className="h-3 w-3" /> Suspicious URLs</p>
                  {email.threatIndicators.urls.map((url, i) => (
                    <p key={i} className="text-xs font-mono text-threat-high break-all pl-4">{url}</p>
                  ))}
                </div>
              )}
              {email.threatIndicators.domains.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Globe className="h-3 w-3" /> Domains</p>
                  {email.threatIndicators.domains.map((d, i) => (
                    <p key={i} className="text-xs font-mono text-threat-low pl-4">{d}</p>
                  ))}
                </div>
              )}
              {email.threatIndicators.ips.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1"><Server className="h-3 w-3" /> IP Addresses</p>
                  {email.threatIndicators.ips.map((ip, i) => (
                    <p key={i} className="text-xs font-mono text-muted-foreground pl-4">{ip}</p>
                  ))}
                </div>
              )}
              {email.threatIndicators.urls.length === 0 && email.threatIndicators.domains.length === 0 && email.threatIndicators.ips.length === 0 && (
                <p className="text-sm text-muted-foreground">No threat indicators detected.</p>
              )}
            </CardContent>
          </Card>

          {/* Override */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Analyst Override</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Select value={overrideCategory} onValueChange={(v) => setOverrideCategory(v as AICategory)}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Reassign category..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high_malicious">High Malicious</SelectItem>
                  <SelectItem value="low_malicious">Low Malicious</SelectItem>
                  <SelectItem value="safe">Safe</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Reason for override (required)..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="bg-secondary border-border text-sm"
                rows={3}
              />
              <Button
                className="w-full"
                disabled={!overrideCategory || !overrideReason.trim() || overrideMutation.isPending}
                onClick={() => overrideMutation.mutate()}
              >
                Submit Override
              </Button>
            </CardContent>
          </Card>

          {/* Similar Emails */}
          {similarEmails && similarEmails.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Similar Emails</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {similarEmails.map((se) => se && (
                  <Link key={se.emailId} to={`/emails/${se.emailId}`} className="flex items-center justify-between p-2 rounded hover:bg-secondary/50 transition-colors group">
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate group-hover:text-primary">{se.subject}</p>
                      <p className="text-[10px] text-muted-foreground">{se.sender}</p>
                    </div>
                    <ThreatBadge category={se.aiCategory} className="ml-2 shrink-0" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
