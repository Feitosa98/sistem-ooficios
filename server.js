import { createServer } from "node:http";
import { parse } from "node:url";
import fs from "node:fs";
import path from "node:path";
import next from "next";

const rootDir = process.cwd();
const hostingerDir = path.resolve(rootDir, "hostinger");
const appDir = (fs.existsSync(hostingerDir) && fs.existsSync(path.join(hostingerDir, ".next")))
  ? hostingerDir
  : rootDir;

const dev = false;
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port, dir: appDir });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", req.url, err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }).listen(port, (err) => {
    if (err) throw err;
    console.log(`> Servidor pronto em http://${hostname}:${port}`);
  });
}).catch((err) => {
  console.error("Erro ao inicializar Next.js:", err);
  process.exit(1);
});
