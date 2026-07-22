import { Outlet } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SkipToMain } from "@/components/skip-to-main";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { LayoutProvider } from "@/context/layout-provider";
import { SearchProvider } from "@/context/search-provider";
import { AdminSidebar } from "@/features/admin/admin-sidebar";
import { getCookie } from "@/lib/cookies";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

type AuthenticatedLayoutProps = {
	children?: React.ReactNode;
};

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
	const defaultOpen = getCookie("sidebar_state") !== "false";
	const { auth } = useAuthStore();
	const hasFetchedProfile = useRef(false);

	useEffect(() => {
		if (auth.isAuthenticated() && auth.user && !hasFetchedProfile.current) {
			hasFetchedProfile.current = true;
			auth.fetchProfile();
		}
	}, [auth.user, auth.fetchProfile, auth.isAuthenticated]);

	const isAdmin =
		auth.user?.role === "admin" || auth.user?.role === "superadmin";

	return (
		<SearchProvider>
			<LayoutProvider>
				<SidebarProvider defaultOpen={defaultOpen}>
					<SkipToMain />
					{isAdmin ? <AdminSidebar /> : <AppSidebar />}
					<SidebarInset
						className={cn(
							"@container/content",
							"has-data-[layout=fixed]:h-svh",
							"peer-data-[variant=inset]:has-data-[layout=fixed]:h-[calc(100svh-(var(--spacing)*4))]",
						)}
					>
						{/* Header removed — no top navbar */}
						{children ?? <Outlet />}
					</SidebarInset>
				</SidebarProvider>
			</LayoutProvider>
		</SearchProvider>
	);
}
