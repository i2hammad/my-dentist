// Shared networking constants for auth requests.
//
// No axios call in the app sets a timeout, so a request that stalls (dropped
// Wi-Fi, captive portal that never responds, sleeping shared host) hangs
// forever — the button spins with no way out. A bounded timeout turns that into
// a normal, reportable failure.

// Generous enough for the shared host's cold starts (~1s warm, occasionally
// several seconds under load) while still failing in a human timeframe.
export const REQUEST_TIMEOUT = 20000;

// Shown whenever the request never produced a response. Axios reports these as
// the bare string "Network Error", which gives the user nothing to act on.
export const NETWORK_MSG =
  'Could not reach the server. Check your internet connection and try again.';

// True when the failure was transport-level (no HTTP response at all) rather
// than the API rejecting the request.
export const isNetworkError = (error) => !error?.response;
