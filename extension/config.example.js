// Sytelens — config template (committed to git, placeholders only).
//
// Copy this file to `config.js` and fill in the real values. `config.js` is
// git-ignored, so your endpoint + API key never reach the repo. The build
// bundles config.js into the shipped extension.
//
//   cp config.example.js config.js   # then edit config.js
//
// Note: values in the shipped extension are visible to end users (a browser
// extension can't hold a true secret). The backend is protected by API Gateway
// throttling + an AWS budget cap, not by hiding this key. Rotate it if abused.

export const CONFIG = {
  endpoint: "", // e.g. https://xxxx.execute-api.us-east-1.amazonaws.com/prod/analyze
  apiKey: "",   // API Gateway x-api-key value
};
