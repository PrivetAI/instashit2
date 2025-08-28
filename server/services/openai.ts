import OpenAI from "openai";
import { log } from '../vite';

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || ""
});

export interface AnalysisResult {
  relevanceScore: number;
  reasoning: string;
  topics: string[];
  engagement: {
    potential: number;
    factors: string[];
  };
}

export interface CommentResult {
  comment: string;
  tone: string;
  confidence: number;
}

export async function analyzeReel(
  reelData: {
    title: string;
    comments: string[];
    likes: number;
    commentCount: number;
    shares: number;
  },
  analysisPrompt: string
): Promise<AnalysisResult> {
  try {
    const prompt = `${analysisPrompt}

Reel Data:
- Title: ${reelData.title}
- Likes: ${reelData.likes}
- Comments: ${reelData.commentCount}
- Shares: ${reelData.shares}
- Sample Comments: ${reelData.comments.slice(0, 10).join(", ")}

Please analyze this content and respond with JSON in this format:
{
  "relevanceScore": number (1-10),
  "reasoning": "detailed explanation",
  "topics": ["topic1", "topic2"],
  "engagement": {
    "potential": number (1-10),
    "factors": ["factor1", "factor2"]
  }
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert social media analyst. Analyze content for engagement potential and relevance."
        },
        {
          role: "user",
          content: prompt                               
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      relevanceScore: Math.max(1, Math.min(10, result.relevanceScore || 5)),
      reasoning: result.reasoning || "Analysis completed",
      topics: result.topics || [],
      engagement: {
        potential: Math.max(1, Math.min(10, result.engagement?.potential || 5)),
        factors: result.engagement?.factors || []
      }
    };
  } catch (error) {
    log(`OpenAI analysis error: ${error}`);
    throw new Error(`Failed to analyze reel: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function generateComment(
  reelData: {
    title: string;
    comments: string[];
    topics: string[];
  },
  commentPrompt: string
): Promise<CommentResult> { 
  try {
    const prompt = `${commentPrompt}

Reel Data:
- Title: ${reelData.title}
- Topics: ${reelData.topics.join(", ")}
- Context from comments: ${reelData.comments.slice(0, 5).join(", ")}

Generate a natural, authentic comment that feels human. Respond with JSON in this format:
{
  "comment": "your generated comment (under 100 chars)",
  "tone": "friendly/excited/thoughtful/etc",
  "confidence": number (0-1)
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a creative social media user who writes engaging, authentic comments. Be natural and conversational."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    return {
      comment: result.comment || "Great content! 🔥",
      tone: result.tone || "friendly",
      confidence: Math.max(0, Math.min(1, result.confidence || 0.7))
    };
  } catch (error) {
    log(`OpenAI comment generation error: ${error}`);
    throw new Error(`Failed to generate comment: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
