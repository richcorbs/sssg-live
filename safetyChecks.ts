import { RequestContext } from "./router.ts";

export function domainSafetyChecks(ctx: RequestContext): Response | null {
  const safeRequests = [
    "DELETE /api/domain", // delete
    "GET /api/domain/check", // check
    "GET /api/domains", // retrieve
    "POST /api/domain", // create
    "POST /api/domain/upload", // upload
    "PUT /api/domain", // rename
    "POST /api/register", // register
  ];

  if (safeRequests.includes(ctx.REQUEST)) {
    return null;
  } else {
    return new Response("Not found", { status: 404 });
  }
}

export function hostingSafetyChecks(ctx: RequestContext): Response | null {
  if (ctx.METHOD !== "GET") {
    return new Response(
      JSON.stringify({ status: "ERROR", message: "Method not allowed" }),
      { status: 405 },
    );
  }
  if (ctx.PATHNAME.includes("..")) {
    return new Response(
      JSON.stringify({ status: "ERROR", message: "Bad Request" }),
      { status: 400 },
    );
  }
  return null;
}
