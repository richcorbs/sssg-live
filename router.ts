import { join, resolve } from "https://deno.land/std@0.170.0/path/mod.ts";
import {
  handleCheckDomain,
  handleCreateDomain,
  handleDeleteDomain,
  handleGetDomains,
  handleRegistration,
  handleRenameDomain,
  handleUploadDomain,
} from "./domainHandlers.ts";

const ROOT: string = "/var/www";

export interface RequestContext {
  METHOD: string;
  HOSTNAME: string;
  PATHNAME: string;
  PARAMS: { [key: string]: string };
  REQUEST: string;
  FULL_PATH: string;
  FORM_DATA: FormData | null;
  HEADERS: { [key: string]: string };
}

export type Handler = (ctx: RequestContext) => Promise<Response> | Response;
export type Route = { handler: Handler };
export type Routes = { [route: string]: Route };

export const ROUTES: Routes = {
  "POST /api/domain": { handler: handleCreateDomain },
  "DELETE /api/domain": { handler: handleDeleteDomain },
  "GET /api/domain/check": { handler: handleCheckDomain },
  "GET /api/domains": { handler: handleGetDomains },
  "POST /api/register": { handler: handleRegistration },
  "PUT /api/domain": { handler: handleRenameDomain },
  "POST /api/domain/upload": { handler: handleUploadDomain },
};

export async function getContext(req: Request): Promise<RequestContext> {
  const url = new URL(req.url);
  const hasFormData = req.method === "POST" &&
    (req?.headers?.get("Content-Type")?.includes(
      "application/x-www-form-urlencoded",
    ) || req?.headers?.get("Content-Type")?.includes("multipart/form-data"));
  const ctx: RequestContext = {
    METHOD: req.method,
    HOSTNAME: url.hostname,
    PATHNAME: url.pathname,
    PARAMS: Object.fromEntries(url.searchParams),
    REQUEST: `${req.method} ${url.pathname}`,
    FULL_PATH: resolve(join(ROOT, url.hostname, url.pathname)),
    FORM_DATA: hasFormData ? await req.formData() : null,
    HEADERS: Object.fromEntries(req.headers.entries()),
  };
  if (ctx.FULL_PATH.endsWith("/")) ctx.FULL_PATH = ctx.FULL_PATH + "index.html";
  return ctx;
}
