import { create } from "zustand";
import { persist } from "zustand/middleware";

export type WishlistItemType = "doctor" | "pharmacy" | "clinic";

export interface WishlistItem {
	id: string;
	type: WishlistItemType;
	name: string;
	subtitle?: string;
	imageUrl?: string;
	url: string;
	addedAt: string;
}

interface WishlistState {
	items: WishlistItem[];
	addItem: (item: Omit<WishlistItem, "addedAt">) => void;
	removeItem: (id: string) => void;
	isInWishlist: (id: string) => boolean;
	toggleItem: (item: Omit<WishlistItem, "addedAt">) => void;
	getDoctors: () => WishlistItem[];
	getPharmacies: () => WishlistItem[];
	getClinics: () => WishlistItem[];
}

export const useWishlistStore = create<WishlistState>()(
	persist(
		(set, get) => ({
			items: [],

			addItem: (item) => {
				const exists = get().items.find((i) => i.id === item.id);
				if (!exists) {
					set((state) => ({
						items: [
							{ ...item, addedAt: new Date().toISOString() },
							...state.items,
						],
					}));
				}
			},

			removeItem: (id) => {
				set((state) => ({
					items: state.items.filter((i) => i.id !== id),
				}));
			},

			isInWishlist: (id) => {
				return get().items.some((i) => i.id === id);
			},

			toggleItem: (item) => {
				const exists = get().isInWishlist(item.id);
				if (exists) {
					get().removeItem(item.id);
				} else {
					get().addItem(item);
				}
			},

			getDoctors: () => {
				return get().items.filter((i) => i.type === "doctor");
			},

			getPharmacies: () => {
				return get().items.filter((i) => i.type === "pharmacy");
			},

			getClinics: () => {
				return get().items.filter((i) => i.type === "clinic");
			},
		}),
		{
			name: "wishlist-storage",
		},
	),
);
