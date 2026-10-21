export type CampaignQrState = {
  key: string;
  request: number;
  status: "loading" | "generated" | "ready" | "error";
  dataUrl: string;
};

export type CampaignQrAction =
  | {type: "start"; key: string; request: number}
  | {type: "generated"; request: number; dataUrl: string}
  | {type: "loaded" | "failed"; request: number};

export function campaignQrReducer(state: CampaignQrState, action: CampaignQrAction): CampaignQrState {
  if (action.type === "start") {
    return {key: action.key, request: action.request, status: "loading", dataUrl: ""};
  }
  // A late generation or image event must never replace the current campaign/retry.
  if (state.request !== action.request) return state;
  if (action.type === "failed") return {...state, status: "error", dataUrl: ""};
  if (action.type === "generated" && state.status === "loading") {
    return {...state, status: "generated", dataUrl: action.dataUrl};
  }
  if (action.type === "loaded" && state.status === "generated") return {...state, status: "ready"};
  return state;
}

export function generateCampaignQr(
  url: string,
  generate: (url: string) => Promise<string>,
  receive: (dataUrl: string) => void,
  fail: () => void,
) {
  let cancelled = false;
  // Handles synchronous generator failures as well as rejected promises.
  Promise.resolve().then(() => generate(url)).then(
    dataUrl => {if (!cancelled) dataUrl ? receive(dataUrl) : fail();},
    () => {if (!cancelled) fail();},
  );
  return () => {cancelled = true;};
}
