import { handleSoumissionRequest } from "../../worker.js";

export function onRequest({ request, env }) {
  return handleSoumissionRequest(request, env);
}
