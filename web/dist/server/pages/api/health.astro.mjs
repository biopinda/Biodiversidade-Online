import { a as getCollection } from '../../chunks/mongo_BayYJVct.mjs';
export { renderers } from '../../renderers.mjs';

const GET = async () => {
  try {
    const taxa = await getCollection("dwc2json", "taxa");
    const mongoStatus = taxa ? "healthy" : "unavailable";
    const healthCheck = {
      status: "ok",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      services: {
        mongodb: mongoStatus
      }
    };
    const statusCode = mongoStatus === "healthy" ? 200 : 503;
    return new Response(JSON.stringify(healthCheck), {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache"
      }
    });
  } catch (error) {
    console.error("Health check failed:", error);
    return new Response(
      JSON.stringify({
        status: "error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
        services: {
          mongodb: "error"
        }
      }),
      {
        status: 503,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache"
        }
      }
    );
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
