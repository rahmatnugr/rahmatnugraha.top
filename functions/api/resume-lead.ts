interface Env {
  DB: D1Database;
  TURNSTILE_SECRET_KEY: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_NOTIFY_UPDATES?: string;
  LEADS_IP_SALT?: string;
}

type LeadRequest = {
  email?: unknown;
  consent?: unknown;
  source?: unknown;
  turnstileToken?: unknown;
  companyWebsite?: unknown;
};

const ALLOWED_SOURCE = "about_resume_cta";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "guerrillamail.com",
  "10minutemail.com",
  "yopmail.com",
  "trashmail.com",
]);

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyTurnstile(secret: string, token: string, remoteip: string): Promise<boolean> {
  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);
  formData.append("remoteip", remoteip);

  const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) {
    return false;
  }

  const body = (await resp.json()) as { success?: boolean };
  return body.success === true;
}

async function sendTelegramMessage(env: Env, message: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return;
  }

  const endpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: message,
      disable_web_page_preview: true,
    }),
  });
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const req = context.request;

    if (!req.headers.get("content-type")?.includes("application/json")) {
      return json({ ok: false, error: "bad_request" }, 400);
    }

    const payload = (await req.json()) as LeadRequest;
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const consent = payload.consent === true;
    const source = payload.source;
    const turnstileToken = typeof payload.turnstileToken === "string" ? payload.turnstileToken : "";
    const companyWebsite = typeof payload.companyWebsite === "string" ? payload.companyWebsite.trim() : "";

    if (companyWebsite) {
      return json({ ok: false, error: "bot_detected" }, 400);
    }

    if (!EMAIL_REGEX.test(email)) {
      return json({ ok: false, error: "invalid_email" }, 400);
    }

    if (!consent) {
      return json({ ok: false, error: "consent_required" }, 400);
    }

    if (source !== ALLOWED_SOURCE) {
      return json({ ok: false, error: "bad_request" }, 400);
    }

    if (!turnstileToken || !context.env.TURNSTILE_SECRET_KEY) {
      return json({ ok: false, error: "bot_check_failed" }, 403);
    }

    const ip = req.headers.get("cf-connecting-ip") || "0.0.0.0";
    const turnstileOK = await verifyTurnstile(context.env.TURNSTILE_SECRET_KEY, turnstileToken, ip);

    if (!turnstileOK) {
      return json({ ok: false, error: "bot_check_failed" }, 403);
    }

    const now = new Date().toISOString();
    const userAgent = req.headers.get("user-agent") || "unknown";
    const emailDomain = email.split("@")[1] || "";
    const isDisposable = DISPOSABLE_DOMAINS.has(emailDomain) ? 1 : 0;
    const salt = context.env.LEADS_IP_SALT || "resume-leads";
    const ipHash = await sha256Hex(`${ip}:${salt}`);

    const existing = await context.env.DB.prepare(
      "SELECT id FROM resume_leads WHERE email = ?1 LIMIT 1"
    )
      .bind(email)
      .first<{ id: number }>();

    let status: "created" | "updated" = "created";

    if (existing?.id) {
      status = "updated";
      await context.env.DB.prepare(
        "UPDATE resume_leads SET last_seen_at = ?1, last_ip_hash = ?2, user_agent = ?3 WHERE email = ?4"
      )
        .bind(now, ipHash, userAgent, email)
        .run();
    } else {
      await context.env.DB.prepare(
        "INSERT INTO resume_leads (email, source, consent_at, created_at, last_seen_at, first_ip_hash, last_ip_hash, user_agent, is_disposable) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
      )
        .bind(email, ALLOWED_SOURCE, now, now, now, ipHash, ipHash, userAgent, isDisposable)
        .run();
    }

    const notifyUpdates = (context.env.TELEGRAM_NOTIFY_UPDATES || "false").toLowerCase() === "true";
    if (status === "created" || notifyUpdates) {
      const message = [
        "*Resume lead captured*",
        `- Status: ${status}`,
        `- Email: ${email}`,
        `- Source: ${ALLOWED_SOURCE}`,
        `- Time: ${now}`,
      ].join("\n");

      sendTelegramMessage(context.env, message).catch((err) => {
        console.error("telegram_notify_failed", err);
      });
    }

    return json({ ok: true, status });
  } catch (err) {
    console.error("resume_lead_error", err);
    return json({ ok: false, error: "server_error" }, 500);
  }
};
