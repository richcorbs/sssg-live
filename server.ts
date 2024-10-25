import { getContext, RequestContext } from "./router.ts";
import { handleDomainRequest, handleHostingRequest } from "./domainHandlers.ts";

const ADMIN_DOMAIN = "domains.local";

Deno.serve(async (req): Promise<Response> => {
  const ctx: RequestContext = await getContext(req);

  if (ctx.HOSTNAME !== ADMIN_DOMAIN) {
    return await handleHostingRequest(ctx);
  } else {
    return await handleDomainRequest(ctx);
  }
});
