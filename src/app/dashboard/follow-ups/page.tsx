"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Reply,
  Send,
  Trash2,
  Clock,
  Search,
  CheckSquare,
  Square,
  Loader2,
  Building2,
  Mail,
  RefreshCw,
  Plus,
  Eye,
  X,
  Tag,
  Database,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Recipient {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
}

interface StoredSentEmail {
  id: string;
  sentAt: string | null;
  status: string;
  customSubject: string | null;
  customBody: string | null;
  followupCount: number;
  messageId: string | null;
  recipient: Recipient;
  campaign: {
    id: string;
    subject: string;
    body?: string;
    createdAt: string;
  };
}

export default function FollowUpsPage() {
  const [emails, setEmails] = useState<StoredSentEmail[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [oldestSentAt, setOldestSentAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  // Database Viewer Modal
  const [showDbViewer, setShowDbViewer] = useState(false);
  const [dbSearch, setDbSearch] = useState("");
  const [dbSortOrder, setDbSortOrder] = useState<"asc" | "desc">("desc");
  const [dbSelectedIds, setDbSelectedIds] = useState<string[]>([]);

  // Follow-up Composer Modal
  const [showComposer, setShowComposer] = useState(false);
  const [batchTarget, setBatchTarget] = useState<number | "selected">(10);
  const [customN, setCustomN] = useState("");
  const [followupSubject, setFollowupSubject] = useState("Re: {original_subject}");
  const [followupBody, setFollowupBody] = useState(
    "Hi {first_name},\n\nI wanted to quickly follow up on my previous email.\n\nWould you have 5-10 minutes for a brief chat this week?\n\nBest regards,"
  );
  const [threadReply, setThreadReply] = useState(true);
  const [sendSpeed, setSendSpeed] = useState<"fast" | "safe" | "stealth">("safe");

  // Send state
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{
    total: number;
    sent: number;
    failed: number;
    status: string;
  } | null>(null);

  // Detail view modal
  const [viewingEmail, setViewingEmail] = useState<StoredSentEmail | null>(null);

  // Fetch emails
  const fetchFollowUps = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s hard limit
    try {
      const res = await fetch(`/api/follow-ups?sort=asc`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        setEmails(data.emails || []);
        setTotalCount(data.totalCount || 0);
        setOldestSentAt(data.oldestSentAt || null);
      } else {
        setFetchError(true);
        toast.error("Failed to load database");
      }
    } catch (err: any) {
      clearTimeout(timeout);
      setFetchError(true);
      if (err?.name === "AbortError") {
        toast.error("Loading timed out — database is slow. Tap Refresh.");
      } else {
        toast.error("Connection error");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  // ── DB Viewer helpers ─────────────────────────────────────────────────────
  const filteredDbEmails = emails.filter((e) => {
    if (!dbSearch.trim()) return true;
    const q = dbSearch.toLowerCase();
    return (
      e.recipient.email.toLowerCase().includes(q) ||
      (e.recipient.name || "").toLowerCase().includes(q) ||
      (e.recipient.company || "").toLowerCase().includes(q) ||
      (e.customSubject || e.campaign.subject || "").toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    const ta = a.sentAt ? new Date(a.sentAt).getTime() : 0;
    const tb = b.sentAt ? new Date(b.sentAt).getTime() : 0;
    return dbSortOrder === "desc" ? tb - ta : ta - tb;
  });

  const toggleDbSelectAll = () => {
    if (dbSelectedIds.length === filteredDbEmails.length) {
      setDbSelectedIds([]);
    } else {
      setDbSelectedIds(filteredDbEmails.map((e) => e.id));
    }
  };

  const toggleDbSelectOne = (id: string) => {
    setDbSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (idsToDelete: string[]) => {
    if (idsToDelete.length === 0) return;
    if (!window.confirm(`Delete ${idsToDelete.length} record(s) from database?`)) return;

    try {
      const res = await fetch("/api/follow-ups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: idsToDelete }),
      });

      if (res.ok) {
        toast.success(`Deleted ${idsToDelete.length} record(s)`);
        setDbSelectedIds((prev) => prev.filter((id) => !idsToDelete.includes(id)));
        fetchFollowUps();
      } else {
        toast.error("Delete failed");
      }
    } catch {
      toast.error("Delete operation failed");
    }
  };

  // ── Send Follow-up batch ──────────────────────────────────────────────────
  const getDelaySeconds = () => {
    switch (sendSpeed) {
      case "fast": return 2;
      case "safe": return 5;
      case "stealth": return 15;
    }
  };

  const handleSendFollowups = async () => {
    if (!followupBody.trim()) {
      toast.error("Follow-up message body is required");
      return;
    }

    let targetPayload: Record<string, unknown> = {};
    if (batchTarget === "selected") {
      if (dbSelectedIds.length === 0) {
        toast.error("Select at least one email from the database");
        return;
      }
      targetPayload = { emailIds: dbSelectedIds };
    } else {
      targetPayload = { targetCount: Number(batchTarget) };
    }

    const delay = getDelaySeconds();
    setSending(true);
    setSendProgress({
      total: batchTarget === "selected" ? dbSelectedIds.length : Number(batchTarget),
      sent: 0,
      failed: 0,
      status: `Sending follow-ups (${delay}s gap)...`,
    });

    try {
      const res = await fetch("/api/follow-ups/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...targetPayload,
          subject: followupSubject,
          body: followupBody,
          threadReply,
          delaySeconds: delay,
        }),
      });

      let finalRes = res;
      let result = await res.json();

      if (finalRes.status === 429 && result.requiresConfirmation) {
        const ok = window.confirm(`${result.error}\n\nSend anyway?`);
        if (!ok) {
          setSending(false);
          setSendProgress(null);
          return;
        }
        const retryRes = await fetch("/api/follow-ups/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...targetPayload, subject: followupSubject, body: followupBody, threadReply, delaySeconds: delay, skipLimitCheck: true }),
        });
        finalRes = retryRes;
        result = await retryRes.json();
      }

      if (finalRes.ok) {
        setSendProgress({
          total: result.totalCount,
          sent: result.sentCount,
          failed: result.failedCount,
          status: result.failedCount === 0
            ? `✅ All ${result.sentCount} follow-ups sent! Timestamps updated.`
            : `Sent ${result.sentCount}, Failed ${result.failedCount}`,
        });
        if (result.sentCount > 0) {
          toast.success(`🎉 Sent ${result.sentCount} follow-up email(s)!`);
          fetchFollowUps();
          setDbSelectedIds([]);
          setTimeout(() => setShowComposer(false), 2500);
        } else if (result.failedCount > 0) {
          toast.error(`Send failed: ${result.errors?.[0]?.error || "Check SMTP settings"}`);
        }
      } else {
        throw new Error(result.error || "Send failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Follow-up send failed");
      setSendProgress(null);
    } finally {
      setSending(false);
    }
  };

  // ── Formatters ───────────────────────────────────────────────────────────
  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  };

  const formatRelative = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const diff = Math.round((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (diff < 1) return "just now";
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  const actualSentEmails = emails.filter(e => e.status === "sent" && e.sentAt && e.customSubject !== "Stored Contact");
  const todaySent = actualSentEmails.filter(e => {
    const d = new Date(e.sentAt!);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title="Follow-up Center"
        description="Send threaded follow-up emails to people you've already contacted."
        action={
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setDbSearch("");
                setDbSortOrder("desc");
                setDbSelectedIds([]);
                setShowDbViewer(true);
              }}
              variant="outline"
              size="sm"
              className="h-10 rounded-xl font-bold border-border gap-1.5"
            >
              <Database className="h-4 w-4" /> View Database
            </Button>
            <Button
              onClick={fetchFollowUps}
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 rounded-xl"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button
              onClick={() => { setBatchTarget(10); setShowComposer(true); }}
              className="gradient-accent text-primary-foreground h-10 rounded-xl font-bold shadow-md"
            >
              <Reply className="h-4 w-4 mr-1.5" /> Send Follow-up
            </Button>
          </div>
        }
      />

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface p-5 rounded-3xl border border-border space-y-1">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-primary" /> Total in Database
          </p>
          <p className="text-3xl font-black text-foreground">{totalCount}</p>
          <p className="text-[11px] text-muted-foreground">stored email records</p>
        </div>

        <div className="surface p-5 rounded-3xl border border-border space-y-1">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Send className="h-3.5 w-3.5 text-primary" /> Sent Today
          </p>
          <p className="text-3xl font-black text-foreground">{todaySent}</p>
          <p className="text-[11px] text-muted-foreground">emails dispatched</p>
        </div>

        <div className="surface p-5 rounded-3xl border border-border space-y-1">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-primary" /> Oldest Contact
          </p>
          <p className="text-base font-bold text-foreground">{oldestSentAt ? formatRelative(oldestSentAt) : "—"}</p>
          <p className="text-[11px] text-muted-foreground">first due for follow-up</p>
        </div>
      </div>

      {/* Quick Launch Presets */}
      <div className="surface p-5 rounded-3xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">Follow-up Batch Presets</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Target the oldest N recipients — those who haven't heard from you the longest.
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold">
            {totalCount} records
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          {[10, 25, 50, 100, 200].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => { setBatchTarget(n); setShowComposer(true); }}
              className="rounded-xl bg-card border border-border hover:border-primary hover:bg-primary/5 px-4 py-2 text-xs font-bold text-foreground transition-all group flex items-center gap-1.5"
            >
              <Reply className="h-3.5 w-3.5 text-primary" />
              Oldest {n}
              <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}

          {/* Custom N */}
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min="1"
              max="500"
              value={customN}
              onChange={(e) => setCustomN(e.target.value)}
              placeholder="Custom N"
              className="h-8 w-24 text-xs rounded-xl"
            />
            <button
              type="button"
              onClick={() => {
                const n = parseInt(customN);
                if (!n || n < 1) { toast.error("Enter a valid number"); return; }
                setBatchTarget(n);
                setShowComposer(true);
              }}
              disabled={!customN}
              className="rounded-xl bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-all disabled:opacity-40"
            >
              Go
            </button>
          </div>
        </div>

        {/* Recent 5 in DB preview */}
        {emails.length > 0 && (
          <div className="border-t border-border pt-3">
            <p className="text-[11px] font-bold text-muted-foreground mb-2">OLDEST 5 (next in queue)</p>
            <div className="space-y-1">
              {emails.slice(0, 5).map((e, i) => (
                <div key={e.id} className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                    <span className="font-semibold text-foreground truncate">
                      {e.recipient.name || e.recipient.email.split("@")[0]}
                    </span>
                    <span className="text-muted-foreground font-mono truncate hidden sm:block">
                      {e.recipient.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {e.followupCount > 0 && (
                      <Badge className="text-[9px] font-bold bg-primary/10 text-primary border-primary/20 px-1.5">
                        {e.followupCount}× up
                      </Badge>
                    )}
                    <span className="text-muted-foreground text-[10px]">{formatRelative(e.sentAt)}</span>
                    <button
                      onClick={() => { setBatchTarget("selected"); setDbSelectedIds([e.id]); setShowComposer(true); }}
                      className="text-primary hover:text-primary/80 font-bold ml-1"
                      title="Follow-up this person"
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {totalCount > 5 && (
              <button
                onClick={() => setShowDbViewer(true)}
                className="mt-2 text-xs text-primary font-bold hover:underline flex items-center gap-1"
              >
                View all {totalCount} records in database <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {emails.length === 0 && !loading && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-secondary/30 border border-border">
            <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs font-bold text-foreground">No records yet</p>
              <p className="text-[11px] text-muted-foreground">Send emails from the Compose page — they'll appear here instantly.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── DATABASE VIEWER MODAL ─────────────────────────────────────────── */}
      {showDbViewer && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-foreground/30 backdrop-blur-sm animate-fade-in">
          <div className="surface w-full max-w-3xl h-full max-h-[calc(100vh-3rem)] rounded-3xl border border-border shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl gradient-accent flex items-center justify-center">
                  <Database className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Email Database</h3>
                  <p className="text-[11px] text-muted-foreground">{totalCount} stored records · sorted by {dbSortOrder === "desc" ? "newest" : "oldest"} first</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDbViewer(false)}
                className="h-8 w-8 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 p-4 border-b border-border shrink-0 flex-wrap">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={dbSearch}
                  onChange={(e) => setDbSearch(e.target.value)}
                  placeholder="Search name, email, company..."
                  className="w-full h-8 pl-8 pr-3 rounded-xl bg-secondary/50 border border-border text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              {/* Sort toggle */}
              <div className="flex rounded-xl bg-secondary border border-border p-0.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => setDbSortOrder("desc")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${dbSortOrder === "desc" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  Newest
                </button>
                <button
                  type="button"
                  onClick={() => setDbSortOrder("asc")}
                  className={`px-3 py-1 rounded-lg font-bold transition-all ${dbSortOrder === "asc" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  Oldest
                </button>
              </div>

              {dbSelectedIds.length > 0 && (
                <button
                  onClick={() => handleDelete(dbSelectedIds)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs font-bold hover:bg-destructive/20 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete {dbSelectedIds.length}
                </button>
              )}
            </div>

            {/* Column header */}
            <div className="grid grid-cols-12 px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border bg-secondary/20 shrink-0">
              <div className="col-span-1 flex items-center">
                <button type="button" onClick={toggleDbSelectAll}>
                  {dbSelectedIds.length > 0 && dbSelectedIds.length === filteredDbEmails.length
                    ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                    : <Square className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="col-span-4">Recipient</div>
              <div className="col-span-3">Subject</div>
              <div className="col-span-2">Sent Time</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-y-auto divide-y divide-border/60">
              {loading ? (
                <div className="flex items-center justify-center p-10 gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-xs">Loading database...</span>
                </div>
              ) : filteredDbEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 gap-3 text-muted-foreground">
                  <Mail className="h-8 w-8 opacity-30" />
                  <p className="text-xs">{dbSearch ? "No matches found" : "No records in database"}</p>
                </div>
              ) : (
                filteredDbEmails.map((item) => {
                  const isSelected = dbSelectedIds.includes(item.id);
                  const name = item.recipient.name || item.recipient.email.split("@")[0];
                  const subject = item.customSubject || item.campaign.subject || "—";
                  const isSent = item.sentAt && item.customSubject !== "Stored Contact";

                  return (
                    <div
                      key={item.id}
                      className={`grid grid-cols-12 items-center px-4 py-3 text-xs transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-secondary/30"}`}
                    >
                      {/* Checkbox */}
                      <div className="col-span-1">
                        <button
                          type="button"
                          onClick={() => toggleDbSelectOne(item.id)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {isSelected
                            ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                            : <Square className="h-3.5 w-3.5" />}
                        </button>
                      </div>

                      {/* Recipient */}
                      <div className="col-span-4 min-w-0 pr-2">
                        <p className="font-semibold text-foreground truncate">{name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{item.recipient.email}</p>
                        {item.recipient.company && (
                          <p className="text-[9px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                            <Building2 className="h-2.5 w-2.5" />{item.recipient.company}
                          </p>
                        )}
                      </div>

                      {/* Subject */}
                      <div className="col-span-3 pr-2">
                        <p className="text-foreground font-medium line-clamp-2 leading-tight">{subject}</p>
                        {item.followupCount > 0 && (
                          <Badge className="mt-0.5 text-[9px] font-bold bg-primary/10 text-primary border-primary/20 px-1.5">
                            {item.followupCount}× followed up
                          </Badge>
                        )}
                      </div>

                      {/* Time */}
                      <div className="col-span-2 pr-1">
                        {isSent ? (
                          <>
                            <p className="font-bold text-foreground text-[10px]">{formatRelative(item.sentAt)}</p>
                            <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">
                              {item.sentAt ? new Date(item.sentAt).toLocaleDateString("en-IN", {
                                day: "2-digit", month: "short",
                              }) : ""}
                              {" "}
                              {item.sentAt ? new Date(item.sentAt).toLocaleTimeString("en-IN", {
                                hour: "2-digit", minute: "2-digit", hour12: true,
                              }) : ""}
                            </p>
                          </>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">Stored contact</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <button
                          onClick={() => setViewingEmail(item)}
                          className="h-6 w-6 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          title="View email"
                        >
                          <Eye className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => {
                            setDbSelectedIds([item.id]);
                            setBatchTarget("selected");
                            setShowDbViewer(false);
                            setShowComposer(true);
                          }}
                          className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
                          title="Send follow-up"
                        >
                          <Reply className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => handleDelete([item.id])}
                          className="h-6 w-6 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive hover:bg-destructive/20 transition-colors"
                          title="Delete record"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border shrink-0 flex items-center justify-between bg-secondary/10">
              <p className="text-[11px] text-muted-foreground">
                Showing <span className="font-bold text-foreground">{filteredDbEmails.length}</span> of <span className="font-bold text-foreground">{totalCount}</span> records
                {dbSelectedIds.length > 0 && ` · ${dbSelectedIds.length} selected`}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={fetchFollowUps}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary border border-border text-xs font-bold text-foreground hover:bg-secondary/80 transition-all"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
                </button>
                <button
                  onClick={() => setShowDbViewer(false)}
                  className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── FOLLOW-UP COMPOSER MODAL ─────────────────────────────────────── */}
      {showComposer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm animate-fade-in">
          <div className="surface w-full max-w-xl rounded-3xl p-6 space-y-4 border border-border shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Reply className="h-4 w-4 text-primary" /> Send Follow-up Batch
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Targeting:{" "}
                  <strong className="text-primary font-bold">
                    {batchTarget === "selected"
                      ? `${dbSelectedIds.length} Selected Email(s)`
                      : `Oldest ${batchTarget} Sent Emails`}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowComposer(false); setSendProgress(null); }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Variable Pills */}
            <div className="rounded-2xl border border-border bg-secondary/30 p-2.5 space-y-1.5">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-primary" /> Click to insert variables:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { tag: "{first_name}", label: "First Name" },
                  { tag: "{name}", label: "Full Name" },
                  { tag: "{company}", label: "Company" },
                  { tag: "{original_subject}", label: "Original Subject" },
                ].map((v) => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => {
                      setFollowupBody((prev) => prev + (prev.endsWith(" ") ? "" : " ") + v.tag);
                      toast.success(`Inserted ${v.tag}`);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl bg-card border border-border hover:border-primary px-2 py-0.5 text-xs font-mono font-bold text-foreground transition-all"
                  >
                    <Plus className="h-3 w-3 text-primary" />
                    <span>{v.tag}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-1">
              <Label className="text-xs font-bold">Subject Line</Label>
              <Input
                value={followupSubject}
                onChange={(e) => setFollowupSubject(e.target.value)}
                placeholder="Re: {original_subject}"
                className="h-10 text-xs font-semibold rounded-xl bg-secondary/20"
              />
            </div>

            {/* Body */}
            <div className="space-y-1">
              <Label className="text-xs font-bold">Message Body</Label>
              <Textarea
                value={followupBody}
                onChange={(e) => setFollowupBody(e.target.value)}
                rows={6}
                placeholder="Write your follow-up..."
                className="resize-none font-mono text-xs p-3 rounded-2xl"
              />
            </div>

            {/* Options */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-border bg-secondary/20 p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-foreground">Thread in Gmail</p>
                  <p className="text-[10px] text-muted-foreground">Same conversation thread</p>
                </div>
                <input
                  type="checkbox"
                  checked={threadReply}
                  onChange={(e) => setThreadReply(e.target.checked)}
                  className="h-4 w-4 rounded text-primary focus:ring-primary"
                />
              </div>

              <div className="rounded-2xl border border-border bg-secondary/20 p-3 space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-primary" /> Send Speed
                </Label>
                <div className="flex gap-1.5">
                  {(["fast", "safe", "stealth"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSendSpeed(s)}
                      className={`flex-1 py-1 px-1.5 text-[10px] font-bold rounded-lg transition-all border capitalize ${sendSpeed === s
                        ? "gradient-accent text-primary-foreground border-transparent"
                        : "border-border bg-card text-muted-foreground"
                        }`}
                    >
                      {s === "fast" ? "Fast (2s)" : s === "safe" ? "Safe (5s)" : "Stealth (15s)"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {sendProgress && (
              <div className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-3 text-xs">
                <div className="flex justify-between font-bold">
                  <span className="text-foreground">{sendProgress.status}</span>
                  <span>{sendProgress.sent + sendProgress.failed}/{sendProgress.total}</span>
                </div>
                <Progress value={((sendProgress.sent + sendProgress.failed) / Math.max(sendProgress.total, 1)) * 100} className="h-2 rounded-full" />
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                onClick={() => { setShowComposer(false); setSendProgress(null); }}
                disabled={sending}
                className="h-10 text-xs font-semibold rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSendFollowups}
                disabled={sending}
                className="gradient-accent text-primary-foreground h-10 px-5 text-xs font-bold rounded-xl shadow-md"
              >
                {sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                {sending ? "Sending..." : "Send Follow-ups"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── INDIVIDUAL EMAIL VIEW MODAL ────────────────────────────────── */}
      {viewingEmail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm animate-fade-in">
          <div className="surface w-full max-w-lg rounded-3xl p-6 space-y-4 border border-border shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Email Record</h3>
                <p className="text-xs text-muted-foreground font-mono">
                  → {viewingEmail.recipient.name || "Recipient"} &lt;{viewingEmail.recipient.email}&gt;
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingEmail(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-secondary/30 p-3">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Sent At</p>
                  <p className="font-bold text-foreground text-sm">
                    {viewingEmail.sentAt
                      ? new Date(viewingEmail.sentAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
                      : "—"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {viewingEmail.sentAt
                      ? new Date(viewingEmail.sentAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                      : ""}
                  </p>
                </div>
                <div className="rounded-xl bg-secondary/30 p-3">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Follow-ups Sent</p>
                  <p className="font-bold text-foreground text-sm">{viewingEmail.followupCount}</p>
                  <p className="text-[10px] text-muted-foreground">times followed up</p>
                </div>
              </div>

              <div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Subject</p>
                <p className="font-bold text-foreground">
                  {viewingEmail.customSubject || viewingEmail.campaign.subject}
                </p>
              </div>

              <div className="border-t border-border pt-2">
                <p className="text-[9px] font-bold text-muted-foreground uppercase mb-1">Email Body</p>
                <div className="whitespace-pre-wrap font-mono p-3 rounded-2xl bg-secondary/30 text-foreground max-h-52 overflow-y-auto text-[11px] leading-relaxed">
                  {viewingEmail.customBody ||
                    viewingEmail.campaign.body ||
                    "(No body stored — this is an address book contact, not yet emailed)"}
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-2 border-t border-border">
              <button
                onClick={() => { handleDelete([viewingEmail.id]); setViewingEmail(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-destructive bg-destructive/10 hover:bg-destructive/20 text-xs font-bold transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete Record
              </button>
              <Button
                type="button"
                onClick={() => setViewingEmail(null)}
                className="h-9 text-xs font-bold rounded-xl"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
