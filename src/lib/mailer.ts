/**
 * Nodemailer SMTP transport for sending emails via Hostinger, Gmail, or Custom SMTP.
 * Supports auto-detection of host (e.g., Hostinger vs Gmail).
 */

import nodemailer from "nodemailer";
import type Mail from "nodemailer/lib/mailer";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import fs from "fs";
import path from "path";
import dns from "dns";

// Force IPv4 lookup by default to prevent ENETUNREACH on IPv6-unrouted networks
try {
  dns.setDefaultResultOrder?.("ipv4first");
} catch {
  // Ignore in older Node environments
}

export interface MailCredentials {
  email: string;
  pass: string;
}

/**
 * Fetch and decrypt the SMTP credentials for a given user.
 */
export async function getMailCredentials(userId: string): Promise<MailCredentials> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      smtpEmail: true,
      smtpPassword: true,
    },
  });

  if (!user.smtpEmail || !user.smtpPassword) {
    throw new Error(
      "SMTP not configured — please go to Settings and add your SMTP email address and password"
    );
  }

  const decryptedPassword = decrypt(user.smtpPassword).trim();

  return {
    email: user.smtpEmail.trim().toLowerCase(),
    pass: decryptedPassword,
  };
}

/**
 * Determine target SMTP host (Gmail, Hostinger, or Custom).
 */
export function getSmtpHost(email: string, customHost?: string): string {
  if (customHost && customHost.trim()) {
    return customHost.trim();
  }
  const cleanEmail = email.trim().toLowerCase();
  if (cleanEmail.endsWith("@gmail.com")) {
    return "smtp.gmail.com";
  }
  // Default for Hostinger and custom domain emails (e.g. contact@novixmedia.in)
  return "smtp.hostinger.com";
}

/**
 * Create a Nodemailer transporter for Hostinger, Gmail, or Custom SMTP.
 * Supports port 465 (SSL direct) or port 587 (STARTTLS).
 */
export function createSmtpTransporter(
  email: string,
  pass: string,
  port: number = 465,
  customHost?: string
): nodemailer.Transporter {
  const host = getSmtpHost(email, customHost);
  const isDirectSsl = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: isDirectSsl, // true for 465, false for 587
    auth: {
      user: email,
      pass: pass,
    },
    tls: {
      rejectUnauthorized: false, // Prevents self-signed or proxy TLS verification rejections
      minVersion: "TLSv1.2",
    },
    connectionTimeout: 10000, // 10s timeout
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

// Backward compatibility alias
export const createGmailTransporter = createSmtpTransporter;

/**
 * Get an authenticated Nodemailer transport for a given user.
 */
export async function getMailTransport(userId: string): Promise<nodemailer.Transporter> {
  const creds = await getMailCredentials(userId);
  return createSmtpTransporter(creds.email, creds.pass, 465);
}

/**
 * Get the sender email for a given user.
 */
export async function getSenderEmail(userId: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { smtpEmail: true, email: true },
  });

  return user.smtpEmail || user.email;
}

export interface SendMailOptions {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachmentPath?: string | null;
  attachmentName?: string | null;
  inReplyTo?: string | null;
  references?: string | string[] | null;
}

/**
 * Send a single email using Nodemailer with automatic port 587 fallback if 465 is blocked.
 */
export async function sendEmail(
  transporter: nodemailer.Transporter,
  options: SendMailOptions,
  credentials?: MailCredentials
) {
  const mailOptions: Mail.Options = {
    from: options.from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    ...(options.inReplyTo ? { inReplyTo: options.inReplyTo } : {}),
    ...(options.references ? { references: options.references } : {}),
  };

  // Add attachment if provided
  if (options.attachmentPath) {
    if (options.attachmentPath.startsWith("data:")) {
      const commaIdx = options.attachmentPath.indexOf(",");
      if (commaIdx !== -1) {
        const meta = options.attachmentPath.slice(0, commaIdx);
        const base64Data = options.attachmentPath.slice(commaIdx + 1);
        const match = meta.match(/^data:([^;]+)/);
        const contentType = match ? match[1] : "application/pdf";
        const fileName = options.attachmentName || "resume.pdf";
        mailOptions.attachments = [
          {
            filename: fileName,
            content: Buffer.from(base64Data, "base64"),
            contentType,
          },
        ];
      }
    } else {
      let resolvedPath = options.attachmentPath;

      if (!fs.existsSync(resolvedPath)) {
        const cleanPath = options.attachmentPath.startsWith("/")
          ? options.attachmentPath.slice(1)
          : options.attachmentPath;

        const candidates = [
          path.join(process.cwd(), options.attachmentPath),
          path.join(process.cwd(), "public", cleanPath),
          path.join(process.cwd(), cleanPath),
          path.join("/tmp", cleanPath),
          path.join("/tmp", "uploads", path.basename(options.attachmentPath)),
        ];

        for (const candidate of candidates) {
          if (fs.existsSync(candidate)) {
            resolvedPath = candidate;
            break;
          }
        }
      }

      if (fs.existsSync(resolvedPath)) {
        const fileName =
          options.attachmentName || path.basename(resolvedPath);
        mailOptions.attachments = [
          {
            filename: fileName,
            path: resolvedPath,
          },
        ];
      } else {
        console.warn(
          `[SMTP] Attachment path not found on disk: "${options.attachmentPath}"`
        );
      }
    }
  }

  try {
    return await transporter.sendMail(mailOptions);
  } catch (err) {
    // If primary port 465 failed and credentials exist, attempt port 587 STARTTLS fallback
    if (credentials) {
      console.warn(
        `[SMTP] Primary send failed (${err instanceof Error ? err.message : String(err)}). Retrying on Port 587 (STARTTLS)...`
      );
      const fallbackTransporter = createSmtpTransporter(
        credentials.email,
        credentials.pass,
        587
      );
      return await fallbackTransporter.sendMail(mailOptions);
    }
    throw err;
  }
}

/**
 * Test SMTP connection for a given email and password (with optional customHost).
 * Tests port 465 first, and falls back to port 587 if needed.
 */
export async function testSmtpConnection(
  email: string,
  password: string,
  customHost?: string
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  // 1. Try Port 465 (SSL)
  try {
    const transporter465 = createSmtpTransporter(cleanEmail, cleanPassword, 465, customHost);
    await transporter465.verify();
    return { success: true };
  } catch (err465) {
    console.warn("[SMTP Test] Port 465 verify failed, trying Port 587 (STARTTLS):", err465);
    
    // 2. Try Port 587 (STARTTLS)
    try {
      const transporter587 = createSmtpTransporter(cleanEmail, cleanPassword, 587, customHost);
      await transporter587.verify();
      return { success: true };
    } catch (err587) {
      const errorMsg =
        err587 instanceof Error
          ? err587.message
          : "Failed to connect to SMTP server. Please check your credentials.";
      return {
        success: false,
        error: errorMsg,
      };
    }
  }
}
