import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.202.0/testing/asserts.ts";
import { handleDomainRequest } from "./domainHandlers.ts";
import { getContext, RequestContext } from "./router.ts";
import { ulid } from "jsr:@std/ulid/ulid";

await Deno.env.set("DENO_ENV", "test")

Deno.test("POST /api/register", async () => {
  const server = Deno.serve({ port: 8888}, async (req: Request): Promise<Response> => {
    const ctx: RequestContext = await getContext(req);
    return await handleDomainRequest(ctx);
  });

  const uniqueId = ulid().toLowerCase();
  const domain = uniqueId + ".sssg.dev";
  const response = await fetch("http://domains.local:8888/api/register" + "?domain=" + domain, {
    method: "POST",
    body: JSON.stringify({})
  });
  const body = await response.json();
  assertEquals(response.status, 200);
  assertEquals(body.productionDomain, domain);
  assertStringIncludes(body.stagingDomain, ".sssg.dev");
  assertExists(body.token);

  server.shutdown()
  Deno.removeSync(`/var/www/${body.productionDomain}`)
  Deno.removeSync(`/var/www/${body.stagingDomain}`)
});

// Deno.test("GET request", async () => {
//   const response = await fetch("http://localhost:8080");
//   const body = await response.text();
//   assertEquals(response.status, 200);
//   assertEquals(body, "Hello World");
// });

// Deno.test("PUT request", async () => {
//   const response = await fetch("http://localhost:8080", {
//     method: "PUT",
//     body: "Put this data",
//   });
//   const body = await response.text();
//   assertEquals(response.status, 200);
//   assertEquals(body, "Received PUT: Put this data");
// });

// Deno.test("DELETE request", async () => {
//   const response = await fetch("http://localhost:8080", { method: "DELETE" });
//   const body = await response.text();
//   assertEquals(response.status, 200);
//   assertEquals(body, "Deleted!");
// });

// Deno.test("POST + file upload", async () => {
//   const formData = new FormData();
//   const fileContent = new Blob(["This is a test file"], { type: "text/plain" });
//   formData.append("file", new File([fileContent], "testfile.txt"));

//   const response = await fetch("http://localhost:8080/upload", {
//     method: "POST",
//     body: formData,
//   });

//   const body = await response.text();
//   assertEquals(response.status, 200);
//   assertEquals(body, "Uploaded file: testfile.txt");
// });

// Deno.test("teardown: stop server", () => {
//   controller.abort(); // Stop the server
// });

Deno.env.delete("DENO_ENV")
