import { app } from "./app";
import { adminRabbitMQConsumer } from "./lib/rabbitmq-consumer";
import { logger } from "./utils/logger";

const PORT = process.env.PORT || 3006;

async function start() {
	await adminRabbitMQConsumer.connect();
	app.listen(PORT, () => {
		logger.info(`admin-service listening on port ${PORT}`);
	});
}

start().catch((error) => {
	logger.error("Failed to start admin-service:", error);
	process.exit(1);
});
