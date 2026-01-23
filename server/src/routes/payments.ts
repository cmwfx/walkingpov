import express, { Response } from 'express';
import { AuthRequest, verifyToken, requireAdmin } from '../middleware/auth.js';
import { sendApprovalEmail, sendDenialEmail } from '../services/email.js';

const router = express.Router();

// @route   POST /api/payments/notify-review
// @desc    Send email notification for payment review
// @access  Admin
router.post('/notify-review', verifyToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { email, status, reason } = req.body;

    if (!email || !status) {
      return res.status(400).json({ error: 'Email and status are required' });
    }

    if (status === 'approved') {
      await sendApprovalEmail(email);
    } else if (status === 'denied') {
      await sendDenialEmail(email, reason);
    } else {
      return res.status(400).json({ error: 'Invalid status. Must be "approved" or "denied".' });
    }

    res.json({ message: 'Notification email sent successfully' });
  } catch (error) {
    console.error('Error sending payment notification:', error);
    res.status(500).json({ error: 'Failed to send notification email' });
  }
});

export default router;
