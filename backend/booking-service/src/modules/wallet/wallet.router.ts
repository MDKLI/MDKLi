import { Router } from 'express'
import { prisma } from '../../app'
import { requireAuth, AuthedRequest } from '../../middleware/auth.middleware'
import { walletService } from '../../services/wallet.service'

const router = Router()

// GET /api/v1/wallet - current user's balance, cards, and transaction history
router.get('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.user!.userId
    const wallet = await walletService.getOrCreateWallet(userId)
    const [cards, transactions] = await Promise.all([
      prisma.walletCard.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: 'desc' } }),
      prisma.walletTransaction.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    ])
    res.json({ success: true, data: { balance: wallet.balance, cards, transactions } })
  } catch (error) {
    next(error)
  }
})

// POST /api/v1/wallet/cards - add a mock payout card (fake number, demo only)
router.post('/cards', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.user!.userId
    const { cardholderName, cardNumber } = req.body
    const digits = String(cardNumber || '').replace(/\s/g, '')

    if (!cardholderName || digits.length < 12) {
      res.status(400).json({ error: 'Valid cardholder name and card number are required' })
      return
    }

    const wallet = await walletService.getOrCreateWallet(userId)
    const card = await prisma.walletCard.create({
      data: {
        walletId: wallet.id,
        cardholderName,
        last4: digits.slice(-4),
      },
    })
    res.status(201).json({ success: true, data: card })
  } catch (error) {
    next(error)
  }
})

// DELETE /api/v1/wallet/cards/:id
router.delete('/cards/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.user!.userId
    const wallet = await walletService.getOrCreateWallet(userId)
    const card = await prisma.walletCard.findFirst({ where: { id: req.params.id, walletId: wallet.id } })
    if (!card) {
      res.status(404).json({ error: 'Card not found' })
      return
    }
    await prisma.walletCard.delete({ where: { id: card.id } })
    res.json({ success: true })
  } catch (error) {
    next(error)
  }
})

// POST /api/v1/wallet/withdraw - mock withdrawal to a saved card, drains the wallet balance
router.post('/withdraw', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const userId = req.user!.userId
    const { cardId, amount } = req.body

    const wallet = await walletService.getOrCreateWallet(userId)
    const card = await prisma.walletCard.findFirst({ where: { id: cardId, walletId: wallet.id } })
    if (!card) {
      res.status(400).json({ error: 'Select a valid payout card' })
      return
    }

    const withdrawAmount = amount != null ? Number(amount) : wallet.balance
    if (!withdrawAmount || withdrawAmount <= 0 || withdrawAmount > wallet.balance) {
      res.status(400).json({ error: 'Invalid withdrawal amount' })
      return
    }

    await prisma.$transaction([
      prisma.wallet.update({ where: { id: wallet.id }, data: { balance: { decrement: withdrawAmount } } }),
      prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'WITHDRAWAL',
          amount: withdrawAmount,
          note: `Withdrawn to card ending ${card.last4} (mock/sandbox)`,
        },
      }),
    ])

    const updated = await prisma.wallet.findUnique({ where: { id: wallet.id } })
    res.json({ success: true, data: { balance: updated!.balance } })
  } catch (error) {
    next(error)
  }
})

export { router as walletRoutes }
