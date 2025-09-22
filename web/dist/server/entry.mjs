import { renderers } from './renderers.mjs';
import { c as createExports, s as serverEntrypointModule } from './chunks/_@astrojs-ssr-adapter_Brz3D1_d.mjs';
import { manifest } from './manifest_CmtknqD9.mjs';

const serverIslandMap = new Map();;

const _page0 = () => import('./pages/_image.astro.mjs');
const _page1 = () => import('./pages/api/chat.astro.mjs');
const _page2 = () => import('./pages/api/family/_kingdom_.astro.mjs');
const _page3 = () => import('./pages/api/health.astro.mjs');
const _page4 = () => import('./pages/api/occurrences.astro.mjs');
const _page5 = () => import('./pages/api/plotoccurrences.astro.mjs');
const _page6 = () => import('./pages/api/taxa.astro.mjs');
const _page7 = () => import('./pages/api/taxacountbystate.astro.mjs');
const _page8 = () => import('./pages/api/taxonomicstatus/_kingdom_.astro.mjs');
const _page9 = () => import('./pages/api/tree.astro.mjs');
const _page10 = () => import('./pages/api.astro.mjs');
const _page11 = () => import('./pages/calendario-fenologico.astro.mjs');
const _page12 = () => import('./pages/chat.astro.mjs');
const _page13 = () => import('./pages/claude.astro.mjs');
const _page14 = () => import('./pages/dashboard.astro.mjs');
const _page15 = () => import('./pages/mapa.astro.mjs');
const _page16 = () => import('./pages/privacy.astro.mjs');
const _page17 = () => import('./pages/taxa.astro.mjs');
const _page18 = () => import('./pages/taxon/_taxonid_.json.astro.mjs');
const _page19 = () => import('./pages/taxon/_taxonid_/ocorrencias.astro.mjs');
const _page20 = () => import('./pages/taxon/_taxonid_.astro.mjs');
const _page21 = () => import('./pages/tree.astro.mjs');
const _page22 = () => import('./pages/index.astro.mjs');
const pageMap = new Map([
    ["node_modules/.pnpm/astro@5.13.5_@types+node@22_9dae374f75b7b09dde1676337edd23b3/node_modules/astro/dist/assets/endpoint/node.js", _page0],
    ["src/pages/api/chat.ts", _page1],
    ["src/pages/api/family/[kingdom].ts", _page2],
    ["src/pages/api/health.ts", _page3],
    ["src/pages/api/occurrences.ts", _page4],
    ["src/pages/api/plotOccurrences.ts", _page5],
    ["src/pages/api/taxa.ts", _page6],
    ["src/pages/api/taxaCountByState.ts", _page7],
    ["src/pages/api/taxonomicStatus/[kingdom].ts", _page8],
    ["src/pages/api/tree.ts", _page9],
    ["src/pages/api.astro", _page10],
    ["src/pages/calendario-fenologico.astro", _page11],
    ["src/pages/chat.astro", _page12],
    ["src/pages/CLAUDE.md", _page13],
    ["src/pages/dashboard.astro", _page14],
    ["src/pages/mapa.astro", _page15],
    ["src/pages/privacy.astro", _page16],
    ["src/pages/taxa.astro", _page17],
    ["src/pages/taxon/[taxonId].json.ts", _page18],
    ["src/pages/taxon/[taxonId]/ocorrencias.astro", _page19],
    ["src/pages/taxon/[taxonId].astro", _page20],
    ["src/pages/tree.astro", _page21],
    ["src/pages/index.astro", _page22]
]);

const _manifest = Object.assign(manifest, {
    pageMap,
    serverIslandMap,
    renderers,
    actions: () => import('./_noop-actions.mjs'),
    middleware: () => import('./_noop-middleware.mjs')
});
const _args = {
    "mode": "standalone",
    "client": "file:///F:/git/DarwinCoreJSON/web/dist/client/",
    "server": "file:///F:/git/DarwinCoreJSON/web/dist/server/",
    "host": true,
    "port": 4321,
    "assets": "_astro",
    "experimentalStaticHeaders": false
};
const _exports = createExports(_manifest, _args);
const handler = _exports['handler'];
const startServer = _exports['startServer'];
const options = _exports['options'];
const _start = 'start';
if (Object.prototype.hasOwnProperty.call(serverEntrypointModule, _start)) {
	serverEntrypointModule[_start](_manifest, _args);
}

export { handler, options, pageMap, startServer };
