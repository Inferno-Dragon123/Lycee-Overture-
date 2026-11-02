// Keep the article DTO explicit; avoid expanding recursive document nodes through Nitro's route inference.
export const strategyRequest = ($fetch as typeof import('ofetch').ofetch).create({headers:{'x-lycee-editor-version':'2'}});
