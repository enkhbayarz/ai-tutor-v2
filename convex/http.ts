import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { Webhook } from "svix";

const http = httpRouter();

// Parse user agent to extract browser info
function parseUserAgent(ua: string): {
  browserName: string;
  browserVersion: string;
  deviceType: string;
  isMobile: boolean;
} {
  const isMobile = /Mobile|Android|iPhone|iPad|iPod/i.test(ua);

  let browserName = "Unknown";
  let browserVersion = "";

  if (ua.includes("Chrome") && !ua.includes("Edg")) {
    browserName = "Chrome";
    const match = ua.match(/Chrome\/(\d+(\.\d+)?)/);
    browserVersion = match?.[1] || "";
  } else if (ua.includes("Safari") && !ua.includes("Chrome")) {
    browserName = "Safari";
    const match = ua.match(/Version\/(\d+(\.\d+)?)/);
    browserVersion = match?.[1] || "";
  } else if (ua.includes("Firefox")) {
    browserName = "Firefox";
    const match = ua.match(/Firefox\/(\d+(\.\d+)?)/);
    browserVersion = match?.[1] || "";
  } else if (ua.includes("Edg")) {
    browserName = "Edge";
    const match = ua.match(/Edg\/(\d+(\.\d+)?)/);
    browserVersion = match?.[1] || "";
  }

  let deviceType = "Desktop";
  if (/iPhone/i.test(ua)) deviceType = "iPhone";
  else if (/iPad/i.test(ua)) deviceType = "iPad";
  else if (/Android/i.test(ua))
    deviceType = isMobile ? "Android Phone" : "Android Tablet";
  else if (/Macintosh/i.test(ua)) deviceType = "Mac";
  else if (/Windows/i.test(ua)) deviceType = "Windows";
  else if (/Linux/i.test(ua)) deviceType = "Linux";

  return { browserName, browserVersion, deviceType, isMobile };
}

// Clerk webhook endpoint
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

    if (!WEBHOOK_SECRET) {
      return new Response("Missing CLERK_WEBHOOK_SECRET", { status: 500 });
    }

    // Get svix headers
    const svix_id = request.headers.get("svix-id");
    const svix_timestamp = request.headers.get("svix-timestamp");
    const svix_signature = request.headers.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new Response("Missing svix headers", { status: 400 });
    }

    // Verify webhook
    const body = await request.text();
    const wh = new Webhook(WEBHOOK_SECRET);

    let evt: {
      type: string;
      data: { id: string; user_id: string };
      event_attributes?: {
        http_request?: { client_ip?: string; user_agent?: string };
      };
    };

    try {
      evt = wh.verify(body, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as typeof evt;
    } catch (err) {
      console.error("Webhook verification failed:", err);
      return new Response("Webhook verification failed", { status: 400 });
    }

    // Handle session events
    const eventType = evt.type;

    if (eventType === "session.created") {
      const httpRequest = evt.event_attributes?.http_request;
      const userAgent = httpRequest?.user_agent || "";
      const ipAddress = httpRequest?.client_ip;

      const { browserName, browserVersion, deviceType, isMobile } =
        parseUserAgent(userAgent);

      await ctx.runMutation(api.loginHistory.recordLoginEvent, {
        clerkUserId: evt.data.user_id,
        sessionId: evt.data.id,
        event: "login",
        deviceType,
        browserName,
        browserVersion,
        ipAddress,
        isMobile,
      });
    }

    if (eventType === "session.ended" || eventType === "session.revoked") {
      await ctx.runMutation(api.loginHistory.recordLoginEvent, {
        clerkUserId: evt.data.user_id,
        sessionId: evt.data.id,
        event: "logout",
      });
    }

    return new Response("OK", { status: 200 });
  }),
});

export default http;
