// Shared capability helpers used by both the gateway (/v1/models) and admin (/api/models)
// endpoints so toolCallSupported computation stays in one place.

const OPENAI_COMPAT_PROVIDERS = new Set(["openai", "deepseek", "moonshot", "xai", "groq", "litellm"]);

// Returns true when Arbr can route tool/function calls to this model:
//   • OpenAI-compat providers: proxied verbatim — upstream handles tools natively.
//   • bedrock-nova, Amazon Nova model IDs: handled via ChatBedrockConverse.bindTools().
//   • Everything else (gemini, anthropic, non-Nova Bedrock): returns 501 for tools today.
function supportsTools(provider, modelId) {
  if (OPENAI_COMPAT_PROVIDERS.has(provider)) return true;
  if (provider === "bedrock-nova") return /amazon\.nova|nova-lite|nova-micro|nova-pro/i.test(modelId || "");
  return false;
}

module.exports = { supportsTools };
