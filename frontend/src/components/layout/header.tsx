import { Search } from "@/components/search";
import { ThemeSwitch } from "@/components/theme-switch";
import { cn } from "@/lib/utils";
interface HeaderProps {
	fixed?: boolean;
	className?: string;
	children?: React.ReactNode;
}
export function Header({ fixed, className, children }: HeaderProps) {
	return (
		<header
			className={cn(
				"flex h-16 items-center gap-3 bg-background px-4 sm:px-6",
				fixed
					? "fixed top-0 z-50 w-svw shadow-sm"
					: "sticky top-0 z-10 border-b",
				className,
			)}
		>
			<div className="ml-auto flex items-center gap-2">
				<Search />
				{/* Settings gear icon removed — theme only */}
				<ThemeSwitch />
			</div>
			{children}
		</header>
	);
}
