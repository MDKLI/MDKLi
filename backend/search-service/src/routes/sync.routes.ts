import { Router } from 'express'
import { syncFromAuth, triggerSync, triggerMigrate } from '../controllers/sync.controller'

const router = Router()

// Webhook from auth service
router.post('/webhook', syncFromAuth)

// Manual trigger - sync from search DB to Meilisearch
router.post('/trigger', triggerSync)

// Migrate from auth DB to search DB
router.post('/migrate', triggerMigrate)

export default router
