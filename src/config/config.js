const dotenv = require("dotenv");

const env = process.env.NODE_ENV || "development";
dotenv.config({ path: `.env.${env}` });

module.exports = {
  databaseUri: process.env.DATABASE_URI,
};
