import {
  dirname,
  join,
  normalize,
  resolve,
} from "https://deno.land/std@0.170.0/path/mod.ts";
import { ulid } from "jsr:@std/ulid/ulid";
import { existsSync } from "https://deno.land/std@0.208.0/fs/mod.ts";
import { UntarStream } from "jsr:@std/tar";
import { domainSafetyChecks, hostingSafetyChecks } from "./safetyChecks.ts";
import { RequestContext, ROUTES } from "./router.ts";

const KV = await Deno.openKv("./db");
const ROOT = "/var/www";

export async function handleDomainRequest(ctx: RequestContext,): Promise<Response> {
  const safetyChecksResponse: Response | null = domainSafetyChecks(ctx);
  if (safetyChecksResponse !== null) return safetyChecksResponse;

  if (ROUTES[ctx.REQUEST]) return ROUTES[ctx.REQUEST].handler(ctx);
  if (ctx.METHOD === "GET" && existsSync(ctx.FULL_PATH)) {
    const file = await Deno.open(ctx.FULL_PATH, { read: true });
    return new Response(file.readable);
  }

  return new Response("Not found", { status: 404 });
}

export async function handleHostingRequest(ctx: RequestContext,): Promise<Response> {
  const safetyChecksResponse: Response | null = hostingSafetyChecks(ctx);
  if (safetyChecksResponse !== null) return safetyChecksResponse;

  if (existsSync(ctx.FULL_PATH)) {
    const file = await Deno.open(ctx.FULL_PATH, { read: true });
    return new Response(file.readable);
  }

  return new Response("Not found", { status: 404 });
}

export function handleCheckDomain(ctx: RequestContext,): Response {
  const domain = ctx.PARAMS?.domain?.toLowerCase();
  if (domain && existsSync(resolve(join(ROOT, domain)))) {
    return new Response(
      JSON.stringify({ message: "OK" }),
      { status: 200 },
    );
  } else {
    return new Response(
      JSON.stringify({ message: `Domain ${domain} not found.` }),
      { status: 404 },
    );
  }
}

export async function handleCreateDomain(ctx: RequestContext,): Promise<Response> {
  const token = ctx.PARAMS.token;
  const newDomain = ctx.PARAMS.domain.toLowerCase();
  const tokenDomainsKey = ["token_domains", token];
  const domainTokenKey = ["domain_token", newDomain];

  let myIP: string;
  if (import.meta.url.includes("/Users/rich/Code")) {
    myIP = "127.0.0.1";
  } else {
    myIP = (await Deno.resolveDns("api.sssg.dev", "A"))[0];
  }

  let dnsResponse: string[] = [];
  try {
    if (import.meta.url.includes("/Users/rich/Code")) {
      dnsResponse = ["127.0.0.1"];
    } else {
      dnsResponse = await Deno.resolveDns(newDomain, "A");
    }
  } catch (_e) {
    console.log("Domain not found:", newDomain);
  }

  if (dnsResponse.length === 0 || !dnsResponse.includes(myIP)) {
    return new Response(
      JSON.stringify({ message: `DNS is not configured properly for ${newDomain}. Configure an "A" record that points to ${myIP} for ${newDomain} and then try again.`, }),
      { status: 409 },
    );
  }

  if (token && token.length > 0 && newDomain && newDomain.length > 0) {
    let [domains, domain] = await KV.getMany([tokenDomainsKey, domainTokenKey]);
    if (domains.value === null) {
      return new Response("Not registered", { status: 401 });
    } else {
      if (domain.value === null) {
        await KV.set(domainTokenKey, token);
        if (Array.isArray(domains.value) && domains.value.includes(newDomain)) {
          return new Response(
            JSON.stringify({ message: "Domain already registered" }),
            { status: 400 });
        } else {
          await KV.set(
            tokenDomainsKey,
            Array.isArray(domains.value)
              ? domains.value.concat(newDomain)
              : [newDomain],
          );
          await Deno.mkdir(resolve(join(ROOT, newDomain)));
          domains = await KV.get(tokenDomainsKey);
          return new Response(JSON.stringify({ domains: domains.value }));
        }
      } else {
        if (domain.value !== token) {
          return new Response("Bad request", {
            status: 400,
          });
        } else {
          domains = await KV.get(tokenDomainsKey);
          return new Response(JSON.stringify({ domains: domains.value }));
        }
      }
    }
  } else {
    return new Response(
      JSON.stringify({
        status: "ERROR",
        message: "Bad request: missing token or domain",
      }),
      { status: 400 },
    );
  }
}

export async function handleDeleteDomain(ctx: RequestContext,): Promise<Response> {
  const id: string | null = ctx.PARAMS.token;
  const deleteDomain: string | null = ctx.PARAMS.domain?.toLowerCase();
  if (!id || id.length === 0 || !deleteDomain || deleteDomain.length === 0) {
    return new Response(
      JSON.stringify({
        status: "ERROR",
        message: "Bad request: missing token or domain",
      }),
      { status: 400 },
    );
  }
  const domains = await KV.get(["token_domains", id]);
  const domain = await KV.get(["domain_token", deleteDomain]);
  if (domains.value === null || domain.value === null || domain.value !== id) {
    return new Response("Unauthorized", { status: 401 });
  } else {
    if (Array.isArray(domains.value) && domains.value.includes(deleteDomain)) {
      await KV.delete(["domain_token", deleteDomain]);
      await KV.set(
        ["token_domains", id],
        domains.value.filter((d: string) => d !== deleteDomain),
      );
      if (existsSync(resolve(join(ROOT, deleteDomain)))) {
        await Deno.remove(resolve(join(ROOT, deleteDomain)), {
          recursive: true,
        });
      }
      const updatedDomains = await KV.get(["token_domains", id]);
      return new Response(JSON.stringify({ domains: updatedDomains.value }));
    } else {
      return new Response(JSON.stringify({ domains: domains.value }));
    }
  }
}

