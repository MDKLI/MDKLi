import { prisma } from "../app";

const PLATFORM_CUT_PERCENT = 10;

export const walletService = {
	async getOrCreateWallet(userId: string) {
		let wallet = await prisma.wallet.findUnique({ where: { userId } });
		if (!wallet) wallet = await prisma.wallet.create({ data: { userId } });
		return wallet;
	},

	/** Credits 90% of the gross booking amount to the business's wallet; platform keeps 10%. */
	async creditForAppointment(
		recipientUserId: string,
		grossAmount: number,
		appointmentId: string,
	) {
		const wallet = await this.getOrCreateWallet(recipientUserId);
		const net = Math.round(grossAmount * (1 - PLATFORM_CUT_PERCENT / 100));

		await prisma.$transaction([
			prisma.wallet.update({
				where: { id: wallet.id },
				data: { balance: { increment: net } },
			}),
			prisma.walletTransaction.create({
				data: {
					walletId: wallet.id,
					type: "CREDIT",
					amount: net,
					appointmentId,
					note: `Booking payment (${grossAmount} EGP gross, ${PLATFORM_CUT_PERCENT}% platform fee)`,
				},
			}),
		]);
	},
};
