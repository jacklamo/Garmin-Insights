// Pure classifier. `threw`: fetch rejected. `controlResolved`: a no-cors request to the same URL resolved.
export function classifyFailure({ threw, controlResolved, status }) {
  if (threw) return controlResolved ? 'cors' : 'network';
  if (status >= 200 && status < 300) return 'ok';
  return `http_${status}`;
}
