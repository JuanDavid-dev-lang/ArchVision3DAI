"use client";

import React, { useState, useMemo } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Filter,
  Grid,
  Info,
  LayoutGrid,
  ListFilter,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Table,
  UserCheck,
  Users,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Definición de Roles del Proyecto ArchVision 3D AI
export type RoleType =
  | "Backend"
  | "Frontend"
  | "Desarrollo de IA"
  | "Documentación";

export const AVAILABLE_ROLES: {
  id: RoleType;
  label: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeBg: string;
}[] = [
  {
    id: "Backend",
    label: "Backend",
    description: "Servicios API, Base de datos Prisma, Autenticación y Arquitectura server-side.",
    color: "text-emerald-400 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
    badgeBg: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  {
    id: "Frontend",
    label: "Frontend",
    description: "Interfaz Next.js, Visualización Three.js 3D, UX/UI y diseño responsivo.",
    color: "text-cyan-400 dark:text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/30",
    badgeBg: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  },
  {
    id: "Desarrollo de IA",
    label: "Desarrollo de IA",
    description: "Modelos generativos 3D, SDK Anthropic/Antigravity y visión por computador.",
    color: "text-purple-400 dark:text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
    badgeBg: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  },
  {
    id: "Documentación",
    label: "Documentación",
    description: "Manuales técnicos, especificaciones de arquitectura, guías y entrega de entregables.",
    color: "text-amber-400 dark:text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    badgeBg: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
];

export interface TeamMember {
  id: string;
  name: string;
  title?: string; // Cargo especial como Docente de apoyo o Coordinadora
  roles: RoleType[];
  avatarGradient: string;
}

// Integrantes oficiales del proyecto ArchVision 3D AI
const INITIAL_MEMBERS: TeamMember[] = [
  {
    id: "1",
    name: "Diego Alexander Cruz Melo",
    title: "Docente de apoyo",
    roles: ["Documentación"],
    avatarGradient: "from-blue-600 to-indigo-600",
  },
  {
    id: "2",
    name: "Jasbeith Andrea Prada",
    title: "Coordinadora del proyecto",
    roles: ["Desarrollo de IA", "Documentación"],
    avatarGradient: "from-purple-600 to-pink-600",
  },
  {
    id: "3",
    name: "Juan David Gomez Vargas",
    roles: ["Backend", "Desarrollo de IA"],
    avatarGradient: "from-cyan-600 to-teal-600",
  },
  {
    id: "4",
    name: "Diego Alejandro Mojica Guevara",
    roles: ["Frontend", "Desarrollo de IA"],
    avatarGradient: "from-emerald-600 to-green-600",
  },
  {
    id: "5",
    name: "Julian Hernando Perez Villamizar",
    roles: ["Backend", "Frontend"],
    avatarGradient: "from-orange-600 to-amber-600",
  },
  {
    id: "6",
    name: "Miguel Leonardo Guerra Díaz",
    roles: ["Backend", "Documentación"],
    avatarGradient: "from-rose-600 to-red-600",
  },
  {
    id: "7",
    name: "Brayan Snayder Vargas Reyes",
    roles: ["Frontend", "Desarrollo de IA"],
    avatarGradient: "from-violet-600 to-fuchsia-600",
  },
];

const MAX_ROLES_PER_PERSON = 3;

export function RoleAssignmentView() {
  const [members, setMembers] = useState<TeamMember[]>(INITIAL_MEMBERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "matrix">("grid");
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Toggle rol para una persona con validación del límite de 3
  const handleToggleRole = (memberId: string, role: RoleType) => {
    setWarningMessage(null);
    setMembers((prevMembers) =>
      prevMembers.map((member) => {
        if (member.id !== memberId) return member;

        const hasRole = member.roles.includes(role);

        if (hasRole) {
          // Remover rol
          return {
            ...member,
            roles: member.roles.filter((r) => r !== role),
          };
        } else {
          // Intentar agregar rol -> verificar límite de 3
          if (member.roles.length >= MAX_ROLES_PER_PERSON) {
            setWarningMessage(
              `⚠️ Restricción superada: "${member.name}" ya tiene asignado el máximo permitido de ${MAX_ROLES_PER_PERSON} roles. Desmarca un rol antes de asignar uno nuevo.`
            );
            return member;
          }
          return {
            ...member,
            roles: [...member.roles, role],
          };
        }
      })
    );
  };

  // Restablecer a la asignación inicial
  const handleReset = () => {
    setMembers(INITIAL_MEMBERS);
    setWarningMessage(null);
  };

  // Balancear o sugerir asignación automática de ejemplo
  const handleAutoBalance = () => {
    setMembers([
      {
        id: "1",
        name: "Diego Alexander Cruz Melo",
        title: "Docente de apoyo",
        roles: ["Documentación"],
        avatarGradient: "from-blue-600 to-indigo-600",
      },
      {
        id: "2",
        name: "Jasbeith Andrea Prada",
        title: "Coordinadora del proyecto",
        roles: ["Desarrollo de IA", "Documentación"],
        avatarGradient: "from-purple-600 to-pink-600",
      },
      {
        id: "3",
        name: "Juan David Gomez Vargas",
        roles: ["Backend", "Desarrollo de IA", "Documentación"],
        avatarGradient: "from-cyan-600 to-teal-600",
      },
      {
        id: "4",
        name: "Diego Alejandro Mojica Guevara",
        roles: ["Frontend", "Desarrollo de IA", "Backend"],
        avatarGradient: "from-emerald-600 to-green-600",
      },
      {
        id: "5",
        name: "Julian Hernando Perez Villamizar",
        roles: ["Backend", "Frontend", "Documentación"],
        avatarGradient: "from-orange-600 to-amber-600",
      },
      {
        id: "6",
        name: "Miguel Leonardo Guerra Díaz",
        roles: ["Backend", "Frontend", "Documentación"],
        avatarGradient: "from-rose-600 to-red-600",
      },
      {
        id: "7",
        name: "Brayan Snayder Vargas Reyes",
        roles: ["Frontend", "Desarrollo de IA", "Backend"],
        avatarGradient: "from-violet-600 to-fuchsia-600",
      },
    ]);
    setWarningMessage(null);
  };

  // Copiar resumen al portapapeles
  const handleCopySummary = () => {
    let summaryText = `📋 *Asignación de Roles - ArchVision 3D AI*\n\n`;
    members.forEach((m) => {
      const cargo = m.title ? ` (${m.title})` : "";
      const rolesStr =
        m.roles.length > 0 ? m.roles.join(", ") : "Sin roles asignados";
      summaryText += `• *${m.name}*${cargo}: ${rolesStr} (${m.roles.length}/3)\n`;
    });
    navigator.clipboard.writeText(summaryText);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 3000);
  };

  // Descargar informe JSON
  const handleDownloadJSON = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(members, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "archvision_roles_assignment.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filtrado de integrantes
  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const matchesSearch =
        member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (member.title &&
          member.title.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRole =
        selectedRoleFilter === "ALL" ||
        member.roles.includes(selectedRoleFilter as RoleType);

      return matchesSearch && matchesRole;
    });
  }, [members, searchQuery, selectedRoleFilter]);

  // Estadísticas globales
  const stats = useMemo(() => {
    const roleCounts: Record<RoleType, number> = {
      Backend: 0,
      Frontend: 0,
      "Desarrollo de IA": 0,
      Documentación: 0,
    };

    let totalAssignedRoles = 0;
    let fullCapacityMembersCount = 0;

    members.forEach((m) => {
      totalAssignedRoles += m.roles.length;
      if (m.roles.length === MAX_ROLES_PER_PERSON) {
        fullCapacityMembersCount++;
      }
      m.roles.forEach((r) => {
        if (roleCounts[r] !== undefined) {
          roleCounts[r]++;
        }
      });
    });

    const maxTotalCapacity = members.length * MAX_ROLES_PER_PERSON;

    return {
      roleCounts,
      totalAssignedRoles,
      maxTotalCapacity,
      fullCapacityMembersCount,
    };
  }, [members]);

  return (
    <div className="space-y-8 pb-16">
      {/* Encabezado Blueprint con Identidad de ArchVision 3D AI */}
      <div className="relative overflow-hidden rounded-xl border border-line bg-surface p-6 sm:p-8 blueprint-grid">
        <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 border border-accent/20 px-3 py-1 text-xs font-semibold text-accent">
              <Sparkles className="size-3.5" />
              <span>Proyecto ArchVision 3D AI</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
              Gestión y Asignación de Roles
            </h1>
            <p className="text-sm text-ink-muted max-w-2xl">
              Configura la responsabilidad técnica de cada integrante del equipo. Cada participante puede tener asignados{" "}
              <strong className="text-accent font-semibold">máximo 3 roles</strong> en simultáneo.
            </p>
          </div>

          {/* Acciones Rápidas */}
          <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
            <button
              onClick={handleCopySummary}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-medium text-ink hover:bg-surface-3 transition-colors cursor-pointer"
              title="Copiar asignación al portapapeles"
            >
              {copiedNotification ? (
                <>
                  <Check className="size-3.5 text-ok" />
                  <span className="text-ok">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3.5" />
                  <span>Copiar Resumen</span>
                </>
              )}
            </button>

            <button
              onClick={handleDownloadJSON}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-medium text-ink hover:bg-surface-3 transition-colors cursor-pointer"
              title="Descargar datos en formato JSON"
            >
              <Download className="size-3.5" />
              <span>Exportar JSON</span>
            </button>

            <button
              onClick={handleAutoBalance}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/20 transition-colors cursor-pointer"
              title="Cargar propuesta equilibrada"
            >
              <Wand2 className="size-3.5" />
              <span>Propuesta Sugerida</span>
            </button>

            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs font-medium text-ink-muted hover:text-ink hover:bg-surface-3 transition-colors cursor-pointer"
              title="Restablecer asignaciones"
            >
              <RotateCcw className="size-3.5" />
              <span>Restablecer</span>
            </button>
          </div>
        </div>
      </div>

      {/* Alerta de restricción alcanzada */}
      {warningMessage && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger animate-in fade-in slide-in-from-top-2 duration-200">
          <ShieldAlert className="size-5 shrink-0 text-danger mt-0.5" />
          <div className="flex-1 font-medium">{warningMessage}</div>
          <button
            onClick={() => setWarningMessage(null)}
            className="text-xs text-danger/80 hover:text-danger underline font-semibold cursor-pointer"
          >
            Entendido
          </button>
        </div>
      )}

      {/* Métricas y Distribución de Roles */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AVAILABLE_ROLES.map((role) => {
          const count = stats.roleCounts[role.id];
          const isFilterActive = selectedRoleFilter === role.id;

          return (
            <div
              key={role.id}
              onClick={() =>
                setSelectedRoleFilter(isFilterActive ? "ALL" : role.id)
              }
              className={cn(
                "group relative cursor-pointer overflow-hidden rounded-xl border p-4 transition-all duration-200 hover:shadow-md",
                isFilterActive
                  ? "border-accent bg-accent/5 ring-1 ring-accent"
                  : "border-line bg-surface hover:border-line-strong"
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded border",
                    role.badgeBg
                  )}
                >
                  {role.label}
                </span>
                <span className="text-2xl font-bold text-ink">{count}</span>
              </div>
              <p className="mt-3 text-xs text-ink-muted line-clamp-2">
                {role.description}
              </p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-ink-subtle">
                <span>
                  {Math.round((count / members.length) * 100)}% del equipo
                </span>
                <span className="group-hover:text-accent transition-colors font-medium">
                  {isFilterActive ? "Ver todos" : "Filtrar integrantes →"}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Barra de Filtros, Búsqueda y Switch de Vista */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-line bg-surface p-4">
        {/* Búsqueda */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por integrante o cargo..."
            className="w-full rounded-lg border border-line bg-surface-2 pl-9 pr-4 py-2 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors"
          />
        </div>

        {/* Filtros por Rol & Vistas */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedRoleFilter("ALL")}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                selectedRoleFilter === "ALL"
                  ? "bg-accent text-accent-ink"
                  : "bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
              )}
            >
              Todos ({members.length})
            </button>
            {AVAILABLE_ROLES.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoleFilter(r.id)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer",
                  selectedRoleFilter === r.id
                    ? "bg-accent text-accent-ink"
                    : "bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink"
                )}
              >
                {r.label} ({stats.roleCounts[r.id]})
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-line hidden sm:block" />

          {/* Toggle de Vistas: Tarjetas vs Matriz */}
          <div className="inline-flex rounded-lg border border-line bg-surface-2 p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "grid"
                  ? "bg-surface text-accent shadow-xs"
                  : "text-ink-muted hover:text-ink"
              )}
              title="Vista en Tarjetas"
            >
              <LayoutGrid className="size-3.5" />
              <span>Tarjetas</span>
            </button>
            <button
              onClick={() => setViewMode("matrix")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "matrix"
                  ? "bg-surface text-accent shadow-xs"
                  : "text-ink-muted hover:text-ink"
              )}
              title="Vista en Matriz Técnica"
            >
              <Table className="size-3.5" />
              <span>Matriz</span>
            </button>
          </div>
        </div>
      </div>

      {/* Contenido Principal: Tarjetas Grid o Matriz */}
      {filteredMembers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-surface p-12 text-center">
          <Users className="mx-auto size-10 text-ink-subtle/50" />
          <h3 className="mt-3 text-base font-semibold text-ink">
            No se encontraron integrantes
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            Intenta cambiar los términos de búsqueda o borra el filtro de roles activado.
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setSelectedRoleFilter("ALL");
            }}
            className="mt-4 rounded-lg bg-surface-2 px-4 py-2 text-xs font-medium text-ink hover:bg-surface-3 cursor-pointer"
          >
            Limpiar filtros
          </button>
        </div>
      ) : viewMode === "grid" ? (
        /* VISTA TARJETAS */
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMembers.map((member) => {
            const roleCount = member.roles.length;
            const isFull = roleCount >= MAX_ROLES_PER_PERSON;

            return (
              <div
                key={member.id}
                className={cn(
                  "flex flex-col justify-between rounded-xl border bg-surface p-6 transition-all duration-200 hover:shadow-lg",
                  isFull ? "border-line-strong/80" : "border-line"
                )}
              >
                <div>
                  {/* Avatar y Encabezado de Integrante */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "flex size-11 items-center justify-center rounded-xl bg-gradient-to-br text-white font-bold text-base shadow-sm shrink-0",
                          member.avatarGradient
                        )}
                      >
                        {member.name
                          .split(" ")
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-ink truncate text-base">
                          {member.name}
                        </h3>
                        {member.title ? (
                          <span className="inline-block rounded bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent mt-0.5">
                            {member.title}
                          </span>
                        ) : (
                          <span className="text-xs text-ink-subtle">
                            Desarrollador / Integrante
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contador y Barra de Capacidad de Roles (Máx 3) */}
                  <div className="mt-5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-muted">
                        Roles asignados
                      </span>
                      <span
                        className={cn(
                          "font-mono font-semibold text-xs",
                          isFull
                            ? "text-warn"
                            : roleCount > 0
                            ? "text-accent"
                            : "text-ink-subtle"
                        )}
                      >
                        {roleCount} / {MAX_ROLES_PER_PERSON} máx.
                      </span>
                    </div>

                    {/* Indicador de barra de capacidad (3 segmentos) */}
                    <div className="grid grid-cols-3 gap-1.5 h-1.5 w-full">
                      {[1, 2, 3].map((step) => (
                        <div
                          key={step}
                          className={cn(
                            "rounded-full transition-colors",
                            step <= roleCount
                              ? isFull
                                ? "bg-warn"
                                : "bg-accent"
                              : "bg-surface-3"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Badges de Roles Asignados Actualmente */}
                  <div className="mt-4 flex flex-wrap gap-1.5 min-h-[32px]">
                    {member.roles.length === 0 ? (
                      <span className="text-xs text-ink-subtle italic">
                        Sin roles asignados (haz clic abajo)
                      </span>
                    ) : (
                      member.roles.map((roleId) => {
                        const rInfo = AVAILABLE_ROLES.find(
                          (r) => r.id === roleId
                        );
                        return (
                          <span
                            key={roleId}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold border",
                              rInfo?.badgeBg ?? "bg-surface-2 text-ink"
                            )}
                          >
                            <Check className="size-3" />
                            {roleId}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Selector Interactivo de Roles (Chips Seleccionables) */}
                <div className="mt-6 border-t border-line pt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle mb-2.5">
                    Selección de roles:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_ROLES.map((role) => {
                      const isSelected = member.roles.includes(role.id);
                      const isBlocked =
                        !isSelected && roleCount >= MAX_ROLES_PER_PERSON;

                      return (
                        <button
                          key={role.id}
                          onClick={() =>
                            handleToggleRole(member.id, role.id)
                          }
                          disabled={isBlocked}
                          className={cn(
                            "group flex items-center justify-between rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left cursor-pointer",
                            isSelected
                              ? "border-accent/60 bg-accent/15 text-accent font-semibold shadow-xs"
                              : isBlocked
                              ? "cursor-not-allowed border-line/40 bg-surface-2/40 text-ink-subtle/50 opacity-60"
                              : "border-line bg-surface-2 text-ink-muted hover:border-line-strong hover:bg-surface-3 hover:text-ink"
                          )}
                          title={
                            isBlocked
                              ? `Límite alcanzado (${MAX_ROLES_PER_PERSON} roles máx.)`
                              : `Hacer clic para ${isSelected ? "remover" : "asignar"} ${role.label}`
                          }
                        >
                          <span className="truncate">{role.label}</span>
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded border transition-colors ml-1",
                              isSelected
                                ? "border-accent bg-accent text-accent-ink"
                                : "border-line bg-surface"
                            )}
                          >
                            {isSelected && <Check className="size-3" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA MATRIZ TÉCNICA */
        <div className="overflow-x-auto rounded-xl border border-line bg-surface shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface-2/70 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              <tr>
                <th scope="col" className="px-6 py-4">
                  Integrante del Equipo
                </th>
                <th scope="col" className="px-4 py-4 text-center">
                  Carga (Máx 3)
                </th>
                {AVAILABLE_ROLES.map((role) => (
                  <th
                    key={role.id}
                    scope="col"
                    className="px-4 py-4 text-center"
                  >
                    <span
                      className={cn(
                        "inline-block rounded px-2 py-0.5 text-xs font-semibold border",
                        role.badgeBg
                      )}
                    >
                      {role.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredMembers.map((member) => {
                const roleCount = member.roles.length;
                const isFull = roleCount >= MAX_ROLES_PER_PERSON;

                return (
                  <tr
                    key={member.id}
                    className="hover:bg-surface-2/40 transition-colors"
                  >
                    {/* Nombre y Cargo */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex size-9 items-center justify-center rounded-lg bg-gradient-to-br text-white font-bold text-xs shadow-xs shrink-0",
                            member.avatarGradient
                          )}
                        >
                          {member.name
                            .split(" ")
                            .slice(0, 2)
                            .map((n) => n[0])
                            .join("")}
                        </div>
                        <div>
                          <div className="font-semibold text-ink text-sm">
                            {member.name}
                          </div>
                          {member.title ? (
                            <div className="text-xs font-medium text-accent">
                              {member.title}
                            </div>
                          ) : (
                            <div className="text-xs text-ink-subtle">
                              Integrante
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Capacidad */}
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-mono font-semibold border",
                          isFull
                            ? "bg-warn/15 text-warn border-warn/30"
                            : roleCount > 0
                            ? "bg-accent/15 text-accent border-accent/30"
                            : "bg-surface-3 text-ink-subtle border-line"
                        )}
                      >
                        {roleCount} / 3
                      </span>
                    </td>

                    {/* Checklist por cada rol */}
                    {AVAILABLE_ROLES.map((role) => {
                      const isSelected = member.roles.includes(role.id);
                      const isBlocked =
                        !isSelected && roleCount >= MAX_ROLES_PER_PERSON;

                      return (
                        <td
                          key={role.id}
                          className="px-4 py-4 text-center whitespace-nowrap"
                        >
                          <button
                            onClick={() =>
                              handleToggleRole(member.id, role.id)
                            }
                            disabled={isBlocked}
                            className={cn(
                              "mx-auto flex size-8 items-center justify-center rounded-lg border transition-all cursor-pointer",
                              isSelected
                                ? "border-accent bg-accent text-accent-ink shadow-xs hover:bg-accent/90"
                                : isBlocked
                                ? "cursor-not-allowed border-line/30 bg-surface-3/30 text-ink-subtle/30 opacity-40"
                                : "border-line bg-surface-2 text-transparent hover:border-line-strong hover:bg-surface-3 hover:text-ink-subtle"
                            )}
                            title={
                              isSelected
                                ? `Remover rol ${role.label}`
                                : isBlocked
                                ? `Límite de 3 roles alcanzado`
                                : `Asignar rol ${role.label}`
                            }
                          >
                            <Check className="size-4" />
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pie con Resumen de Regla de Negocio */}
      <div className="flex flex-col sm:flex-row items-center justify-between rounded-xl border border-line bg-surface p-4 text-xs text-ink-muted gap-2">
        <div className="flex items-center gap-2">
          <Info className="size-4 text-accent shrink-0" />
          <span>
            <strong>Regla de Asignación:</strong> Máximo 3 roles asignables por persona para garantizar un rendimiento óptimo en el desarrollo de ArchVision 3D AI.
          </span>
        </div>
        <div className="font-mono text-ink-subtle whitespace-nowrap">
          Carga Total del Equipo: {stats.totalAssignedRoles} / {stats.maxTotalCapacity} asignaciones
        </div>
      </div>
    </div>
  );
}
