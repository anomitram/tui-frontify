/* Shared settings for the Frontify export tools. Values come from frontify.config.json and
 * can be overridden per run: FRONTIFY_HOST, FRONTIFY_DOC_ID, FRONTIFY_PORTAL_ID,
 * FRONTIFY_PROJECT_ID, FRONTIFY_LANGUAGE. Never put credentials here (auth is injected). */
import { readFileSync } from 'node:fs';

const base = JSON.parse(readFileSync(new URL('./frontify.config.json', import.meta.url)));
const env = process.env;
const CFG = {
  ...base,
  host: env.FRONTIFY_HOST || base.host,
  documentId: Number(env.FRONTIFY_DOC_ID || base.documentId),
  portalId: Number(env.FRONTIFY_PORTAL_ID || base.portalId),
  projectId: Number(env.FRONTIFY_PROJECT_ID || base.projectId),
  language: env.FRONTIFY_LANGUAGE || base.language,
};
CFG.hostname = new URL(CFG.host).hostname;
export default CFG;
