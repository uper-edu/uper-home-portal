import {useEffect, useReducer, useRef, useState} from "react";
import QRCode from "qrcode";
import {campaignQrReducer, generateCampaignQr} from "../../utils/campaignQr";

const generateQrCode = (value: string) => QRCode.toDataURL(value, {
  width: 320, margin: 2, color: {dark: "#0f172a", light: "#ffffff"},
});

export function useCampaignQr(url: string | null, generate = generateQrCode) {
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  const key = JSON.stringify([url, revision]);
  const [state, dispatch] = useReducer(campaignQrReducer, {
    key: "", request: 0, status: "loading", dataUrl: "",
  });
  useEffect(() => {
    const request = ++sequence.current;
    dispatch({type: "start", key, request});
    if (!url) return;
    return generateCampaignQr(url, generate, dataUrl => dispatch({type: "generated", request, dataUrl}),
    () => dispatch({type: "failed", request}));
  }, [url, key, generate]);
  // Hide previous-campaign pixels before the effect starts the new generation.
  const current = !!url && state.key === key;
  return {
    dataUrl: current ? state.dataUrl : "",
    status: current ? state.status : "loading" as const,
    ready: current && state.status === "ready",
    request: state.request,
    loaded: () => dispatch({type: "loaded", request: state.request}),
    failed: () => dispatch({type: "failed", request: state.request}),
    retry: () => setRevision(value => value + 1),
  };
}
