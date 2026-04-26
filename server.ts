// Minimal static file server for Noisy Connect.
// Run with: bun server.ts
const PORT = 3000;

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const filePath = url.pathname === "/" ? "./index.html" : "." + url.pathname;
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(file);
  },
});

console.log(`Noisy Connect running at http://localhost:${PORT}`);
