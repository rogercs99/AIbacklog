"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import TaskModal from "@/components/TaskModal";
import DocumentModal from "@/components/DocumentModal";
import { useLanguage } from "@/components/LanguageProvider";
import RichText from "@/components/RichText";
import InfoTooltip from "@/components/InfoTooltip";
import TopNav from "@/components/TopNav";
import Portal from "@/components/Portal";

export default function ProjectDetailPage({ params }) {
  const projectId = params?.id;
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [taskFilters, setTaskFilters] = useState({ query: "", status: "all", area: "all" });
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeDocument, setActiveDocument] = useState(null);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState(null);
  const [projectDescriptionLoading, setProjectDescriptionLoading] = useState(false);
  const [projectDescriptionError, setProjectDescriptionError] = useState("");
  const projectDescriptionRequestedRef = useRef(false);
  const [activeView, setActiveView] = useState("general");
  const [generalTab, setGeneralTab] = useState("overview");
  const [recalculateLoading, setRecalculateLoading] = useState(false);
  const [recalculateStatus, setRecalculateStatus] = useState("");
  const [projectChatMessages, setProjectChatMessages] = useState([]);
  const [projectChatThreads, setProjectChatThreads] = useState([]);
  const [projectChatActiveThreadId, setProjectChatActiveThreadId] = useState(null);
  const [projectChatInput, setProjectChatInput] = useState("");
  const [projectChatLoading, setProjectChatLoading] = useState(false);
  const [projectChatFetching, setProjectChatFetching] = useState(false);
  const [projectChatError, setProjectChatError] = useState("");
  const [projectMemory, setProjectMemory] = useState("");
  const projectChatRef = useRef(null);
  const [exportStatus, setExportStatus] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatItem, setChatItem] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [draggingItem, setDraggingItem] = useState(null);
  const [dropZone, setDropZone] = useState("");
  const [newEpic, setNewEpic] = useState({ title: "", description: "" });
  const [newTask, setNewTask] = useState({
    title: "",
    type: "Story",
    area: "other",
    priority: "Medium",
    status: "todo",
    parentId: "",
  });
  const [treeOpen, setTreeOpen] = useState(false);
  const [treeExpanded, setTreeExpanded] = useState(new Set(["root"]));
  const [showUnassignedInline, setShowUnassignedInline] = useState(false);
  const [unassignedUserStories, setUnassignedUserStories] = useState([]);
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(1);

  const parseProjectDescription = (value) => {
    if (!value) {
      return null;
    }
    try {
      const parsed = JSON.parse(value);
      if (parsed && (parsed.description_es || parsed.description_en)) {
        return parsed;
      }
      return null;
    } catch (error) {
      return { description_es: String(value), description_en: "" };
    }
  };

  const formatDate = (value) => {
    if (!value) {
      return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString(lang === "en" ? "en-US" : "es-ES");
  };

  const addToast = (message, { type = "info", duration = 2800 } = {}) => {
    const id = toastIdRef.current++;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration && duration > 0) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, duration);
    }
    return id;
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const loadProject = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setError("");
    setActionError("");
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        throw new Error("No encontrado");
      }
      const detail = await response.json();
      setData(detail);
      setProjectName(detail.project?.name || "");
      setProjectDescription(parseProjectDescription(detail.project?.description));
      projectDescriptionRequestedRef.current = false;
      return detail;
    } catch (err) {
      setError(t("No se pudo cargar el proyecto.", "Could not load the project."));
      return null;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const generateProjectDescription = async (force = false) => {
    setProjectDescriptionError("");
    setProjectDescriptionLoading(true);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/describe${force ? "?force=1" : ""}`,
      );
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo generar la descripción.");
      }
      const desc = payload.description || null;
      setProjectDescription(desc);
      setData((prev) => {
        if (!prev?.project) {
          return prev;
        }
        return {
          ...prev,
          project: {
            ...prev.project,
            description: JSON.stringify(desc),
          },
        };
      });
    } catch (err) {
      setProjectDescriptionError(
        t("No se pudo generar la descripción del proyecto.", "Could not generate project description."),
      );
    } finally {
      setProjectDescriptionLoading(false);
    }
  };

  useEffect(() => {
    if (!data?.project?.id) {
      return;
    }
    const hasDescription =
      Boolean(projectDescription?.description_es) || Boolean(projectDescription?.description_en);
    if (hasDescription) {
      return;
    }
    if (projectDescriptionLoading) {
      return;
    }
    if (projectDescriptionRequestedRef.current) {
      return;
    }
    projectDescriptionRequestedRef.current = true;
    generateProjectDescription(false);
  }, [data?.project?.id, projectDescription, projectDescriptionLoading]);

  const handleExport = async (type) => {
    setExportStatus(t("Generando archivo...", "Generating file..."));
    setExportLoading(true);
    try {
      const response = await fetch(`/api/export/${type}?projectId=${projectId}`);
      if (!response.ok) {
        throw new Error(t("No se pudo generar el CSV.", "Could not generate the CSV."));
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = type === "jira" ? `req2backlog_${projectId}_jira.csv` : `req2backlog_${projectId}_rally.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setExportStatus(t("Descarga lista.", "Download ready."));
    } catch (error) {
      setExportStatus(t("No se pudo exportar.", "Export failed."));
    } finally {
      setExportLoading(false);
      window.setTimeout(() => setExportStatus(""), 2500);
    }
  };

  const loadProjectChat = async (requestedThreadId = null) => {
    setProjectChatError("");
    setProjectChatFetching(true);
    try {
      const threadQuery = requestedThreadId || projectChatActiveThreadId;
      const response = await fetch(
        `/api/project-chat?projectId=${projectId}${threadQuery ? `&threadId=${threadQuery}` : ""}`,
      );
      if (!response.ok) {
        throw new Error("No se pudo cargar el chat del proyecto.");
      }
      const data = await response.json();
      setProjectChatThreads(data.threads || []);
      if (data.activeThreadId) {
        setProjectChatActiveThreadId(Number(data.activeThreadId));
      }
      setProjectChatMessages(data.messages || []);
      setProjectMemory(data.memory || "");
    } catch (err) {
      setProjectChatError(t("No se pudo cargar el chat del proyecto.", "Could not load project chat."));
    } finally {
      setProjectChatFetching(false);
    }
  };

  useEffect(() => {
    if (activeView === "general" && generalTab === "ask") {
      loadProjectChat();
    }
  }, [activeView, generalTab, projectId, projectChatActiveThreadId]);

  useEffect(() => {
    if (projectChatRef.current) {
      projectChatRef.current.scrollTop = projectChatRef.current.scrollHeight;
    }
  }, [projectChatMessages, projectChatLoading, projectChatFetching]);

  const handleRecalculateProject = async () => {
    const toastId = addToast(t("Recalculando contexto...", "Recalculating context..."), {
      type: "loading",
      duration: 0,
    });
    setRecalculateLoading(true);
    setRecalculateStatus("");
    try {
      const response = await fetch(`/api/projects/${projectId}/recalculate`, { method: "POST" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo recalcular.");
      }
      await loadProject({ silent: true });
      if (payload?.description) {
        setProjectDescription(payload.description);
        setData((prev) => {
          if (!prev?.project) {
            return prev;
          }
          return {
            ...prev,
            project: {
              ...prev.project,
              description: JSON.stringify(payload.description),
            },
          };
        });
      }
      if (typeof payload?.memory === "string") {
        setProjectMemory(payload.memory);
      }
      const dedupRemoved = payload?.dedup?.removed ? Number(payload.dedup.removed) : 0;
      const suffix =
        dedupRemoved > 0
          ? ` · ${t("Duplicados eliminados:", "Duplicates removed:")} ${dedupRemoved}`
          : "";
      addToast(`${t("Contexto actualizado.", "Context updated.")}${suffix}`, { type: "success" });
    } catch (err) {
      addToast(t("No se pudo recalcular.", "Recalculation failed."), {
        type: "error",
        duration: 3600,
      });
    } finally {
      removeToast(toastId);
      setRecalculateLoading(false);
    }
  };

  const tasks = data?.tasks || [];
  const epics = data?.epics || [];
  const storyItems = useMemo(
    () => tasks.filter((item) => String(item.type || "").toLowerCase() === "story"),
    [tasks],
  );
  const userStoryItems = useMemo(
    () => tasks.filter((item) => String(item.type || "").toLowerCase() === "task"),
    [tasks],
  );
  const storyById = useMemo(() => {
    const map = new Map();
    storyItems.forEach((story) => {
      map.set(story.id, story);
    });
    return map;
  }, [storyItems]);
  const latestDocument = useMemo(() => {
    const docs = data?.documents || [];
    return docs.length ? docs[0] : null;
  }, [data]);
  const latestAssumptions = useMemo(() => {
    if (!latestDocument?.assumptions) {
      return [];
    }
    return Array.isArray(latestDocument.assumptions) ? latestDocument.assumptions : [];
  }, [latestDocument]);

  const projectDescriptionText = useMemo(() => {
    if (!projectDescription) {
      return "";
    }
    if (lang === "en") {
      return projectDescription.description_en || projectDescription.description_es || "";
    }
    return projectDescription.description_es || projectDescription.description_en || "";
  }, [projectDescription, lang]);

  const activeProjectChatThread = useMemo(() => {
    const id = projectChatActiveThreadId ? Number(projectChatActiveThreadId) : null;
    if (!id) {
      return null;
    }
    return (projectChatThreads || []).find((thread) => Number(thread.id) === id) || null;
  }, [projectChatThreads, projectChatActiveThreadId]);

  useEffect(() => {
    const typeLower = String(newTask.type || "").toLowerCase();
    const parents = typeLower === "task" ? storyItems : epics;
    if (!parents.length) {
      return;
    }
    const current = newTask.parentId ? Number(newTask.parentId) : null;
    const exists = current && parents.some((parent) => parent.id === current);
    if (!current || !exists) {
      setNewTask((prev) => ({ ...prev, parentId: String(parents[0].id) }));
    }
  }, [epics, storyItems, newTask.parentId, newTask.type]);
  const viewTabs = [
    { key: "general", label: t("General", "General") },
    { key: "rally", label: t("Vista Rally", "Rally view") },
    { key: "jira", label: t("Vista Jira", "Jira view") },
  ];
  const generalTabs = [
    { key: "overview", label: t("Resumen", "Summary") },
    { key: "docs", label: t("Documentos", "Documents") },
    { key: "subprojects", label: t("Subproyectos", "Subprojects") },
    { key: "tasks", label: t("Tareas", "Tasks") },
    { key: "ask", label: t("Chat de dudas con IA", "AI Q&A chat") },
  ];
  const createTaskIsUserStory = String(newTask.type || "").toLowerCase() === "task";
  const createTaskParents = createTaskIsUserStory ? storyItems : epics;

  const epicMap = useMemo(() => {
    const map = new Map();
    epics.forEach((epic) => {
      map.set(epic.id, epic.title);
    });
    return map;
  }, [epics]);
  const epicExternalMap = useMemo(() => {
    const map = new Map();
    epics.forEach((epic) => {
      map.set(epic.id, epic.external_id || "");
    });
    return map;
  }, [epics]);
  const epicTitleByExternalId = useMemo(() => {
    const map = new Map();
    epics.forEach((epic) => {
      if (epic.external_id) {
        map.set(epic.external_id, epic.title);
      }
    });
    return map;
  }, [epics]);

  const epicStats = useMemo(() => {
    const stats = new Map();
    const epicIds = new Set(epics.map((epic) => epic.id));
    const epicIdByExternal = new Map(
      epics.map((epic) => [String(epic.external_id || ""), epic.id]),
    );

    const bump = (epicId, item) => {
      if (!epicId) {
        return;
      }
      const current = stats.get(epicId) || { total: 0, done: 0 };
      current.total += 1;
      if (item?.status === "done") {
        current.done += 1;
      }
      stats.set(epicId, current);
    };

    storyItems.forEach((story) => {
      const epicId = story.parent_id && epicIds.has(story.parent_id) ? story.parent_id : null;
      bump(epicId, story);
    });

    userStoryItems.forEach((us) => {
      let epicId = null;
      if (us.parent_id && storyById.has(us.parent_id)) {
        const parentStory = storyById.get(us.parent_id);
        if (parentStory?.parent_id && epicIds.has(parentStory.parent_id)) {
          epicId = parentStory.parent_id;
        }
      } else if (us.parent_id && epicIds.has(us.parent_id)) {
        epicId = us.parent_id;
      } else if (us.epic_key && epicIdByExternal.has(String(us.epic_key))) {
        epicId = epicIdByExternal.get(String(us.epic_key));
      }
      bump(epicId, us);
    });

    return stats;
  }, [epics, storyItems, userStoryItems, storyById]);
  const taskAreas = useMemo(() => {
    const set = new Set();
    tasks.forEach((task) => set.add(task.area || "other"));
    if (set.size === 0) {
      set.add("other");
    }
    return Array.from(set);
  }, [tasks]);

  const statusLabels = useMemo(
    () => ({
      todo: t("Por hacer", "To Do"),
      in_progress: t("En progreso", "In Progress"),
      review: t("Revisión", "Review"),
      done: t("Hecho", "Done"),
      obsolete: t("Obsoleto", "Obsolete"),
    }),
    [t],
  );
  const allStories = useMemo(
    () => tasks.filter((task) => String(task.type || "").toLowerCase() === "story"),
    [tasks],
  );
  const allStoriesById = useMemo(() => {
    const map = new Map();
    allStories.forEach((story) => map.set(story.id, story));
    return map;
  }, [allStories]);
  const allStoryOptions = useMemo(() => {
    return allStories
      .map((story) => ({
        id: story.id,
        label: `${story.external_id || ""} · ${story.title}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allStories]);
  const orphanUserStories = useMemo(() => {
    return tasks.filter((task) => {
      const typeLower = String(task.type || "").toLowerCase();
      if (typeLower !== "task") return false;
      if (task.parent_id && allStoriesById.has(task.parent_id)) return false;
      return true;
    });
  }, [tasks, allStoriesById]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const query = taskFilters.query.trim().toLowerCase();
      const nameMatch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        (task.external_id || "").toLowerCase().includes(query);
      const statusMatch = taskFilters.status === "all" || task.status === taskFilters.status;
      const areaMatch = taskFilters.area === "all" || (task.area || "other") === taskFilters.area;
      return nameMatch && statusMatch && areaMatch;
    });
  }, [tasks, taskFilters]);

  useEffect(() => {
    setUnassignedUserStories(orphanUserStories);
    // No auto-modal: solo avisamos y el usuario abre la sección cuando quiera.
  }, [orphanUserStories]);

  const epicGroups = useMemo(() => {
    const map = new Map();
    epics.forEach((epic) => {
      map.set(epic.id, {
        key: epic.id,
        epic,
        stories: [],
        userStoriesByStoryId: new Map(),
        unassignedUserStories: [],
      });
    });
    const epicIdByExternal = new Map(
      epics.map((epic) => [String(epic.external_id || ""), epic.id]),
    );
    const ensureGroup = (key) => {
      if (map.has(key)) {
        return map.get(key);
      }
      const fallbackEpic = {
        id: null,
        external_id: "SP-000",
        title: t("Sin subproyecto", "No subproject"),
        description: t("Items sin subproyecto asociado.", "Items without an associated subproject."),
        type: "Epic",
      };
      const group = {
        key,
        epic: fallbackEpic,
        stories: [],
        userStoriesByStoryId: new Map(),
        unassignedUserStories: [],
      };
      map.set(key, group);
      return group;
    };

    storyItems.forEach((story) => {
      const groupKey = story.parent_id && map.has(story.parent_id) ? story.parent_id : "unassigned";
      ensureGroup(groupKey).stories.push(story);
    });

    userStoryItems.forEach((us) => {
      const parentId = us.parent_id ? Number(us.parent_id) : null;
      const parentStory = parentId ? storyById.get(parentId) : null;
      if (parentStory) {
        let epicId = null;
        if (parentStory.parent_id && map.has(parentStory.parent_id)) {
          epicId = parentStory.parent_id;
        } else if (us.epic_key && epicIdByExternal.has(String(us.epic_key))) {
          epicId = epicIdByExternal.get(String(us.epic_key));
        }
        const groupKey = epicId || "unassigned";
        const group = ensureGroup(groupKey);
        if (!group.userStoriesByStoryId.has(parentStory.id)) {
          group.userStoriesByStoryId.set(parentStory.id, []);
        }
        group.userStoriesByStoryId.get(parentStory.id).push(us);
      } else {
        let epicId = null;
        if (parentId && map.has(parentId)) {
          epicId = parentId;
        } else if (us.epic_key && epicIdByExternal.has(String(us.epic_key))) {
          epicId = epicIdByExternal.get(String(us.epic_key));
        }
        const group = ensureGroup(epicId || "unassigned");
        group.unassignedUserStories.push(us);
      }
    });

    const rows = Array.from(map.values());
    rows.sort((a, b) => {
      if (a.key === "unassigned") {
        return 1;
      }
      if (b.key === "unassigned") {
        return -1;
      }
      if (a.epic?.id && b.epic?.id) {
        return a.epic.id - b.epic.id;
      }
      return 0;
    });
    rows.forEach((group) => {
      group.stories.sort((a, b) => (a.id || 0) - (b.id || 0));
      group.stories.forEach((story) => {
        const list = group.userStoriesByStoryId.get(story.id) || [];
        list.sort((a, b) => (a.id || 0) - (b.id || 0));
        group.userStoriesByStoryId.set(story.id, list);
      });
      group.unassignedUserStories.sort((a, b) => (a.id || 0) - (b.id || 0));
    });
    return rows;
  }, [epics, storyItems, userStoryItems, storyById, t]);

  const handleProjectRename = async () => {
    const name = projectName.trim();
    if (!name) {
      setActionError(t("El nombre no puede estar vacío.", "Name cannot be empty."));
      return;
    }
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) {
        throw new Error(t("No se pudo actualizar", "Could not update"));
      }
      setEditingName(false);
      await loadProject();
    } catch (err) {
      setActionError(t("No se pudo actualizar el proyecto.", "Could not update the project."));
    }
  };

  const handleOpenDocument = async (docId) => {
    if (!docId) {
      return;
    }
    setDocumentLoading(true);
    setDocumentError("");
    try {
      const response = await fetch(`/api/documents/${docId}?projectId=${projectId}`);
      if (!response.ok) {
        throw new Error("No se pudo cargar el documento.");
      }
      const payload = await response.json();
      setActiveDocument(payload.document || null);
    } catch (err) {
      setDocumentError(t("No se pudo abrir el documento.", "Could not open the document."));
    } finally {
      setDocumentLoading(false);
    }
  };

  const handleProjectDelete = async () => {
    if (!data?.project?.name) {
      return;
    }
    if (
      !window.confirm(
        t(
          `¿Eliminar el proyecto \"${data.project.name}\" y todo su contenido?`,
          `Delete project \"${data.project.name}\" and all its content?`,
        ),
      )
    ) {
      return;
    }
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(t("No se pudo eliminar", "Could not delete"));
      }
      router.push("/projects");
    } catch (err) {
      setActionError(t("No se pudo eliminar el proyecto.", "Could not delete the project."));
    }
  };

  const handleCreateEpic = async () => {
    if (!newEpic.title.trim()) {
      setActionError(t("Escribe el nombre del subproyecto.", "Enter the subproject name."));
      return;
    }
    setActionError("");
    try {
      const response = await fetch("/api/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: {
            project_id: Number(projectId),
            type: "Epic",
            title: newEpic.title.trim(),
            description: newEpic.description.trim(),
            area: "other",
            priority: "Medium",
            status: "todo",
          },
        }),
      });
      if (!response.ok) {
        throw new Error(t("No se pudo crear", "Could not create"));
      }
      setNewEpic({ title: "", description: "" });
      await loadProject();
    } catch (err) {
      setActionError(t("No se pudo crear el subproyecto.", "Could not create the subproject."));
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      setActionError(
        createTaskIsUserStory
          ? t("Escribe el título de la historia de usuario.", "Enter the user story title.")
          : t("Escribe el título de la funcionalidad.", "Enter the feature title."),
      );
      return;
    }
    if (!newTask.parentId) {
      setActionError(
        createTaskIsUserStory
          ? t("Selecciona una funcionalidad.", "Select a feature.")
          : t("Selecciona un subproyecto.", "Select a subproject."),
      );
      return;
    }
    setActionError("");
    try {
      const response = await fetch("/api/backlog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: {
            project_id: Number(projectId),
            type: newTask.type,
            title: newTask.title.trim(),
            area: newTask.area,
            priority: newTask.priority,
            status: newTask.status,
            parent_id: newTask.parentId ? Number(newTask.parentId) : null,
          },
        }),
      });
      if (!response.ok) {
        throw new Error(t("No se pudo crear", "Could not create"));
      }
      setNewTask({
        title: "",
        type: "Story",
        area: "other",
        priority: "Medium",
        status: "todo",
        parentId: "",
      });
      await loadProject();
    } catch (err) {
      setActionError(t("No se pudo crear el item.", "Could not create the item."));
    }
  };

  const handleSaveItem = async (updates) => {
    if (!selectedItem) {
      return;
    }
    const { keepOpen, ...payload } = updates || {};
    setActionError("");
    setRecalculateStatus("");
    try {
      const response = await fetch(`/api/backlog/${selectedItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: payload }),
      });
      if (!response.ok) {
        throw new Error(t("No se pudo actualizar", "Could not update"));
      }
      const detail = await loadProject({ silent: Boolean(keepOpen) });
      if (keepOpen) {
        const refreshed =
          detail?.tasks?.find((task) => task.id === selectedItem.id) || selectedItem;
        setSelectedItem(refreshed);
      } else {
        setSelectedItem(null);
      }
      const toastId = addToast(
        t("Recalculando contexto con las nuevas respuestas...", "Recalculating context with the new answers..."),
        { type: "loading", duration: 0 },
      );
      fetch(`/api/projects/${projectId}/recalculate`, { method: "POST" })
        .then((res) => res.json())
        .then((payload) => {
          const dedupRemoved = payload?.dedup?.removed ? Number(payload.dedup.removed) : 0;
          const suffix =
            dedupRemoved > 0
              ? ` · ${t("Duplicados eliminados:", "Duplicates removed:")} ${dedupRemoved}`
              : "";
          addToast(`${t("Contexto actualizado.", "Context updated.")}${suffix}`, { type: "success" });
        })
        .catch(() => {
          addToast(
            t("No se pudo recalcular con las nuevas respuestas.", "Could not recalc with the new answers."),
            { type: "error", duration: 3600 },
          );
        })
        .finally(() => removeToast(toastId));
    } catch (err) {
      setActionError(t("No se pudo actualizar la tarea.", "Could not update the task."));
    }
  };

  const handleDeleteItem = async (item) => {
    if (!item) {
      return;
    }
    if (
      !window.confirm(
        t(
          `¿Eliminar ${item.external_id} - ${item.title}?`,
          `Delete ${item.external_id} - ${item.title}?`,
        ),
      )
    ) {
      return;
    }
    setActionError("");
    try {
      const response = await fetch(`/api/backlog/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(t("No se pudo eliminar", "Could not delete"));
      }
      setSelectedItem(null);
      await loadProject();
    } catch (err) {
      setActionError(t("No se pudo eliminar la tarea.", "Could not delete the task."));
    }
  };

  const handleProjectChatSend = async () => {
    const content = projectChatInput.trim();
    if (!content) {
      return;
    }
    setProjectChatError("");
    setProjectChatLoading(true);
    const optimistic = [
      ...projectChatMessages,
      { role: "user", content, created_at: new Date().toISOString() },
    ];
    setProjectChatMessages(optimistic);
    setProjectChatInput("");
    try {
      const response = await fetch("/api/project-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          threadId: projectChatActiveThreadId,
          message: content,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudo responder.");
      }
      if (data.threadId) {
        setProjectChatActiveThreadId(Number(data.threadId));
      }
      if (typeof data.memory === "string") {
        setProjectMemory(data.memory);
      }
      await loadProjectChat(data.threadId || projectChatActiveThreadId);
    } catch (err) {
      setProjectChatError(t("No se pudo responder con la IA.", "AI could not respond."));
    } finally {
      setProjectChatLoading(false);
    }
  };

  const handleCreateProjectChatThread = async () => {
    const title = window.prompt(
      t("Título de la duda (opcional).", "Thread title (optional)."),
      t("Nueva duda", "New question"),
    );
    if (title === null) {
      return;
    }
    setProjectChatError("");
    setProjectChatFetching(true);
    try {
      const response = await fetch("/api/project-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(projectId),
          action: "create_thread",
          title: String(title || "").trim(),
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "No se pudo crear el hilo.");
      }
      const thread = payload?.thread;
      if (thread?.id) {
        setProjectChatActiveThreadId(Number(thread.id));
        await loadProjectChat(Number(thread.id));
      } else {
        await loadProjectChat();
      }
    } catch (err) {
      setProjectChatError(t("No se pudo crear la duda.", "Could not create the thread."));
    } finally {
      setProjectChatFetching(false);
    }
  };

  const buildChatSystem = (item) => {
    if (!item) {
      return "Eres un asistente claro y directo.";
    }
    const criteria = Array.isArray(item.acceptance_criteria)
      ? item.acceptance_criteria.join("; ")
      : "";
    const source = item.source_snippet ? `Fuente: ${item.source_snippet}` : "";
    if (lang === "en") {
      return `You are a functional analyst. Answer questions about the user story clearly and without inventing details. Use Markdown with bullet lists and bold when helpful.\n\nUS: ${item.title}\nDescription: ${item.description || t("Sin descripcion.", "No description.")}\nCriteria: ${criteria || t("Sin criterios.", "No criteria.")}\n${source}`;
    }
    return `Eres un analista funcional. Responde dudas sobre la US con claridad y sin inventar. Usa Markdown con listas y negritas cuando ayude.\n\nUS: ${item.title}\nDescripcion: ${item.description || t("Sin descripcion.", "No description.")}\nCriterios: ${criteria || t("Sin criterios.", "No criteria.")}\n${source}`;
  };

  const handleOpenChat = (item) => {
    if (!item) {
      return;
    }
    setSelectedItem(null);
    setChatItem(item);
    setChatMessages([]);
    setChatInput("");
    setChatError("");
    setChatOpen(true);
  };

  const handleChatSend = async () => {
    const content = chatInput.trim();
    if (!content || !chatItem) {
      return;
    }
    const nextMessages = [...chatMessages, { role: "user", content }];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);
    setChatError("");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: buildChatSystem(chatItem),
          messages: nextMessages,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "No se pudo responder.");
      }
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.answer || "" }]);
    } catch (err) {
      setChatError(t("No se pudo responder con la IA.", "AI could not respond."));
    } finally {
      setChatLoading(false);
    }
  };

  const handleCardDragStart = (item, event) => {
    if (!item || String(item.type || "").toLowerCase() === "epic") {
      return;
    }
    event.dataTransfer.setData(
      "text/plain",
      JSON.stringify({
        id: item.id,
        type: item.type || "",
        parent_id: item.parent_id || null,
      }),
    );
    event.dataTransfer.effectAllowed = "move";
    setDraggingItem({
      id: item.id,
      type: item.type || "",
      parent_id: item.parent_id || null,
    });
  };

  const handleCardDragEnd = () => {
    setDraggingItem(null);
    setDropZone("");
  };

  const handleDragOverZone = (event, allowedTypes, zoneKey) => {
    if (!draggingItem) {
      return;
    }
    const dragType = String(draggingItem.type || "").toLowerCase();
    if (!allowedTypes.includes(dragType)) {
      return;
    }
    event.preventDefault();
    setDropZone(zoneKey);
  };

  const handleDropToEpic = async ({ event, targetEpicId, allowedTypes }) => {
    event.preventDefault();
    if (!draggingItem) {
      return;
    }
    const dragType = String(draggingItem.type || "").toLowerCase();
    if (!allowedTypes.includes(dragType)) {
      return;
    }
    if (!targetEpicId) {
      return;
    }
    if (draggingItem.parent_id === targetEpicId) {
      setDropZone("");
      setDraggingItem(null);
      return;
    }
    setDropZone("");
    setDraggingItem(null);
    try {
      await fetch(`/api/backlog/${draggingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: {
            parent_id: targetEpicId,
            epic_key: epicExternalMap.get(targetEpicId) || null,
          },
        }),
      });
      await loadProject();
    } catch (err) {
      setActionError("No se pudo mover la tarea.");
    }
  };

  const handleDropToStory = async ({ event, targetStory, allowedTypes }) => {
    event.preventDefault();
    if (!draggingItem) {
      return;
    }
    const dragType = String(draggingItem.type || "").toLowerCase();
    if (!allowedTypes.includes(dragType)) {
      return;
    }
    if (!targetStory?.id) {
      return;
    }
    if (draggingItem.parent_id === targetStory.id) {
      setDropZone("");
      setDraggingItem(null);
      return;
    }
    setDropZone("");
    setDraggingItem(null);

    const rootEpicKey =
      targetStory.epic_key ||
      (targetStory.parent_id ? epicExternalMap.get(targetStory.parent_id) : null) ||
      null;

    try {
      await fetch(`/api/backlog/${draggingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: {
            parent_id: targetStory.id,
            epic_key: rootEpicKey,
          },
        }),
      });
      await loadProject();
    } catch (err) {
      setActionError(t("No se pudo mover la tarea.", "Could not move the item."));
    }
  };

  const dropKey = (viewKey, groupKey, columnKey) =>
    `${viewKey}-${groupKey}-${columnKey}`;

  const handleQuickPatch = async (itemId, updates) => {
    if (!itemId || !updates) {
      return;
    }
    setActionError("");
    try {
      const response = await fetch(`/api/backlog/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!response.ok) {
        throw new Error("No se pudo actualizar.");
      }
      await loadProject();
    } catch (err) {
      setActionError(t("No se pudo actualizar la tarea.", "Could not update the item."));
    }
  };

  const handleToggleBlocked = async (task) => {
    if (!task?.id) {
      return;
    }
    if (task.blocked_reason) {
      await handleQuickPatch(task.id, { blocked_reason: "" });
      return;
    }
    const reason = window.prompt(
      t(
        "Indica el motivo del bloqueo (se mostrará en el proyecto).",
        "Enter the blocking reason (it will be shown in the project).",
      ),
      t("Pendiente de dependencia / aclaración.", "Pending dependency / clarification."),
    );
    if (reason === null) {
      return;
    }
    const clean = String(reason || "").trim();
    await handleQuickPatch(task.id, { blocked_reason: clean || "Bloqueada" });
  };

  const handleReassignOrphan = async (taskId, targetStoryId) => {
    if (!taskId || !targetStoryId) return;
    const story = allStoriesById.get(Number(targetStoryId));
    const epicKey =
      story?.epic_key ||
      (story?.parent_id ? epicExternalMap.get(story.parent_id) : null) ||
      null;
    try {
      await fetch(`/api/backlog/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: {
            parent_id: Number(targetStoryId),
            epic_key: epicKey,
          },
        }),
      });
      await loadProject();
    } catch (err) {
      setActionError(t("No se pudo reasignar la US.", "Could not reassign the US."));
    }
  };

  const parseQaList = (item) => {
    if (!Array.isArray(item?.clarification_questions)) return [];
    return item.clarification_questions.map((raw) => {
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const question = String(raw.question || raw.q || "")
          .replace(/^Q[:=]\s*/i, "")
          .trim();
        const answer = String(raw.answer || raw.a || "")
          .replace(/^A[:=]\s*/i, "")
          .trim();
        return { question, answer };
      }
      const text = String(raw || "");
      const parts = text.split(/\s*\|\s*A[:=]\s*/i);
      const question = parts[0].replace(/^Q[:=]\s*/i, "").trim();
      const answer = parts[1] ? parts[1].trim() : "";
      return { question: question || text.trim(), answer };
    });
  };

  const needsInfo = (item) => {
    if (!item) return false;
    if (Number(item.info_complete) === 1) {
      return false;
    }
    const qa = parseQaList(item);
    const pendingQa = qa.some((pair) => !pair.answer || !pair.answer.trim());
    const missingDesc = !item.description || String(item.description).trim().length < 20;
    const missingCriteria =
      Array.isArray(item.acceptance_criteria) && item.acceptance_criteria.length === 0;
    return pendingQa || missingDesc || missingCriteria;
  };

  const renderTree = (groups) => {
    const toggleNode = (id) => {
      setTreeExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    };
    const isExpanded = (id) => treeExpanded.has(id);

    const renderNode = (item, nodeId) => {
      const typeLower = String(item.type || "").toLowerCase();
      const marker =
        typeLower === "epic"
          ? "◆"
          : typeLower === "story"
            ? "▶"
            : "●";
      const infoNeeded = needsInfo(item);
      const questions = Array.isArray(item.clarification_questions)
        ? item.clarification_questions
        : [];
      const expanded = isExpanded(nodeId);
      return (
        <li
          key={`${nodeId}`}
          className={infoNeeded ? "tree-needs-info" : ""}
        >
          <div
            className={`tree-line tree-${typeLower}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              toggleNode(nodeId);
              setSelectedItem(item);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleNode(nodeId);
                setSelectedItem(item);
              }
            }}
          >
            <span className={`tree-marker tree-marker-${typeLower}`}>{marker}</span>
            <span className="tree-title">{item.title}</span>
            <span className="tree-helper">
              {item.external_id} · {typeLower === "epic" ? t("Iniciativa", "Initiative") : typeLower === "story" ? t("Feature", "Feature") : t("US", "User story")}
            </span>
            {infoNeeded ? (
              <span className="badge danger">{t("Info pendiente", "Info missing")}</span>
            ) : null}
            <span className="tree-expander">{expanded ? "−" : "+"}</span>
          </div>
          {infoNeeded && questions.length && expanded ? (
            <ul className="tree-questions">
              {parseQaList(item).map((qa, idx) => (
                <li key={idx}>
                  <strong>{qa.question}</strong>
                  {qa.answer ? ` → ${qa.answer}` : ""}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      );
    };

    if (groups.length === 0) {
      return <p className="helper">{t("Aún no hay backlog.", "No backlog yet.")}</p>;
    }

    const projectNodeId = "root";
    const projectTitle = data?.project?.name || t("Proyecto", "Project");

    return (
      <div className="tree-view">
        <ul>
          <li key={projectNodeId}>
            <div
              className="tree-line tree-epic"
              role="button"
              tabIndex={0}
              onClick={() => toggleNode(projectNodeId)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleNode(projectNodeId);
                }
              }}
            >
              <span className="tree-marker tree-marker-epic">◆</span>
              <span className="tree-title">{projectTitle}</span>
              <span className="tree-helper">{t("Vista del proyecto", "Project view")}</span>
              <span className="tree-expander">{isExpanded(projectNodeId) ? "−" : "+"}</span>
            </div>
            {isExpanded(projectNodeId) ? (
              <ul>
                {groups.map((group) => {
                  const epicNodeId = `epic-${group.epic?.id || group.key}`;
                  return (
                    <li key={epicNodeId}>
                      {renderNode(group.epic, epicNodeId)}
                      {isExpanded(epicNodeId) ? (
                        <ul className="tree-branch">
                          {group.stories.map((story) => {
                            const storyNodeId = `story-${story.id}`;
                            return (
                              <li key={storyNodeId}>
                                {renderNode(story, storyNodeId)}
                                {isExpanded(storyNodeId) ? (
                                  <ul className="tree-branch">
                                    {(group.userStoriesByStoryId.get(story.id) || []).map((us) => {
                                      const usNodeId = `us-${us.id}`;
                                      return <li key={usNodeId}>{renderNode(us, usNodeId)}</li>;
                                    })}
                                  </ul>
                                ) : null}
                              </li>
                            );
                          })}
                          {group.unassignedUserStories?.length ? (
                            <li>
                              <div className="tree-line tree-muted">
                                {t("US sin feature asignada", "US without feature")}
                              </div>
                              <ul>
                                {group.unassignedUserStories.map((us) => (
                                  <li key={`us-unassigned-${us.id}`}>
                                    {renderNode(us, `us-unassigned-${us.id}`)}
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ) : null}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </li>
        </ul>
      </div>
    );
  };

  const renderFrameworkCard = (item, label, variant, dragEnabled = true) => {
    if (!item) {
      return null;
    }
    const isDragging = draggingItem?.id === item.id;
    const statusText =
      statusLabels[item.status] || item.status || t("Por hacer", "To Do");
    const itemType = String(item.type || "").toLowerCase();
    const showActions = itemType !== "epic";
    const isBlocked = Boolean(item.blocked_reason);
    const showNeedsInfo = needsInfo(item);
    return (
      <div
        className={`framework-card ${variant} ${isDragging ? "dragging" : ""} ${isBlocked ? "blocked" : ""} ${showNeedsInfo ? "needs-info" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => setSelectedItem(item)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedItem(item);
          }
        }}
        draggable={dragEnabled}
        onDragStart={(event) => dragEnabled && handleCardDragStart(item, event)}
        onDragEnd={handleCardDragEnd}
      >
        <div className="framework-card-meta">
          <span className="badge">{label}</span>
          {showNeedsInfo ? <span className="badge danger">{t("Info pendiente", "Info missing")}</span> : null}
          <span className="helper">{item.external_id || "-"}</span>
        </div>
        <h4>{item.title}</h4>
        <p className="helper">
          {statusText}
          {isBlocked ? ` · ${t("Bloqueada", "Blocked")}` : ""}
        </p>
        {showActions ? (
          <div className="framework-card-actions" onClick={(event) => event.stopPropagation()}>
            <select
              className="framework-mini-select"
              value={item.status || "todo"}
              onChange={(event) => handleQuickPatch(item.id, { status: event.target.value })}
              aria-label={t("Cambiar estado", "Change status")}
            >
              <option value="todo">{t("Por hacer", "To Do")}</option>
              <option value="in_progress">{t("En progreso", "In Progress")}</option>
              <option value="review">{t("Revisión", "Review")}</option>
              <option value="done">{t("Hecho", "Done")}</option>
              <option value="obsolete">{t("Obsoleto", "Obsolete")}</option>
            </select>
            <select
              className="framework-mini-select"
              value={item.priority || "Medium"}
              onChange={(event) => handleQuickPatch(item.id, { priority: event.target.value })}
              aria-label={t("Cambiar prioridad", "Change priority")}
            >
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
            <button
              className="btn btn-ghost framework-mini-btn"
              type="button"
              onClick={() => handleToggleBlocked(item)}
            >
              {isBlocked ? t("Desbloquear", "Unblock") : t("Bloquear", "Block")}
            </button>
            <button
              className="btn btn-ghost framework-mini-btn danger"
              type="button"
              onClick={() => handleDeleteItem(item)}
            >
              {t("Eliminar", "Delete")}
            </button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="page">
      <TopNav />

      <section className="section" style={{ paddingBottom: "8px" }}>
        {loading ? <p className="helper">{t("Cargando...", "Loading...")}</p> : null}
        {error ? <p className="notice">{error}</p> : null}
        {actionError ? <p className="notice">{actionError}</p> : null}
        <div className="view-toolbar">
          <div className="view-switch">
            {viewTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`btn ${activeView === tab.key ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setActiveView(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="view-actions">
            <button
              className="btn btn-outline"
              type="button"
              onClick={() => {
                setTreeExpanded(new Set(["root"]));
                setTreeOpen(true);
              }}
            >
              {t("Visualizar en árbol", "View as tree")}
            </button>
            {activeView === "jira" ? (
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => handleExport("jira")}
                disabled={exportLoading}
              >
                {t("Exportar (Jira)", "Export (Jira)")}
              </button>
            ) : activeView === "rally" ? (
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => handleExport("rally")}
                disabled={exportLoading}
              >
                {t("Exportar (Rally)", "Export (Rally)")}
              </button>
            ) : (
              <>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => handleExport("jira")}
                  disabled={exportLoading}
                >
                  {t("Exportar Jira", "Export Jira")}
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => handleExport("rally")}
                  disabled={exportLoading}
                >
                  {t("Exportar Rally", "Export Rally")}
                </button>
              </>
            )}
            <button
              className="btn btn-outline btn-ai"
              type="button"
              onClick={handleRecalculateProject}
              disabled={recalculateLoading}
            >
              {recalculateLoading ? t("Recalculando...", "Recalculating...") : t("Recalcular IA", "Recalculate AI")}
            </button>
          </div>
        </div>
        {exportStatus ? <p className="helper">{exportStatus}</p> : null}
        {recalculateStatus ? <p className="helper">{recalculateStatus}</p> : null}
        {unassignedUserStories.length > 0 ? (
          <div className="notice">
            <strong>{t("Hay US sin feature asignada.", "There are US without a feature.")}</strong>{" "}
            <button
              className="btn btn-ghost"
              type="button"
              onClick={() => setShowUnassignedInline((prev) => !prev)}
            >
              {showUnassignedInline
                ? t("Ocultar", "Hide")
                : t("Revisar ahora", "Review now")}
            </button>
          </div>
        ) : null}
        {activeView === "general" ? (
          <div className="view-subtabs">
            {generalTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`btn ${generalTab === tab.key ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setGeneralTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {activeView === "general" && generalTab === "overview" ? (
        <section className="section">
          {data ? (
            <div className="card-grid">
              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <h3>{t("Descripción del proyecto", "Project description")}</h3>
                  <button
                    className="btn btn-outline btn-ai"
                    type="button"
                    onClick={() => generateProjectDescription(true)}
                    disabled={projectDescriptionLoading}
                  >
                    {projectDescriptionLoading ? t("Generando...", "Generating...") : t("Regenerar", "Regenerate")}
                  </button>
                </div>
                <p className="helper">
                  {t(
                    "Resumen generado con IA a partir de documentos, backlog y contexto guardado del proyecto.",
                    "AI-generated summary from documents, backlog, and saved project context.",
                  )}
                </p>
                {projectDescriptionError ? <p className="notice">{projectDescriptionError}</p> : null}
                {projectDescriptionLoading ? (
                  <p className="helper">{t("Preparando la descripción...", "Preparing description...")}</p>
                ) : null}
                {projectDescriptionText ? (
                  <div className="card" style={{ padding: "14px", marginTop: "12px", background: "var(--surface-2)" }}>
                    <RichText text={projectDescriptionText} />
                  </div>
                ) : (
                  <p className="helper">
                    {t(
                      "Aún no hay descripción disponible. Se generará automáticamente cuando haya contexto suficiente.",
                      "No description available yet. It will be generated automatically once there is enough context.",
                    )}
                  </p>
                )}
              </div>
              <div className="card">
                <span className="badge">{t("Proyecto", "Project")}</span>
                {editingName ? (
                  <div>
                    <input
                      className="input"
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                    />
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                      <button className="btn btn-primary" type="button" onClick={handleProjectRename}>
                        {t("Guardar", "Save")}
                      </button>
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={() => {
                          setProjectName(data.project.name);
                          setEditingName(false);
                        }}
                      >
                        {t("Cancelar", "Cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h2>{data.project.name}</h2>
                    <p className="helper">{t("ID", "ID")} {data.project.id}</p>
                    <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                      <button className="btn btn-ghost" type="button" onClick={() => setEditingName(true)}>
                        {t("Editar nombre", "Edit name")}
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={handleProjectDelete}>
                        {t("Eliminar proyecto", "Delete project")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="card">
                <h3>{t("Resumen", "Summary")}</h3>
                <p>{t("Documentos", "Documents")}: {data.stats.documents}</p>
                <p>{t("Backlog", "Backlog")}: {data.stats.backlog}</p>
                <p>{t("Subproyectos", "Subprojects")}: {data.stats.subprojects}</p>
              </div>
              <div className="card" style={{ gridColumn: "1 / -1" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                  <h3>{t("Último documento", "Latest document")}</h3>
                  <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {latestDocument?.id ? (
                      <button
                        className="btn btn-outline"
                        type="button"
                        onClick={() => handleOpenDocument(latestDocument.id)}
                        disabled={documentLoading}
                      >
                        {t("Abrir", "Open")}
                      </button>
                    ) : null}
                    <button
                      className="btn btn-ghost"
                      type="button"
                      onClick={() => setGeneralTab("docs")}
                    >
                      {t("Ver documentos", "View documents")}
                    </button>
                  </div>
                </div>
                {latestDocument ? (
                  <p className="helper" style={{ marginTop: "6px" }}>
                    {t("Versión", "Version")}: {latestDocument.version} ·{" "}
                    {t("Creado", "Created")}: {formatDate(latestDocument.created_at)}
                  </p>
                ) : (
                  <p className="helper">{t("Aún no hay documentos.", "No documents yet.")}</p>
                )}
                {latestDocument?.summary ? (
                  <div className="card" style={{ padding: "14px", marginTop: "12px", background: "var(--surface-2)" }}>
                    <RichText text={latestDocument.summary} />
                  </div>
                ) : latestDocument ? (
                  <p className="helper" style={{ marginTop: "12px" }}>
                    {t(
                      "Este documento aún no tiene resumen. Genera backlog desde /plan para que se cree automáticamente.",
                      "This document has no summary yet. Generate a backlog from /plan so it can be created automatically.",
                    )}
                  </p>
                ) : null}
                <div style={{ marginTop: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <strong>{t("Supuestos", "Assumptions")}</strong>
                    <InfoTooltip label={t("Información sobre supuestos", "Info about assumptions")}>
                      <div style={{ fontWeight: 700, marginBottom: "6px" }}>
                        {t("¿Por qué aparecen?", "Why are they here?")}
                      </div>
                      <div>
                        {t(
                          "Son hipótesis necesarias para estimar o estructurar el trabajo cuando el documento no es explícito. Deben confirmarse con el cliente o el equipo.",
                          "They are hypotheses needed to estimate or structure work when the document is not explicit. Confirm them with the client or the team.",
                        )}
                      </div>
                    </InfoTooltip>
                  </div>
                  {latestAssumptions.length === 0 ? (
                    <p className="helper" style={{ marginTop: "6px" }}>
                      {t("No se detectaron supuestos.", "No assumptions detected.")}
                    </p>
                  ) : (
                    <ul style={{ marginTop: "8px" }}>
                      {latestAssumptions.map((assumption, index) => (
                        <li key={index}>{assumption}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {activeView === "general" && generalTab === "docs" ? (
        <section className="section">
          <h2>{t("Documentos del proyecto", "Project documents")}</h2>
          <p className="helper">
            {t(
              "Aquí puedes consultar los documentos ya ingestados. Se muestra el texto extraído (no el archivo original).",
              "Here you can review ingested documents. It shows the extracted text (not the original file).",
            )}
          </p>
          {documentError ? <p className="notice">{documentError}</p> : null}
          {documentLoading ? <p className="helper">{t("Abriendo documento...", "Opening document...")}</p> : null}
          <div className="card-grid">
            {(data?.documents || []).length === 0 ? (
              <p className="helper">{t("Aún no hay documentos cargados.", "No documents uploaded yet.")}</p>
            ) : (
              data.documents.map((doc) => (
                <div key={doc.id} className="card">
                  <span className="badge">{doc.version}</span>
                  <h3>{t("Documento", "Document")} #{doc.id}</h3>
                  <p className="helper">{t("Creado", "Created")}: {formatDate(doc.created_at)}</p>
                  <p className="helper">{t("Caracteres", "Characters")}: {doc.size}</p>
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => handleOpenDocument(doc.id)}
                    style={{ marginTop: "12px" }}
                    disabled={documentLoading}
                  >
                    {t("Abrir", "Open")}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      ) : null}

      {activeView === "general" && generalTab === "subprojects" ? (
        <section className="section">
          <h2>{t("Subproyectos", "Subprojects")}</h2>
          <p className="helper">
            {t(
              "Subproyectos que agrupan trabajo y permiten crear tareas asociadas.",
              "Subprojects that group work and allow associated tasks.",
            )}
          </p>
          {epics.length === 0 ? (
            <p className="helper">{t("Aún no hay subproyectos creados.", "No subprojects created yet.")}</p>
          ) : (
            <div className="card-grid">
              {epics.map((epic) => {
                const stats = epicStats.get(epic.id) || { total: 0, done: 0 };
                return (
                  <div
                    key={epic.id}
                    className="card"
                    role="button"
                    onClick={() => setSelectedItem(epic)}
                  >
                    <span className="badge">{epic.external_id}</span>
                    <h3>{epic.title}</h3>
                    <p className="helper">{t("Items", "Items")}: {stats.total}</p>
                    <p className="helper">{t("Completadas", "Completed")}: {stats.done}</p>
                  </div>
                );
              })}
            </div>
          )}
          <div className="card" style={{ marginTop: "16px" }}>
            <h3>{t("Crear subproyecto", "Create subproject")}</h3>
            <div className="form-grid">
              <input
                className="input"
                placeholder={t("Nombre del subproyecto", "Subproject name")}
                value={newEpic.title}
                onChange={(event) => setNewEpic({ ...newEpic, title: event.target.value })}
              />
              <input
                className="input"
                placeholder={t("Descripción (opcional)", "Description (optional)")}
                value={newEpic.description}
                onChange={(event) => setNewEpic({ ...newEpic, description: event.target.value })}
              />
              <button className="btn btn-outline" type="button" onClick={handleCreateEpic}>
                {t("Crear subproyecto", "Create subproject")}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {activeView === "general" && generalTab === "tasks" ? (
        <section className="section">
          <h2>{t("Tareas del proyecto", "Project tasks")}</h2>
          <div className="form-grid">
            <div>
              <label>{t("Buscar", "Search")}</label>
              <input
                className="input"
                value={taskFilters.query}
                onChange={(event) =>
                  setTaskFilters({ ...taskFilters, query: event.target.value })
                }
              />
            </div>
            <div>
              <label>{t("Estado", "Status")}</label>
              <select
                className="input"
                value={taskFilters.status}
                onChange={(event) =>
                  setTaskFilters({ ...taskFilters, status: event.target.value })
                }
              >
                <option value="all">{t("Todos", "All")}</option>
                <option value="todo">{t("Por hacer", "To Do")}</option>
                <option value="in_progress">{t("En progreso", "In Progress")}</option>
                <option value="review">{t("Revisión", "Review")}</option>
                <option value="done">{t("Hecho", "Done")}</option>
                <option value="obsolete">{t("Obsoleto", "Obsolete")}</option>
              </select>
            </div>
            <div>
              <label>{t("Área", "Area")}</label>
              <select
                className="input"
                value={taskFilters.area}
                onChange={(event) =>
                  setTaskFilters({ ...taskFilters, area: event.target.value })
                }
              >
                <option value="all">{t("Todas", "All")}</option>
                {taskAreas.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="card" style={{ marginTop: "16px" }}>
            <h3>{t("Crear funcionalidad o historia de usuario", "Create feature or user story")}</h3>
            <div className="form-grid">
              <input
                className="input"
                placeholder={
                  createTaskIsUserStory
                    ? t("Título de la historia de usuario", "User story title")
                    : t("Título de la funcionalidad", "Feature title")
                }
                value={newTask.title}
                onChange={(event) => setNewTask({ ...newTask, title: event.target.value })}
              />
              <select
                className="input"
                value={newTask.type}
                onChange={(event) => setNewTask({ ...newTask, type: event.target.value })}
              >
                <option value="Story">{t("Funcionalidad", "Feature")}</option>
                <option value="Task">{t("Historia de usuario", "User story")}</option>
              </select>
              <select
                className="input"
                value={newTask.area}
                onChange={(event) => setNewTask({ ...newTask, area: event.target.value })}
              >
                <option value="frontend">frontend</option>
                <option value="backend">backend</option>
                <option value="api">api</option>
                <option value="db">db</option>
                <option value="qa">qa</option>
                <option value="devops">devops</option>
                <option value="security">security</option>
                <option value="other">other</option>
              </select>
              <select
                className="input"
                value={newTask.priority}
                onChange={(event) => setNewTask({ ...newTask, priority: event.target.value })}
              >
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
              <select
                className="input"
                value={newTask.status}
                onChange={(event) => setNewTask({ ...newTask, status: event.target.value })}
              >
                <option value="todo">{t("Por hacer", "To Do")}</option>
                <option value="in_progress">{t("En progreso", "In Progress")}</option>
                <option value="review">{t("Revisión", "Review")}</option>
                <option value="done">{t("Hecho", "Done")}</option>
                <option value="obsolete">{t("Obsoleto", "Obsolete")}</option>
              </select>
              <select
                className="input"
                value={newTask.parentId}
                onChange={(event) => setNewTask({ ...newTask, parentId: event.target.value })}
                disabled={!createTaskParents.length}
              >
                {createTaskParents.length === 0 ? (
                  <option value="">
                    {createTaskIsUserStory
                      ? t("Crea una funcionalidad primero", "Create a feature first")
                      : t("Crea un subproyecto primero", "Create a subproject first")}
                  </option>
                ) : (
                  createTaskParents.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.title}
                    </option>
                  ))
                )}
              </select>
              <button
                className="btn btn-outline"
                type="button"
                onClick={handleCreateTask}
                disabled={!createTaskParents.length}
              >
                {createTaskIsUserStory ? t("Crear US", "Create US") : t("Crear feature", "Create feature")}
              </button>
            </div>
            {!createTaskParents.length ? (
              <p className="helper">
                {createTaskIsUserStory
                  ? t(
                      "Crea al menos una funcionalidad (Feature) antes de registrar historias de usuario.",
                      "Create at least one feature before adding user stories.",
                    )
                  : t(
                      "Crea un subproyecto antes de registrar funcionalidades o historias de usuario.",
                      "Create a subproject before adding items.",
                    )}
              </p>
            ) : null}
          </div>
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>{t("Título", "Title")}</th>
                  <th>{t("Tipo", "Type")}</th>
                  <th>{t("Área", "Area")}</th>
                  <th>{t("Subproyecto", "Subproject")}</th>
                  <th>{t("Estado", "Status")}</th>
                  <th>{t("Prioridad", "Priority")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      {t("No hay tareas con ese filtro.", "No tasks match the filter.")}
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => (
                    <tr key={task.id} onClick={() => setSelectedItem(task)} style={{ cursor: "pointer" }}>
                      {(() => {
                        const typeLower = String(task.type || "").toLowerCase();
                        let subprojectTitle = "-";
                        if (typeLower === "story") {
                          subprojectTitle = task.parent_id ? epicMap.get(task.parent_id) || "-" : "-";
                        } else if (typeLower === "task") {
                          if (task.parent_id && storyById.has(task.parent_id)) {
                            const parentStory = storyById.get(task.parent_id);
                            if (parentStory?.parent_id) {
                              subprojectTitle = epicMap.get(parentStory.parent_id) || "-";
                            }
                          }
                          if (subprojectTitle === "-" && task.epic_key) {
                            subprojectTitle = epicTitleByExternalId.get(task.epic_key) || "-";
                          }
                          if (subprojectTitle === "-" && task.parent_id) {
                            subprojectTitle = epicMap.get(task.parent_id) || "-";
                          }
                        }
                        return (
                          <>
                      <td>{task.external_id}</td>
                      <td>{task.title}</td>
                      <td>
                        {String(task.type || "").toLowerCase() === "epic"
                          ? t("Subproyecto", "Subproject")
                          : String(task.type || "").toLowerCase() === "story"
                            ? t("Funcionalidad", "Feature")
                            : String(task.type || "").toLowerCase() === "task"
                              ? t("Historia de usuario", "User story")
                              : task.type}
                      </td>
                      <td>{task.area}</td>
                      <td>{subprojectTitle}</td>
                      <td>{statusLabels[task.status] || task.status}</td>
                      <td>{task.priority}</td>
                          </>
                        );
                      })()}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      {activeView === "general" && generalTab === "ask" ? (
        <section className="section">
          <h2>{t("Chat de dudas con IA", "AI Q&A chat")}</h2>
          <p className="helper">
            {t(
              "Crea un hilo por cada duda. El contexto útil se guarda dentro del proyecto para ayudarte en futuras revisiones.",
              "Create one thread per question. Useful context is saved within the project for future reviews.",
            )}
          </p>
          {projectChatError ? <p className="notice">{projectChatError}</p> : null}
          <div className="split">
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ marginTop: 0 }}>{t("Dudas", "Threads")}</h3>
                  <p className="helper" style={{ marginTop: "6px" }}>
                    {t(
                      "Cada duda mantiene su conversación separada.",
                      "Each question keeps a separate conversation.",
                    )}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    className="btn btn-outline btn-ai"
                    type="button"
                    onClick={handleCreateProjectChatThread}
                    disabled={projectChatFetching}
                  >
                    {t("Nueva duda", "New thread")}
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={() => loadProjectChat()}
                    disabled={projectChatFetching}
                  >
                    {t("Actualizar", "Refresh")}
                  </button>
                </div>
              </div>
              {projectChatFetching ? <p className="helper">{t("Cargando...", "Loading...")}</p> : null}
              {projectChatThreads.length === 0 ? (
                <p className="helper">{t("Aún no hay dudas creadas.", "No threads yet.")}</p>
              ) : (
                <div style={{ display: "grid", gap: "10px", marginTop: "12px" }}>
                  {projectChatThreads.map((thread) => {
                    const active = Number(thread.id) === Number(projectChatActiveThreadId);
                    return (
                      <button
                        key={thread.id}
                        type="button"
                        className={`btn ${active ? "btn-primary" : "btn-ghost"}`}
                        style={{ justifyContent: "space-between", display: "flex" }}
                        onClick={() => setProjectChatActiveThreadId(Number(thread.id))}
                      >
                        <span style={{ textAlign: "left" }}>{thread.title}</span>
                        <span className="badge">{thread.messages_count || 0}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div style={{ marginTop: "12px" }}>
                {projectMemory ? (
                  <p className="helper">{t("Contexto del proyecto guardado y actualizado.", "Project context saved and up to date.")}</p>
                ) : (
                  <p className="helper">{t("Aún no hay contexto guardado.", "No saved context yet.")}</p>
                )}
              </div>
            </div>

            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ marginTop: 0 }}>{activeProjectChatThread?.title || t("Conversación", "Conversation")}</h3>
                  <p className="helper" style={{ marginTop: "6px" }}>
                    {t(
                      "Pregunta sobre alcance, riesgos, dependencias o próximos pasos.",
                      "Ask about scope, risks, dependencies, or next steps.",
                    )}
                  </p>
                </div>
              </div>
              <div className="chat-panel" ref={projectChatRef} style={{ marginTop: "10px" }}>
                {projectChatMessages.length === 0 ? (
                  <p className="helper">
                    {t(
                      "Selecciona una duda o crea una nueva para empezar.",
                      "Select a thread or create a new one to start.",
                    )}
                  </p>
                ) : (
                  projectChatMessages.map((msg, index) => (
                    <div
                      key={`${msg.role}-${index}`}
                      className={`chat-message ${msg.role === "assistant" ? "assistant" : "user"}`}
                    >
                      <div className="chat-meta">
                        {msg.role === "assistant" ? t("Asistente", "Assistant") : t("Tú", "You")}
                      </div>
                      <div>
                        {msg.role === "assistant" ? <RichText text={msg.content} /> : msg.content}
                      </div>
                    </div>
                  ))
                )}
                {projectChatLoading ? <p className="helper">{t("Pensando...", "Thinking...")}</p> : null}
              </div>
              <div style={{ marginTop: "14px" }}>
                <label>{t("Tu mensaje", "Your message")}</label>
                <textarea
                  value={projectChatInput}
                  onChange={(event) => setProjectChatInput(event.target.value)}
                  placeholder={t(
                    "Ej: ¿Qué falta para cerrar el alcance? ¿Qué depende del cliente?",
                    "Ex: What is missing to close scope? What depends on the client?",
                  )}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleProjectChatSend();
                    }
                  }}
                />
                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "12px", flexWrap: "wrap" }}>
                  <button
                    className="btn btn-primary btn-ai"
                    type="button"
                    onClick={handleProjectChatSend}
                    disabled={projectChatLoading || projectChatFetching || !projectChatInput.trim()}
                  >
                    {projectChatLoading ? t("Enviando...", "Sending...") : t("Enviar", "Send")}
                  </button>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={handleCreateProjectChatThread}
                    disabled={projectChatLoading || projectChatFetching}
                  >
                    {t("Crear nueva duda", "New thread")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      {activeView === "rally" ? (
        <section className="section">
          <div className="view-header">
            <div>
              <h2>{t("Vista Rally", "Rally view")}</h2>
              <p className="helper">
                {t(
                  "Iniciativas (subproyectos), features y user stories con jerarquia visual.",
                  "Initiatives (subprojects), features, and user stories with visual hierarchy.",
                )}
              </p>
            </div>
          </div>
          <div className="framework-board">
            {epicGroups.length === 0 ? (
              <p className="helper">{t("Aún no hay backlog para mostrar.", "No backlog to show yet.")}</p>
            ) : (
              epicGroups.map((group) => (
                <div key={group.key} className="framework-row">
                  <div className="framework-cell">
                    <div className="framework-cell-title">{t("Iniciativa", "Initiative")}</div>
                    {renderFrameworkCard(group.epic, t("Iniciativa", "Initiative"), "initiative", false)}
                  </div>
                  <div
                    className={`framework-cell ${
                      dropZone === dropKey("rally", group.key, "features") ? "drop-target" : ""
                    }`}
                    onDragOver={(event) =>
                      handleDragOverZone(event, ["story"], dropKey("rally", group.key, "features"))
                    }
                    onDragLeave={() => setDropZone("")}
                    onDrop={(event) =>
                      handleDropToEpic({
                        event,
                        targetEpicId: group.epic?.id,
                        allowedTypes: ["story"],
                      })
                    }
                  >
                    <div className="framework-cell-title">
                      {t("Features y User Stories", "Features & User Stories")}
                    </div>
                    <div className="framework-stack">
                      {group.stories.length === 0 ? (
                        <p className="helper">{t("Sin features.", "No features.")}</p>
                      ) : (
                        group.stories.map((feature) => {
                          const userStories = group.userStoriesByStoryId.get(feature.id) || [];
                          return (
                            <div key={feature.id} className="framework-feature-group">
                              {renderFrameworkCard(feature, t("Feature", "Feature"), "feature")}
                              <div
                                className={`framework-dropzone ${
                                  dropZone === dropKey("rally", feature.id, "userstories")
                                    ? "drop-target"
                                    : ""
                                }`}
                                onDragOver={(event) =>
                                  handleDragOverZone(
                                    event,
                                    ["task"],
                                    dropKey("rally", feature.id, "userstories"),
                                  )
                                }
                                onDragLeave={() => setDropZone("")}
                                onDrop={(event) =>
                                  handleDropToStory({
                                    event,
                                    targetStory: feature,
                                    allowedTypes: ["task"],
                                  })
                                }
                              >
                                <div className="framework-dropzone-title">
                                  {t("User Stories", "User Stories")}
                                </div>
                                <div className="framework-stack">
                                  {userStories.length === 0 ? (
                                    <p className="helper">{t("Sin US.", "No US.")}</p>
                                  ) : (
                                    userStories.map((item) =>
                                      renderFrameworkCard(item, t("US", "US"), "userstory"),
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      {group.unassignedUserStories?.length ? (
                        <div className="framework-dropzone">
                          <div className="framework-dropzone-title">
                            {t("US sin feature", "Unassigned US")}
                          </div>
                          <div className="framework-stack">
                            {group.unassignedUserStories.map((item) =>
                              renderFrameworkCard(item, t("US", "US"), "userstory"),
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {renderTree(epicGroups, t("Árbol Rally", "Rally tree"))}
        </section>
      ) : null}
      {activeView === "jira" ? (
        <section className="section">
          <div className="view-header">
            <div>
              <h2>{t("Vista Jira", "Jira view")}</h2>
              <p className="helper">
                {t(
                  "Epics con sus stories y tasks alineadas para estimar y planificar.",
                  "Epics with their stories and tasks aligned for estimation and planning.",
                )}
              </p>
            </div>
          </div>
          <div className="framework-board">
            {epicGroups.length === 0 ? (
              <p className="helper">{t("Aún no hay backlog para mostrar.", "No backlog to show yet.")}</p>
            ) : (
              epicGroups.map((group) => (
                <div key={group.key} className="framework-row">
                  <div className="framework-cell">
                    <div className="framework-cell-title">Epic</div>
                    {renderFrameworkCard(group.epic, "Epic", "epic", false)}
                  </div>
                  <div
                    className={`framework-cell ${
                      dropZone === dropKey("jira", group.key, "stories") ? "drop-target" : ""
                    }`}
                    onDragOver={(event) =>
                      handleDragOverZone(event, ["story"], dropKey("jira", group.key, "stories"))
                    }
                    onDragLeave={() => setDropZone("")}
                    onDrop={(event) =>
                      handleDropToEpic({
                        event,
                        targetEpicId: group.epic?.id,
                        allowedTypes: ["story"],
                      })
                    }
                  >
                    <div className="framework-cell-title">
                      {t("Stories y Tasks", "Stories & Tasks")}
                    </div>
                    <div className="framework-stack">
                      {group.stories.length === 0 ? (
                        <p className="helper">{t("Sin stories.", "No stories.")}</p>
                      ) : (
                        group.stories.map((story) => {
                          const tasksForStory = group.userStoriesByStoryId.get(story.id) || [];
                          return (
                            <div key={story.id} className="framework-feature-group">
                              {renderFrameworkCard(story, t("Story", "Story"), "story")}
                              <div
                                className={`framework-dropzone ${
                                  dropZone === dropKey("jira", story.id, "tasks") ? "drop-target" : ""
                                }`}
                                onDragOver={(event) =>
                                  handleDragOverZone(
                                    event,
                                    ["task"],
                                    dropKey("jira", story.id, "tasks"),
                                  )
                                }
                                onDragLeave={() => setDropZone("")}
                                onDrop={(event) =>
                                  handleDropToStory({
                                    event,
                                    targetStory: story,
                                    allowedTypes: ["task"],
                                  })
                                }
                              >
                                <div className="framework-dropzone-title">{t("Tasks", "Tasks")}</div>
                                <div className="framework-stack">
                                  {tasksForStory.length === 0 ? (
                                    <p className="helper">{t("Sin tasks.", "No tasks.")}</p>
                                  ) : (
                                    tasksForStory.map((item) =>
                                      renderFrameworkCard(item, t("Task", "Task"), "task"),
                                    )
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                      {group.unassignedUserStories?.length ? (
                        <div className="framework-dropzone">
                          <div className="framework-dropzone-title">
                            {t("Tasks sin story", "Unassigned tasks")}
                          </div>
                          <div className="framework-stack">
                            {group.unassignedUserStories.map((item) =>
                              renderFrameworkCard(item, t("Task", "Task"), "task"),
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          {renderTree(epicGroups, t("Árbol Jira", "Jira tree"))}
        </section>
      ) : null}
      <TaskModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onSave={handleSaveItem}
        onDelete={handleDeleteItem}
        onOpenChat={handleOpenChat}
        view={activeView}
      />
      <DocumentModal document={activeDocument} onClose={() => setActiveDocument(null)} />
      <Portal>
        {chatOpen ? <div className="side-panel-backdrop" onClick={() => setChatOpen(false)} /> : null}
        <aside className={`side-panel ${chatOpen ? "open" : ""}`} aria-hidden={!chatOpen}>
          <div className="side-panel-header">
            <div>
              <div className="badge">{t("IA", "AI")}</div>
              <h3>{t("Chat de la US", "User story chat")}</h3>
              <p className="helper">
                {chatItem ? chatItem.title : t("Selecciona una US", "Select a user story")}
              </p>
            </div>
            <button className="btn btn-ghost" type="button" onClick={() => setChatOpen(false)}>
              {t("Cerrar", "Close")}
            </button>
          </div>
          <div className="side-panel-body">
            <div className="chat-panel">
              {!chatItem ? (
                <p className="helper">
                  {t(
                    "Selecciona una tarea o US para iniciar el chat.",
                    "Select a task or user story to start the chat.",
                  )}
                </p>
              ) : chatMessages.length === 0 ? (
                <p className="helper">
                  {t(
                    "Pregunta a la IA sobre esta US. Ej: alcance, dependencias o riesgos.",
                    "Ask the AI about this user story: scope, dependencies, or risks.",
                  )}
                </p>
              ) : (
                chatMessages.map((msg, index) => (
                  <div key={index} className={`chat-message ${msg.role}`}>
                    <div className="chat-meta">
                      {msg.role === "user" ? t("Tu", "You") : t("IA", "AI")}
                    </div>
                    <div>{msg.role === "assistant" ? <RichText text={msg.content} /> : msg.content}</div>
                  </div>
                ))
              )}
              {chatLoading ? <p className="helper">{t("Pensando...", "Thinking...")}</p> : null}
              {chatError ? <p className="notice">{chatError}</p> : null}
            </div>
          </div>
          <div className="side-panel-footer">
            <textarea
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              placeholder={t("Escribe tu pregunta...", "Type your question...")}
            />
            <button
              className="btn btn-primary btn-ai"
              type="button"
              onClick={handleChatSend}
              disabled={chatLoading || !chatItem || !chatInput.trim()}
            >
              {chatLoading ? t("Enviando...", "Sending...") : t("Enviar", "Send")}
            </button>
          </div>
        </aside>
      </Portal>
      {treeOpen ? (
        <Portal>
          <div className="tree-overlay" onClick={() => setTreeOpen(false)}>
            <div className="tree-panel" onClick={(e) => e.stopPropagation()}>
              <div className="tree-panel-header">
                <div>
                  <div className="badge">{t("Vista árbol", "Tree view")}</div>
                  <h3>{data?.project?.name || t("Proyecto", "Project")}</h3>
                  <p className="helper">
                    {t(
                      "Explora el proyecto expandiendo nodos (clic). Puedes abrir detalles haciendo clic en cada elemento.",
                      "Explore the project by expanding nodes (click). Open details by clicking each item.",
                    )}
                  </p>
                </div>
                <button className="btn btn-ghost" type="button" onClick={() => setTreeOpen(false)}>
                  {t("Cerrar", "Close")}
                </button>
              </div>
              <div className="tree-panel-body">
                {renderTree(epicGroups)}
              </div>
            </div>
          </div>
        </Portal>
      ) : null}
      {showUnassignedInline && unassignedUserStories.length > 0 ? (
        <div className="card" style={{ margin: "16px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <div className="badge danger">{t("US sin feature", "US without feature")}</div>
              <p className="helper" style={{ margin: 0 }}>
                {t(
                  "Reasigna cada US a una feature. No se abre modal, se actualiza en línea.",
                  "Reassign each US to a feature. Inline update without modal.",
                )}
              </p>
            </div>
            <button className="btn btn-ghost" type="button" onClick={() => setShowUnassignedInline(false)}>
              {t("Cerrar sección", "Close section")}
            </button>
          </div>
          <div className="stack" style={{ marginTop: "10px" }}>
            {unassignedUserStories.map((us) => (
              <div key={us.id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ minWidth: "240px" }}>
                    <div className="badge danger">{us.external_id}</div>
                    <h4>{us.title}</h4>
                    <p className="helper">{us.description || t("Sin descripción", "No description")}</p>
                  </div>
                  <div style={{ minWidth: "260px", flex: 1 }}>
                    <label className="helper">{t("Asignar a feature", "Assign to feature")}</label>
                    <select
                      className="input"
                      defaultValue=""
                      onChange={(event) => handleReassignOrphan(us.id, event.target.value)}
                    >
                      <option value="">{t("Elige una feature", "Choose a feature")}</option>
                      {allStoryOptions.map((story) => (
                        <option key={story.id} value={story.id}>
                          {story.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <Portal>
        <div className="toast-container" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              <div className="toast-content">
                {toast.type === "loading" ? <span className="spinner" aria-hidden="true" /> : null}
                <span>{toast.message}</span>
              </div>
              <button
                className="btn btn-ghost"
                type="button"
                aria-label={t("Cerrar notificación", "Close notification")}
                onClick={() => removeToast(toast.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </Portal>
      <footer className="footer">{t("Req2Backlog AI · Proyecto", "Req2Backlog AI · Project")}</footer>
    </div>
  );
}
