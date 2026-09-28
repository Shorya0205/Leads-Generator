"use client";

import { useState } from "react";
import {
  Wand2,
  Sparkles,
  Users,
  CheckCircle2,
  Loader2,
  Plus,
  Mail,
  Building2,
  ShieldCheck,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface PredictedItem {
  name: string;
  email: string;
  company: string;
  pattern: string;
  confidence: "High" | "Medium";
}

export default function PredictEmailsPage() {
  const [sampleEmailsText, setSampleEmailsText] = useState("");
  const [employeeNamesText, setEmployeeNamesText] = useState("");
  const [domainOverride, setDomainOverride] = useState("");

  const [loading, setLoading] = useState(false);
  const [savingRecipients, setSavingRecipients] = useState(false);
  const [predictions, setPredictions] = useState<PredictedItem[]>([]);
  const [detectedPattern, setDetectedPattern] = useState("");
  const [detectedCompany, setDetectedCompany] = useState("");
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  const handlePredict = async () => {
    const sampleEmails = sampleEmailsText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const employeeNames = employeeNamesText
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (employeeNames.length === 0) {
      toast.error("Please enter at least one employee name.");
      return;
    }

    setLoading(true);
    setPredictions([]);
    setSelectedIndices([]);

    try {
      const res = await fetch("/api/predict-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sampleEmails,
          employeeNames,
          domain: domainOverride,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Failed to predict emails");
        return;
      }

      setPredictions(data.predictions || []);
      setDetectedPattern(data.pattern || "");
      setDetectedCompany(data.company || "");
      setSelectedIndices((data.predictions || []).map((_: unknown, idx: number) => idx));

      toast.success(
        `Predicted ${data.predictions?.length || 0} employee emails using AI pattern engine!`
      );
    } catch {
      toast.error("An error occurred while predicting emails.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIndices.length === predictions.length) {
      setSelectedIndices([]);
    } else {
      setSelectedIndices(predictions.map((_, i) => i));
    }
  };

  const toggleSelect = (idx: number) => {
    if (selectedIndices.includes(idx)) {
      setSelectedIndices(selectedIndices.filter((i) => i !== idx));
    } else {
      setSelectedIndices([...selectedIndices, idx]);
    }
  };

  const handleAddSelectedToRecipients = async () => {
    const selected = predictions.filter((_, idx) => selectedIndices.includes(idx));

    if (selected.length === 0) {
      toast.error("Please select at least one email to add to Recipients.");
      return;
    }

    setSavingRecipients(true);
    try {
      const formatted = selected.map((item) => ({
        name: item.name,
        email: item.email,
        company: item.company,
      }));

      const res = await fetch("/api/recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formatted),
      });

      if (res.ok) {
        toast.success(`Successfully added ${selected.length} recipient(s) to Address Book! 👥`);
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to add recipients");
      }
    } catch {
      toast.error("Failed to add recipients");
    } finally {
      setSavingRecipients(false);
    }
  };

  const handleDownloadCSV = () => {
    const selected = predictions.filter((_, idx) => selectedIndices.includes(idx));
    if (selected.length === 0) {
      toast.error("Please select at least one email to export.");
      return;
    }

    const headers = "Name,Email,Company,Pattern\n";
    const rows = selected.map((item) => `"${item.name}","${item.email}","${item.company}","${item.pattern}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `predicted_emails_${detectedCompany || "list"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success("Downloaded CSV successfully! 📥");
  };

  return (
    <div className="space-y-8 w-full max-w-5xl">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Wand2 className="h-8 w-8 text-primary animate-pulse" />
            AI Email Predictor
          </span>
        }
        description="Input sample company emails & target employee names to automatically predict exact corporate email addresses using AI pattern recognition."
      />

      <div className="grid gap-8 lg:grid-cols-12">
        {/* Input Form Section */}
        <div className="lg:col-span-6 space-y-6">
          <section className="surface p-6 space-y-5 rounded-3xl border border-border shadow-sm">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-foreground">Step 1: Company &amp; Sample Mails</h2>
                <p className="text-xs text-muted-foreground">Provide sample emails from target company</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sample-emails" className="text-sm font-bold flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-muted-foreground" />
                Sample Company Emails (One per line)
              </Label>
              <Textarea
                id="sample-emails"
                placeholder="e.g. rahul.sharma@tcs.com&#10;a.patel@tcs.com&#10;contact@tcs.com"
                value={sampleEmailsText}
                onChange={(e) => setSampleEmailsText(e.target.value)}
                rows={4}
                className="rounded-2xl font-mono text-sm leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">
                AI analyzes these samples to detect email syntax (e.g. <code className="text-primary font-bold">first.last@domain</code>).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="domain-override" className="text-sm font-bold">
                Domain Override (Optional)
              </Label>
              <Input
                id="domain-override"
                placeholder="e.g. tcs.com or google.com"
                value={domainOverride}
                onChange={(e) => setDomainOverride(e.target.value)}
                className="h-11 rounded-2xl text-sm font-medium"
              />
            </div>
          </section>

          <section className="surface p-6 space-y-5 rounded-3xl border border-border shadow-sm">
            <div className="flex items-center gap-3 border-b border-border pb-4">
              <span className="grid h-10 w-10 place-items-center rounded-2xl bg-violet/10 text-violet">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-bold text-foreground">Step 2: Target Employee Names</h2>
                <p className="text-xs text-muted-foreground">Enter names of people you want emails for</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="employee-names" className="text-sm font-bold">
                Employee Full Names (One per line)
              </Label>
              <Textarea
                id="employee-names"
                placeholder="e.g. Aarav Patel&#10;Priya Singh&#10;Rohan Verma&#10;Sneha Kapoor"
                value={employeeNamesText}
                onChange={(e) => setEmployeeNamesText(e.target.value)}
                rows={5}
                className="rounded-2xl text-sm leading-relaxed"
              />
            </div>

            <Button
              onClick={handlePredict}
              disabled={loading}
              className="w-full gradient-accent text-primary-foreground h-12 text-base font-bold rounded-2xl shadow-lg hover:opacity-90 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Analyzing Pattern &amp; Predicting...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  Predict Emails with AI
                </>
              )}
            </Button>
          </section>
        </div>

        {/* Results Section */}
        <div className="lg:col-span-6 space-y-6">
          <section className="surface p-6 space-y-5 rounded-3xl border border-border shadow-sm min-h-[520px] flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-success/10 text-success">
                    <CheckCircle2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-foreground">Predicted Email Output</h2>
                    <p className="text-xs text-muted-foreground">
                      {predictions.length > 0
                        ? `${predictions.length} email(s) generated for ${detectedCompany}`
                        : "Results will appear here"}
                    </p>
                  </div>
                </div>

                {predictions.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="text-xs font-semibold rounded-xl h-8"
                  >
                    {selectedIndices.length === predictions.length ? "Deselect All" : "Select All"}
                  </Button>
                )}
              </div>

              {detectedPattern && (
                <div className="flex items-center gap-2 rounded-2xl bg-primary/10 border border-primary/20 px-4 py-2.5 text-xs text-primary font-bold">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <span>Pattern Format: <code className="underline">{detectedPattern}</code></span>
                </div>
              )}

              {predictions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-3">
                  <Wand2 className="h-12 w-12 stroke-[1.5] text-muted-foreground/40 animate-bounce" />
                  <p className="text-sm font-semibold text-foreground/80">No Predictions Yet</p>
                  <p className="text-xs max-w-xs leading-relaxed">
                    Fill in sample emails and employee names on the left, then click <strong>Predict Emails with AI</strong>.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {predictions.map((item, idx) => {
                    const isSelected = selectedIndices.includes(idx);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleSelect(idx)}
                        className={`group cursor-pointer flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-200 ${
                          isSelected
                            ? "bg-primary/5 border-primary/40 shadow-sm"
                            : "bg-secondary/20 border-border hover:border-muted"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(idx)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary accent-primary"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
                            <p className="text-xs font-mono text-primary truncate">{item.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-right shrink-0">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/20">
                            {item.confidence}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {predictions.length > 0 && (
              <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-xs font-bold text-muted-foreground">
                  {selectedIndices.length} of {predictions.length} selected
                </span>
                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    onClick={handleDownloadCSV}
                    disabled={selectedIndices.length === 0}
                    className="h-11 px-4 text-xs font-bold rounded-2xl border-border"
                  >
                    <Download className="mr-1.5 h-4 w-4" />
                    CSV Export
                  </Button>
                  <Button
                    onClick={handleAddSelectedToRecipients}
                    disabled={savingRecipients || selectedIndices.length === 0}
                    className="gradient-accent text-primary-foreground h-11 px-5 text-sm font-bold rounded-2xl shadow-md flex-1 sm:flex-none"
                  >
                    {savingRecipients ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="mr-2 h-4 w-4" />
                    )}
                    Add Selected to Recipients
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
