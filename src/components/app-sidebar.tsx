"use client";

import { useState } from "react";
import {
  Calendar,
  ChevronUp,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Settings,
  Sparkles,
  Timer,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useSession, signOut } from "~/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "~/components/ui/sidebar";
import { AIAssistantDrawer } from "~/components/ai-assistant-drawer";
import { AIGoalBreakdown } from "~/components/ai-goal-breakdown";
import { AIProjectPlanner } from "~/components/ai-project-planner";
import { api } from "~/trpc/react";

const navigation = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: ListTodo,
  },
  {
    title: "Projects",
    href: "/projects",
    icon: FolderKanban,
  },
  {
    title: "Time Entries",
    href: "/time-entries",
    icon: Timer,
  },
  {
    title: "Calendar",
    href: "/calendar",
    icon: Calendar,
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [goalBreakdownOpen, setGoalBreakdownOpen] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);

  const { data: recentProject } = api.project.getMostRecentlyActive.useQuery();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    router.refresh();
  };

  // Get user display info
  const user = session?.user;
  const userEmail = user?.email ?? "";
  const userName = user?.name ?? user?.email?.split("@")[0] ?? "User";
  const userAvatar = user?.image;
  const userInitials = userName
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-[65px] justify-center border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              size="lg"
              tooltip="Organizatron"
              className="hover:bg-transparent active:bg-transparent data-[state=open]:hover:bg-transparent"
            >
              <Link href="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary">
                  <Timer className="size-4 text-primary-foreground" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Organizatron</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Task & Time Tracker
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                      <Link href={item.href}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="AI Assistant"
              onClick={() => setAiDrawerOpen(true)}
              className="text-primary hover:text-primary"
            >
              <Sparkles />
              <span>AI Assistant</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href="/settings">
                <Settings />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarSeparator />

        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={`${userName} - ${userEmail}`}
                >
                  <Avatar className="size-8 rounded-lg">
                    {userAvatar && <AvatarImage src={userAvatar} alt={userName} />}
                    <AvatarFallback className="rounded-lg bg-primary/10 text-xs font-medium text-primary">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{userName}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                  <ChevronUp className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="end"
                sideOffset={4}
                className="w-56"
              >
                <DropdownMenuItem>
                  <User className="mr-2 size-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <AIAssistantDrawer
        open={aiDrawerOpen}
        onOpenChange={setAiDrawerOpen}
        onGoalBreakdown={() => {
          setAiDrawerOpen(false);
          setGoalBreakdownOpen(true);
        }}
        onProjectPlanner={() => {
          if (recentProject) {
            setAiDrawerOpen(false);
            setPlannerOpen(true);
          } else {
            void router.push("/projects");
          }
        }}
      />

      <AIGoalBreakdown
        open={goalBreakdownOpen}
        onOpenChange={setGoalBreakdownOpen}
      />

      {recentProject && (
        <AIProjectPlanner
          open={plannerOpen}
          onOpenChange={setPlannerOpen}
          projectId={recentProject.id}
          projectName={recentProject.name}
        />
      )}
    </Sidebar>
  );
}
