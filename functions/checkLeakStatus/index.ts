import { createClientFromRequest } from "npm:@base44/sdk";

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";

async function checkUrl(url: string): Promise<{ online: boolean; statusCode: number; error?: string }> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Cache-Control": "max-age=0",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // 404, 410 = removed; 200, 301 = still online
    const online = res.status !== 404 && res.status !== 410 && res.status !== 451;
    return { online, statusCode: res.status };
  } catch (err: any) {
    if (err.name === "AbortError") return { online: false, statusCode: 0, error: "timeout" };
    return { online: false, statusCode: 0, error: err.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type, Authorization" } });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { leakId, leakUrl } = body;

    if (!leakUrl) return Response.json({ error: "Missing leakUrl" }, { status: 400 });

    const result = await checkUrl(leakUrl);

    // Auto-update leak status if leakId provided
    if (leakId) {
      if (!result.online) {
        await base44.asServiceRole.entities.Leak.update(leakId, {
          status: "removed",
          removal_date: new Date().toISOString().split("T")[0],
        });
      }
      // If it was "removed" but now online again → recurrence
      // (caller can handle this logic if needed)
    }

    return Response.json({
      success: true,
      leakId,
      leakUrl,
      online: result.online,
      statusCode: result.statusCode,
      error: result.error || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});