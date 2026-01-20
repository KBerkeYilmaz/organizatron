import { AppSidebar } from "~/components/app-sidebar";
import { TimerProvider } from "~/components/timer-provider";
import { SidebarInset, SidebarProvider } from "~/components/ui/sidebar";

export default function DashboardLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <TimerProvider>
        <AppSidebar />
        <SidebarInset className="flex h-screen flex-col overflow-hidden">
          {children}
          {modal}
        </SidebarInset>
      </TimerProvider>
    </SidebarProvider>
  );
}
