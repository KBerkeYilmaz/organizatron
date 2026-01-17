"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { clients, getProjectsForClient, getTasksForProject } from "~/lib/data/mock";

export function ProjectsOverview() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Clients & Projects</h2>
          <p className="text-sm text-muted-foreground">
            {clients.length} clients
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild className="gap-1">
          <Link href="/projects">
            View all
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        {clients.map((client) => {
          const clientProjects = getProjectsForClient(client.id);

          return (
            <Card
              key={client.id}
              className="group cursor-pointer transition-all duration-200 hover:shadow-md"
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Client icon/logo */}
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
                    style={{ backgroundColor: `${client.color}15` }}
                  >
                    {client.logo}
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
                      {clientProjects.slice(0, 3).map((project) => {
                        const projectTasks = getTasksForProject(project.id);
                        const completedCount = projectTasks.filter(
                          (t) => t.status === "completed"
                        ).length;

                        return (
                          <div
                            key={project.id}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              {project.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {completedCount}/{projectTasks.length} tasks
                            </span>
                          </div>
                        );
                      })}
                      {clientProjects.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{clientProjects.length - 3} more projects
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
