export default defineEventHandler(async event => {
  const pdf = await useStorage('assets:rule-downloads').getItemRaw('lo-rules.pdf');
  if (!pdf) throw createError({ statusCode: 404, message: '规则原稿暂不可用' });
  setHeader(event, 'Content-Type', 'application/octet-stream');
  if (getQuery(event).raw !== '1') setHeader(event, 'Content-Disposition', "attachment; filename=lo-rules.pdf; filename*=UTF-8''" + encodeURIComponent('LO规则妙妙小解.pdf'));
  setHeader(event, 'Cache-Control', 'public, max-age=86400');
  return pdf;
});
