import { createClientFromRequest } from "npm:@base44/sdk";

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";

async function checkUrl(url: string): Promise<{ online: boolean; statusCode: number }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Connection": "keep-alive",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const online = res.status !== 404 && res.status !== 410 && res.status !== 451;
    return { online, statusCode: res.status };
  } catch {
    return { online: false, statusCode: 0 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);

    // Get all leaks that have had a notice sent but not yet removed
    const activeLeaks = await base44.asServiceRole.entities.Leak.filter({
      status: "notice_sent",
    });

    // Also check "waiting" and "follow_up" status
    const waitingLeaks = await base44.asServiceRole.entities.Leak.filter({
      status: "waiting",
    });
    const followUpLeaks = await base44.asServiceRole.entities.Leak.filter({
      status: "follow_up",
    });

    const leaksToCheck = [...activeLeaks, ...waitingLeaks, ...followUpLeaks];

    const results = {
      checked: 0,
      removed: 0,
      stillOnline: 0,
      followUp: 0,
    };

    const today = new Date().toISOString().split("T")[0];

    for (const leak of leaksToCheck) {
      if (!leak.leak_url) continue;

      results.checked++;
      const { online } = await checkUrl(leak.leak_url);

      if (!online) {
        // Mark as removed
        await base44.asServiceRole.entities.Leak.update(leak.id, {
          status: "removed",
          removal_date: today,
          days_online: leak.first_notice_date
            ? Math.floor(
                (Date.now() - new Date(leak.first_notice_date).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
        });

        // Update related DMCARequest
        const dmcaRequests = await base44.asServiceRole.entities.DMCARequest.filter({
          leak_id: leak.id,
        });
        for (const dmca of dmcaRequests) {
          await base44.asServiceRole.entities.DMCARequest.update(dmca.id, {
            status: "completed",
            removal_confirmed: true,
            removal_confirmation_date: today,
          });
        }

        // ─── UPDATE DOMAIN STATS (REMOVAL CONFIRMED) ────────────
        try {
          await base44.asServiceRole.functions.invoke("updateDomainStats", {
            domain: leak.domain,
            event_type: "removal_confirmed",
            leak_id: leak.id,
          });
          console.log(`[VERIFY] Domain stats updated for ${leak.domain} (removal confirmed)`);
        } catch (err) {
          console.warn(`[VERIFY] Domain stats update failed for ${leak.domain}: ${err.message}`);
        }

        results.removed++;
      } else {
        // Still online - check if follow-up is needed (7+ days since notice)
        if (leak.first_notice_date) {
          const daysSinceNotice = Math.floor(
            (Date.now() - new Date(leak.first_notice_date).getTime()) /
              (1000 * 60 * 60 * 24)
          );

          if (daysSinceNotice >= 7 && leak.status === "notice_sent") {
            await base44.asServiceRole.entities.Leak.update(leak.id, {
              status: "follow_up",
            });
            results.followUp++;
          } else if (daysSinceNotice >= 14 && leak.status === "follow_up") {
            await base44.asServiceRole.entities.Leak.update(leak.id, {
              status: "escalated",
            });
            results.followUp++;
          }
        }
        results.stillOnline++;
      }
    }

    return Response.json({ success: true, ...results });
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});