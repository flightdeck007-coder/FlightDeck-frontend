"use client";

import { useState, useRef, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ChevronDown,
  Minus,
  Maximize2,
  X,
  Paperclip,
  User,
  FileText,
  Trash2,
} from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import { useRocksOptional } from "@/contexts/RocksContext";

export type CreateType =
  | "issue"
  | "rock"
  | "todo"
  | "headline"
  | "cascading_message";

const CREATE_TYPE_OPTIONS: { value: CreateType; label: string }[] = [
  { value: "issue", label: "Turbulence (Issue)" },
  { value: "rock", label: "Waypoint (Rock)" },
  { value: "todo", label: "Clearance (To-Do)" },
  { value: "headline", label: "Headline" },
  { value: "cascading_message", label: "Cascading message" },
];

const issueSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.string().optional(),
  who: z.string().optional(),
  teamId: z.string().optional(),
  interval: z.enum(["short", "long"]).optional(),
});

const rockSchema = z.object({
  title: z.string().min(1, "Title is required"),
  dueBy: z.string().optional(),
});

type IssueFormData = z.infer<typeof issueSchema>;
type RockFormData = z.infer<typeof rockSchema>;

interface CreatePopupProps {
  open: boolean;
  onClose: () => void;
  teamName?: string;
  teamId?: string;
  teams?: { id: string; name: string }[];
}

