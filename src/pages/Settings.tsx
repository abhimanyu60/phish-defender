import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AICategory, type Settings as SettingsType } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Pause, Zap, Trash2, Plus, Mail, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });

  const [highThreshold, setHighThreshold] = useState<number[]>([80]);
  const [lowThreshold, setLowThreshold] = useState<number[]>([50]);
  const [newRuleType, setNewRuleType] = useState<"domain" | "keyword">("domain");
  const [newRuleValue, setNewRuleValue] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState<AICategory>("high_malicious");

  const pauseJob = useMutation({ mutationFn: api.settings.pauseJob, onSuccess: () => { toast.success("Job paused"); queryClient.invalidateQueries({ queryKey: ["settings"] }); } });
  const resumeJob = useMutation({ mutationFn: api.settings.resumeJob, onSuccess: () => { toast.success("Job resumed"); queryClient.invalidateQueries({ queryKey: ["settings"] }); } });
  const triggerJob = useMutation({ mutationFn: api.settings.triggerJob, onSuccess: () => { toast.success("Manual run triggered"); } });
  const updateThresholds = useMutation({
    mutationFn: () => api.settings.updateThresholds({ highMaliciousThreshold: highThreshold[0] / 100, lowMaliciousThreshold: lowThreshold[0] / 100 }),
    onSuccess: () => toast.success("Thresholds updated"),
  });
  const addRule = useMutation({
    mutationFn: () => api.settings.addRule({ type: newRuleType, value: newRuleValue, forceCategory: newRuleCategory }),
    onSuccess: () => { toast.success("Rule added"); setNewRuleValue(""); queryClient.invalidateQueries({ queryKey: ["settings"] }); },
  });
  const deleteRule = useMutation({
    mutationFn: (id: string) => api.settings.deleteRule(id),
    onSuccess: () => { toast.success("Rule removed"); queryClient.invalidateQueries({ queryKey: ["settings"] }); },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Configure ingestion, AI thresholds, and rules</p>
      </div>

      {/* Ingestion Controls */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Ingestion Job Controls</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${settings?.jobStatus === "paused" ? "bg-threat-low" : "bg-threat-safe"}`} />
            <span className="text-sm font-medium capitalize">{settings?.jobStatus ?? "—"}</span>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => pauseJob.mutate()} disabled={settings?.jobStatus === "paused"}>
                <Pause className="h-3.5 w-3.5 mr-1" /> Pause
              </Button>
              <Button size="sm" variant="outline" onClick={() => resumeJob.mutate()} disabled={settings?.jobStatus !== "paused"}>
                <Play className="h-3.5 w-3.5 mr-1" /> Resume
              </Button>
              <Button size="sm" onClick={() => triggerJob.mutate()}>
                <Zap className="h-3.5 w-3.5 mr-1" /> Trigger Run
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Thresholds */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">AI Sensitivity Thresholds</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>High Malicious Threshold</span>
              <span className="font-mono text-threat-high">{highThreshold[0]}%</span>
            </div>
            <Slider value={highThreshold} onValueChange={setHighThreshold} max={100} min={50} step={1} className="[&_[role=slider]]:bg-threat-high" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Low Malicious Threshold</span>
              <span className="font-mono text-threat-low">{lowThreshold[0]}%</span>
            </div>
            <Slider value={lowThreshold} onValueChange={setLowThreshold} max={80} min={20} step={1} className="[&_[role=slider]]:bg-threat-low" />
          </div>
          <Button size="sm" onClick={() => updateThresholds.mutate()}>Save Thresholds</Button>
        </CardContent>
      </Card>

      {/* Custom Rules */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Custom Rules</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Select value={newRuleType} onValueChange={(v) => setNewRuleType(v as "domain" | "keyword")}>
              <SelectTrigger className="w-28 bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="domain">Domain</SelectItem>
                <SelectItem value="keyword">Keyword</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Value..." value={newRuleValue} onChange={(e) => setNewRuleValue(e.target.value)} className="bg-secondary border-border" />
            <Select value={newRuleCategory} onValueChange={(v) => setNewRuleCategory(v as AICategory)}>
              <SelectTrigger className="w-40 bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high_malicious">High Malicious</SelectItem>
                <SelectItem value="low_malicious">Low Malicious</SelectItem>
                <SelectItem value="safe">Safe</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => addRule.mutate()} disabled={!newRuleValue.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-2">
            {settings?.customRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between p-2 rounded bg-secondary/30 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase">{rule.type}</span>
                  <span className="font-mono text-xs">{rule.value}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className={`text-xs ${rule.forceCategory === "high_malicious" ? "text-threat-high" : rule.forceCategory === "low_malicious" ? "text-threat-low" : "text-threat-safe"}`}>
                    {rule.forceCategory.replace("_", " ")}
                  </span>
                </div>
                <Button size="sm" variant="ghost" onClick={() => deleteRule.mutate(rule.id)}><Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-threat-high" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider">Notification Preferences</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "highMaliciousSpike", label: "Alert on high malicious volume spikes" },
            { key: "jobFailure", label: "Alert on ingestion job failures" },
            { key: "dailyDigest", label: "Send daily threat digest email" },
          ].map((pref) => (
            <div key={pref.key} className="flex items-center justify-between">
              <span className="text-sm">{pref.label}</span>
              <Switch defaultChecked={settings?.notificationPreferences[pref.key as keyof typeof settings.notificationPreferences]} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Connected Mailboxes */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Connected Mailboxes</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {settings?.connectedMailboxes.map((mb) => (
            <div key={mb.email} className="flex items-center justify-between p-2 rounded bg-secondary/30">
              <div>
                <p className="text-sm font-medium">{mb.displayName}</p>
                <p className="text-xs font-mono text-muted-foreground">{mb.email}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {mb.status === "active" ? <Wifi className="h-3.5 w-3.5 text-threat-safe" /> : <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className={`text-xs ${mb.status === "active" ? "text-threat-safe" : "text-muted-foreground"}`}>{mb.status}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
