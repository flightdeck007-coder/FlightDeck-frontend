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
import { useIssuesOptional } from "@/contexts/IssuesContext";
import { useTodosOptional } from "@/contexts/TodosContext";
import { useHeadlinesOptional } from "@/contexts/HeadlinesContext";

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
  description: z.string().optional(),
  dueBy: z.string().optional(),
  status: z.enum(["on_track", "off_track", "at_risk", "done"]).optional(),
  isCompanyRock: z.boolean().optional(),
  teamId: z.string().optional(),
});

const todoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  repeat: z.string().optional(),
  teamId: z.string().optional(),
  private: z.boolean().optional(),
});

const headlineSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  teamId: z.string().optional(),
});

const cascadingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  teamId: z.string().optional(),
});

type IssueFormData = z.infer<typeof issueSchema>;
type RockFormData = z.infer<typeof rockSchema>;
type TodoFormData = z.infer<typeof todoSchema>;
type HeadlineFormData = z.infer<typeof headlineSchema>;
type CascadingFormData = z.infer<typeof cascadingSchema>;

interface CreatePopupProps {
  open: boolean;
  onClose: () => void;
  teamName?: string;
  teamId?: string;
  teams?: { id: string; name: string }[];
  initialType?: CreateType;
}

export function CreatePopup({
  open,
  onClose,
  teamName = "Leadership Team",
  teamId: defaultTeamId = "",
  teams = [],
  initialType,
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
  const issuesApi = useIssuesOptional();
  const todosApi = useTodosOptional();
  const headlinesApi = useHeadlinesOptional();

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
    defaultValues: { title: "", description: "", dueBy: "", status: "on_track", isCompanyRock: false, teamId: "" },
  });

  const todoForm = useForm<TodoFormData>({
    resolver: zodResolver(todoSchema),
    defaultValues: { title: "", description: "", dueDate: "", repeat: "Don't repeat", teamId: defaultTeamId || (teams[0]?.id ?? ""), private: false },
  });

  const headlineForm = useForm<HeadlineFormData>({
    resolver: zodResolver(headlineSchema),
    defaultValues: { title: "", description: "", teamId: defaultTeamId || (teams[0]?.id ?? "") },
  });

  const cascadingForm = useForm<CascadingFormData>({
    resolver: zodResolver(cascadingSchema),
    defaultValues: { title: "", description: "", teamId: defaultTeamId || (teams[0]?.id ?? "") },
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
      todoForm.reset();
      headlineForm.reset();
      cascadingForm.reset();
    }
    if (open && initialType) setCreateType(initialType);
  }, [open, reset, initialType]);

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

  const onIssueSubmit = async (data: IssueFormData) => {
    if (issuesApi) {
      await issuesApi.addIssue({
        title: data.title,
        description: data.description || undefined,
        priority: data.priority ? parseInt(data.priority, 10) : 0,
        termType: data.interval === "long" ? "long_term" : "short_term",
      });
    }
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
      status: (data.status as "on_track" | "off_track" | "at_risk" | "done") || "on_track",
      column: "current",
      achieved: false,
      isCompanyRock: Boolean(data.isCompanyRock),
    });
    onClose();
    rockForm.reset();
  };

  const onTodoSubmit = async (data: TodoFormData) => {
    if (todosApi) {
      await todosApi.addTodo({
        title: data.title,
        description: data.description || undefined,
        dueDate: data.dueDate || null,
        ownerInitials: "U",
        completed: false,
      });
    }
    onClose();
    todoForm.reset();
  };

  const onHeadlineSubmit = (data: HeadlineFormData) => {
    const now = new Date().toISOString();
    headlinesApi?.addHeadline({
      title: data.title,
      createdAt: now,
      createdAgo: "Just now",
      ownerInitials: "U",
      archived: false,
    });
    onClose();
    headlineForm.reset();
  };

  const onCascadingSubmit = (data: CascadingFormData) => {
    const now = new Date().toISOString();
    headlinesApi?.addCascadingMessage({
      title: data.title,
      from: teamName || "Leadership Team",
      createdAt: now,
      createdAgo: "Just now",
      ownerInitials: "U",
      archived: false,
    });
    onClose();
    cascadingForm.reset();
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
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  <span className="text-base">✨</span> Help me draft a SMART Rock
                </button>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    {...rockForm.register("title")}
                    className={`w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      rockForm.formState.errors.title ? "border-red-500" : "border-border"
                    }`}
                    placeholder="Add a title for the Rock..."
                  />
                  {rockForm.formState.errors.title && (
                    <p className="text-sm text-red-600 mt-1">
                      {rockForm.formState.errors.title.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Description (optional)
                  </label>
                  <Controller
                    name="description"
                    control={rockForm.control}
                    render={({ field }) => (
                      <RichTextEditor
                        value={field.value ?? ""}
                        onChange={field.onChange}
                        placeholder="Add a description (optional)..."
                      />
                    )}
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...rockForm.register("isCompanyRock")}
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">Company Rock</span>
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Due date</label>
                    <input
                      {...rockForm.register("dueBy")}
                      type="text"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g. 5/27/2026"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                    <select
                      {...rockForm.register("status")}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="on_track">On-track</option>
                      <option value="at_risk">At-risk</option>
                      <option value="off_track">Off-track</option>
                      <option value="done">Done</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Team</label>
                  <select
                    {...rockForm.register("teamId")}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {teams.length > 0 ? teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    )) : <option value="">{teamName}</option>}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Changing the team will affect which users the Rock can be assigned to.
                  </p>
                </div>
              </form>
            )}
            {createType === "todo" && (
              <form id="create-todo-form" onSubmit={todoForm.handleSubmit(onTodoSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Title <span className="text-red-500">*</span></label>
                  <input
                    {...todoForm.register("title")}
                    className={`w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      todoForm.formState.errors.title ? "border-red-500" : "border-border"
                    }`}
                    placeholder="Add a title for the To-Do..."
                  />
                  {todoForm.formState.errors.title && (
                    <p className="text-sm text-red-600 mt-1">{todoForm.formState.errors.title.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
                  <Controller
                    name="description"
                    control={todoForm.control}
                    render={({ field }) => (
                      <RichTextEditor value={field.value ?? ""} onChange={field.onChange} placeholder="Add a description (optional)..." />
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Due date</label>
                    <input
                      {...todoForm.register("dueDate")}
                      type="text"
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="e.g. 3/5/2026"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Repeat</label>
                    <select
                      {...todoForm.register("repeat")}
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="Don't repeat">Don&apos;t repeat</option>
                      <option value="Weekly">Weekly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Team</label>
                  <select
                    {...todoForm.register("teamId")}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {teams.length > 0 ? teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>) : <option value="">{teamName}</option>}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">Changing the team will affect which users the To-Do can be assigned to.</p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" {...todoForm.register("private")} className="rounded border-border" />
                  <span className="text-sm text-foreground">Make this To-Do private.</span>
                </label>
              </form>
            )}
            {createType === "headline" && (
              <form id="create-headline-form" onSubmit={headlineForm.handleSubmit(onHeadlineSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Title <span className="text-red-500">*</span></label>
                  <input
                    {...headlineForm.register("title")}
                    className={`w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      headlineForm.formState.errors.title ? "border-red-500" : "border-border"
                    }`}
                    placeholder="Add a title for the Headline..."
                  />
                  {headlineForm.formState.errors.title && (
                    <p className="text-sm text-red-600 mt-1">{headlineForm.formState.errors.title.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
                  <Controller
                    name="description"
                    control={headlineForm.control}
                    render={({ field }) => (
                      <RichTextEditor value={field.value ?? ""} onChange={field.onChange} placeholder="Add a description (optional)..." />
                    )}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Team</label>
                  <select
                    {...headlineForm.register("teamId")}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {teams.length > 0 ? teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>) : <option value="">{teamName}</option>}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">Changing the team will affect which users the Headline can be assigned to.</p>
                </div>
              </form>
            )}
            {createType === "cascading_message" && (
              <form id="create-cascading-form" onSubmit={cascadingForm.handleSubmit(onCascadingSubmit)} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Title <span className="text-red-500">*</span></label>
                  <input
                    {...cascadingForm.register("title")}
                    className={`w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                      cascadingForm.formState.errors.title ? "border-red-500" : "border-border"
                    }`}
                    placeholder="Add a title for the Cascading Message..."
                  />
                  {cascadingForm.formState.errors.title && (
                    <p className="text-sm text-red-600 mt-1">{cascadingForm.formState.errors.title.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Description (optional)</label>
                  <Controller
                    name="description"
                    control={cascadingForm.control}
                    render={({ field }) => (
                      <RichTextEditor value={field.value ?? ""} onChange={field.onChange} placeholder="Add a description (optional)..." />
                    )}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Team</label>
                  <select
                    {...cascadingForm.register("teamId")}
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {teams.length > 0 ? teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>) : <option value="">{teamName}</option>}
                  </select>
                  <p className="mt-1 text-xs text-muted-foreground">Changing the team will affect which users can own the Cascading Message.</p>
                </div>
              </form>
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
                Create Rock
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-md hover:bg-accent text-foreground text-sm font-medium">
                Cancel
              </button>
            </div>
          )}
          {createType === "todo" && (
            <div className="flex items-center justify-between gap-3 p-4 border-t border-border bg-card shrink-0">
              <button
                type="submit"
                form="create-todo-form"
                disabled={todoForm.formState.isSubmitting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
              >
                Create To-Do
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-md hover:bg-accent text-foreground text-sm font-medium">
                Cancel
              </button>
            </div>
          )}
          {createType === "headline" && (
            <div className="flex items-center justify-between gap-3 p-4 border-t border-border bg-card shrink-0">
              <button
                type="submit"
                form="create-headline-form"
                disabled={headlineForm.formState.isSubmitting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
              >
                Create Headline
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-md hover:bg-accent text-foreground text-sm font-medium">
                Cancel
              </button>
            </div>
          )}
          {createType === "cascading_message" && (
            <div className="flex items-center justify-between gap-3 p-4 border-t border-border bg-card shrink-0">
              <button
                type="submit"
                form="create-cascading-form"
                disabled={cascadingForm.formState.isSubmitting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 text-sm font-medium"
              >
                Create Cascading Message
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2 border border-border rounded-md hover:bg-accent text-foreground text-sm font-medium">
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