export async function handleGetDomains(ctx: RequestContext): Promise<Response> {
  const token = ctx.PARAMS.token;
  if (token && token.length > 0) {
    const domains = await KV.get(["token_domains", token]);
    const responseDomains = Array.isArray(domains.value) ? domains.value : [];
    return new Response(JSON.stringify({ domains: responseDomains }));
  } else {
    return new Response(
      JSON.stringify({
        status: "ERROR",
        message: "Bad request: missing token",
      }),
      { status: 400 },
    );
  }
}

export async function handleRegistration(ctx: RequestContext,): Promise<Response> {
  const id = ulid();
  const domain = ctx.PARAMS.domain;
  const domains = await KV.get(["token_domains", id]);
  if (domains.value === null) {
    await KV.set(["token_domains", id], []);
  }
  ctx.PARAMS.token = id;
  const response = await handleCreateDomain(ctx);
  if (response.status !== 200) {
    return response;
  }
  const stagingKey = ulid();
  const stagingDomain = stagingKey + ".sssg.dev";
  ctx.PARAMS.domain = stagingDomain;
  await handleCreateDomain(ctx);
  return new Response(
    JSON.stringify({ token: id, stagingDomain, productionDomain: domain }),
  );
}

export async function handleRenameDomain(ctx: RequestContext,): Promise<Response> {
  const id = ctx.PARAMS.token;
  const domain = ctx.PARAMS.domain.toLowerCase();
  const newDomain = ctx.PARAMS.newDomain.toLowerCase();
  if (
    id && id.length > 0 &&
    domain && domain.length > 0 &&
    newDomain && newDomain.length > 0
  ) {
    const domains = await KV.get(["token_domains", id]);
    const sourceDomain = await KV.get(["domain_token", domain]);
    const destinationDomain = await KV.get(["domain_token", newDomain]);
    if (
      domains.value === null ||
      sourceDomain.value === null || sourceDomain.value !== id ||
      (destinationDomain.value !== null && destinationDomain.value !== id)
    ) {
      return new Response("Unauthorized", { status: 401 });
    } else {
      if (
        Array.isArray(domains.value) && domains.value.includes(domain)
      ) {
        await KV.delete(["domain_token", domain]);
        await KV.set(["domain_token", newDomain], id);
        await KV.set(
          ["token_domains", id],
          domains.value.filter((d: string) => d !== domain).concat(
            newDomain,
          ).sort(),
        );
        if (existsSync(resolve(join(ROOT, domain)))) {
          await Deno.rename(
            resolve(join(ROOT, domain)),
            resolve(join(ROOT, newDomain)),
          );
        }
        const updatedDomains = await KV.get(["token_domains", id]);
        return new Response(JSON.stringify({ domains: updatedDomains.value }));
      } else {
        return new Response(JSON.stringify({ domains: domains.value }));
      }
    }
  } else {
    return new Response(
      JSON.stringify({
        status: "ERROR",
        message: "Bad request: missing token, domain, or newDomain",
      }),
      { status: 400 },
    );
  }
}

export async function handleUploadDomain(ctx: RequestContext,): Promise<Response> {
  let id: string | undefined, domain: string | undefined;
  if (ctx?.FORM_DATA === null) {
    return new Response("Bad request: missing form data", { status: 400 });
  }
  for (const [field, val] of ctx?.FORM_DATA?.entries()) {
    if (val instanceof File) continue;
    if (field === "token") id = val.toString();
    else if (field === "domain") domain = val.toString().toLowerCase();
  }

  if (!id || !domain) {
    return new Response("Bad request: missing token or domain", {
      status: 400,
    });
  }
  const domains = await KV.get(["token_domains", id]);
  const existingDomain = await KV.get(["domain_token", domain]);
  if (
    domains.value === null ||
    (Array.isArray(domains.value) && !domains.value.includes(domain)) ||
    existingDomain.value === null || existingDomain.value !== id
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  const zipFilename = resolve(join("./tmp/", domain + ".tgz"));
  for (const [_field, val] of ctx.FORM_DATA.entries()) {
    if (!(val instanceof File)) continue;
    await Deno.writeFile(
      `${zipFilename}`,
      new Uint8Array(await val.arrayBuffer()),
    );
  }

  if (existsSync(resolve(join(ROOT, domain)))) {
    await Deno.remove(resolve(join(ROOT, domain)), { recursive: true });
  }
  await Deno.mkdir(resolve(join(ROOT, domain)), { recursive: true });

  for await (
    const entry of (await Deno.open(zipFilename))
      .readable
      .pipeThrough(new DecompressionStream("gzip"))
      .pipeThrough(new UntarStream())
  ) {
    const path = normalize(entry.path);
    const newPath = resolve(join(ROOT, domain, dirname(path)));
    if (!existsSync(newPath)) await Deno.mkdir(newPath, { recursive: true });
    await entry.readable?.pipeTo(
      (await Deno.create(resolve(join(ROOT, domain, path)))).writable,
    );
  }

  if (existsSync(zipFilename)) await Deno.remove(zipFilename);

  return new Response(
    JSON.stringify({ status: "OK", message: "Domain deployed successfully" }),
    { status: 200 },
  );
}

Deno.env.delete("DENO_ENV");
