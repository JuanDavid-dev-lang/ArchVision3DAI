import type { Metadata } from "next";
import { RoleAssignmentView } from "@/components/team/role-assignment-view";

export const metadata: Metadata = {
  title: "Equipo y Roles - ArchVision 3D AI",
  description: "Asignación de roles y responsabilidades del equipo de ArchVision 3D AI",
};

export default function TeamRolesPage() {
  return (
    <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
      <RoleAssignmentView />
    </main>
  );
}
