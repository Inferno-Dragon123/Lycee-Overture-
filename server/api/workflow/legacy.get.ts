import { loadLegacyWorkflow } from '../../utils/workflow-legacy';
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'public, max-age=60');
  return loadLegacyWorkflow(getQuery(event));
});
