"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Select, Input, Dropdown } from "antd";
import type { MenuProps } from "antd";
import {
  Minus,
  Maximize2,
  X,
  Paperclip,
  FileText,
  Trash2,
  ChevronDown,
  Link2,
} from "lucide-react";
import dayjs, { type Dayjs } from "dayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { MobileDatePicker } from "@mui/x-date-pickers/MobileDatePicker";
import { MobileTimePicker } from "@mui/x-date-pickers/MobileTimePicker";
import { RichTextEditor } from "./RichTextEditor";
import { useRocksOptional } from "@/contexts/RocksContext";
import { useIssuesOptional } from "@/contexts/IssuesContext";
import { useTodosOptional } from "@/contexts/TodosContext";
import { useHeadlinesOptional } from "@/contexts/HeadlinesContext";
import type { Team } from "@/lib/api/teams.service";
import { teamsService } from "@/lib/api/teams.service";

export type CreateType =
  | "issue"
  | "rock"
  | "todo"
  | "headline"
  | "cascading_message";

const CREATE_TYPE_OPTIONS: { value: CreateType; label: string }[] = [
  { value: "issue", label: "Turbulence" },
  { value: "rock", label: "Waypoint" },
  { value: "todo", label: "Clearance" },
  { value: "headline", label: "Headline" },
  { value: "cascading_message", label: "Cascading message" },
];

/** Linked entity type for display (measurable = scorecard; rock_milestone = waypoint milestone). */
type LinkedEntityType = CreateType | "measurable" | "rock_milestone";

export type CreatePopupLinkedEntity = {
  type: LinkedEntityType;
  id: string;
  title: string;
};

function linkedEntityTypeLabel(type: LinkedEntityType): string {
  const map: Record<string, string> = {
    issue: "Turbulence",
    rock: "Waypoint",
    todo: "Clearance",
    headline: "Headline",
    cascading_message: "Cascading message",
    measurable: "Measurable",
    rock_milestone: "Milestone",
  };
  return map[type] ?? type;
}

/** Card section shown when creating from a "Link" action or from measurable: shows what we're linking from (above attachments). */
function LinkingToSection({
  linkedEntity,
}: {
  linkedEntity: CreatePopupLinkedEntity;
}) {
  return (
    <div className="border-t border-b border-border py-5 my-5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Linking to
      </p>
      <div className="rounded-lg border border-border border-t-2 border-t-primary bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <Link2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-0.5">
              {linkedEntityTypeLabel(linkedEntity.type)}
            </p>
            <p className="text-sm font-semibold text-foreground break-words">
              {linkedEntity.title}
            </p>
          </div>
        </div>
      </div>
      <p className="mt-2.5 ml-1 text-[12px] font-medium text-foreground/65">
        The form below creates the new item linked to the one above.
      </p>
    </div>
  );
}

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
  dueByTime: z.string().optional(),
  status: z.enum(["on_track", "off_track", "at_risk", "done", "other"]).optional(),
  isCompanyRock: z.boolean().optional(),
  ownerId: z.string().optional(),
  teamId: z.string().optional(),
  quarter: z.string().optional(),
  otherTeamId: z.string().optional(),
});

const todoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  repeat: z.string().optional(),
  teamId: z.string().min(1, "Team is required"),
  assigneeId: z.string().optional(),
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

const MUI_PICKER_SX = {
  "& .MuiInputLabel-root": { color: "var(--foreground) !important", "&.Mui-focused": { color: "var(--primary) !important" } },
  "& .MuiOutlinedInput-root": {
    backgroundColor: "var(--background)",
    color: "var(--foreground) !important",
    "& fieldset": { borderColor: "var(--border)" },
    "&:hover fieldset": { borderColor: "var(--foreground)" },
    "&.Mui-focused fieldset": { borderColor: "var(--primary)", borderWidth: "1px" },
  },
  "& .MuiInputBase-input": { color: "var(--foreground) !important", WebkitTextFillColor: "var(--foreground)" },
  "& .MuiInputAdornment-root .MuiSvgIcon-root": { color: "var(--foreground) !important" },
  "& .MuiIconButton-root": { color: "var(--foreground) !important" },
};

