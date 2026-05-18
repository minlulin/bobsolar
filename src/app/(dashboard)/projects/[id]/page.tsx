import { ProjectDetailShell } from "@/app/(dashboard)/projects/[id]/project-detail-shell";
import { requireAuth } from "@/lib/auth/validate";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ProjectWorkspacePage(props: Props): Promise<React.JSX.Element> {
  const { id } = await props.params;

  const session = await requireAuth();

  return (
    <div className="space-y-4">
      <ProjectDetailShell id={id} userId={session.userId} isAdmin={session.role === "admin"} />
    </div>
  );
}
