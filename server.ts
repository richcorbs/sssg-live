import { getContext, RequestContext } from "./router.ts";
import { handleDomainRequest, handleHostingRequest } from "./domainHandlers.ts";

Deno.serve(async (req): Promise<Response> => {
  const ctx: RequestContext = await getContext(req);

  if (ctx.HOSTNAME !== "0.0.0.0" && ctx.HOSTNAME !== "api.sssg.dev" && ctx.HOSTNAME !== "domains.local") {
    return await handleHostingRequest(ctx);
  } else {
    return await handleDomainRequest(ctx);
  }
});
