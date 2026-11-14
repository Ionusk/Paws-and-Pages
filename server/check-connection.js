
import dotenv from "dotenv";

dotenv.config();

const url = new URL(process.env.TIGER_DATABASE_URL);

console.log("Host:", url.hostname);
console.log("Port:", url.port || "5432 (implicit)");
console.log("Database:", url.pathname);
console.log("SSL:", url.searchParams.get("sslmode"));
