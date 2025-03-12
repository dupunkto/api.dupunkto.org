#!/usr/bin/env -S bun

import crypto from "node:crypto";
import puppeteer from "puppeteer";

const RANDOM_BYTES = 32;
const CLIENT_ID = "somtoday-leerling-native";
const SCOPE = "openid";
const APP = "somtoday://nl.topicus.somtoday.leerling";
const ENDPOINT = "https://inloggen.somtoday.nl/oauth2";
const REDIRECT_URI = `${APP}/oauth/callback`;
const STATE = "boobswow";

interface Params {
  tenant_id: string,
  username: string,
  password: string
}

function base64_url_encode(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256sum(buffer: Buffer | string): Buffer {
  return crypto.createHash("sha256").update(buffer).digest();
}

const server = Bun.serve({
  port: 4001,
  async fetch(req) {
    if (req.method !== "POST") {
      return new Response("Method not supported.", { status: 405 });
    }

    const { tenant_id, username, password }: Params = await req.json();

    if (!tenant_id) return new Response("Missing 'tenant_id'.", { status: 400 });
    if (!username) return new Response("Missing 'username'.", { status: 400 });
    if (!password) return new Response("Missing 'password'.", { status: 400 });

    const code_verifier = base64_url_encode(crypto.randomBytes(RANDOM_BYTES));
    const code_challenge = base64_url_encode(sha256sum(code_verifier));

    const params = new URLSearchParams({
      response_type: "code",
      prompt: "login",
      client_id: CLIENT_ID,
      tenant_uuid: tenant_id,
      redirect_uri: REDIRECT_URI,
      scope: SCOPE,
      code_challenge: code_challenge,
      code_challenge_method: "S256",
      state: STATE,
      session: "dont_remember_me"
    });

    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    let code: string | null = null;
    let processed = false;

    await page.on("response", (response) => {
      const location = response.headers()["location"];
      if (!location || !location.startsWith(APP)) return;

      const url = new URL(location);
      processed = true;
      code = url.searchParams.get("code");
    });

    const url = `${ENDPOINT}/authorize?${params.toString()}`;

    process.stdout.write(`Visiting ${url}`);
    await page.goto(url);

    await page.type("#usernameField", username);
    await page.click("a[type='submit']");
    await page.type("#password-field", password);
    await page.click("a[type='submit']");

    while (!processed) {
      await Bun.sleep(5000);
      process.stdout.write("Waiting for the code... (it's taking a while)\n");
    }

    await browser.close();

    if (!code) {
      return new Response("Could not find 'code'. Sowwy!", { status: 500 });
    }

    return fetch(`${ENDPOINT}/token`, {
      method: "POST",
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        code_verifier: code_verifier,
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: SCOPE,
        session: "no_session"
      })
    });
  }
});

console.log(`Listening on ${server.url}`);