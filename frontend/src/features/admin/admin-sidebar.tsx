import { Link } from "@tanstack/react-router";
import { LogOut, Search as SearchIcon } from "lucide-react";
import { sidebarData } from "@/components/layout/data/sidebar-data";
import { SignOutDialog } from "@/components/sign-out-dialog";
import { ThemeSwitch } from "@/components/theme-switch";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import useDialogState from "@/hooks/use-dialog-state";

const adminItems =
	sidebarData.navGroups.find((g) => g.title === "Admin")?.items ?? [];

export function AdminSidebar() {
	const [signOutOpen, setSignOutOpen] = useDialogState();

	return (
		<>
			<Sidebar variant="floating" side="left" collapsible="icon">
				<SidebarHeader>
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton size="lg" asChild>
								<Link to="/admin/dashboard">
									<div className="flex aspect-square size-8 items-center justify-center shrink-0">
										<img
											src="/images/logo.png"
											alt="MDKLI"
											className="size-8 object-contain"
										/>
									</div>
									<div className="grid flex-1 text-left text-sm leading-tight overflow-hidden group-data-[collapsible=icon]:hidden">
										<span className="truncate font-semibold whitespace-nowrap">
											MDKLI
										</span>
										<span className="truncate text-xs text-muted-foreground whitespace-nowrap">
											Admin
										</span>
									</div>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarHeader>
				<SidebarContent>
					<SidebarMenu className="gap-1.5 px-2">
						{adminItems.map((item) => {
							const Icon = item.icon;
							return (
								<SidebarMenuItem key={item.title}>
									<SidebarMenuButton
										asChild
										tooltip={item.title}
										className="h-10 text-base"
									>
										<Link to={item.url}>
											{Icon && <Icon className="size-5 shrink-0" />}
											<span className="overflow-hidden whitespace-nowrap group-data-[collapsible=icon]:hidden">
												{item.title}
											</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							);
						})}
					</SidebarMenu>
				</SidebarContent>
				<SidebarFooter>
					<SidebarMenu className="gap-1.5">
						<SidebarMenuItem>
							<SidebarMenuButton
								asChild
								tooltip="Search"
								className="h-10 text-base"
							>
								<Link to="/search">
									<SearchIcon className="size-5 shrink-0" />
									<span className="overflow-hidden whitespace-nowrap group-data-[collapsible=icon]:hidden">
										Search
									</span>
								</Link>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>

					<ThemeSwitch />

					<SidebarMenu className="gap-1.5">
						<SidebarMenuItem>
							<SidebarMenuButton
								tooltip="Logout"
								onClick={() => setSignOutOpen(true)}
								className="h-10 text-base text-destructive hover:text-destructive"
							>
								<LogOut className="size-5 shrink-0" />
								<span className="overflow-hidden whitespace-nowrap group-data-[collapsible=icon]:hidden">
									Logout
								</span>
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>

				<SidebarRail />
			</Sidebar>

			<SignOutDialog open={!!signOutOpen} onOpenChange={setSignOutOpen} />
		</>
	);
}
