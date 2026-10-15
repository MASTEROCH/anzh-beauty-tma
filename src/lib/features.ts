// Client-side feature switches — one constant per feature, read where the feature shows.
// Not tied to the server or to env (VITE_* would need an env push to Vercel).

/** AI assistant: the floating bubble (App.tsx) and its three mentions in onboarding.
 *  Hidden until it is reworked (owner's word 06.10: "hide the AI agent icon for now —
 *  we will finish it later"). Styles and the component stay for the return: flip to true. */
export const AI_ASSISTANT: boolean = false;
