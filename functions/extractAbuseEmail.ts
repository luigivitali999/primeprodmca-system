import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST", "Access-Control-Allow-Headers": "Content-Type" } });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const domain = body.domain;

    if (!domain) return Response.json({ error: "Missing domain" }, { status: 400 });

    console.log(`[ABUSE EMAIL] Starting extraction for domain: ${domain}`);

    // Step 1: Fetch homepage
    console.log(`[ABUSE EMAIL] Fetching homepage for ${domain}`);
    let homeUrl = `https://${domain}`;
    let homeHtml = '';
    
    try {
      const homeRes = await fetch(homeUrl, { 
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow'
      });
      if (homeRes.ok) {
        homeHtml = await homeRes.text();
      }
    } catch (e) {
      console.warn(`[ABUSE EMAIL] Failed to fetch ${homeUrl}: ${e.message}`);
    }

    if (!homeHtml) {
      return Response.json({ 
        error: "Could not fetch homepage",
        domain,
        abuseEmail: null,
      }, { status: 400 });
    }

    // Step 2: Search for DMCA link in homepage HTML
    console.log(`[ABUSE EMAIL] Searching for DMCA link in homepage`);
    
    const dmcaLinkMatch = homeHtml.match(/href=["']([^"']*dmca[^"']*)['"]/i);
    let pageToScrape = null;
    
    if (dmcaLinkMatch) {
      pageToScrape = dmcaLinkMatch[1];
      console.log(`[ABUSE EMAIL] Found DMCA link: ${pageToScrape}`);
    } else {
      console.log(`[ABUSE EMAIL] No DMCA link found in homepage`);
    }
    
    let abuseEmail = null;

    // Step 3: If page found, fetch it
    if (pageToScrape) {
      let fullUrl = pageToScrape.startsWith('http') ? pageToScrape : `https://${domain}${pageToScrape}`;
      console.log(`[ABUSE EMAIL] Fetching DMCA page: ${fullUrl}`);

      try {
        const pageRes = await fetch(fullUrl, { 
          headers: { 'User-Agent': USER_AGENT },
          redirect: 'follow'
        });
        
        if (pageRes.ok) {
          const pageHtml = await pageRes.text();
          
          // Step 4: Use AI to extract email from DMCA/Legal page
          console.log(`[ABUSE EMAIL] Extracting email from DMCA page`);
          
          const emailExtraction = await base44.integrations.Core.InvokeLLM({
            prompt: `Find the abuse/DMCA contact email in this HTML content. Look for abuse@, dmca@, legal@, or any contact email for copyright/abuse reports.
            
HTML content:
${pageHtml.substring(0, 10000)}

Return as JSON: { email: "the email address or null", alternative_contact: "phone/form URL or null" }`,
            response_json_schema: {
              type: "object",
              properties: {
                email: { type: ["string", "null"] },
                alternative_contact: { type: ["string", "null"] },
              },
            },
          });

          if (emailExtraction.email) {
            abuseEmail = emailExtraction.email;
            console.log(`[ABUSE EMAIL] Found email on DMCA page: ${abuseEmail}`);
          }
        }
      } catch (e) {
        console.warn(`[ABUSE EMAIL] Failed to fetch DMCA page: ${e.message}`);
      }
    }

    if (!abuseEmail) {
      return Response.json({ 
        error: "Could not find abuse email",
        domain,
        abuseEmail: null,
      }, { status: 400 });
    }

    console.log(`[ABUSE EMAIL] Successfully found: ${abuseEmail}`);

    return Response.json({
      success: true,
      domain,
      abuseEmail,
    });
  } catch (error) {
    console.error("[ABUSE EMAIL] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});