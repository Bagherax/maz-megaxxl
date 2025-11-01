import { useState, useEffect } from 'react';
import { FeedItem, Ad, PaidAd, LiveTrade, Auction, AiSuggestion } from '../types';
import { GoogleGenAI, Type } from "@google/genai";

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

// Helper to shuffle an array
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const useFeedComposer = () => {
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New function to generate AI suggestions dynamically
  const generateAiSuggestions = async (contextItem: Ad): Promise<AiSuggestion[]> => {
    // Fallback to static data if API key is not available
    if (!process.env.API_KEY) {
      console.warn("API_KEY not found. Falling back to static AI suggestions.");
      const res = await fetch('/features/Feed/data/aiFeed.json');
      return res.json();
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `You are an AI assistant for a P2P marketplace called MAZDADY. Your goal is to create engaging suggestions to help users discover new things. Based on a user's recent interest in '${contextItem.title}', generate 1 creative suggestion for them to explore. For the suggestion, provide a catchy 'title', a brief 'description', and a 'reason' explaining why it's recommended. The reason should be phrased like 'Because you viewed...'. Return the result as a JSON array containing a single object.`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'A catchy title for the suggestion card.' },
                description: { type: Type.STRING, description: 'A brief, engaging description of what the user can explore.' },
                reason: { type: Type.STRING, description: 'A short sentence explaining why this is suggested, starting with "Because you..."' },
              },
              required: ['title', 'description', 'reason'],
            },
          },
        },
      });

      const suggestions: Omit<AiSuggestion, 'id'>[] = JSON.parse(response.text);

      // Add unique IDs to the suggestions
      return suggestions.map((s, i) => ({
        ...s,
        id: `ai_${contextItem.id}_${i}_${Date.now()}`,
      }));

    } catch (error) {
      console.error("Error generating AI suggestions:", error);
      // Fallback to static data on error
      const res = await fetch('/features/Feed/data/aiFeed.json');
      return res.json();
    }
  };

  const composeFeed = async () => {
    setIsLoading(true);
    try {
      // Fetch data from all sources in parallel
      const [
        adsRes,
        paidAdsRes,
        liveTradesRes,
        auctionsRes
      ] = await Promise.all([
        fetch('/features/Feed/data/masonryAds.json'),
        fetch('/features/Feed/data/paidAds.json'),
        fetch('/features/Feed/data/liveTrades.json'),
        fetch('/features/Feed/data/auctions.json'),
      ]);
      
      const ads: Ad[] = await adsRes.json();
      const paidAds: PaidAd[] = await paidAdsRes.json();
      const liveTrades: LiveTrade[] = await liveTradesRes.json();
      const auctions: Auction[] = await auctionsRes.json();

      // Generate AI suggestions dynamically based on a random ad as context
      const contextAd = ads[Math.floor(Math.random() * ads.length)];
      const aiSuggestions = await generateAiSuggestions(contextAd);

      // Weight ratios
      // For a ~20 item feed:
      // Normal Ads = 60% (12)
      // Paid Ads = 10% (2)
      // Live Trades = 15% (3)
      // Auctions = 10% (2)
      // AI Suggestions = 5% (1)

      const composed: FeedItem[] = [
        ...ads.slice(0, 12).map((item): FeedItem => ({ id: item.id, type: 'ad', data: item })),
        ...paidAds.slice(0, 2).map((item): FeedItem => ({ id: item.id, type: 'paid', data: item })),
        ...liveTrades.slice(0, 3).map((item): FeedItem => ({ id: item.id, type: 'trade', data: item })),
        ...auctions.slice(0, 2).map((item): FeedItem => ({ id: item.id, type: 'auction', data: item })),
        ...aiSuggestions.slice(0, 1).map((item): FeedItem => ({ id: item.id, type: 'ai', data: item })),
      ];
      
      setFeedItems(shuffleArray(composed));
    } catch (error) {
      console.error("Failed to compose feed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    composeFeed(); // Initial composition
    
    const intervalId = setInterval(composeFeed, REFRESH_INTERVAL);
    
    return () => clearInterval(intervalId);
  }, []);

  return { feedItems, isLoading };
};

export default useFeedComposer;