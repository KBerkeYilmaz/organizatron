"use client";

import { ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { api } from "~/trpc/react";

export function ProjectsOverview() {
  const { data: clients, isLoading: clientsLoading } = api.clients.getAll.useQuery();
  const { data: allProjects, isLoading: projectsLoading } = api.project.getAll.useQuery();

  const isLoading = clientsLoading || projectsLoading;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Clients & Projects</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading..." : `${clients?.length ?? 0} clients`}
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link href="/projects">
            View all
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {clients?.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              projects={allProjects?.filter((p) => p.clientId === client.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ClientCard({
  client,
  projects,
}: {
  client: {
    id: string;
    name: string;
    color: string;
    logo: string | null;
  };
  projects: { id: string; name: string; tasks: { id: string; status: string }[] }[] | undefined;
}) {
  return (
    <Card className="group cursor-pointer transition-all duration-200 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Client icon/logo */}
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: `${client.color}15` }}
          >
            {client.logo ?? "📁"}
          </div>

          <div className="flex-1 space-y-2">
            {/* Client name */}
            <div className="flex items-center justify-between">
              <h3 className="font-medium">{client.name}</h3>
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: client.color }}
              />
            </div>

            {/* Projects list */}
            <div className="space-y-1">
              {projects?.slice(0, 3).map((project) => {
                const taskCount = project.tasks?.length ?? 0;
                const completedCount =
                  project.tasks?.filter((t) => t.status === "completed")
                    .length ?? 0;

                return (
                  <div
                    key={project.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-muted-foreground">{project.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {completedCount}/{taskCount} tasks
                    </span>
                  </div>
                );
              })}
              {(projects?.length ?? 0) > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{(projects?.length ?? 0) - 3} more projects
                </span>
              )}
              {projects?.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  No projects yet
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
