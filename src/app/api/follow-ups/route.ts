import { NextRequest, NextResponse } from "next/server";
import { getDbUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/follow-ups — Fetch stored campaign_emails for follow-up targeting.
 * Shows all sent emails + pending emails belonging to the user.
 *
 * Query params:
 *   - limit: number (optional)
 *   - sort: "asc" | "desc" (default "asc" -> oldest sent first)
 *   - search: string (optional)
 */
export async function GET(req: NextRequest) {
  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = searchParams.get("limit");
  const sortParam = searchParams.get("sort") || "asc";
  const searchParam = searchParams.get("search")?.trim() || "";

  const take = limitParam && !isNaN(Number(limitParam)) ? Number(limitParam) : undefined;
  const sortOrder = sortParam === "desc" ? "desc" : "asc";

  try {
    const whereClause: any = {
      campaign: { userId: user.id },
      status: { in: ["sent", "pending"] },
    };

    if (searchParam) {
      whereClause.OR = [
        { recipient: { name: { contains: searchParam, mode: "insensitive" } } },
        { recipient: { email: { contains: searchParam, mode: "insensitive" } } },
        { recipient: { company: { contains: searchParam, mode: "insensitive" } } },
        { customSubject: { contains: searchParam, mode: "insensitive" } },
        { campaign: { subject: { contains: searchParam, mode: "insensitive" } } },
      ];
    }

    const [totalCount, oldestRecord, emails] = await Promise.all([
      prisma.campaignEmail.count({ where: whereClause }),
      prisma.campaignEmail.findFirst({
        where: { campaign: { userId: user.id }, status: { in: ["sent", "pending"] } },
        orderBy: { sentAt: "asc" },
        select: { sentAt: true },
      }),
      prisma.campaignEmail.findMany({
        where: whereClause,
        orderBy: { sentAt: sortOrder },
        take,
        include: {
          recipient: true,
          campaign: {
            select: {
              id: true,
              subject: true,
              body: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      totalCount,
      oldestSentAt: oldestRecord?.sentAt || null,
      emails,
    });
  } catch (error) {
    console.error("[GET /api/follow-ups] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch follow-ups" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/follow-ups — Delete sent email records from database.
 * Query param: ?id=xxx (single) OR Body: { ids: [...] } (bulk)
 */
export async function DELETE(req: NextRequest) {
  const user = await getDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const singleId = searchParams.get("id");

  try {
    if (singleId) {
      const deleted = await prisma.campaignEmail.deleteMany({
        where: {
          id: singleId,
          campaign: { userId: user.id },
        },
      });
      return NextResponse.json({ deleted: deleted.count });
    }

    const body = await req.json().catch(() => null);
    if (body?.ids && Array.isArray(body.ids)) {
      const deleted = await prisma.campaignEmail.deleteMany({
        where: {
          id: { in: body.ids },
          campaign: { userId: user.id },
        },
      });
      return NextResponse.json({ deleted: deleted.count });
    }

    return NextResponse.json({ error: "Provide 'id' param or 'ids' array" }, { status: 400 });
  } catch (error) {
    console.error("[DELETE /api/follow-ups] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete entries" },
      { status: 500 }
    );
  }
}
