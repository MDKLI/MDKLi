import {
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DataTablePagination } from "@/components/data-table";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { type User, usersColumns } from "./users-columns";

export function UsersTable() {
	const [data, setData] = useState<User[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [rowSelection, setRowSelection] = useState({});
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [sorting, setSorting] = useState<SortingState>([]);
	const [globalFilter, setGlobalFilter] = useState("");

	useEffect(() => {
		type ApiUser = {
			id: string;
			email: string;
			full_name?: string;
			role: string;
			is_suspended?: boolean;
			deleted_at?: string | null;
		};

		const fetchUsers = async () => {
			try {
				const response = await api<ApiUser[]>("/admin/users", {
					method: "GET",
				});
				if (response.data) {
					const mappedData = response.data.map((user: ApiUser) => ({
						id: user.id,
						username: user.email?.split("@")[0] || "unknown",
						name: user.full_name || user.email || "Unknown",
						email: user.email,
						role: user.role,
						status: user.is_suspended
							? "suspended"
							: user.deleted_at
								? "deleted"
								: "active",
						avatar: "/placeholder-user.jpg",
					}));
					setData(mappedData);
				} else {
					toast.error(response.error || "Failed to fetch users");
				}
			} catch {
				toast.error("Failed to fetch users");
			} finally {
				setIsLoading(false);
			}
		};
		fetchUsers();
	}, []);

	const table = useReactTable({
		data,
		columns: usersColumns,
		state: {
			sorting,
			columnVisibility,
			rowSelection,
			globalFilter,
		},
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		getPaginationRowModel: getPaginationRowModel(),
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		globalFilterFn: (row, id, value) => {
			return String(row.getValue(id))
				.toLowerCase()
				.includes(value.toLowerCase());
		},
	});

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col gap-4">
			<div className="flex items-center gap-4">
				<Input
					placeholder="Filter users..."
					value={globalFilter}
					onChange={(event) => setGlobalFilter(event.target.value)}
					className="max-w-sm"
				/>
				<div className="flex gap-2">
					<select
						className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						onChange={(e) =>
							table
								.getColumn("status")
								?.setFilterValue(e.target.value || undefined)
						}
					>
						<option value="">All Status</option>
						<option value="active">Active</option>
						<option value="pending">Pending</option>
						<option value="verified">Verified</option>
						<option value="suspended">Suspended</option>
					</select>
					<select
						className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
						onChange={(e) =>
							table
								.getColumn("role")
								?.setFilterValue(e.target.value || undefined)
						}
					>
						<option value="">All Roles</option>
						<option value="patient">Patient</option>
						<option value="doctor">Doctor</option>
						<option value="clinic_admin">Clinic Admin</option>
						<option value="pharmacy_admin">Pharmacy Admin</option>
						<option value="admin">Admin</option>
						<option value="superadmin">Super Admin</option>
					</select>
				</div>
			</div>
			<div className="overflow-hidden rounded-md border">
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="group/row">
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										colSpan={header.colSpan}
										className={cn(
											"bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted",
											header.column.columnDef.meta?.className,
											header.column.columnDef.meta?.thClassName,
										)}
									>
										{header.isPlaceholder
											? null
											: flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow
									key={row.id}
									data-state={row.getIsSelected() && "selected"}
									className="group/row"
								>
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											className={cn(
												"bg-background group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted",
												cell.column.columnDef.meta?.className,
												cell.column.columnDef.meta?.tdClassName,
											)}
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={usersColumns.length}
									className="h-24 text-center"
								>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
			<DataTablePagination table={table} className="mt-auto" />
		</div>
	);
}
