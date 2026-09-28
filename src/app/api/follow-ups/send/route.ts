import { NextRequest, NextResponse } from "next/server";
import { getDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMailCredentials, createGmailTransporter, getSenderEmail, sendEmail } from "@/lib/mailer";
import { applyMergeTags } from "@/lib/mime";
import { checkSendLimits } from "@/lib/send-limits";
import { humanizeEmail } from "@/lib/humanizer";

export const maxDuration = 300;

const DEFAULT_DELAY_SECONDS = 5;

/**
 * POST /api/follow-ups/send — Send follow-up emails in batch to oldest sent emails
 */
export async function POST(req: NextRequest) {
  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      targetCount,
      emailIds,
      subject: customSubjectTemplate,
      body: customBodyTemplate,
      threadReply = true,
      delaySeconds = DEFAULT_DELAY_SECONDS,
      skipLimitCheck = false,
    } = body;

    if (!customBodyTemplate || !customBodyTemplate.trim()) {
      return NextResponse.json({ error: "Follow-up message body is required" }, { status: 400 });
    }

    // 1. Fetch target sent emails (ordered by sentAt ASC — oldest first!)
    let targetEmails: any[] = [];

    if (Array.isArray(emailIds) && emailIds.length > 0) {
      targetEmails = await prisma.campaignEmail.findMany({
        where: {
          id: { in: emailIds },
          campaign: { userId: user.id },
          status: "sent",
        },
        include: {
          recipient: true,
          campaign: true,
        },
        orderBy: { sentAt: "asc" },
      });
    } else {
      const take = targetCount && !isNaN(Number(targetCount)) ? Math.min(500, Math.max(1, Number(targetCount))) : 10;
      targetEmails = await prisma.campaignEmail.findMany({
        where: {
          campaign: { userId: user.id },
          status: "sent",
        },
        include: {
          recipient: true,
          campaign: true,
        },
        orderBy: { sentAt: "asc" },
        take,
      });
    }

    if (targetEmails.length === 0) {
      return NextResponse.json({ error: "No sent emails available to follow up" }, { status: 400 });
    }

    // 2. Check Daily Send Limits
    const limitCheck = await checkSendLimits(user.id, targetEmails.length);

    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: limitCheck.warning,
          sentToday: limitCheck.sentToday,
          remaining: limitCheck.remaining,
        },
        { status: 429 }
      );
    }

    if (limitCheck.warning && !skipLimitCheck) {
      return NextResponse.json(
        {
          error: limitCheck.warning,
          sentToday: limitCheck.sentToday,
          remaining: limitCheck.remaining,
          requiresConfirmation: true,
        },
        { status: 429 }
      );
    }

    // 3. Get SMTP Credentials
    let mailCredentials;
    let transporter;
    try {
      mailCredentials = await getMailCredentials(user.id);
      transporter = createGmailTransporter(mailCredentials.email, mailCredentials.pass, 465);
    } catch (error) {
      return NextResponse.json(
        { error: `SMTP Configuration error: ${error instanceof Error ? error.message : "Unknown error"}` },
        { status: 500 }
      );
    }

    const senderEmail = mailCredentials.email || (await getSenderEmail(user.id));
    const senderDisplayName = user.name ? user.name.replace(/["\r\n]/g, "") : "";
    const fromAddress = senderDisplayName ? `"${senderDisplayName}" <${senderEmail}>` : senderEmail;

    let sentCount = 0;
    let failedCount = 0;
    const errors: { email: string; error: string }[] = [];

    // 4. Loop & Send Follow-ups
    for (let i = 0; i < targetEmails.length; i++) {
      const emailRecord = targetEmails[i];
      const recipient = emailRecord.recipient;
      const originalSubject = emailRecord.customSubject || applyMergeTags(emailRecord.campaign.subject, {
        email: recipient.email,
        name: recipient.name,
        company: recipient.company,
      });

      try {
        // Construct follow-up subject
        let finalSubject = customSubjectTemplate
          ? applyMergeTags(customSubjectTemplate, {
            email: recipient.email,
            name: recipient.name,
            company: recipient.company,
          }).replace(/\{original_subject\}/gi, originalSubject)
          : `Re: ${originalSubject}`;

        // CRITICAL FIX: If threading is enabled, the subject MUST match the original subject exactly
        // to guarantee Gmail threading, even if the user typed a custom subject or messageId is missing.
        if (threadReply) {
          finalSubject = originalSubject.toLowerCase().startsWith("re:") 
            ? originalSubject 
            : `Re: ${originalSubject}`;
        }

        // Construct follow-up body
        let finalBody = applyMergeTags(customBodyTemplate, {
          email: recipient.email,
          name: recipient.name,
          company: recipient.company,
        }).replace(/\{original_subject\}/gi, originalSubject);

        if (!finalBody.includes("<p>") && !finalBody.includes("<br>")) {
          finalBody = finalBody.replace(/\n/g, "<br>");
        }

        // Humanize text
        finalBody = humanizeEmail(finalBody, {
          varyGreetings: true,
          varySignoffs: true,
          insertInvisibleChars: true,
          varyWhitespace: true,
        });

        // Threading headers
        const inReplyTo = threadReply && emailRecord.messageId ? emailRecord.messageId : undefined;
        const references = threadReply && emailRecord.messageId ? [emailRecord.messageId] : undefined;

        // Send Email
        const sendInfo = await sendEmail(
          transporter,
          {
            from: fromAddress,
            to: recipient.email,
            subject: finalSubject,
            html: finalBody,
            inReplyTo,
            references,
          },
          mailCredentials
        );

        // Update sentAt to NOW and increment followupCount so they get re-sorted to the top!
        await prisma.campaignEmail.update({
          where: { id: emailRecord.id },
          data: {
            status: "sent",
            sentAt: new Date(),
            followupCount: (emailRecord.followupCount || 0) + 1,
            customSubject: finalSubject,
            customBody: customBodyTemplate,
            messageId: sendInfo?.messageId || emailRecord.messageId,
            error: null,
          },
        });

        sentCount++;

        if (i < targetEmails.length - 1 && delaySeconds > 0) {
          await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
        }
      } catch (error) {
        const errText = error instanceof Error ? error.message : "Failed to send follow-up";
        failedCount++;
        errors.push({ email: recipient.email, error: errText });
      }
    }

    return NextResponse.json({
      totalCount: targetEmails.length,
      sentCount,
      failedCount,
      errors,
    });
  } catch (error) {
    console.error("[POST /api/follow-ups/send] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Follow-up campaign execution failed" },
      { status: 500 }
    );
  }
}