export function CreatePopup({
  open,
  onClose,
  teamName = "Leadership Team",
  teamId: defaultTeamId = "",
  teams = [],
}: CreatePopupProps) {
  const [createType, setCreateType] = useState<CreateType>("issue");
  const [minimized, setMinimized] = useState(false);
  const [isModal, setIsModal] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const rocksApi = useRocksOptional();

  const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx"];
  const ALLOWED_MIMES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  const isFileAllowed = (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    const mimeOk = ALLOWED_MIMES.includes(file.type);
    const extOk = ALLOWED_EXTENSIONS.includes(ext);
    return extOk || mimeOk;
  };

  const handleAttachmentClick = () => {
    setAttachmentError(null);
    fileInputRef.current?.click();
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    const allowed: File[] = [];
    const rejected: string[] = [];
    chosen.forEach((f) => {
      if (isFileAllowed(f)) allowed.push(f);
      else rejected.push(f.name);
    });
    if (rejected.length > 0) {
      setAttachmentError(
        `Not allowed: ${rejected.join(", ")}. Only PDF, DOC, DOCX, XLS, XLSX are allowed.`
      );
    }
    setAttachmentFiles((prev) => [...prev, ...allowed]);
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
    setAttachmentError(null);
  };

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<IssueFormData>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "",
      who: "",
      teamId: defaultTeamId || (teams[0]?.id ?? ""),
      interval: "short",
    },
  });

  const rockForm = useForm<RockFormData>({
    resolver: zodResolver(rockSchema),
    defaultValues: { title: "", dueBy: "" },
  });

  const selectedLabel =
    CREATE_TYPE_OPTIONS.find((o) => o.value === createType)?.label ??
    "Turbulence (Issue)";

  useEffect(() => {
    if (!open) {
      setMinimized(false);
      setAttachmentFiles([]);
      setAttachmentError(null);
      reset();
      rockForm.reset();
    }
  }, [open, reset]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setTypeDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const onIssueSubmit = (data: IssueFormData) => {
    console.log("Create issue:", data);
    onClose();
    reset();
  };

  const onRockSubmit = (data: RockFormData) => {
    const dueBy = data.dueBy?.trim() || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    rocksApi?.addRock({
      title: data.title,
      ownerName: "John Doe",
      ownerInitials: "JD",
      dueBy,
      status: "on_track",
      column: "current",
      achieved: false,
      isCompanyRock: false,
    });
    onClose();
    rockForm.reset();
  };

  if (!open) return null;

  const panelContent = (
    <div className="flex flex-col min-h-0 h-full">
      {/* Orange accent bar */}
      <div className="h-1.5 w-full bg-primary rounded-t-lg shrink-0" />

      {/* Header: Create [Type ▼] | Minimize | Toggle | Close */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl font-semibold text-foreground shrink-0">
            Create
          </span>
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setTypeDropdownOpen((o) => !o)}
              className="flex items-center gap-1 text-2xl font-semibold text-primary hover:text-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/30 rounded px-1 py-0.5"
            >
              {selectedLabel}
              <ChevronDown className="w-4 h-4 shrink-0" />
            </button>
            {typeDropdownOpen && (
              <div className="absolute left-0 top-full mt-1 py-1 bg-card border border-border rounded-md shadow-lg z-50 min-w-[200px]">
                {CREATE_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      setCreateType(opt.value);
                      setTypeDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-accent rounded-none first:rounded-t last:rounded-b"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setMinimized((m) => !m)}
            className="p-2 rounded-md hover:bg-accent text-foreground/70 hover:text-foreground transition-colors"
            aria-label={minimized ? "Expand" : "Minimize"}
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setMinimized(false);
              setIsModal((m) => !m);
            }}
            className="p-2 rounded-md hover:bg-accent text-foreground/70 hover:text-foreground transition-colors"
            aria-label={isModal ? "Pin to corner" : "Open as modal"}
            title={isModal ? "Pin to corner" : "Open as modal"}
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-accent text-foreground/70 hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Form body (hidden when minimized) */}
      {!minimized && (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {createType === "issue" && (
              <form
                id="create-issue-form"
                onSubmit={handleSubmit(onIssueSubmit)}
                className="space-y-4"
              >
                <div>
                  <label
                    htmlFor="create-title"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Title
                  </label>
                  <input
                    id="create-title"
                    {...register("title")}
                    placeholder="Add a title for the Turbulence (Issue)..."
                    className={`w-full px-3 py-2 border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                      errors.title ? "border-red-500" : "border-border"
                    }`}
                  />
                  {errors.title && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="create-desc"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Description (optional)
                  </label>
                  <Controller
                    name="description"
                    control={control}
                    defaultValue=""
                    render={({ field }) => (
                      <RichTextEditor
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Add a description (optional)..."
                      />
                    )}
                  />
                </div>

                {/* Priority | Who | Team | Interval — 2 columns */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="create-priority"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Priority (optional)
                    </label>
                    <select
                      id="create-priority"
                      {...register("priority")}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select a priority...</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="create-who"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Who (optional)
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      <input
                        id="create-who"
                        {...register("who")}
                        placeholder="Select or enter who the Issue is with..."
                        className="w-full pl-9 pr-3 py-2 border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="create-team"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Team
                    </label>
                    <select
                      id="create-team"
                      {...register("teamId")}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {teams.length > 0 ? (
                        teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))
                      ) : (
                        <option value="">{teamName}</option>
                      )}
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Changing the team will affect which users the Issue can be
                      assigned to.
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="create-interval"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Interval
                    </label>
                    <select
                      id="create-interval"
                      {...register("interval")}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="short">Short-Term</option>
                      <option value="long">Long-Term</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Attachments
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    multiple
                    className="hidden"
                    onChange={handleAttachmentChange}
                  />
                  <button
                    type="button"
                    onClick={handleAttachmentClick}
                    className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-md text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-sm"
                  >
                    <Paperclip className="w-4 h-4" />
                    Add attachment
                  </button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Allowed: PDF, DOC, DOCX, XLS, XLSX
                  </p>
                  {attachmentError && (
                    <p className="mt-1 text-xs text-red-600">{attachmentError}</p>
                  )}
                  {attachmentFiles.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {attachmentFiles.map((file, index) => (
                        <li
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-2 text-sm text-foreground"
                        >
                          <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                          <span className="truncate flex-1">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-600"
                            aria-label="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </form>
            )}

            {createType === "rock" && (
              <form
                id="create-rock-form"
                onSubmit={rockForm.handleSubmit(onRockSubmit)}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...rockForm.register("title")}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Rock title"
                  />
                  {rockForm.formState.errors.title && (
                    <p className="text-sm text-red-600 mt-1">
                      {rockForm.formState.errors.title.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Due by
                  </label>
                  <input
                    {...rockForm.register("dueBy")}
                    type="text"
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="e.g. May 23"
                  />
                </div>
              </form>
            )}
            {createType === "todo" && (
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  Clearance (To-Do) form — coming soon. Structure will include
                  title, assignee, team, due date.
                </p>
              </div>
            )}
            {createType === "headline" && (
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>Headline form — coming soon.</p>
              </div>
            )}
            {createType === "cascading_message" && (
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>Cascading message form — coming soon.</p>
              </div>
            )}
          </div>

          {/* Footer: Create [Type] | Cancel */}
          {createType === "issue" && (
            <div className="flex items-center justify-between gap-3 p-4 border-t border-border bg-card shrink-0">
              <button
                type="submit"
                form="create-issue-form"
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
              >
                Create Turbulence (Issue)
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-md hover:bg-accent text-foreground text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          )}
          {createType === "rock" && (
            <div className="flex items-center justify-between gap-3 p-4 border-t border-border bg-card shrink-0">
              <button
                type="submit"
                form="create-rock-form"
                disabled={rockForm.formState.isSubmitting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
              >
                Create Waypoint (Rock)
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-md hover:bg-accent text-foreground text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          )}
          {(createType === "todo" ||
            createType === "headline" ||
            createType === "cascading_message") && (
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-card shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-md hover:bg-accent text-foreground text-sm font-medium"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (isModal) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className="bg-background border border-border rounded-lg shadow-xl flex flex-col w-full max-w-2xl max-h-[90vh] overflow-hidden min-h-0"
          onClick={(e) => e.stopPropagation()}
        >
          {panelContent}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-50 flex flex-col bg-background border border-border rounded-lg shadow-xl overflow-hidden bottom-0 right-0 ${
        minimized ? "w-[420px]" : "w-full max-w-[650px] max-h-[80vh]"
      }`}
    >
      {panelContent}
    </div>
  );
}
