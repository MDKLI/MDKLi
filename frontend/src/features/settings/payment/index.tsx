import { ArrowDownToLine, CreditCard, Trash2, Wallet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { walletApi } from "@/lib/api";
import { ContentSection } from "../components/content-section";

type WalletData = Awaited<ReturnType<typeof walletApi.getWallet>>;

function PaymentContent() {
	const [data, setData] = useState<WalletData | null>(null);
	const [loading, setLoading] = useState(true);
	const [showAddCard, setShowAddCard] = useState(false);
	const [cardholderName, setCardholderName] = useState("");
	const [cardNumber, setCardNumber] = useState("");
	const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
	const [withdrawing, setWithdrawing] = useState(false);

	const load = async () => {
		try {
			const wallet = await walletApi.getWallet();
			setData(wallet);
			if (wallet.cards.length && !selectedCardId)
				setSelectedCardId(wallet.cards[0].id);
		} catch {
			toast.error("Could not load wallet");
		} finally {
			setLoading(false);
		}
	};

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally runs once on mount; `load` closes over selectedCardId, and refetching on every card selection would be a behavior change
	useEffect(() => {
		load();
	}, []);

	const handleAddCard = async () => {
		if (!cardholderName || cardNumber.replace(/\s/g, "").length < 12) {
			toast.error("Enter a name and a valid card number");
			return;
		}
		try {
			await walletApi.addCard({ cardholderName, cardNumber });
			toast.success("Payout card added (sandbox)");
			setCardholderName("");
			setCardNumber("");
			setShowAddCard(false);
			load();
		} catch {
			toast.error("Failed to add card");
		}
	};

	const handleRemoveCard = async (id: string) => {
		try {
			await walletApi.removeCard(id);
			toast.success("Card removed");
			load();
		} catch {
			toast.error("Failed to remove card");
		}
	};

	const handleWithdraw = async () => {
		if (!selectedCardId) {
			toast.error("Add a payout card first");
			return;
		}
		setWithdrawing(true);
		try {
			const result = await walletApi.withdraw({ cardId: selectedCardId });
			toast.success(`Withdrew ${data?.balance ?? 0} EGP to card`);
			setData((prev) => (prev ? { ...prev, balance: result.balance } : prev));
			load();
		} catch {
			toast.error("Withdrawal failed");
		} finally {
			setWithdrawing(false);
		}
	};

	if (loading)
		return (
			<div className="p-6 text-sm text-muted-foreground">Loading wallet...</div>
		);
	if (!data) return null;

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Wallet className="h-5 w-5" /> Wallet Balance
						</CardTitle>
						<CardDescription>
							Sandbox demo — 90% of every paid booking is credited here, 10%
							platform fee.
						</CardDescription>
					</div>
					<Badge variant="secondary">Sandbox</Badge>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="text-3xl font-bold">
						{data.balance.toLocaleString()} EGP
					</div>
					<Button
						onClick={handleWithdraw}
						disabled={withdrawing || data.balance <= 0 || !selectedCardId}
					>
						<ArrowDownToLine className="h-4 w-4 mr-2" />
						{withdrawing
							? "Withdrawing..."
							: `Withdraw ${data.balance.toLocaleString()} EGP`}
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<CreditCard className="h-5 w-5" /> Payout Cards
						</CardTitle>
						<CardDescription>
							Fake card numbers only — sandbox demo, no real charges.
						</CardDescription>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setShowAddCard((v) => !v)}
					>
						{showAddCard ? "Cancel" : "Add Card"}
					</Button>
				</CardHeader>
				<CardContent className="space-y-4">
					{showAddCard && (
						<div className="space-y-3 rounded-lg border p-4">
							<div className="space-y-1">
								<Label>Cardholder Name</Label>
								<Input
									value={cardholderName}
									onChange={(e) => setCardholderName(e.target.value)}
									placeholder="John Doe"
								/>
							</div>
							<div className="space-y-1">
								<Label>Card Number (fake, sandbox only)</Label>
								<Input
									value={cardNumber}
									onChange={(e) => setCardNumber(e.target.value)}
									placeholder="4242 4242 4242 4242"
									maxLength={19}
								/>
							</div>
							<Button onClick={handleAddCard}>Save Card</Button>
						</div>
					)}

					{data.cards.length === 0 && !showAddCard && (
						<p className="text-sm text-muted-foreground">
							No payout cards yet. Add one to enable withdrawals.
						</p>
					)}

					{data.cards.map((card) => (
						// biome-ignore lint/a11y/useSemanticElements: can't be a <button> — it contains a nested Button for card removal, and interactive elements can't nest
						<div
							key={card.id}
							role="button"
							tabIndex={0}
							className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer ${selectedCardId === card.id ? "border-primary" : ""}`}
							onClick={() => setSelectedCardId(card.id)}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") {
									e.preventDefault();
									setSelectedCardId(card.id);
								}
							}}
						>
							<div>
								<div className="font-medium">{card.cardholderName}</div>
								<div className="text-sm text-muted-foreground">
									•••• {card.last4}
								</div>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={(e) => {
									e.stopPropagation();
									handleRemoveCard(card.id);
								}}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					))}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Transaction History</CardTitle>
				</CardHeader>
				<CardContent>
					{data.transactions.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No transactions yet.
						</p>
					) : (
						<div className="space-y-2">
							{data.transactions.map((tx) => (
								<div
									key={tx.id}
									className="flex items-center justify-between border-b py-2 text-sm"
								>
									<div>
										<span
											className={
												tx.type === "CREDIT" ? "text-green-600" : "text-red-600"
											}
										>
											{tx.type === "CREDIT" ? "+" : "-"}
											{tx.amount} EGP
										</span>
										<span className="text-muted-foreground ml-2">
											{tx.note}
										</span>
									</div>
									<span className="text-muted-foreground">
										{new Date(tx.createdAt).toLocaleDateString()}
									</span>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

export default function PaymentSettings() {
	return (
		<ContentSection
			title="Payment"
			desc="Manage your wallet balance, payout cards, and withdrawals. Sandbox/demo mode — no real money moves."
		>
			<PaymentContent />
		</ContentSection>
	);
}
