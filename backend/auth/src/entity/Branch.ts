import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from "typeorm";
import { User } from "./User";

@Entity("branches")
export class Branch {
	@PrimaryGeneratedColumn("uuid")
	id: string;

	@ManyToOne(
		() => User,
		(user) => user.id,
		{ nullable: false },
	)
	@JoinColumn({ name: "user_id" })
	user: User;

	@Column()
	name: string;

	@Column()
	city: string;

	@Column()
	area: string;

	@Column({ type: "text" })
	address: string;

	@Column({ nullable: true })
	google_maps_url: string;

	@Column("float", { nullable: true })
	latitude: number;

	@Column("float", { nullable: true })
	longitude: number;

	@Column("text", { array: true })
	phone_numbers: string[];

	@Column({ nullable: true })
	consultation_fee: string;

	// Media URLs stored as JSON array
	@Column({ type: "jsonb", nullable: true })
	media_urls: string[];

	@Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
	created_at: Date;

	@Column({
		type: "timestamp",
		default: () => "CURRENT_TIMESTAMP",
		onUpdate: "CURRENT_TIMESTAMP",
	})
	updated_at: Date;
}
