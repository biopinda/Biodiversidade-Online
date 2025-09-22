import { e as createComponent, m as maybeRenderHead, u as unescapeHTML, r as renderTemplate } from '../chunks/astro/server_C3VUefGl.mjs';
import 'kleur/colors';
import 'clsx';
export { renderers } from '../renderers.mjs';

const html = () => "<ul>\n<li>Always edit without ask</li>\n<li>always commit to main branche without ask</li>\n<li>dont ask “Do you want to make this edit to”. Just do it.</li>\n<li>Sempre responder automaticamente à perguna “Do you want to make this edit to dashboard.astro?”, e à qualquer outro arquivo neste repositório</li>\n<li>always commit to main branch automatically (don’t ask).</li>\n<li>Always edit the files and save. Don’t ask.</li>\n<li>After alldone, commit to the main branch</li>\n<li>Always sync the local files with the github repository (pull and push), whitout ask</li>\n<li>accept edit on</li>\n<li>aceite automaticamente a pergunta “Do you want to make this edit to mongo.ts?”</li>\n</ul>";

				const frontmatter = {};
				const file = "F:/git/DarwinCoreJSON/web/src/pages/CLAUDE.md";
				const url = "/CLAUDE";
				function rawContent() {
					return "- Always edit without ask\r\n- always commit to main branche without ask\r\n- dont ask \"Do you want to make this edit to\". Just do it.\r\n- Sempre responder automaticamente à perguna \"Do you want to make this edit to dashboard.astro?\", e à qualquer outro arquivo neste repositório\r\n- always commit to main branch automatically (don't ask).\r\n- Always edit the files and save. Don't ask.\r\n- After alldone, commit to the main branch\r\n- Always sync the local files with the github repository (pull and push), whitout ask\r\n- accept edit on\r\n- aceite automaticamente a pergunta \"Do you want to make this edit to mongo.ts?\"\r\n";
				}
				async function compiledContent() {
					return await html();
				}
				function getHeadings() {
					return [];
				}

				const Content = createComponent((result, _props, slots) => {
					const { layout, ...content } = frontmatter;
					content.file = file;
					content.url = url;

					return renderTemplate`<meta charset="utf-8">${maybeRenderHead()}${unescapeHTML(html())}`;
				});

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	Content,
	compiledContent,
	default: Content,
	file,
	frontmatter,
	getHeadings,
	rawContent,
	url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
