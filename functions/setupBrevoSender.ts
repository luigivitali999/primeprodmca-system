import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import nodemailer from 'npm:nodemailer@6.9.7';

const BREVO_SMTP_KEY = Deno.env.get("BREVO_SMTP_KEY");
const FROM_EMAIL = "dmca@myonly.me";
const FROM_NAME = "PRIME DMCA Intelligence";

const transporter = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: FROM_EMAIL,
    pass: BREVO_SMTP_KEY,
  },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" } });
  }

  try {
    const base44 = createClientFromRequest(req);

    console.log(`[BREVO SETUP] Testing SMTP connection for ${FROM_EMAIL}`);
    
    try {
      await transporter.verify();
      console.log(`[BREVO SETUP] SMTP connection verified for ${FROM_EMAIL}`);
      return Response.json({
        success: true,
        message: "SMTP connection verified and ready",
        email: FROM_EMAIL,
        status: "ready",
      });
    } catch (verifyErr) {
      console.error(`[BREVO SETUP] SMTP verification failed: ${verifyErr.message}`);
      return Response.json({
        success: false,
        message: "SMTP connection failed",
        error: verifyErr.message,
        email: FROM_EMAIL,
      }, { status: 500 });
    }
  } catch (error) {
    console.error("[BREVO SETUP] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});