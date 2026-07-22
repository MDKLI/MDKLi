import axios from "axios";
import crypto from "crypto";
import { logger } from "../utils/logger";

const PAYMOB_BASE = "https://accept.paymob.com";

interface BillingData {
	first_name: string;
	last_name: string;
	email: string;
	phone_number: string;
}

class PaymobService {
	/**
	 * Creates a Payment Intention and returns the Unified Checkout URL.
	 * The customer picks card or wallet on Paymob's own hosted page.
	 */
	async createCheckoutIntention(
		amountEGP: number,
		merchantOrderId: string,
		billing: BillingData,
		appointmentId: string,
	) {
		const amountCents = amountEGP * 100;
		const integrationIds = (process.env.PAYMOB_INTEGRATION_IDS || "")
			.split(",")
			.map((id) => Number(id.trim()))
			.filter(Boolean);

		// Client-side redirect only (patient's browser, not Paymob's server) - safe to
		// point at localhost during dev. Swap FRONTEND_URL to the real domain later.
		const redirectionUrl = `${process.env.FRONTEND_URL}/booking/payment-result?appointmentId=${appointmentId}`;

		const { data } = await axios.post(
			`${PAYMOB_BASE}/v1/intention/`,
			{
				amount: amountCents,
				currency: "EGP",
				payment_methods: integrationIds,
				billing_data: {
					first_name: billing.first_name,
					last_name: billing.last_name,
					email: billing.email,
					phone_number: billing.phone_number,
					apartment: "NA",
					floor: "NA",
					street: "NA",
					building: "NA",
					shipping_method: "NA",
					postal_code: "NA",
					city: "NA",
					country: "EG",
					state: "NA",
				},
				extras: { merchant_order_id: merchantOrderId },
				redirection_url: redirectionUrl,
			},
			{
				headers: {
					Authorization: `Token ${process.env.PAYMOB_SECRET_KEY}`,
				},
			},
		);

		const clientSecret = data.client_secret as string;
		const paymobOrderId = String(data.intention_order_id ?? data.id);
		const redirectUrl = `${PAYMOB_BASE}/unifiedcheckout/?publicKey=${process.env.PAYMOB_PUBLIC_KEY}&clientSecret=${clientSecret}`;

		return { paymobOrderId, redirectUrl, clientSecret };
	}

	/** Verifies the HMAC on a transaction webhook callback (same format regardless of intention/legacy flow) */
	verifyHmac(obj: Record<string, any>, receivedHmac: string): boolean {
		const orderedKeys = [
			"amount_cents",
			"created_at",
			"currency",
			"error_occured",
			"has_parent_transaction",
			"id",
			"integration_id",
			"is_3d_secure",
			"is_auth",
			"is_capture",
			"is_refunded",
			"is_standalone_payment",
			"is_voided",
			"order",
			"owner",
			"pending",
			"source_data.pan",
			"source_data.sub_type",
			"source_data.type",
			"success",
		];
		const concatenated = orderedKeys
			.map((k) => {
				const parts = k.split(".");
				const val = parts.length === 2 ? obj.source_data?.[parts[1]] : obj[k];
				return val === undefined || val === null ? "" : String(val);
			})
			.join("");
		const computed = crypto
			.createHmac("sha512", process.env.PAYMOB_HMAC_SECRET!)
			.update(concatenated)
			.digest("hex");
		return computed === receivedHmac;
	}
}

export const paymobService = new PaymobService();
