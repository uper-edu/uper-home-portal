// Fallback model selection when no CRM AI configuration has been saved.
// OPENAI_MODEL overrides primary. Existing CRM model selections take precedence.
// Keep provider credentials in the private environment configuration.

export default {
  "primary": "gpt-6.1-sol",
  "fallback": "deepseek-chat"
};
