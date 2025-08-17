import type { App } from "../types";
import type { AIConfig, EmailConfig, IConfigStrategy, StorageConfig } from "./IConfigStrategy";

export class ProductionConfig implements IConfigStrategy {
  getBaseUrl(): string {
    return `https://${process.env.DOMAIN || "ai-digest.bhekani.com"}`;
  }

  getApps(): App[] {
    return [
      {
        name: "LinkedIn",
        icon: "https://content.linkedin.com/content/dam/me/business/en-us/amp/brand-site/v2/bg/LI-Bug.svg.original.svg",
      },
      {
        name: "Substack",
        icon: "https://substackcdn.com/image/fetch/w_96,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack.com%2Fimg%2Fsubstack-nomargin.png",
      },
      {
        name: "Reddit",
        icon: "https://www.redditstatic.com/desktop2x/img/favicon/favicon-96x96.png",
      },
      { name: "Twitter", icon: "https://abs.twimg.com/icons/apple-touch-icon-192x192.png" },
      { name: "Perplexity", icon: "https://www.perplexity.ai/favicon.ico" },
      { name: "Medium", icon: "https://miro.medium.com/max/1400/1*psYl0y9DUzZWtHzFJLIvTw.png" },
      {
        name: "YouTube",
        icon: "https://www.youtube.com/s/desktop/12d6b690/img/favicon_144x144.png",
      },
      { name: "Product Hunt", icon: "https://ph-static.imgix.net/ph-ios-icon.png" },
      { name: "Hacker News", icon: "https://news.ycombinator.com/y18.svg" },
      { name: "GitHub", icon: "https://github.githubassets.com/favicons/favicon.png" },
      {
        name: "The Verge",
        icon: "https://cdn.vox-cdn.com/uploads/chorus_asset/file/7395359/ios-icon.0.png",
      },
      {
        name: "TechCrunch",
        icon: "https://techcrunch.com/wp-content/uploads/2015/02/cropped-cropped-favicon-gradient.png",
      },
      { name: "Wired", icon: "https://www.wired.com/verso/static/wired/assets/favicon.ico" },
      { name: "Ars Technica", icon: "https://cdn.arstechnica.net/favicon.ico" },
    ];
  }

  getAIKeywords(): string[] {
    return [
      "artificial intelligence",
      "machine learning",
      "deep learning",
      "neural network",
      "natural language processing",
      "computer vision",
      "robotics",
      "automation",
      "data science",
      "big data",
      "predictive analytics",
      "chatbot",
      "voice assistant",
      "reinforcement learning",
      "supervised learning",
      "unsupervised learning",
      "generative AI",
      "AI ethics",
      "AI bias",
      "explainable AI",
      "AI governance",
      "TensorFlow",
      "PyTorch",
      "scikit-learn",
      "Keras",
      "OpenCV",
      "GPT",
      "BERT",
      "transformer model",
      "large language model",
      "LLM",
      "prompt engineering",
      "fine-tuning",
      "transfer learning",
      "few-shot learning",
      "zero-shot learning",
      "edge AI",
      "federated learning",
      "AutoML",
      "AI chip",
      "quantum computing",
      "neuromorphic computing",
      "AI in healthcare",
      "AI in finance",
      "AI in education",
      "AI in manufacturing",
      "autonomous vehicle",
      "self-driving car",
      "drone",
      "smart city",
      "AI startup",
      "AI research",
      "AI breakthrough",
      "AI innovation",
      "OpenAI",
      "DeepMind",
      "Anthropic",
      "Hugging Face",
      "Stability AI",
      "ChatGPT",
      "GPT-4",
      "Claude",
      "Gemini",
      "Llama",
      "Mistral",
      "Midjourney",
      "DALL-E",
      "Stable Diffusion",
      "RunwayML",
      "vector database",
      "embedding",
      "RAG",
      "retrieval augmented generation",
      "agent",
      "multi-agent",
      "AI safety",
      "alignment",
      "AGI",
      "ASI",
    ];
  }

  getStorageConfig(): StorageConfig {
    const storageType = process.env.STORAGE_TYPE as "azure" | "s3" | "dynamodb";

    switch (storageType) {
      case "s3":
        return {
          type: "s3",
          bucketName: process.env.S3_BUCKET!,
        };
      case "dynamodb":
        return {
          type: "dynamodb",
          tableName: process.env.DYNAMODB_TABLE!,
        };
      default:
        return {
          type: "azure",
          connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING!,
        };
    }
  }

  getEmailConfig(): EmailConfig {
    return {
      clientId: process.env.GMAIL_CLIENT_ID!,
      clientSecret: process.env.GMAIL_CLIENT_SECRET!,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN!,
      recipientEmail: process.env.RECIPIENT_EMAIL!,
    };
  }

  getAIConfig(): AIConfig {
    return {
      openAIKey: process.env.OPENAI_API_KEY!,
      heliconeKey: process.env.HELICONE_API_KEY,
      keywords: this.getAIKeywords(),
    };
  }

  getMaxEmailsPerBatch(): number {
    return 50;
  }

  getMaxArticleFetchConcurrency(): number {
    return 5;
  }

  getArticleFetchTimeout(): number {
    return 30000; // 30 seconds
  }
}
