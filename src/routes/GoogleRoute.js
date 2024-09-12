const express = require("express");
const { google } = require("googleapis");
const creds = require("../creds.json");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.REACT_APP_FRONTEND_URL,
    credentials: true,
  })
);

const oauth2Client = new google.auth.OAuth2(
  creds.web.client_id,
  creds.web.client_secret,
  creds.web.redirect_uri
);

app.get("/auth", (req, res) => {
  const redirectUrl = req.query.redirectUrl || "/";
  const url = oauth2Client.generateAuthUrl({
    // added hd (that will direct the user to login using the TI credentials)
    hd: "telusinternational.com",
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state: redirectUrl, // Pass the redirect URL as state
  });
  res.send(url);
});

app.get("/redirect", async (req, res) => {
  const code = req.query;
  const authDetails = {
    code: decodeURIComponent(code.code),
    scope: decodeURIComponent(code.scope),
    authuser: code.authUser,
    hd: code.hd,
    prompt: code.prompt,
  };

  if (!code) {
    return res.status(400).send("Code query parameter is required");
  }

  try {
    const { tokens } = await oauth2Client.getToken(authDetails);
    const { access_token, refresh_token } = tokens;

    res.json({ access_token, refresh_token });
  } catch (error) {
    console.error("Error getting tokens:", error);
    res.status(500).send("Error during authentication");
  }
});

app.post("/getUserInfo", (req, res) => {
  oauth2Client.setCredentials(req.body);
  const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
  oauth2.userinfo.get((err, response) => {
    if (err) res.status(400).send(err);
    if (response != null) {
      res.send(response.data);
    }
  });
});

const authenticate = (req, res, next) => {
  const accessToken = req.cookies.access_token;

  if (!accessToken) {
    console.log("No access token found in cookies");
    return res.status(401).send("Unauthorized: No access token provided");
  }

  req.accessToken = accessToken;
  next();
};

app.get("/auth-status", authenticate, (req, res) => {
  res.status(200).json({ authenticated: true });
});

module.exports = app;
