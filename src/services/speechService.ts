export interface VoicePrompt {
  id: string;
  category: 'ON_SCREEN' | 'ACTION' | 'REAL_WORLD_TOY';
  textEn: string;
  textTa: string; // Tamil prompt
  targetAoiId?: string;
  expectedWordEn?: string;
}

export const VOICE_PROMPTS: VoicePrompt[] = [
  {
    id: 'flower_red',
    category: 'ON_SCREEN',
    textEn: 'Look at the red flower in the meadow!',
    textTa: 'புல்வெளியில் உள்ள சிவப்பு பூவைப் பாருங்கள்!',
    targetAoiId: 'flower_red',
  },
  {
    id: 'dog_balloon',
    category: 'ON_SCREEN',
    textEn: 'Look at the happy puppy balloon!',
    textTa: 'மகிழ்ச்சியான நாய் பலூனைப் பாருங்கள்!',
    targetAoiId: 'dog_balloon',
  },
  {
    id: 'bunny_balloon',
    category: 'ON_SCREEN',
    textEn: 'Look at the friendly bunny!',
    textTa: 'அழகான முயலைப் பாருங்கள்!',
    targetAoiId: 'bunny_balloon',
  },
  {
    id: 'clap_hands',
    category: 'ACTION',
    textEn: 'Can you clap your hands together?',
    textTa: 'உங்கள் கைகளைத் தட்ட முடியுமா?',
  },
  {
    id: 'toy_car',
    category: 'REAL_WORLD_TOY',
    textEn: 'Show Bao your toy car or favorite toy!',
    textTa: 'உங்கள் பொம்மை காரை பிப்பிடம் காட்டுங்கள்!',
  },
  {
    id: 'say_pip',
    category: 'ACTION',
    textEn: 'Can you say "Hello Bao"?',
    textTa: '"வணக்கம் பிப்" என்று சொல்ல முடியுமா?',
    expectedWordEn: 'pip',
  },
];

class SpeechService {
  private isOptedIn: boolean = false;
  private currentLanguage: 'en' | 'ta' = 'en';
  private synth: SpeechSynthesis | null = null;
  private recognition: any = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public setOptIn(consented: boolean) {
    this.isOptedIn = consented;
  }

  public setLanguage(lang: 'en' | 'ta') {
    this.currentLanguage = lang;
  }

  public speak(prompt: VoicePrompt, onDone?: () => void): boolean {
    if (!this.isOptedIn || !this.synth) {
      if (onDone) setTimeout(onDone, 500);
      return false;
    }

    try {
      this.synth.cancel();
      const text = this.currentLanguage === 'ta' ? prompt.textTa : prompt.textEn;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85; // Calming, unhurried pace for ASD children
      utterance.pitch = 1.15; // Friendly, warm pitch
      utterance.lang = this.currentLanguage === 'ta' ? 'ta-IN' : 'en-US';

      if (onDone) {
        utterance.onend = () => onDone();
        utterance.onerror = () => onDone();
      }

      this.synth.speak(utterance);
      return true;
    } catch {
      if (onDone) onDone();
      return false;
    }
  }

  public cancel() {
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

export const speechService = new SpeechService();
