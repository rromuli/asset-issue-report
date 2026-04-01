import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import session from "express-session";
import sql from "mssql";
import { Issuer, custom, generators } from "openid-client";

dotenv.config();

const app = express();
app.use(express.json());

const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: FRONTEND_ORIGINS.length ? FRONTEND_ORIGINS : true,
    credentials: true,
  })
);

const COOKIE_SAME_SITE = process.env.SESSION_SAME_SITE || "lax";
const COOKIE_SECURE =
  process.env.SESSION_SECURE === "true" ||
  process.env.NODE_ENV === "production" ||
  COOKIE_SAME_SITE === "none";

app.use(
  session({
    secret: process.env.SESSION_SECRET || "replace-me-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: COOKIE_SECURE,
      httpOnly: true,
      sameSite: COOKIE_SAME_SITE,
    },
  })
);

const PORT = Number(process.env.API_PORT || 7001);
const CALLBACK_URL = process.env.CALLBACK_URL || `http://localhost:${PORT}/cb`;
const PORTA_AUTHORITY = process.env.PORTA_AUTHORITY || "";
const CLIENT_ID = process.env.CLIENT_ID || "";
const CLIENT_SECRET = process.env.CLIENT_SECRET || "";
const BACKOFFICE_DOMAIN = process.env.BACKOFFICE_DOMAIN || "https://backoffice.gjirafa.com";
const LOCAL_BYPASS_AUTH = process.env.LOCAL_BYPASS_AUTH === "true";

let client = null;
let pool = null;
const OIDC_CLOCK_TOLERANCE = Number(process.env.OIDC_CLOCK_TOLERANCE || 60);

async function ensureDbPool() {
  if (pool) return pool;

  pool = await sql.connect({
    server: process.env.DB_SERVER,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || "BackOffice",
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
  });

  return pool;
}

async function initOidc() {
  if (!PORTA_AUTHORITY || !CLIENT_ID || !CLIENT_SECRET) {
    console.warn(
      "OIDC config is incomplete. Set PORTA_AUTHORITY, CLIENT_ID, CLIENT_SECRET in backend env."
    );
    return;
  }

  const issuer = await Issuer.discover(
    `${PORTA_AUTHORITY.replace(/\/$/, "")}/.well-known/openid-configuration`
  );

  client = new issuer.Client({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uris: [CALLBACK_URL],
    response_types: ["code"],
  });

  client[custom.clock_tolerance] = OIDC_CLOCK_TOLERANCE;
  console.log("OIDC client ready");
}

app.get("/api/auth/login", (req, res) => {
  if (!client) {
    if (LOCAL_BYPASS_AUTH) {
      const returnTo = req.query.returnTo || "/";
      req.session.user = {
        email: "dev@gjirafa.com",
        given_name: "Local",
        family_name: "Admin",
        role: "SuperAdmin",
        delayPermissions: "multi",
      };
      return res.redirect(returnTo);
    }
    return res.status(500).send("OIDC client not initialized");
  }

  const returnTo = req.query.returnTo || "/";
  req.session.returnTo = returnTo;

  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  req.session.code_verifier = codeVerifier;

  const state = generators.state();
  const nonce = generators.nonce();
  req.session.state = state;
  req.session.nonce = nonce;

  const authUrl = client.authorizationUrl({
    scope: "openid profile email roles",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });

  res.redirect(authUrl);
});

app.get("/cb", async (req, res, next) => {
  try {
    if (!client) return res.status(500).send("OIDC client not initialized");

    if (req.query.error) {
      console.error("OIDC error:", req.query.error, req.query.error_description || "");
      return res.status(400).send(`
        <h1>Login Error</h1>
        <p>Error: <b>${req.query.error}</b></p>
        <p>Description: ${req.query.error_description || "No description provided."}</p>
        <a href="/">Back to home</a>
      `);
    }

    const params = client.callbackParams(req);
    if (params.state !== req.session.state) {
      return res.status(400).send("Invalid state");
    }

    const tokenSet = await client.callback(CALLBACK_URL, params, {
      code_verifier: req.session.code_verifier,
      state: req.session.state,
      nonce: req.session.nonce,
    });

    const userinfo = await client.userinfo(tokenSet.access_token);
    const email = userinfo.email;
    if (!email) {
      return res.status(400).send("Missing user email in OIDC profile.");
    }

    let returnTo = req.session.returnTo || "/";
    delete req.session.returnTo;

    if (LOCAL_BYPASS_AUTH) {
      req.session.user = userinfo;
      if (returnTo.startsWith("/")) {
        returnTo = `${BACKOFFICE_DOMAIN}${returnTo}`;
      } else {
        returnTo = returnTo.replace(":7001", "");
      }
      return res.redirect(returnTo);
    }

    const db = await ensureDbPool();
    const result = await db
      .request()
      .input("email", sql.NVarChar, email)
      .query("SELECT * FROM users WHERE email = @email AND is_active = 1;");

    if (!result.recordset.length) {
      req.session.user = {
        email: userinfo.email,
        given_name: userinfo.given_name || "",
        family_name: userinfo.family_name || "",
      };
      return res.redirect(`${BACKOFFICE_DOMAIN}/request-access`);
    }

    req.session.user = userinfo;

    if (returnTo.startsWith("/")) {
      returnTo = `${BACKOFFICE_DOMAIN}${returnTo}`;
    } else {
      returnTo = returnTo.replace(":7001", "");
    }

    res.redirect(returnTo);
  } catch (err) {
    next(err);
  }
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/api/me", async (req, res) => {
  try {
    if (process.env.NODE_ENV === "local" && LOCAL_BYPASS_AUTH) {
      const fakeUser = {
        email: "dev@gjirafa.com",
        given_name: "Dev",
        family_name: "Local",
        role: "SuperAdmin",
        delayPermissions: "multi",
      };
      req.session.user = fakeUser;
      return res.json({ loggedIn: true, user: fakeUser });
    }

    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ loggedIn: false });
    }

    if (LOCAL_BYPASS_AUTH) {
      user.role = user.role || "SuperAdmin";
      user.delayPermissions = user.delayPermissions || "multi";
      req.session.user = user;
      return res.json({ loggedIn: true, user });
    }

    const db = await ensureDbPool();
    const result = await db
      .request()
      .input("email", sql.NVarChar, user.email)
      .query(
        "SELECT u.role, r.delayPermission FROM users u LEFT JOIN roles r ON r.name = u.role WHERE u.email = @email;"
      );

    if (result.recordset.length > 0) {
      user.role = result.recordset[0].role;
      user.delayPermissions = result.recordset[0].delayPermission ?? "none";
    } else {
      user.role = "unauthorized";
      user.delayPermissions = "none";
    }

    req.session.user = user;
    res.json({ loggedIn: true, user });
  } catch (err) {
    console.error("[/api/me] Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled server error:", err);
  res.status(500).send("Internal server error");
});

initOidc()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`OIDC backend listening on http://localhost:${PORT}`);
    });
  })
  .catch((e) => {
    console.error("OIDC setup failed:", e);
    process.exit(1);
  });
