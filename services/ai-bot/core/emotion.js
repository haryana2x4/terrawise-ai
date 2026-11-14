/**
 * SUNDAY v2 - Emotion Contract & Parser
 * Intercepts and parses structured emotion/gesture tags from LLM responses:
 * e.g. {"emotion":"excited","gesture":"wave"}
 * Ensures tags are stripped cleanly before TTS speaks or captions display,
 * with graceful fallback to neutral expression on malformed tags.
 */

class EmotionParser {
  constructor() {
    this.validEmotions = ['neutral', 'happy', 'excited', 'thinking', 'focused', 'celebrating', 'sad', 'confused', 'surprised', 'sleepy'];
    this.validGestures = ['none', 'wave', 'point', 'thumbs_up', 'nod', 'head_tilt', 'type', 'stretch'];
  }

  /**
   * Parse response text and extract clean speech + emotion metadata
   * @param {string} rawText 
   * @returns {{ cleanText: string, emotion: string, gesture: string }}
   */
  parse(rawText) {
    if (!rawText || typeof rawText !== 'string') {
      return { cleanText: '', emotion: 'neutral', gesture: 'none' };
    }

    let emotion = 'neutral';
    let gesture = 'none';
    let cleanText = rawText;

    // Pattern 1: JSON object at the end or embedded, e.g. {"emotion":"...", "gesture":"..."}
    const jsonRegex = /\{[\s\S]*?"emotion"[\s\S]*?\}/gi;
    const jsonMatches = rawText.match(jsonRegex);

    if (jsonMatches && jsonMatches.length > 0) {
      for (const matchStr of jsonMatches) {
        try {
          const parsed = JSON.parse(matchStr);
          if (parsed.emotion && this.validEmotions.includes(parsed.emotion.toLowerCase())) {
            emotion = parsed.emotion.toLowerCase();
          }
          if (parsed.gesture && this.validGestures.includes(parsed.gesture.toLowerCase())) {
            gesture = parsed.gesture.toLowerCase();
          }
          // Remove matched tag from clean text
          cleanText = cleanText.replace(matchStr, '');
        } catch {
          // If JSON parse fails, try regex extraction
          const emMatch = matchStr.match(/"emotion"\s*:\s*"([^"]+)"/i);
          const geMatch = matchStr.match(/"gesture"\s*:\s*"([^"]+)"/i);
          if (emMatch && this.validEmotions.includes(emMatch[1].toLowerCase())) {
            emotion = emMatch[1].toLowerCase();
          }
          if (geMatch && this.validGestures.includes(geMatch[1].toLowerCase())) {
            gesture = geMatch[1].toLowerCase();
          }
          cleanText = cleanText.replace(matchStr, '');
        }
      }
    }

    // Pattern 2: Bracketed format [emotion: excited, gesture: wave]
    const bracketRegex = /\[(?:emotion|gesture):\s*([^\]]+)\]/gi;
    let bMatch;
    while ((bMatch = bracketRegex.exec(rawText)) !== null) {
      const content = bMatch[1].toLowerCase();
      for (const em of this.validEmotions) {
        if (content.includes(em)) emotion = em;
      }
      for (const ge of this.validGestures) {
        if (content.includes(ge)) gesture = ge;
      }
      cleanText = cleanText.replace(bMatch[0], '');
    }

    // Clean up excessive whitespace or trailing punctuation
    cleanText = cleanText.replace(/\s{2,}/g, ' ').trim();

    return {
      cleanText: cleanText || 'I am right here with you!',
      emotion,
      gesture
    };
  }

  /**
   * Append a structured emotion tag to an LLM system prompt instructions
   */
  getSystemInstruction() {
    return `At the very end of your response, always append a hidden metadata tag formatted strictly as:
{"emotion": "<neutral|happy|excited|thinking|focused|celebrating|sad|confused|surprised|sleepy>", "gesture": "<none|wave|point|thumbs_up|nod|head_tilt|type|stretch>"}
Do not explain the tag.`;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EmotionParser };
}
