import express, { Response } from 'express';
import { AuthRequest, verifyToken, requireAdmin } from '../middleware/auth.js';
import { sendApprovalEmail, sendDenialEmail } from '../services/email.js';
import { encrypt, decrypt, isEncrypted } from '../services/encryption.js';
import { supabaseAdmin } from '../config/supabase.js';
import { paymentLimiter, emailLimiter } from '../middleware/rateLimiter.js';
import { logAuditAction } from '../services/auditLog.js';

const router = express.Router();

// @route   POST /api/payments/submit
// @desc    Submit payment proof with encryption
// @access  Authenticated users
router.post('/submit', paymentLimiter, verifyToken, async (req: AuthRequest, res: Response) => {
  try {
    const { payment_type, proof } = req.body;

    if (!payment_type || !proof) {
      return res.status(400).json({ error: 'Payment type and proof are required' });
    }

    if (!['crypto', 'giftcard'].includes(payment_type)) {
      return res.status(400).json({ error: 'Invalid payment type' });
    }

    // Validate proof length (max 500 characters)
    if (proof.length > 500) {
      return res.status(400).json({ error: 'Payment proof too long (max 500 characters)' });
    }

    // Encrypt the sensitive proof data
    const encryptedProof = encrypt(proof.trim());

    // Insert payment request
    const { error: insertError } = await supabaseAdmin
      .from('payment_requests')
      .insert({
        user_id: req.user!.id,
        payment_type,
        proof: encryptedProof,
        status: 'pending',
      });

    if (insertError) {
      console.error('Payment insert error:', insertError);
      throw insertError;
    }

    // Update user's payment info
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        payment_method: payment_type,
        payment_proof: encryptedProof,
        membership_status: 'pending',
      })
      .eq('id', req.user!.id);

    if (updateError) {
      console.error('User update error:', updateError);
      throw updateError;
    }

    res.json({ message: 'Payment submitted successfully' });
  } catch (error) {
    console.error('Payment submission error:', error);
    res.status(500).json({ error: 'Failed to submit payment' });
  }
});

// @route   GET /api/payments/requests
// @desc    Get payment requests with decrypted proof (admin only)
// @access  Admin
router.get('/requests', verifyToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { data: requests, error } = await supabaseAdmin
      .from('payment_requests')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Decrypt proof data for admin view
    const decryptedRequests = requests?.map(request => ({
      ...request,
      proof: isEncrypted(request.proof) ? decrypt(request.proof) : request.proof,
    })) || [];

    res.json(decryptedRequests);
  } catch (error) {
    console.error('Error fetching payment requests:', error);
    res.status(500).json({ error: 'Failed to fetch payment requests' });
  }
});

// @route   POST /api/payments/notify-review
// @desc    Send email notification for payment review
// @access  Admin
router.post('/notify-review', emailLimiter, verifyToken, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { email, status, reason } = req.body;

    if (!email || !status) {
      return res.status(400).json({ error: 'Email and status are required' });
    }

    // Validate status
    if (!['approved', 'denied'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be "approved" or "denied".' });
    }

    // Validate email exists in users table
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('email, id')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(400).json({
        error: 'Email not found. Can only notify registered users.',
      });
    }

    // Validate payment request exists for this user
    const { data: paymentRequest, error: paymentError } = await supabaseAdmin
      .from('payment_requests')
      .select('id, status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (paymentError || !paymentRequest) {
      return res.status(400).json({
        error: 'No payment request found for this user.',
      });
    }

    // Send appropriate email
    if (status === 'approved') {
      await sendApprovalEmail(email);
    } else {
      await sendDenialEmail(email, reason);
    }

    // Log the admin action
    await logAuditAction(
      req.user!.id,
      `payment_${status}`,
      'payment_request',
      req,
      {
        target_user_email: email,
        target_user_id: user.id,
        payment_request_id: paymentRequest.id,
        reason: reason || null,
      },
      paymentRequest.id
    );

    res.json({ message: 'Notification email sent successfully' });
  } catch (error) {
    console.error('Error sending payment notification:', error);
    res.status(500).json({ error: 'Failed to send notification email' });
  }
});

export default router;
