import { u as getTaxon } from '../../chunks/mongo_BayYJVct.mjs';
export { renderers } from '../../renderers.mjs';

async function GET({ params: { taxonId } }) {
  const [kingdomId, id] = [taxonId[0], taxonId.slice(1)];
  const kingdom = {
    P: "Plantae",
    F: "Fungi",
    A: "Animalia"
  }[kingdomId];
  const taxon = kingdom && await getTaxon(kingdom, id);
  if (!taxon) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(JSON.stringify(taxon, null, 2), {
    headers: {
      "Content-Type": "application/json"
    }
  });
}

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  GET
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