/** Build quarter options: None, Q4 FY 2025, Q1 FY 2026, ... */
function getQuarterOptions(): { label: string; value: string }[] {
  const options: { label: string; value: string }[] = [{ label: "None", value: "" }];
  const now = new Date();
  const year = now.getFullYear();
  for (let y = year - 1; y <= year + 1; y++) {
    for (let q = 1; q <= 4; q++) {
      options.push({ label: `Q${q} FY ${y}`, value: `Q${q}-FY-${y}` });
    }
  }
  return options;
}

/** Fetches teams when dropdown opens and shows only fetched list */
function RockOtherTeamSelect({
  organizationId,
  value,
  onChange,
}: {
  organizationId: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && organizationId && teams.length === 0) {
      setLoading(true);
      teamsService
        .list(organizationId)
        .then(setTeams)
        .finally(() => setLoading(false));
    }
  }, [open, organizationId]);

  return (
    <Select
      placeholder="Select team..."
      value={value || undefined}
      onChange={(v) => onChange(v ?? "")}
      onOpenChange={setOpen}
      loading={loading}
      options={teams.map((t) => ({ label: t.name, value: t.id }))}
      className="w-full"
      allowClear
    />
  );
}

function getInitials(name?: string | null, email?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "U";
}

interface CreatePopupProps {
  open: boolean;
  onClose: () => void;
  teamName?: string;
  teamId?: string;
  teams?: Team[];
  organizationId?: string;
  /** When 'measurable', popup opens on Clearance tab with linked measurable (no measurable tab in popup). */
  initialType?: CreateType | 'measurable';
  /** Pre-fill title when opening Create Clearance or Create Turbulence (e.g. "Review 3 Measurables") */
  initialTitle?: string;
  /** Pre-fill description when opening Create Clearance or Create Turbulence (e.g. "Measurables:\n• Item 1") */
  initialDescription?: string;
  /** When creating from a row (e.g. "Link issue" from rock, or create from measurable): pre-set link so the new issue/todo shows "Linking to" (measurable is display-only; backend also supports rock_milestone) */
  initialLinkedEntity?: CreatePopupLinkedEntity;
  /** Meeting attendees for rock owner dropdown (and issue/todo assignees if needed) */
  meetingAttendances?: Array<{ id: string; user: { id: string; name?: string | null; email: string } }>;
  currentUserId?: string | null;
}

