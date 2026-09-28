"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Sparkles,
  X,
  Paperclip,
  Send as SendIcon,
  Building2,
  Loader2,
  Clock,
  Shield,
  Zap,
  Turtle,
  FileText,
  Users,
  Plus,
  Clipboard,
  UserCheck,
  Check,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getCompanyFromEmail, inferNameFromEmail } from "@/lib/company-lookup";
import { parseCSV, ParsedRecipient, isValidEmail } from "@/lib/csv";
import { applyMergeTags } from "@/lib/mime";

interface Recipient extends ParsedRecipient {
  id?: string;
}

interface GeneratedEmail {
  recipientId?: string;
  email: string;
  company: string;
  recipientName: string;
  subject: string;
  body: string;
}

interface UserProfile {
  fullName: string | null;
  currentRole: string | null;
  targetRoles: string | null;
  skills: string | null;
}

export default function ComposePage() {
  const [activeMode, setActiveMode] = useState<"ai" | "template">("template");
  
  // Profile
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Recipients
  const [addressBook, setAddressBook] = useState<Recipient[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [draftInput, setDraftInput] = useState("");
  const [showCsvBox, setShowCsvBox] = useState(false);
  const [rawCsvText, setRawCsvText] = useState("");
  
  // Form fields
  const [subject, setSubject] = useState("Hi {first_name} - Quick Inquiry");
  const [body, setBody] = useState(
    "Hi {first_name},\n\nI hope this email finds you well.\n\nI am reaching out regarding {company}. I would love to connect and discuss potential opportunities.\n\nBest regards,\n{sender_name}"
  );
  
  // AI options
  const [goal, setGoal] = useState("outreach");
  const [tone, setTone] = useState("professional and concise");
  const [customInstructions, setCustomInstructions] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmail[]>([]);
  const [activePreviewIdx, setActivePreviewIdx] = useState(0);

  // Resume PDF Attachment
  const [file, setFile] = useState<{ name: string; path: string } | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Target input focus ref for variable insertion
  const [lastFocusedField, setLastFocusedField] = useState<"subject" | "body">("body");

  // Send speed / throttling
  const [sendSpeed, setSendSpeed] = useState<"fast" | "safe" | "stealth" | "custom">("safe");
  const [customDelay, setCustomDelay] = useState(5);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{
    total: number;
    sent: number;
    failed: number;
    status: string;
  } | null>(null);

  // Daily limits
  const [dailyLimits, setDailyLimits] = useState<{
    sentToday: number;
    remaining: number;
    safeLimit: number;
  } | null>(null);

  // Load initial data (profile, recipients, daily limits)
  const fetchInitialData = useCallback(async () => {
    try {
      const [recRes, limitRes, profRes] = await Promise.all([
        fetch("/api/recipients"),
        fetch("/api/campaigns/limits"),
        fetch("/api/profile"),
      ]);

      let profData: UserProfile | null = null;
      if (profRes.ok) {
        profData = await profRes.json();
        setProfile(profData);
      }

      if (recRes.ok) {
        const data = await recRes.json();
        setAddressBook(data);
        if (data.length > 0 && recipients.length === 0) {
          setRecipients(data.slice(0, 3));
        }
      }

      if (limitRes.ok) {
        const lData = await limitRes.json();
        setDailyLimits(lData);
      }
    } catch {
      toast.error("Failed to load initial settings");
    }
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Detected company for the first active recipient
  const detectedCompany = useMemo(() => {
    const firstRec = recipients[0];
    if (!firstRec) return null;
    const company = firstRec.company || getCompanyFromEmail(firstRec.email);
    return company ? { company, email: firstRec.email } : null;
  }, [recipients]);

  // Delay seconds calculation
  const getDelaySeconds = () => {
    switch (sendSpeed) {
      case "fast": return 2;
      case "safe": return 5;
      case "stealth": return 15;
      case "custom": return customDelay;
    }
  };

  const getEstimatedTime = (count: number) => {
    const totalSecs = count * getDelaySeconds();
    if (totalSecs < 60) return `~${totalSecs}s`;
    const mins = Math.ceil(totalSecs / 60);
    return `~${mins} min${mins > 1 ? "s" : ""}`;
  };

  // Add single input (handles Name, email / CSV snippet / email)
  const handleAddRecipientInput = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const parsed = parseCSV(trimmed);
    if (parsed.length === 0) {
      toast.error("Please enter a valid email address or 'Name, Email' pair");
      return;
    }

    setRecipients((prev) => {
      const existingEmails = new Set(prev.map((r) => r.email.toLowerCase()));
      const newItems = parsed.filter((r) => !existingEmails.has(r.email.toLowerCase()));
      if (newItems.length === 0) return prev;
      toast.success(`Added ${newItems.length} recipient${newItems.length > 1 ? "s" : ""}`);
      return [...prev, ...newItems];
    });

    setDraftInput("");
  };

  // Process raw CSV box input
  const handleImportCsvText = () => {
    if (!rawCsvText.trim()) return;
    const parsed = parseCSV(rawCsvText);
    if (parsed.length === 0) {
      toast.error("No valid recipients or emails found in pasted text");
      return;
    }

    setRecipients((prev) => {
      const existingEmails = new Set(prev.map((r) => r.email.toLowerCase()));
      const newItems = parsed.filter((r) => !existingEmails.has(r.email.toLowerCase()));
      toast.success(`Imported ${newItems.length} recipient${newItems.length > 1 ? "s" : ""}`);
      return [...prev, ...newItems];
    });

    setRawCsvText("");
    setShowCsvBox(false);
  };

  const removeRecipient = (email: string) => {
    setRecipients((prev) => prev.filter((r) => r.email.toLowerCase() !== email.toLowerCase()));
  };

  const selectAllAddressBook = () => {
    setRecipients((prev) => {
      const existingEmails = new Set(prev.map((r) => r.email.toLowerCase()));
      const toAdd = addressBook.filter((r) => !existingEmails.has(r.email.toLowerCase()));
      toast.success(`Added ${toAdd.length} recipient(s) from address book`);
      return [...prev, ...toAdd];
    });
  };

  // Insert variable tag ({name}, {first_name}, {company}, {email}) into active field
  const insertVariable = (variableTag: string) => {
    if (lastFocusedField === "subject") {
      setSubject((prev) => prev + (prev.endsWith(" ") || !prev ? "" : " ") + variableTag);
    } else {
      setBody((prev) => prev + (prev.endsWith(" ") || !prev ? "" : " ") + variableTag);
    }
    toast.success(`Inserted ${variableTag}`);
  };

  // File upload handler with server upload + browser fallback
  const handleFileUpload = async (uploaded: File) => {
    if (!uploaded) return;

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (uploaded.size > MAX_SIZE) {
      const sizeMb = (uploaded.size / (1024 * 1024)).toFixed(1);
      toast.error(`File is too large (${sizeMb}MB). Maximum allowed size is 10MB.`);
      return;
    }

    if (uploaded.size === 0) {
      toast.error("The selected file is empty (0 bytes)");
      return;
    }

    setUploadingFile(true);

    const attachDirectly = (fileObj: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        setFile({ name: fileObj.name, path: base64 });
        toast.success(`Attached file: ${fileObj.name}`);
      };
      reader.onerror = () => {
        toast.error("Failed to read file on device");
      };
      reader.readAsDataURL(fileObj);
    };

    try {
      const formData = new FormData();
      formData.append("file", uploaded);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.path) {
        setFile({ name: data.name || uploaded.name, path: data.path });
        toast.success(`Attached file: ${data.name || uploaded.name}`);
      } else {
        attachDirectly(uploaded);
      }
    } catch {
      attachDirectly(uploaded);
    } finally {
      setUploadingFile(false);
    }
  };

  // AI Generation
  const handleGenerateAI = async () => {
    if (recipients.length === 0) {
      toast.error("Add at least one recipient to generate AI emails");
      return;
    }

    setGenerating(true);
    try {
      const directRecipients = recipients.map((r) => ({
        id: r.id,
        email: r.email,
        name: r.name || inferNameFromEmail(r.email),
        company: r.company || getCompanyFromEmail(r.email),
      }));

      const res = await fetch("/api/generate-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: directRecipients,
          goal,
          tone,
          customInstructions,
        }),
      });

      const data = await res.json();
      if (res.ok && Array.isArray(data.emails) && data.emails.length > 0) {
        setGeneratedEmails(data.emails);
        setActivePreviewIdx(0);
        setSubject(data.emails[0].subject);
        setBody(data.emails[0].body);
        toast.success(`Generated ${data.emails.length} personalized AI emails!`);
      } else {
        toast.error(data.error || "Failed to generate AI emails");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // Update active generated email content when editing
  const handleSubjectChange = (val: string) => {
    setSubject(val);
    if (generatedEmails[activePreviewIdx]) {
      setGeneratedEmails((prev) =>
        prev.map((item, idx) => (idx === activePreviewIdx ? { ...item, subject: val } : item))
      );
    }
  };

  const handleBodyChange = (val: string) => {
    setBody(val);
    if (generatedEmails[activePreviewIdx]) {
      setGeneratedEmails((prev) =>
        prev.map((item, idx) => (idx === activePreviewIdx ? { ...item, body: val } : item))
      );
    }
  };

  // Send Campaign
  const handleSend = async () => {
    if (recipients.length === 0) {
      toast.error("Add at least one recipient");
      return;
    }

    if (!subject.trim()) {
      toast.error("Please enter a valid subject line");
      return;
    }

    if (!body.trim()) {
      toast.error("Please enter email body content");
      return;
    }

    setSending(true);
    const delay = getDelaySeconds();
    setSendProgress({
      total: recipients.length,
      sent: 0,
      failed: 0,
      status: `Initializing campaign (${delay}s gap)...`,
    });

    try {
      // 1. Ensure recipients exist in DB with their parsed Names & Companies
      const recipientMap = new Map<string, string>(); // email -> recipientId

      const createRes = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients: recipients.map((r) => ({
            email: r.email,
            name: r.name || inferNameFromEmail(r.email),
            company: r.company || getCompanyFromEmail(r.email),
          })),
        }),
      });

      if (createRes.ok) {
        const createData = await createRes.json();
        if (Array.isArray(createData.recipients)) {
          for (const r of createData.recipients) {
            recipientMap.set(r.email.toLowerCase(), r.id);
          }
        }
      }

      const recipientIds: string[] = [];
      for (const r of recipients) {
        const id = recipientMap.get(r.email.toLowerCase()) || r.id;
        if (id) {
          recipientIds.push(id);
        }
      }

      if (recipientIds.length === 0) {
        throw new Error("Could not register recipients. Please verify the email addresses.");
      }

      // Map generated emails to recipientIds if in AI mode
      const customEmails = generatedEmails
        .map((e) => {
          const id = e.recipientId || recipientMap.get(e.email.toLowerCase());
          return {
            recipientId: id!,
            subject: e.subject || subject,
            body: e.body || body,
          };
        })
        .filter((e) => !!e.recipientId);

      const sender = profile?.fullName || "User";
      const campaignTitle =
        subject.trim() ||
        `${sender} — Cold Outreach (${recipients.length} recipient${recipients.length > 1 ? "s" : ""})`;

      const payload = {
        subject: campaignTitle,
        body: body || "Email content",
        recipientIds,
        attachmentPath: file?.path,
        attachmentName: file?.name,
        customEmails: activeMode === "ai" ? customEmails : [],
      };

      const campRes = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!campRes.ok) {
        const err = await campRes.json();
        throw new Error(err.error || "Failed to create campaign");
      }

      const campaign = await campRes.json();

      setSendProgress((p) => ({
        ...p!,
        status: `Sending emails via Gmail SMTP (${delay}s gap)...`,
      }));

      const sendRes = await fetch(`/api/campaigns/${campaign.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delaySeconds: delay }),
      });

      let sendResponse = sendRes;
      let result = await sendRes.json();

      if (sendResponse.status === 429 && result.requiresConfirmation) {
        const proceed = window.confirm(`${result.error}\n\nDo you want to send anyway?`);
        if (proceed) {
          const retryRes = await fetch(`/api/campaigns/${campaign.id}/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ delaySeconds: delay, skipLimitCheck: true }),
          });
          const retryResult = await retryRes.json();
          if (!retryRes.ok) throw new Error(retryResult.error || "Send failed");
          sendResponse = retryRes;
          result = retryResult;
        } else {
          setSending(false);
          setSendProgress(null);
          return;
        }
      }

      if (sendResponse.ok) {
        setSendProgress({
          total: result.totalCount,
          sent: result.sentCount,
          failed: result.failedCount,
          status:
            result.failedCount === 0
              ? "All sent successfully!"
              : `Sent ${result.sentCount}, Failed ${result.failedCount}`,
        });

        if (result.sentCount === 0 && result.failedCount > 0) {
          const firstErr =
            result.errors?.[0]?.error ||
            "Please check your Gmail address and App Password in Settings.";
          toast.error(`Email sending failed: ${firstErr}`);
        } else if (result.failedCount > 0) {
          toast.warning(`Sent ${result.sentCount} email(s), but ${result.failedCount} failed.`);
        } else {
          toast.success(`🎉 All ${result.sentCount} emails sent successfully!`);
        }
      } else {
        throw new Error(result.error || "Send failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send campaign");
      setSendProgress(null);
    } finally {
      setSending(false);
    }
  };

  // Active recipient for live preview
  const currentPreviewRecipient = useMemo(() => {
    if (recipients.length === 0) {
      return { email: "recipient@company.com", name: "John Doe", company: "Acme Inc" };
    }
    const rec = recipients[activePreviewIdx] || recipients[0];
    return {
      email: rec.email,
      name: rec.name || inferNameFromEmail(rec.email) || "Recipient",
      company: rec.company || getCompanyFromEmail(rec.email) || "Company",
    };
  }, [recipients, activePreviewIdx]);

  // Rendered subject and body for Live Preview with variable replacements
  const previewSubject = useMemo(() => {
    let raw = subject;
    if (activeMode === "ai" && generatedEmails[activePreviewIdx]?.subject) {
      raw = generatedEmails[activePreviewIdx].subject;
    }
    return applyMergeTags(raw, currentPreviewRecipient).replace(/\{sender_name\}/gi, profile?.fullName || "Your Name");
  }, [subject, activeMode, generatedEmails, activePreviewIdx, currentPreviewRecipient, profile?.fullName]);

  const previewBody = useMemo(() => {
    let raw = body;
    if (activeMode === "ai" && generatedEmails[activePreviewIdx]?.body) {
      raw = generatedEmails[activePreviewIdx].body;
    }
    return applyMergeTags(raw, currentPreviewRecipient).replace(/\{sender_name\}/gi, profile?.fullName || "Your Name");
  }, [body, activeMode, generatedEmails, activePreviewIdx, currentPreviewRecipient, profile?.fullName]);

  return (
    <div className="space-y-5 w-full">
      <PageHeader
        title="Compose Email Campaign"
        description="Add recipient names & emails, use placeholders like {name}, or generate with AI."
      />

      <div className="grid gap-6 lg:grid-cols-12 w-full items-start">
        {/* Left Column: Form Controls (7 cols) */}
        <div className="surface space-y-5 p-6 sm:p-7 lg:col-span-7">
          {/* Mode Switcher Pills */}
          <div className="flex items-center justify-between border-b border-border pb-4">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Campaign Mode
            </Label>
            <div className="flex rounded-2xl bg-secondary/80 p-1.5 border border-border">
              <button
                type="button"
                onClick={() => setActiveMode("template")}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all ${
                  activeMode === "template"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FileText className="h-4 w-4" />
                Standard / Placeholder Mode
              </button>
              <button
                type="button"
                onClick={() => setActiveMode("ai")}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all ${
                  activeMode === "ai"
                    ? "gradient-accent text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="h-4 w-4" />
                AI Auto-Personalize
              </button>
            </div>
          </div>

          {/* "To" Recipient Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Recipients ({recipients.length})
              </Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCsvBox(!showCsvBox)}
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-bold"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  {showCsvBox ? "Hide CSV Box" : "Paste CSV / Bulk Text"}
                </button>
                {addressBook.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAllAddressBook}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-bold"
                  >
                    Select stored ({addressBook.length})
                  </button>
                )}
              </div>
            </div>

            {/* CSV / Bulk Text Area Collapsible */}
            {showCsvBox && (
              <div className="space-y-2 rounded-2xl border border-primary/30 bg-primary/5 p-3.5">
                <Label className="text-xs font-bold text-foreground">
                  Paste CSV or Multi-line Recipients (e.g. <code className="text-primary font-mono text-[11px]">Name, email@domain.com</code> or <code className="text-primary font-mono text-[11px]">Name &lt;email@domain.com&gt;</code>)
                </Label>
                <Textarea
                  value={rawCsvText}
                  onChange={(e) => setRawCsvText(e.target.value)}
                  rows={4}
                  placeholder={`John Doe, john@example.com, TCS\nJane Smith, jane@google.com\nrecruiter@microsoft.com`}
                  className="bg-background text-xs font-mono p-2.5 rounded-xl resize-none"
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowCsvBox(false)}
                    className="h-8 text-xs font-semibold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleImportCsvText}
                    className="h-8 text-xs font-bold gradient-accent text-primary-foreground"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Parse &amp; Add Recipients
                  </Button>
                </div>
              </div>
            )}

            {/* Chips Container */}
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-input bg-secondary/30 p-2.5 min-h-[52px]">
              {recipients.map((r) => {
                const comp = r.company || getCompanyFromEmail(r.email);
                return (
                  <span
                    key={r.email}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-card border border-border px-2.5 py-1 text-xs font-semibold text-foreground shadow-sm"
                  >
                    {r.name ? (
                      <span className="font-bold text-primary">{r.name}</span>
                    ) : null}
                    <span className="text-muted-foreground">{r.email}</span>
                    {comp && (
                      <span className="rounded-lg bg-secondary text-foreground border border-border px-1.5 py-0.5 text-[10px] font-bold">
                        {comp}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Remove ${r.email}`}
                      onClick={() => removeRecipient(r.email)}
                      className="hover:text-destructive transition-colors ml-0.5"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                );
              })}
              <input
                value={draftInput}
                onChange={(e) => setDraftInput(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData("text");
                  if (pasted && pasted.trim()) {
                    e.preventDefault();
                    handleAddRecipientInput(pasted);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    handleAddRecipientInput(draftInput);
                  }
                  if (e.key === "Backspace" && !draftInput && recipients.length > 0) {
                    setRecipients((p) => p.slice(0, -1));
                  }
                }}
                onBlur={() => draftInput && handleAddRecipientInput(draftInput)}
                placeholder={recipients.length === 0 ? "Type 'John Doe, john@example.com' or paste email..." : "Add more..."}
                className="min-w-[220px] flex-1 bg-transparent px-2 py-1 text-xs sm:text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>

            {detectedCompany && (
              <div className="flex items-center gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-semibold text-foreground">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  Target Company: <strong className="text-foreground">{detectedCompany.company}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Placeholder Variables Toolbar */}
          <div className="rounded-2xl border border-border bg-secondary/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-primary" /> Click to Insert Placeholder Variable:
              </span>
              <span className="text-[11px] text-muted-foreground">
                Target: <strong className="capitalize text-foreground">{lastFocusedField}</strong>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {[
                { tag: "{first_name}", label: "First Name", desc: "e.g. John" },
                { tag: "{name}", label: "Full Name", desc: "e.g. John Doe" },
                { tag: "{company}", label: "Company", desc: "e.g. TCS" },
                { tag: "{email}", label: "Email Address", desc: "e.g. john@domain.com" },
              ].map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => insertVariable(v.tag)}
                  className="inline-flex items-center gap-1 rounded-xl bg-card border border-border hover:border-primary px-2.5 py-1 text-xs font-mono font-bold text-foreground hover:text-primary transition-all shadow-sm"
                  title={`Insert ${v.tag} (${v.desc})`}
                >
                  <Plus className="h-3 w-3 text-primary" />
                  <span>{v.tag}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Subject Line Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold">Subject Line</Label>
              {generatedEmails.length > 1 && (
                <span className="text-xs text-primary font-semibold">
                  (Customized for: {generatedEmails[activePreviewIdx]?.company || "Selected recipient"})
                </span>
              )}
            </div>
            {generating ? (
              <div className="shimmer h-11 rounded-2xl" />
            ) : (
              <Input
                value={subject}
                onFocus={() => setLastFocusedField("subject")}
                onChange={(e) => handleSubjectChange(e.target.value)}
                placeholder="e.g. Hi {first_name} — Quick Inquiry regarding {company}"
                className="bg-secondary/20 h-11 text-sm sm:text-base rounded-2xl font-semibold"
              />
            )}
          </div>

          {/* Body Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold">Email Message Body</Label>
              {activeMode === "ai" && (
                <button
                  type="button"
                  onClick={handleGenerateAI}
                  disabled={generating || recipients.length === 0}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-bold transition-colors disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {generating ? "Generating..." : "Generate AI Emails"}
                </button>
              )}
            </div>
            {generating ? (
              <div className="space-y-2.5 py-3">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="shimmer h-4 rounded-lg" style={{ width: `${92 - i * 8}%` }} />
                ))}
              </div>
            ) : (
              <Textarea
                value={body}
                onFocus={() => setLastFocusedField("body")}
                onChange={(e) => handleBodyChange(e.target.value)}
                rows={10}
                placeholder="Write your email body here. Use {first_name}, {name}, {company}..."
                className="resize-none font-mono text-xs sm:text-sm leading-relaxed p-3.5 rounded-2xl"
              />
            )}
          </div>

          {/* Document / File Attachment Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFileUpload(f);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-4 text-center transition-all ${
              dragging
                ? "border-primary bg-primary/10 scale-[1.01]"
                : "border-border hover:bg-secondary/40"
            }`}
          >
            <Paperclip className="mx-auto mb-1.5 h-4 w-4 text-muted-foreground" />
            {uploadingFile ? (
              <span className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Uploading attachment...
              </span>
            ) : file ? (
              <div className="flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-foreground">
                <span className="truncate max-w-[280px]">📎 {file.name}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="text-destructive hover:underline ml-2 text-xs font-semibold px-2 py-0.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 transition-colors"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="space-y-0.5">
                <span className="text-xs sm:text-sm text-muted-foreground font-medium block">
                  Drag &amp; drop document or resume (PDF/DOCX, max 10MB), or click to browse
                </span>
                <span className="text-[11px] text-muted-foreground/70 block">
                  Optional file attachment
                </span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
                e.target.value = "";
              }}
            />
          </div>

          {/* Send Speed Throttling Bar */}
          <div className="space-y-3.5 rounded-3xl border border-border bg-secondary/30 p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <Label className="text-xs sm:text-sm font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" /> Send Speed &amp; Throttling
              </Label>
              <span className="text-xs font-semibold text-muted-foreground">
                Est: {getEstimatedTime(recipients.length)}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "fast" as const, label: "Fast", desc: "2s gap", icon: Zap },
                { id: "safe" as const, label: "Safe", desc: "5s gap", icon: Shield },
                { id: "stealth" as const, label: "Stealth", desc: "15s gap", icon: Turtle },
                { id: "custom" as const, label: "Custom", desc: `${customDelay}s`, icon: Clock },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSendSpeed(s.id)}
                  className={`flex flex-col items-center gap-0.5 rounded-2xl border p-2.5 text-xs transition-all ${
                    sendSpeed === s.id
                      ? "gradient-accent text-primary-foreground font-bold shadow-md border-transparent"
                      : "border-border bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <s.icon className="h-3.5 w-3.5" />
                  <span className="font-bold text-xs sm:text-sm">{s.label}</span>
                  <span className="text-[10px] opacity-75">{s.desc}</span>
                </button>
              ))}
            </div>

            {sendSpeed === "custom" && (
              <div className="flex items-center gap-3 pt-1">
                <Input
                  type="number"
                  min={0}
                  max={300}
                  value={customDelay}
                  onChange={(e) => setCustomDelay(Math.max(0, Math.min(300, Number(e.target.value))))}
                  className="h-9 w-20 text-xs font-bold"
                />
                <span className="text-xs text-muted-foreground">seconds between each email (0-300)</span>
              </div>
            )}

            {dailyLimits && (
              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/60 pt-2.5">
                <span className="font-medium">Daily Quota: {dailyLimits.sentToday}/{dailyLimits.safeLimit} used</span>
                <span className="text-success font-bold">{dailyLimits.remaining} remaining</span>
              </div>
            )}
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSend}
            disabled={sending || recipients.length === 0}
            className="w-full gradient-accent text-primary-foreground shadow-[var(--shadow-glow)] hover:opacity-90 h-12 text-sm sm:text-base font-bold rounded-2xl"
          >
            {sending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <SendIcon className="mr-2 h-4 w-4" />
            )}
            {sending
              ? "Sending Individual Emails via Gmail SMTP..."
              : `Send Personalized Emails to ${recipients.length} Recipient${recipients.length !== 1 ? "s" : ""}`}
          </Button>

          {sendProgress && (
            <div className="space-y-2 rounded-2xl border border-border bg-secondary/40 p-3.5 text-xs sm:text-sm">
              <div className="flex justify-between font-bold">
                <span className="text-foreground">{sendProgress.status}</span>
                <span>{sendProgress.sent + sendProgress.failed}/{sendProgress.total}</span>
              </div>
              <Progress value={((sendProgress.sent + sendProgress.failed) / sendProgress.total) * 100} className="h-2 rounded-full" />
            </div>
          )}
        </div>

        {/* Right Column: Live Email Preview (5 cols) */}
        <div className="space-y-5 lg:col-span-5 h-fit lg:sticky lg:top-4">
          {/* Live Email Preview Card */}
          <div className="surface p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Live Email Preview
                </p>
                <p className="text-[11px] text-muted-foreground">Replaced variables for selected recipient</p>
              </div>
              {recipients.length > 1 && (
                <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-bold text-xs">
                  Recipient {activePreviewIdx + 1} of {recipients.length}
                </Badge>
              )}
            </div>

            {/* Recipient switcher pills for preview */}
            {recipients.length > 1 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Preview for recipient:</span>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {recipients.map((rec, idx) => (
                    <button
                      key={rec.email}
                      type="button"
                      onClick={() => setActivePreviewIdx(idx)}
                      className={`shrink-0 rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                        activePreviewIdx === idx
                          ? "gradient-accent text-primary-foreground shadow-sm"
                          : "border border-border bg-card text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {rec.name || rec.email.split("@")[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Rendered Email Card */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="gradient-accent grid h-8 w-8 place-items-center rounded-xl text-xs font-black text-primary-foreground">
                    {profile?.fullName ? profile.fullName.slice(0, 2).toUpperCase() : "ME"}
                  </span>
                  <div className="text-xs">
                    <p className="font-bold text-foreground">{profile?.fullName || "You"} (via Gmail)</p>
                    <p className="text-muted-foreground truncate max-w-[200px] sm:max-w-[240px] text-[11px] font-mono">
                      To: {currentPreviewRecipient.name ? `${currentPreviewRecipient.name} <${currentPreviewRecipient.email}>` : currentPreviewRecipient.email}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">Live Preview</span>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subject</p>
                <h3 className="text-xs sm:text-sm font-bold text-foreground leading-snug mt-0.5">
                  {previewSubject || <span className="text-muted-foreground font-normal">Subject line will appear here</span>}
                </h3>
              </div>

              <div className="border-t border-border/60 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Message</p>
                <div className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed text-foreground max-h-72 overflow-y-auto font-sans">
                  {previewBody || "Your email message body will appear here with placeholders replaced."}
                </div>
              </div>

              {file && (
                <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/50 px-3 py-1.5 text-xs font-bold text-foreground shadow-sm">
                  <Paperclip className="h-3.5 w-3.5 text-primary" />
                  <span>Attachment: {file.name}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
