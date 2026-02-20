/**
 * Credtent Admin Dashboard — Content Valuation Submissions
 * Accessible only to users with role=admin.
 * Lists all submitted assessments with search, status filter, and detail drawer.
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  Building2, Search, ChevronRight, CheckCircle2, Clock, Archive,
  Loader2, Film, FileText, Mic, Image, Share2, Palette, Gamepad2,
  Clapperboard, HelpCircle, RotateCcw, X, Mail, User, Tag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ── Helpers ──────────────────────────────────────────────────────────────────

const CONTENT_TYPE_ICONS: Record<string, React.ElementType> = {
  video: Film, written: FileText, audio: Mic, images: Image,
  social: Share2, design: Palette, games: Gamepad2, film: Clapperboard, other: HelpCircle,
};

const CONTENT_TYPE_COLORS: Record<string, string> = {
  video: "oklch(0.55 0.15 264)", written: "oklch(0.55 0.18 145)", audio: "oklch(0.60 0.18 30)",
  images: "oklch(0.55 0.16 200)", social: "oklch(0.60 0.18 310)", design: "oklch(0.58 0.18 60)",
  games: "oklch(0.52 0.18 280)", film: "oklch(0.45 0.12 264)", other: "oklch(0.52 0.08 264)",
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  submitted:   { label: "Submitted",   color: "bg-blue-50 text-blue-700 border-blue-200",   icon: Clock },
  reviewed:    { label: "Reviewed",    color: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle2 },
  in_progress: { label: "In Progress", color: "bg-amber-50 text-amber-700 border-amber-200", icon: RotateCcw },
  archived:    { label: "Archived",    color: "bg-gray-50 text-gray-500 border-gray-200",    icon: Archive },
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatVal(val: unknown): string {
  if (val === undefined || val === null || val === "") return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (Array.isArray(val)) return val.filter(Boolean).join(", ");
  return String(val);
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({
  id, onClose,
}: {
  id: number;
  onClose: () => void;
}) {
  const { data, isLoading } = trpc.assessments.get.useQuery({ id });
  const utils = trpc.useUtils();
  const updateStatus = trpc.assessments.updateStatus.useMutation({
    onSuccess: () => utils.assessments.list.invalidate(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }
  if (!data) return null;

  const companyAnswers = (data.companyAnswers as Record<string, unknown>) ?? {};
  const contentEntries = (data.contentEntries as Array<{ type: string; answers: Record<string, unknown>; customLabel?: string }>) ?? [];

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Drawer header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
        <div>
          <h2 className="text-sm font-bold text-[oklch(0.22_0.08_264)]">
            {String(companyAnswers.companyName || "Unknown Company")}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">{formatDate(data.createdAt)} · ID #{data.id}</p>
        </div>
        <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Status selector */}
      <div className="px-5 py-3 border-b border-gray-50 flex-shrink-0 flex items-center gap-3">
        <span className="text-xs text-gray-400 font-medium">Status</span>
        <Select
          value={data.status}
          onValueChange={(val) => updateStatus.mutate({ id: data.id, status: val as "submitted" | "reviewed" | "in_progress" | "archived" })}
        >
          <SelectTrigger className="h-7 text-xs w-36 border-gray-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Contact info */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Contact</p>
          <div className="space-y-1.5">
            {[
              { icon: Building2, key: "companyName", label: "Company" },
              { icon: User, key: "contactName", label: "Name" },
              { icon: Mail, key: "contactEmail", label: "Email" },
            ].map(({ icon: Icon, key, label }) => {
              const val = formatVal(companyAnswers[key]);
              if (!val) return null;
              return (
                <div key={key} className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                  <span className="text-xs text-gray-500">{label}:</span>
                  <span className="text-xs font-medium text-gray-800">{val}</span>
                </div>
              );
            })}
            {data.submissionEmail && data.submissionEmail !== formatVal(companyAnswers.contactEmail) && (
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[oklch(0.68_0.19_41)] flex-shrink-0" />
                <span className="text-xs text-gray-500">Submission email:</span>
                <span className="text-xs font-medium text-gray-800">{data.submissionEmail}</span>
              </div>
            )}
          </div>
        </div>

        {/* Content type tags */}
        {data.contentTypes && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Content Types</p>
            <div className="flex flex-wrap gap-1.5">
              {data.contentTypes.split(", ").map((t) => {
                const Icon = CONTENT_TYPE_ICONS[t] ?? Tag;
                const color = CONTENT_TYPE_COLORS[t] ?? "oklch(0.52 0.08 264)";
                return (
                  <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-white text-xs font-medium" style={{ background: color }}>
                    <Icon className="w-3 h-3" />
                    {t}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Content entry details */}
        {contentEntries.map((entry, i) => {
          const Icon = CONTENT_TYPE_ICONS[entry.type] ?? Tag;
          const color = CONTENT_TYPE_COLORS[entry.type] ?? "oklch(0.52 0.08 264)";
          const label = entry.customLabel || entry.type;
          const items = Object.entries(entry.answers).filter(([k, v]) => {
            if (k === "otherContentDescription") return false;
            const f = formatVal(v);
            return f && f !== "false" && f !== "No";
          });
          return (
            <div key={i}>
              <div className="flex items-center gap-1.5 mb-2">
                <Icon className="w-3.5 h-3.5" style={{ color }} />
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color }}>{label}</p>
              </div>
              <div className="space-y-1.5 pl-5">
                {items.map(([k, v]) => (
                  <div key={k} className="flex gap-2 items-start">
                    <CheckCircle2 className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-700 leading-snug">{formatVal(v)}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Notes */}
        {data.notes && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Additional Notes</p>
            <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 rounded-xl px-3 py-2">{data.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────

export default function Admin() {
  const { user, loading } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  const { data, isLoading, refetch } = trpc.assessments.list.useQuery(
    { limit: LIMIT, offset: page * LIMIT, search: debouncedSearch || undefined },
    { enabled: !!user && user.role === "admin" }
  );

  // Debounce search
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((window as unknown as { _searchTimer: ReturnType<typeof setTimeout> })._searchTimer);
    (window as unknown as { _searchTimer: ReturnType<typeof setTimeout> })._searchTimer = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(0);
    }, 350);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[oklch(0.98_0.003_264)]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[oklch(0.98_0.003_264)]">
        <div className="text-center">
          <p className="text-sm text-gray-500 mb-4">You need to be signed in to access the admin panel.</p>
          <a href={getLoginUrl()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[oklch(0.22_0.08_264)] text-white text-sm font-semibold">
            Sign in
          </a>
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[oklch(0.98_0.003_264)]">
        <div className="text-center">
          <p className="text-sm text-gray-500">Access restricted to Credtent admins.</p>
        </div>
      </div>
    );
  }

  const rows = (data?.rows ?? []).filter((r) =>
    statusFilter === "all" ? true : r.status === statusFilter
  );
  const total = data?.total ?? 0;

  return (
    <div className="h-screen flex flex-col bg-[oklch(0.98_0.003_264)] overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-[oklch(0.22_0.08_264)] h-14 flex items-center px-4 sm:px-6 justify-between z-10">
        <div className="flex items-center gap-2.5">
          <svg width="26" height="26" viewBox="0 0 40 40" fill="none">
            <path d="M20 3L5 9V20C5 28.5 11.5 36.4 20 38C28.5 36.4 35 28.5 35 20V9L20 3Z" fill="oklch(0.68 0.19 41)" />
            <text x="20" y="26" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold" fontFamily="Sora,sans-serif">C</text>
          </svg>
          <span className="text-white font-bold text-base tracking-tight">Credtent</span>
          <span className="text-white/30 text-sm mx-1 hidden sm:inline">|</span>
          <span className="text-white/60 text-sm hidden sm:inline">Admin · Submissions</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-xs hidden sm:inline">{user.name}</span>
          <a href="/" className="text-white/50 hover:text-white/80 text-xs transition-colors">← Back to form</a>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* List panel */}
        <div className={`flex flex-col ${selectedId ? "hidden md:flex md:w-1/2 lg:w-3/5" : "flex-1"} border-r border-gray-200`}>
          {/* Toolbar */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-gray-100 bg-white flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
              <Input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search by company, contact, or content type…"
                className="pl-9 h-9 text-sm border-gray-200"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs w-36 border-gray-200">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-9 px-2">
              <RotateCcw className="w-3.5 h-3.5 text-gray-400" />
            </Button>
          </div>

          {/* Stats bar */}
          <div className="flex-shrink-0 px-4 py-2 bg-white border-b border-gray-50 flex items-center gap-4">
            <span className="text-xs text-gray-400">{total} total submission{total !== 1 ? "s" : ""}</span>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => {
              const count = (data?.rows ?? []).filter((r) => r.status === k).length;
              if (!count) return null;
              return (
                <span key={k} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${v.color}`}>
                  {count} {v.label.toLowerCase()}
                </span>
              );
            })}
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-gray-400">No submissions found.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {rows.map((row) => {
                  const types = (row.contentTypes ?? "").split(", ").filter(Boolean);
                  const statusCfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.submitted;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors flex items-center gap-3 ${selectedId === row.id ? "bg-blue-50/50" : ""}`}
                    >
                      <div className="w-9 h-9 rounded-xl bg-[oklch(0.22_0.08_264)]/8 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-[oklch(0.22_0.08_264)]/50" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-gray-800 truncate">{row.companyName || "Unknown"}</p>
                          <span className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full border flex-shrink-0 ${statusCfg.color}`}>
                            <StatusIcon className="w-2.5 h-2.5" />
                            {statusCfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">{row.contactName || ""}{row.contactEmail ? ` · ${row.contactEmail}` : ""}</p>
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {types.slice(0, 5).map((t) => {
                            const Icon = CONTENT_TYPE_ICONS[t] ?? Tag;
                            const color = CONTENT_TYPE_COLORS[t] ?? "oklch(0.52 0.08 264)";
                            return (
                              <span key={t} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-white text-xs" style={{ background: color + "cc" }}>
                                <Icon className="w-2.5 h-2.5" />
                                {t}
                              </span>
                            );
                          })}
                          {types.length > 5 && <span className="text-xs text-gray-400">+{types.length - 5}</span>}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <p className="text-xs text-gray-400">{formatDate(row.createdAt)}</p>
                        <ChevronRight className="w-4 h-4 text-gray-300 mt-1 ml-auto" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">Page {page + 1} of {Math.ceil(total / LIMIT)}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="h-7 text-xs">Prev</Button>
                <Button variant="outline" size="sm" disabled={(page + 1) * LIMIT >= total} onClick={() => setPage((p) => p + 1)} className="h-7 text-xs">Next</Button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedId && (
          <div className="flex-1 md:w-1/2 lg:w-2/5 flex-shrink-0 overflow-hidden">
            <DetailDrawer id={selectedId} onClose={() => setSelectedId(null)} />
          </div>
        )}

        {!selectedId && (
          <div className="hidden md:flex flex-1 items-center justify-center bg-gray-50/50">
            <div className="text-center">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
              <p className="text-xs text-gray-400">Select a submission to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