export function CreatePopup({
  open,
  onClose,
  teamName = "No team found",
  teamId: defaultTeamId = "",
  teams = [],
  organizationId,
  initialType,
  initialTitle,
  initialDescription,
  initialLinkedEntity,
  meetingAttendances = [],
  currentUserId,
}: CreatePopupProps) {
  const teamsList = Array.isArray(teams) ? teams : [];
  const teamsForSelect = teamsList.length > 0 ? teamsList.map((t) => ({ id: t.id, name: t.name })) : [];
  const [createType, setCreateType] = useState<CreateType>("issue");
  const [minimized, setMinimized] = useState(false);
  const [isModal, setIsModal] = useState(false);
  const [linkedEntity, setLinkedEntity] = useState<CreatePopupLinkedEntity | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const rockFileInputRef = useRef<HTMLInputElement>(null);
  const [rockAttachmentFiles, setRockAttachmentFiles] = useState<File[]>([]);
  const [rockAttachmentError, setRockAttachmentError] = useState<string | null>(null);
  const todoFileInputRef = useRef<HTMLInputElement>(null);
  const [todoAttachmentFiles, setTodoAttachmentFiles] = useState<File[]>([]);
  const [todoAttachmentError, setTodoAttachmentError] = useState<string | null>(null);
  const headlineFileInputRef = useRef<HTMLInputElement>(null);
  const [headlineAttachmentFiles, setHeadlineAttachmentFiles] = useState<File[]>([]);
  const [headlineAttachmentError, setHeadlineAttachmentError] = useState<string | null>(null);
  const cascadingFileInputRef = useRef<HTMLInputElement>(null);
  const [cascadingAttachmentFiles, setCascadingAttachmentFiles] = useState<File[]>([]);
  const [cascadingAttachmentError, setCascadingAttachmentError] = useState<string | null>(null);
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

  const handleRockAttachmentClick = () => {
    setRockAttachmentError(null);
    rockFileInputRef.current?.click();
  };

  const handleRockAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    const allowed: File[] = [];
    const rejected: string[] = [];
    chosen.forEach((f) => {
      if (isFileAllowed(f)) allowed.push(f);
      else rejected.push(f.name);
    });
    if (rejected.length > 0) {
      setRockAttachmentError(
        `Not allowed: ${rejected.join(", ")}. Only PDF, DOC, DOCX, XLS, XLSX are allowed.`
      );
    }
    setRockAttachmentFiles((prev) => [...prev, ...allowed]);
    e.target.value = "";
  };

  const removeRockAttachment = (index: number) => {
    setRockAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
    setRockAttachmentError(null);
  };

  const handleTodoAttachmentClick = () => {
    setTodoAttachmentError(null);
    todoFileInputRef.current?.click();
  };
  const handleTodoAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    const allowed = chosen.filter((f) => isFileAllowed(f));
    const rejected = chosen.filter((f) => !isFileAllowed(f));
    if (rejected.length > 0) {
      setTodoAttachmentError(`Not allowed: ${rejected.map((f) => f.name).join(", ")}. Only PDF, DOC, DOCX, XLS, XLSX are allowed.`);
    }
    setTodoAttachmentFiles((prev) => [...prev, ...allowed]);
    e.target.value = "";
  };
  const removeTodoAttachment = (index: number) => {
    setTodoAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
    setTodoAttachmentError(null);
  };

  const handleHeadlineAttachmentClick = () => {
    setHeadlineAttachmentError(null);
    headlineFileInputRef.current?.click();
  };
  const handleHeadlineAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    const allowed = chosen.filter((f) => isFileAllowed(f));
    const rejected = chosen.filter((f) => !isFileAllowed(f));
    if (rejected.length > 0) {
      setHeadlineAttachmentError(`Not allowed: ${rejected.map((f) => f.name).join(", ")}. Only PDF, DOC, DOCX, XLS, XLSX are allowed.`);
    }
    setHeadlineAttachmentFiles((prev) => [...prev, ...allowed]);
    e.target.value = "";
  };
  const removeHeadlineAttachment = (index: number) => {
    setHeadlineAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
    setHeadlineAttachmentError(null);
  };

  const handleCascadingAttachmentClick = () => {
    setCascadingAttachmentError(null);
    cascadingFileInputRef.current?.click();
  };
  const handleCascadingAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const chosen = Array.from(e.target.files ?? []);
    const allowed = chosen.filter((f) => isFileAllowed(f));
    const rejected = chosen.filter((f) => !isFileAllowed(f));
    if (rejected.length > 0) {
      setCascadingAttachmentError(`Not allowed: ${rejected.map((f) => f.name).join(", ")}. Only PDF, DOC, DOCX, XLS, XLSX are allowed.`);
    }
    setCascadingAttachmentFiles((prev) => [...prev, ...allowed]);
    e.target.value = "";
  };
  const removeCascadingAttachment = (index: number) => {
    setCascadingAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
    setCascadingAttachmentError(null);
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
      teamId: defaultTeamId || (teamsForSelect[0]?.id ?? ""),
      interval: "short",
    },
  });

  const rockOwnerOptions = useMemo(() => {
    const list = Array.isArray(meetingAttendances) ? meetingAttendances : [];
    return list.map((a) => ({
      label: a.user?.name || a.user?.email || a.user?.id || "Unknown",
      value: a.user?.id ?? a.id,
      name: a.user?.name ?? null,
      email: a.user?.email ?? "",
    }));
  }, [meetingAttendances]);

  const rockForm = useForm<RockFormData>({
    resolver: zodResolver(rockSchema),
    defaultValues: {
      title: "",
      description: "",
      dueBy: "",
      dueByTime: "",
      status: "on_track",
      isCompanyRock: false,
      ownerId: currentUserId ?? "",
      teamId: defaultTeamId || (teamsForSelect[0]?.id ?? ""),
      quarter: "",
      otherTeamId: "",
    },
  });

  const issueTeamId = useWatch({ control, name: "teamId", defaultValue: defaultTeamId || (teamsForSelect[0]?.id ?? "") });
  const issueTeamMembers = (teamsList as Team[]).find((t) => t.id === issueTeamId)?.members ?? [];

  const todoForm = useForm<TodoFormData>({
    resolver: zodResolver(todoSchema),
    defaultValues: { title: "", description: "", dueDate: "", repeat: "Don't repeat", teamId: defaultTeamId || (teamsForSelect[0]?.id ?? ""), assigneeId: "", private: false },
  });

  const todoTeamId = useWatch({ control: todoForm.control, name: "teamId", defaultValue: defaultTeamId || (teamsForSelect[0]?.id ?? "") });
  const [todoTeamMembers, setTodoTeamMembers] = useState<Team["members"]>([]);
  useEffect(() => {
    const fromList = (teamsList as Team[]).find((t) => t.id === todoTeamId)?.members;
    if (fromList?.length) {
      setTodoTeamMembers(fromList);
      return;
    }
    if (!organizationId || !todoTeamId) {
      setTodoTeamMembers([]);
      return;
    }
    teamsService.getOne(organizationId, todoTeamId).then((team) => setTodoTeamMembers(team.members ?? [])).catch(() => setTodoTeamMembers([]));
  }, [organizationId, todoTeamId, teamsList]);

  const headlineForm = useForm<HeadlineFormData>({
    resolver: zodResolver(headlineSchema),
    defaultValues: { title: "", description: "", teamId: defaultTeamId || (teamsForSelect[0]?.id ?? "") },
  });

  const cascadingForm = useForm<CascadingFormData>({
    resolver: zodResolver(cascadingSchema),
    defaultValues: { title: "", description: "", teamId: defaultTeamId || (teamsForSelect[0]?.id ?? "") },
  });

  useEffect(() => {
    if (!open) {
      setMinimized(false);
      setAttachmentFiles([]);
      setAttachmentError(null);
      setRockAttachmentFiles([]);
      setRockAttachmentError(null);
      setTodoAttachmentFiles([]);
      setTodoAttachmentError(null);
      setHeadlineAttachmentFiles([]);
      setHeadlineAttachmentError(null);
      setCascadingAttachmentFiles([]);
      setCascadingAttachmentError(null);
      reset();
      rockForm.reset();
      todoForm.reset();
      headlineForm.reset();
      cascadingForm.reset();
    }
    if (open && initialType) setCreateType(initialType === 'measurable' ? 'todo' : initialType);
    if (open && (initialTitle != null || initialDescription != null) && initialType) {
      const title = initialTitle ?? "";
      const desc = initialDescription ?? "";
      if (initialType === "todo") todoForm.reset({ title, description: desc, dueDate: "", repeat: "Don't repeat", teamId: defaultTeamId || (teamsForSelect[0]?.id ?? ""), assigneeId: "", private: false });
      if (initialType === "issue") reset({ title, description: desc, priority: "", who: "", teamId: defaultTeamId || (teamsForSelect[0]?.id ?? ""), interval: "short" });
    }
    if (open && initialLinkedEntity) {
      setLinkedEntity(initialLinkedEntity);
    } else if (!open) {
      setLinkedEntity(undefined);
    }
    if (open && initialType === "rock" && currentUserId) {
      rockForm.setValue("ownerId", currentUserId);
    }
  }, [open, reset, initialType, initialTitle, initialDescription, initialLinkedEntity, currentUserId]);

  const onIssueSubmit = async (data: IssueFormData) => {
    if (issuesApi) {
      await issuesApi.addIssue({
        title: data.title,
        description: data.description || undefined,
        priority: data.priority ? parseInt(data.priority, 10) : 0,
        termType: data.interval === "long" ? "long_term" : "short_term",
        ...(linkedEntity && {
          linkedEntityType: linkedEntity.type,
          linkedEntityId: linkedEntity.id,
          linkedEntityTitle: linkedEntity.title,
        }),
      });
    }
    onClose();
    reset();
  };

  const onRockSubmit = (data: RockFormData) => {
    const dueBy = data.dueBy?.trim() || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const isCompany = Boolean(data.isCompanyRock);
    const selected = rockOwnerOptions.find((o) => o.value === data.ownerId);
    const ownerName = selected?.name || selected?.label || "User";
    const ownerInitials = selected ? getInitials(selected.name, selected.email) : "U";
    rocksApi?.addRock({
      title: data.title,
      ownerName: String(ownerName),
      ownerInitials: ownerInitials.slice(0, 2),
      dueBy,
      status: (data.status as "on_track" | "off_track" | "at_risk" | "done" | "other") || "on_track",
      column: "current",
      achieved: false,
      isCompanyRock: isCompany,
    });
    onClose();
    rockForm.reset();
    setRockAttachmentFiles([]);
    setRockAttachmentError(null);
  };

  const onTodoSubmit = async (data: TodoFormData) => {
    if (todosApi) {
      const selectedTeam = (teamsList as Team[]).find((t) => t.id === data.teamId);
      await todosApi.addTodo({
        title: data.title,
        description: data.description || undefined,
        dueDate: data.dueDate || null,
        ownerInitials: "U",
        completed: false,
        teamId: data.teamId,
        teamName: selectedTeam?.name,
        assigneeId: data.assigneeId || undefined,
        ...(linkedEntity && {
          linkedEntityType: linkedEntity.type,
          linkedEntityId: linkedEntity.id,
          linkedEntityTitle: linkedEntity.title,
        }),
      });
    }
    onClose();
    todoForm.reset();
    setTodoAttachmentFiles([]);
    setTodoAttachmentError(null);
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
    setHeadlineAttachmentFiles([]);
    setHeadlineAttachmentError(null);
  };

  const onCascadingSubmit = (data: CascadingFormData) => {
    const now = new Date().toISOString();
    headlinesApi?.addCascadingMessage({
      title: data.title,
      from: teamName || "Team",
      createdAt: now,
      createdAgo: "Just now",
      ownerInitials: "U",
      archived: false,
    });
    onClose();
    cascadingForm.reset();
    setCascadingAttachmentFiles([]);
    setCascadingAttachmentError(null);
  };

  if (!open) return null;

  const panelContent = (
    <div className="flex flex-col min-h-0 h-full">
      {/* Orange accent bar */}
      <div className="h-1.5 w-full bg-primary rounded-t-lg shrink-0" />

      {/* Header: Create [Type ▼] | Minimize | Toggle | Close — borderless, wide text like reference */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-2 min-w-0">
          <Dropdown
            menu={{
              items: CREATE_TYPE_OPTIONS.map((opt) => ({
                key: opt.value,
                label: opt.label,
                onClick: () => setCreateType(opt.value),
              })) as MenuProps["items"],
              style: { minWidth: 260 },
            }}
            trigger={["click"]}
          >
            <button
              type="button"
              className="flex items-center gap-1 text-left outline-none focus:ring-0 focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              <span className="text-xl font-semibold text-foreground shrink-0">
                Create
              </span>
              <span className="text-xl font-semibold text-primary shrink-0 ml-2">
                {CREATE_TYPE_OPTIONS.find((o) => o.value === createType)?.label ?? createType}
              </span>
              <ChevronDown className="w-5 h-5 text-primary shrink-0 mt-[5px]" />
            </button>
          </Dropdown>
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
                <div className="mt-5 pt-5 border-t border-border">
                  <label
                    htmlFor="create-title"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    Title
                  </label>
                  <input
                    id="create-title"
                    {...register("title")}
                    placeholder="Add a title for the Turbulence..."
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
                  <div className="mt-5 pt-5 border-t border-border">
                    <label
                      htmlFor="create-priority"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Priority (optional)
                    </label>
                    <Controller
                      name="priority"
                      control={control}
                      render={({ field }) => (
                        <Select
                          id="create-priority"
                          placeholder="Select a priority..."
                          value={field.value || undefined}
                          onChange={(v) => field.onChange(v ?? "")}
                          options={[1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: String(n) }))}
                          className="w-full"
                          allowClear
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="create-who"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Who (optional)
                    </label>
                    <Controller
                      name="who"
                      control={control}
                      render={({ field }) => (
                        <Select
                          id="create-who"
                          placeholder="Select who the Turbulence is with..."
                          value={field.value || undefined}
                          onChange={(v) => field.onChange(v ?? "")}
                          options={issueTeamMembers.map((m) => ({
                            label: m.user?.name || m.user?.email || m.userId,
                            value: m.userId,
                          }))}
                          className="w-full"
                          allowClear
                          disabled={issueTeamMembers.length === 0}
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="create-team"
                      className="block text-sm font-medium text-foreground mb-1"
                    >
                      Team
                    </label>
                    <Controller
                      name="teamId"
                      control={control}
                      render={({ field }) => (
                        <Select
                          id="create-team"
                          value={field.value || undefined}
                          onChange={(v) => field.onChange(v ?? "")}
                          options={
                            teamsForSelect.length > 0
                              ? teamsForSelect.map((t) => ({ label: t.name, value: t.id }))
                              : [{ label: teamName, value: defaultTeamId || "" }]
                          }
                          className="w-full"
                        />
                      )}
                    />
                    <p className="mt-1.5 ml-1 text-[12px] font-medium text-foreground/65">
                      Changing the team will affect which users the Turbulence can be
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
                    <Controller
                      name="interval"
                      control={control}
                      render={({ field }) => (
                        <Select
                          id="create-interval"
                          value={field.value || undefined}
                          onChange={(v) => field.onChange(v ?? undefined)}
                          options={[
                            { label: "Short-Term", value: "short" },
                            { label: "Long-Term", value: "long" },
                          ]}
                          className="w-full"
                        />
                      )}
                    />
                  </div>
                </div>

                {linkedEntity && <LinkingToSection linkedEntity={linkedEntity} />}

                <div className="mt-5 pt-5 border-t border-border">
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
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-white text-foreground hover:bg-accent transition-colors text-sm font-medium"
                  >
                    <Paperclip className="w-4 h-4" />
                    Add attachment
                  </button>
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
              <LocalizationProvider dateAdapter={AdapterDayjs}>
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
                      className={`w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                        rockForm.formState.errors.title ? "border-red-500" : "border-border"
                      }`}
                      placeholder="Add a title for the Waypoint..."
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
                  <label className="w-1/2 flex items-center gap-3 rounded-lg border border-border border-t-2 border-t-primary bg-white px-3 py-3.5 cursor-pointer">
                    <input
                      type="checkbox"
                      {...rockForm.register("isCompanyRock")}
                      className="rounded border-border"
                    />
                    <span className="text-sm font-medium text-foreground">Company Rock</span>
                  </label>
                  {rockOwnerOptions.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Owner</label>
                      <Controller
                        name="ownerId"
                        control={rockForm.control}
                        render={({ field }) => (
                          <Select
                            value={field.value || undefined}
                            onChange={(v) => field.onChange(v ?? "")}
                            options={rockOwnerOptions.map((o) => ({ label: o.label, value: o.value }))}
                            className="w-full"
                            placeholder="Select person in meeting"
                          />
                        )}
                      />
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Due date</label>
                      <Controller
                        name="dueBy"
                        control={rockForm.control}
                        render={({ field }) => (
                          <MobileDatePicker
                            value={field.value ? dayjs(field.value) : null}
                            onChange={(d) => field.onChange(d ? d.format("YYYY-MM-DD") : "")}
                            slotProps={{
                              textField: {
                                size: "small",
                                fullWidth: true,
                                sx: MUI_PICKER_SX,
                                inputProps: { style: { color: "var(--foreground)" } },
                              },
                            }}
                          />
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Status</label>
                      <Controller
                        name="status"
                        control={rockForm.control}
                        render={({ field }) => (
                          <Select
                            value={field.value || undefined}
                            onChange={(v) => field.onChange(v ?? undefined)}
                            options={[
                              { label: "Off-track", value: "off_track" },
                              { label: "On-track", value: "on_track" },
                              { label: "At-risk", value: "at_risk" },
                              { label: "Complete", value: "done" },
                              { label: "Other", value: "other" },
                            ]}
                            className="w-full"
                          />
                        )}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Team</label>
                      <Controller
                        name="teamId"
                        control={rockForm.control}
                        render={({ field }) => (
                          <Select
                            value={field.value || undefined}
                            onChange={(v) => field.onChange(v ?? "")}
                            options={
                              teamsForSelect.length > 0
                                ? teamsForSelect.map((t) => ({ label: t.name, value: t.id }))
                                : [{ label: teamName, value: defaultTeamId || "" }]
                            }
                            className="w-full"
                          />
                        )}
                      />
                    </div>
                    {organizationId ? (
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-1">Other team (optional)</label>
                        <RockOtherTeamSelect
                          organizationId={organizationId}
                          value={rockForm.watch("otherTeamId") ?? ""}
                          onChange={(v) => rockForm.setValue("otherTeamId", v ?? "")}
                        />
                      </div>
                    ) : (
                      <div />
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-1">Quarter (optional)</label>
                      <Controller
                        name="quarter"
                        control={rockForm.control}
                        render={({ field }) => (
                          <Select
                            value={field.value || undefined}
                            onChange={(v) => field.onChange(v ?? "")}
                            options={getQuarterOptions()}
                            placeholder="None"
                            className="w-full"
                            allowClear
                          />
                        )}
                      />
                    </div>
                  </div>

                  {linkedEntity && <LinkingToSection linkedEntity={linkedEntity} />}

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">
                      Attachments
                    </label>
                    <input
                      ref={rockFileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                      multiple
                      className="hidden"
                      onChange={handleRockAttachmentChange}
                    />
                    <button
                      type="button"
                      onClick={handleRockAttachmentClick}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-white text-foreground hover:bg-accent transition-colors text-sm font-medium"
                    >
                      <Paperclip className="w-4 h-4" />
                      Add attachment
                    </button>
                    {rockAttachmentError && (
                      <p className="mt-1 text-xs text-red-600">{rockAttachmentError}</p>
                    )}
                    {rockAttachmentFiles.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {rockAttachmentFiles.map((file, index) => (
                          <li
                            key={`${file.name}-${index}`}
                            className="flex items-center gap-2 text-sm text-foreground"
                          >
                            <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                            <span className="truncate flex-1">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => removeRockAttachment(index)}
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
              </LocalizationProvider>
            )}
            {createType === "todo" && (
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <form id="create-todo-form" onSubmit={todoForm.handleSubmit(onTodoSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Title <span className="text-red-500">*</span></label>
                    <input
                      {...todoForm.register("title")}
                      className={`w-full px-3 py-2 border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary ${
                        todoForm.formState.errors.title ? "border-red-500" : "border-border"
                      }`}
                      placeholder="Add a title for the Clearance..."
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
                      <Controller
                        name="dueDate"
                        control={todoForm.control}
                        render={({ field }) => (
                          <MobileDatePicker
                            value={field.value ? dayjs(field.value) : null}
                            onChange={(d) => field.onChange(d ? d.format("YYYY-MM-DD") : "")}
                            slotProps={{
                              textField: {
                                size: "small",
                                fullWidth: true,
                                sx: MUI_PICKER_SX,
                                inputProps: { style: { color: "var(--foreground)" } },
                              },
                            }}
                          />
                        )}
                      />
                    </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Repeat</label>
                    <Controller
                      name="repeat"
                      control={todoForm.control}
                      render={({ field }) => (
                        <Select
                          value={field.value || undefined}
                          onChange={(v) => field.onChange(v ?? "")}
                          options={[
                            { label: "Don't repeat", value: "Don't repeat" },
                            { label: "Weekly", value: "Weekly" },
                            { label: "Monthly", value: "Monthly" },
                          ]}
                          className="w-full"
                        />
                      )}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Team <span className="text-red-500">*</span></label>
                    <Controller
                      name="teamId"
                      control={todoForm.control}
                      render={({ field }) => (
                        <Select
                          value={field.value || undefined}
                          onChange={(v) => {
                            field.onChange(v ?? "");
                            todoForm.setValue("assigneeId", "");
                          }}
                          options={
                            teamsForSelect.length > 0
                              ? teamsForSelect.map((t) => ({ label: t.name, value: t.id }))
                              : [{ label: teamName, value: defaultTeamId || "" }]
                          }
                          className="w-full"
                        />
                      )}
                    />
                    <p className="mt-1.5 ml-1 text-[12px] font-medium text-foreground/65">Clearance must be assigned to a crew.</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Team member (optional)</label>
                    <Controller
                      name="assigneeId"
                      control={todoForm.control}
                      render={({ field }) => (
                        <Select
                          value={field.value || undefined}
                          onChange={(v) => field.onChange(v ?? "")}
                          allowClear
                          placeholder="Unassigned"
                          options={[
                            { label: "Unassigned", value: "" },
                            ...(todoTeamMembers ?? []).map((m) => ({ label: m.user?.name || m.user?.email || m.userId, value: m.user?.id ?? m.userId })),
                          ]}
                          className="w-full"
                        />
                      )}
                    />
                    <p className="mt-1.5 ml-1 text-[12px] font-medium text-foreground/65">Optionally assign to a member of the selected team.</p>
                  </div>
                </div>
                <label className="w-1/2 flex items-center gap-3 rounded-lg border border-border border-t-2 border-t-primary bg-white px-3 py-3.5 cursor-pointer">
                  <input type="checkbox" {...todoForm.register("private")} className="rounded border-border" />
                  <span className="text-sm font-medium text-foreground">Make this Clearance private.</span>
                </label>
                {linkedEntity && <LinkingToSection linkedEntity={linkedEntity} />}
                <div className="mt-5 pt-5 border-t border-border">
                  <label className="block text-sm font-medium text-foreground mb-1">Attachments</label>
                  <input
                    ref={todoFileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    multiple
                    className="hidden"
                    onChange={handleTodoAttachmentChange}
                  />
                  <button
                    type="button"
                    onClick={handleTodoAttachmentClick}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-white text-foreground hover:bg-accent transition-colors text-sm font-medium"
                  >
                    <Paperclip className="w-4 h-4" />
                    Add attachment
                  </button>
                  {todoAttachmentError && <p className="mt-1 text-xs text-red-600">{todoAttachmentError}</p>}
                  {todoAttachmentFiles.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {todoAttachmentFiles.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="flex items-center gap-2 text-sm text-foreground">
                          <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                          <span className="truncate flex-1">{file.name}</span>
                          <button type="button" onClick={() => removeTodoAttachment(index)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-600" aria-label="Remove">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </form>
              </LocalizationProvider>
            )}
            {createType === "headline" && (
              <form id="create-headline-form" onSubmit={headlineForm.handleSubmit(onHeadlineSubmit)} className="space-y-4">
                <div className="mt-5 pt-5 border-t border-border">
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
                  <Controller
                    name="teamId"
                    control={headlineForm.control}
                    render={({ field }) => (
                      <Select
                        value={field.value || undefined}
                        onChange={(v) => field.onChange(v ?? "")}
                        options={
                          teamsForSelect.length > 0
                            ? teamsForSelect.map((t) => ({ label: t.name, value: t.id }))
                            : [{ label: teamName, value: defaultTeamId || "" }]
                        }
                        className="w-full"
                      />
                    )}
                  />
                  <p className="mt-1.5 ml-1 text-[12px] font-medium text-foreground/65">Changing the team will affect which users the Headline can be assigned to.</p>
                </div>
                {linkedEntity && <LinkingToSection linkedEntity={linkedEntity} />}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Attachments</label>
                  <input
                    ref={headlineFileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    multiple
                    className="hidden"
                    onChange={handleHeadlineAttachmentChange}
                  />
                  <button
                    type="button"
                    onClick={handleHeadlineAttachmentClick}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-white text-foreground hover:bg-accent transition-colors text-sm font-medium"
                  >
                    <Paperclip className="w-4 h-4" />
                    Add attachment
                  </button>
                  {headlineAttachmentError && <p className="mt-1 text-xs text-red-600">{headlineAttachmentError}</p>}
                  {headlineAttachmentFiles.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {headlineAttachmentFiles.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="flex items-center gap-2 text-sm text-foreground">
                          <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                          <span className="truncate flex-1">{file.name}</span>
                          <button type="button" onClick={() => removeHeadlineAttachment(index)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-600" aria-label="Remove">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
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
                  <Controller
                    name="teamId"
                    control={cascadingForm.control}
                    render={({ field }) => (
                      <Select
                        value={field.value || undefined}
                        onChange={(v) => field.onChange(v ?? "")}
                        options={
                          teamsForSelect.length > 0
                            ? teamsForSelect.map((t) => ({ label: t.name, value: t.id }))
                            : [{ label: teamName, value: defaultTeamId || "" }]
                        }
                        className="w-full"
                      />
                    )}
                  />
                  <p className="mt-1.5 ml-1 text-[12px] font-medium text-foreground/65">Changing the team will affect which users can own the Cascading Message.</p>
                </div>
                {linkedEntity && <LinkingToSection linkedEntity={linkedEntity} />}
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Attachments</label>
                  <input
                    ref={cascadingFileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    multiple
                    className="hidden"
                    onChange={handleCascadingAttachmentChange}
                  />
                  <button
                    type="button"
                    onClick={handleCascadingAttachmentClick}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-white text-foreground hover:bg-accent transition-colors text-sm font-medium"
                  >
                    <Paperclip className="w-4 h-4" />
                    Add attachment
                  </button>
                  {cascadingAttachmentError && <p className="mt-1 text-xs text-red-600">{cascadingAttachmentError}</p>}
                  {cascadingAttachmentFiles.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {cascadingAttachmentFiles.map((file, index) => (
                        <li key={`${file.name}-${index}`} className="flex items-center gap-2 text-sm text-foreground">
                          <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                          <span className="truncate flex-1">{file.name}</span>
                          <button type="button" onClick={() => removeCascadingAttachment(index)} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-red-600" aria-label="Remove">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
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
                Create Turbulence
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
                Create Waypoint
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
                Create Clearance
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
