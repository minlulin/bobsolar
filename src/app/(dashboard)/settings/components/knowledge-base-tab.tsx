"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import {
  createKnowledgeChunk,
  deleteKnowledgeChunk,
  getKnowledgeChunks,
  updateKnowledgeChunk,
} from "@/actions/knowledge-actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { knowledgeKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import type { KnowledgeChunkInput } from "@/lib/validators/knowledge";

type Chunk = {
  id: string;
  content: string;
  brand: string | null;
  model: string | null;
  capacity: string | null;
  errorCode: string | null;
  dangerLevel: string | null;
  category: string | null;
};

function dangerColor(level: string | null): string {
  switch (level?.toLowerCase()) {
    case "critical":
      return "bg-red-100 text-red-800";
    case "major":
      return "bg-orange-100 text-orange-800";
    case "medium":
      return "bg-amber-100 text-amber-800";
    case "minor":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function KnowledgeBaseTab(): React.JSX.Element {
  const chunksQuery = useQuery({
    queryKey: knowledgeKeys.list(),
    queryFn: async () => {
      const res = await getKnowledgeChunks();
      if (!res.success) throw new Error(res.error);
      return res.data;
    },
    staleTime: 30_000,
  });

  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Chunk | null>(null);
  const [deleting, setDeleting] = React.useState<Chunk | null>(null);
  const [formData, setFormData] = React.useState<KnowledgeChunkInput>({
    content: "",
    brand: "",
    model: "",
    capacity: "",
    errorCode: "",
    dangerLevel: "",
    category: "",
  });
  const [saving, setSaving] = React.useState(false);

  // Upload state
  const [uploadFile, setUploadFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadResult, setUploadResult] = React.useState<{
    success: boolean;
    count: number;
    failed: number;
    total: number;
    errors?: string[];
  } | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  function openCreate() {
    setFormData({
      content: "",
      brand: "",
      model: "",
      capacity: "",
      errorCode: "",
      dangerLevel: "",
      category: "",
    });
    setCreating(true);
  }

  function openEdit(chunk: Chunk) {
    setFormData({
      content: chunk.content,
      brand: chunk.brand ?? "",
      model: chunk.model ?? "",
      capacity: chunk.capacity ?? "",
      errorCode: chunk.errorCode ?? "",
      dangerLevel: chunk.dangerLevel ?? "",
      category: chunk.category ?? "",
    });
    setEditing(chunk);
  }

  function openDelete(chunk: Chunk) {
    setDeleting(chunk);
  }

  function closeDialogs() {
    setCreating(false);
    setEditing(null);
    setDeleting(null);
    setSaving(false);
  }

  function handleFileSelect(file: File) {
    if (!file.name.toLowerCase().endsWith(".md")) {
      toast.error("Only .md (Markdown) files are accepted");
      return;
    }
    setUploadFile(file);
    setUploadResult(null);
  }

  function clearUploadFile() {
    setUploadFile(null);
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadResult(null);

    try {
      const fd = new FormData();
      fd.set("file", uploadFile);
      fd.set("clearExisting", "true");

      const res = await fetch("/api/admin/knowledge/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setUploadResult(data);
        toast.success(`Imported ${data.count} chunks from ${uploadFile.name}`);
        void chunksQuery.refetch();
      } else {
        setUploadResult({ success: false, count: 0, failed: 0, total: 0, errors: [data.error] });
        toast.error(data.error || "Import failed");
      }
    } catch {
      toast.error("Failed to upload file");
      setUploadResult({ success: false, count: 0, failed: 0, total: 0, errors: ["Network error"] });
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!formData.content.trim()) {
      toast.error("Content is required");
      return;
    }
    setSaving(true);
    try {
      const res = editing
        ? await updateKnowledgeChunk({ ...formData, id: editing.id })
        : await createKnowledgeChunk(formData);

      if (res.success) {
        toast.success(editing ? "Knowledge chunk updated" : "Knowledge chunk created");
        closeDialogs();
        void chunksQuery.refetch();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to save knowledge chunk");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setSaving(true);
    try {
      const res = await deleteKnowledgeChunk(deleting.id);
      if (res.success) {
        toast.success("Knowledge chunk deleted");
        closeDialogs();
        void chunksQuery.refetch();
      } else {
        toast.error(res.error);
      }
    } catch {
      toast.error("Failed to delete knowledge chunk");
    } finally {
      setSaving(false);
    }
  }

  const chunks: Chunk[] = chunksQuery.data ?? [];
  const grouped = chunks.reduce<Record<string, Chunk[]>>((acc, chunk) => {
    const cat = chunk.category || "Uncategorized";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(chunk);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-heading text-lg font-semibold">Knowledge Base</h3>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            Upload official user manuals as .md files. The bot uses this data to diagnose inverter
            faults accurately.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Chunk
        </Button>
      </div>

      {/* Upload Zone */}
      <div className="border-border bg-card rounded-xl border p-6">
        <div className="mb-4 flex items-center gap-2">
          <Upload className="text-muted-foreground h-5 w-5" />
          <h4 className="font-heading text-sm font-semibold">Import from Markdown File</h4>
        </div>
        <p className="text-muted-foreground mb-4 text-xs">
          Convert PDF manuals to .md using{" "}
          <a
            href="https://github.com/microsoft/markitdown"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2"
          >
            Microsoft MarkItDown
          </a>
          , then upload here. Each table row becomes a searchable knowledge chunk with embeddings.
        </p>

        {/* Drop zone */}
        <button
          type="button"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFileSelect(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={cn(
            "border-border flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition",
            dragOver ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-muted/30",
            uploadFile && "border-solid border-green-500/50 bg-green-50/30",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".md"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
          />

          {uploadFile ? (
            <div className="flex flex-col items-center gap-2">
              <FileText className="h-8 w-8 text-green-600" />
              <p className="text-sm font-medium">{uploadFile.name}</p>
              <p className="text-muted-foreground text-xs">
                {(uploadFile.size / 1024).toFixed(1)} KB
              </p>
              {!uploading && !uploadResult && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearUploadFile();
                  }}
                  className="mt-1 text-xs"
                >
                  <X className="mr-1 h-3 w-3" />
                  Remove
                </Button>
              )}
            </div>
          ) : (
            <>
              <Upload className="text-muted-foreground mb-3 h-8 w-8" />
              <p className="text-sm font-medium">Drop .md file here or click to browse</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Supports Markdown files with diagnostic tables
              </p>
            </>
          )}
        </button>

        {/* Upload button */}
        {uploadFile && !uploadResult && (
          <div className="mt-4 flex justify-end">
            <Button onClick={handleUpload} disabled={uploading} className="gap-2">
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {uploading ? "Importing..." : "Import File"}
            </Button>
          </div>
        )}

        {/* Upload result */}
        {uploadResult && (
          <div
            className={cn(
              "mt-4 rounded-lg border p-4",
              uploadResult.success ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50",
            )}
          >
            <div className="flex items-start gap-3">
              {uploadResult.success ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              ) : (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              )}
              <div className="flex-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    uploadResult.success ? "text-green-800" : "text-red-800",
                  )}
                >
                  {uploadResult.success
                    ? `Successfully imported ${uploadResult.count} knowledge chunks`
                    : "Import failed"}
                </p>
                {uploadResult.success && uploadResult.failed > 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    {uploadResult.failed} chunks failed to import
                  </p>
                )}
                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <div className="mt-2 text-xs text-red-700">
                    <p className="font-medium">Errors:</p>
                    <ul className="mt-1 list-inside list-disc">
                      {uploadResult.errors.slice(0, 5).map((err) => (
                        <li key={err}>{err}</li>
                      ))}
                      {uploadResult.errors.length > 5 && (
                        <li>...and {uploadResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
                {uploadResult.success && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearUploadFile}
                    className="mt-2 text-xs text-green-700 hover:text-green-800"
                  >
                    Upload another file
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4">
        <div className="border-border bg-card rounded-xl border px-4 py-3">
          <p className="text-muted-foreground text-xs">Total Chunks</p>
          <p className="font-heading text-2xl font-semibold">{chunks.length}</p>
        </div>
        <div className="border-border bg-card rounded-xl border px-4 py-3">
          <p className="text-muted-foreground text-xs">Categories</p>
          <p className="font-heading text-2xl font-semibold">{Object.keys(grouped).length}</p>
        </div>
        <div className="border-border bg-card rounded-xl border px-4 py-3">
          <p className="text-muted-foreground text-xs">Brands Covered</p>
          <p className="font-heading text-2xl font-semibold">
            {new Set(chunks.map((c) => c.brand).filter(Boolean)).size}
          </p>
        </div>
        <div className="border-border bg-card rounded-xl border px-4 py-3">
          <p className="text-muted-foreground text-xs">Error Codes</p>
          <p className="font-heading text-2xl font-semibold">
            {chunks.filter((c) => c.errorCode).length}
          </p>
        </div>
      </div>

      {/* Loading state */}
      {chunksQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}

      {/* Empty state */}
      {!chunksQuery.isLoading && chunks.length === 0 ? (
        <div className="border-border bg-card rounded-xl border py-12 text-center">
          <FileText className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
          <p className="text-muted-foreground text-sm">
            No knowledge chunks yet. Upload a .md file to get started.
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Convert your PDF manuals to .md using MarkItDown, then upload above.
          </p>
        </div>
      ) : null}

      {/* Grouped chunk list */}
      {!chunksQuery.isLoading && chunks.length > 0 ? (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, categoryChunks]) => (
            <div key={category}>
              <h4 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                {category} ({categoryChunks.length})
              </h4>
              <div className="space-y-2">
                {categoryChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="border-border/70 bg-muted/35 flex items-start justify-between gap-4 rounded-xl border p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-relaxed line-clamp-2">{chunk.content}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {chunk.brand ? (
                          <span className="bg-secondary rounded-md px-2 py-0.5 text-xs font-medium">
                            {chunk.brand}
                          </span>
                        ) : null}
                        {chunk.model ? (
                          <span className="bg-secondary rounded-md px-2 py-0.5 text-xs font-medium">
                            {chunk.model}
                          </span>
                        ) : null}
                        {chunk.capacity ? (
                          <span className="bg-secondary rounded-md px-2 py-0.5 text-xs font-medium">
                            {chunk.capacity}
                          </span>
                        ) : null}
                        {chunk.errorCode ? (
                          <span className="bg-accent text-accent-foreground rounded-md px-2 py-0.5 text-xs font-medium">
                            {chunk.errorCode}
                          </span>
                        ) : null}
                        {chunk.dangerLevel ? (
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-medium ${dangerColor(chunk.dangerLevel)}`}
                          >
                            {chunk.dangerLevel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(chunk)}
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openDelete(chunk)}
                        title="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Create / Edit Dialog */}
      <Dialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) closeDialogs();
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Knowledge Chunk" : "Add Knowledge Chunk"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the diagnostic content. The embedding will be regenerated automatically."
                : "Add new diagnostic content. An embedding vector will be generated automatically."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="kb-content">
                Content <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="kb-content"
                value={formData.content}
                onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
                placeholder="Describe the inverter fault, symptoms, causes, and troubleshooting steps..."
                className="min-h-[120px]"
              />
              <p className="text-muted-foreground text-xs">
                {formData.content.length}/10,000 characters
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="kb-brand">Brand</Label>
                <Input
                  id="kb-brand"
                  value={formData.brand}
                  onChange={(e) => setFormData((p) => ({ ...p, brand: e.target.value }))}
                  placeholder="e.g. Growatt, Sungrow, Huawei"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="kb-model">Model</Label>
                <Input
                  id="kb-model"
                  value={formData.model}
                  onChange={(e) => setFormData((p) => ({ ...p, model: e.target.value }))}
                  placeholder="e.g. IVEM5048-LV"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="kb-capacity">Capacity</Label>
                <Input
                  id="kb-capacity"
                  value={formData.capacity}
                  onChange={(e) => setFormData((p) => ({ ...p, capacity: e.target.value }))}
                  placeholder="e.g. 5KVA"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="kb-error-code">Error Code</Label>
                <Input
                  id="kb-error-code"
                  value={formData.errorCode}
                  onChange={(e) => setFormData((p) => ({ ...p, errorCode: e.target.value }))}
                  placeholder="e.g. F09, Fault 20, E01"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="kb-danger-level">Danger Level</Label>
                <Input
                  id="kb-danger-level"
                  value={formData.dangerLevel}
                  onChange={(e) => setFormData((p) => ({ ...p, dangerLevel: e.target.value }))}
                  placeholder="Minor, Medium, Major, Critical"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="kb-category">Category</Label>
                <Input
                  id="kb-category"
                  value={formData.category}
                  onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                  placeholder="e.g. Grid, Isolation, BMS, Thermal"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleting}
        onOpenChange={(o) => {
          if (!o) closeDialogs();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Knowledge Chunk</DialogTitle>
            <DialogDescription>
              This will permanently remove this chunk from the knowledge base. The chatbot will no
              longer be able to reference this data.
            </DialogDescription>
          </DialogHeader>
          {deleting ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <p className="text-sm line-clamp-3">{deleting.content}</p>
              <div className="mt-2 flex gap-2">
                {deleting.brand ? (
                  <span className="bg-secondary rounded-md px-2 py-0.5 text-xs">
                    {deleting.brand}
                  </span>
                ) : null}
                {deleting.errorCode ? (
                  <span className="bg-accent text-accent-foreground rounded-md px-2 py-0.5 text-xs">
                    {deleting.errorCode}
                  </span>
                ) : null}
                {deleting.dangerLevel ? (
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs ${dangerColor(deleting.dangerLevel)}`}
                  >
                    {deleting.dangerLevel}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialogs} disabled={saving}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={saving}
              className="gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
