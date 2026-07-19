import { Loader2, Search } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
	value: string;
	onChange: (v: string) => void;
	onSearch: () => void;
	placeholder?: string;
	isSearching?: boolean;
}

export const AdminSearchBar: React.FC<Props> = ({
	value,
	onChange,
	onSearch,
	placeholder = "Search by name or email",
	isSearching = false,
}) => {
	return (
		<div className="flex items-center gap-2">
			<Input
				placeholder={placeholder}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => e.key === "Enter" && onSearch()}
			/>
			<Button onClick={onSearch} disabled={isSearching}>
				{isSearching ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					<Search className="h-4 w-4" />
				)}
				<span className="ml-2">Search</span>
			</Button>
		</div>
	);
};
