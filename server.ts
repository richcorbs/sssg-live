import { getContext, RequestContext } from "./router.ts";
import { handleDomainRequest, handleHostingRequest } from "./domainHandlers.ts";

const ADMIN_DOMAIN = import.meta.url.includes("/Users/rich/Code") ? "http://domains.local:8000" : "https://api.sssg.dev";

Deno.serve(async (req): Promise<Response> => {
  const ctx: RequestContext = await getContext(req);

  if (ctx.HOSTNAME !== ADMIN_DOMAIN) {
    return await handleHostingRequest(ctx);
  } else {
    return await handleDomainRequest(ctx);
  }
});
