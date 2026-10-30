/**
 * Reusable voice guidance service for Eye-play.
 * Provides robust Web Speech synthesis management, subtitle captions,
 * anti-overlap queuing, voice selection, persistence, and safe fallbacks.
 */

import { VoiceGuidanceConfig } from '../types';

export interface VoiceInstruction {
  id: string;
  category: 'WELCOME' | 'EXPLANATION' | 'DEMO' | 'READY_WAIT' | 'START' | 'FEEDBACK' | 'CALIBRATION' | 'HELP' | 'COMPLETE' | 'EXIT';
  textEn: string;
  textTa: string;
  stageName?: string;
}

export type VoiceStateListener = (state: {
  isPlaying: boolean;
  isPaused: boolean;
  currentCaption: string;
  currentInstructionId: string | null;
}) => void;

const PREF_KEY = 'eyeplay_voice_preferences_v1';

class VoiceGuidanceService {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private listeners: Set<VoiceStateListener> = new Set();
  private availableVoices: SpeechSynthesisVoice[] = [];
  private lastSpokenInstruction: VoiceInstruction | null = null;

  public config: VoiceGuidanceConfig = {
    enabled: true,
    language: 'en',
    volume: 0.85,
    rate: 0.88, // Unhurried, reassuring rate for children
    pitch: 1.12, // Friendly mascot pitch
    voiceName: undefined,
    showCaptions: true,
  };

  public isPlaying: boolean = false;
  public isPaused: boolean = false;
  public currentCaption: string = '';
  public currentInstructionId: string | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadPreferences();
      this.initVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  private loadPreferences() {
    try {
      const saved = localStorage.getItem(PREF_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.config = { ...this.config, ...parsed };
      }
    } catch {
      // Ignore local storage error
    }
  }

  private savePreferences() {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(this.config));
    } catch {
      // Ignore local storage error
    }
  }

  private initVoices() {
    if (!this.synth) return;
    try {
      this.availableVoices = this.synth.getVoices();
    } catch {
      this.availableVoices = [];
    }
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.availableVoices.length && this.synth) {
      this.availableVoices = this.synth.getVoices();
    }
    return this.availableVoices;
  }

  public subscribe(listener: VoiceStateListener): () => void {
    this.listeners.add(listener);
    listener({
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentCaption: this.currentCaption,
      currentInstructionId: this.currentInstructionId,
    });
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) =>
      listener({
        isPlaying: this.isPlaying,
        isPaused: this.isPaused,
        currentCaption: this.currentCaption,
        currentInstructionId: this.currentInstructionId,
      })
    );
  }

  public updateConfig(partial: Partial<VoiceGuidanceConfig>) {
    this.config = { ...this.config, ...partial };
    this.savePreferences();
    if (!this.config.enabled) {
      this.stop();
    }
  }

  /**
   * Speak a voice instruction with anti-overlap protection and matched captions
   */
  public speak(
    instruction: VoiceInstruction | string,
    options?: {
      onEnd?: () => void;
      onError?: () => void;
      priority?: 'normal' | 'interrupt';
    }
  ): boolean {
    const text = typeof instruction === 'string'
      ? instruction
      : this.config.language === 'ta'
      ? instruction.textTa || instruction.textEn
      : instruction.textEn;

    const id = typeof instruction === 'string' ? null : instruction.id;

    if (typeof instruction !== 'string') {
      this.lastSpokenInstruction = instruction;
    }

    // Always update caption even if speech synth is disabled
    this.currentCaption = text;
    this.currentInstructionId = id;

    if (!this.config.enabled || !this.synth) {
      this.notify();
      if (options?.onEnd) {
        setTimeout(options.onEnd, 300);
      }
      return false;
    }

    try {
      // Stop ongoing utterance cleanly
      this.synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = Math.max(0, Math.min(1, this.config.volume));
      utterance.rate = Math.max(0.6, Math.min(1.5, this.config.rate));
      utterance.pitch = Math.max(0.7, Math.min(1.4, this.config.pitch));
      utterance.lang = this.config.language === 'ta' ? 'ta-IN' : 'en-US';

      // Attempt to pick matching configured voice
      const voices = this.getVoices();
      if (this.config.voiceName) {
        const found = voices.find((v) => v.name === this.config.voiceName);
        if (found) utterance.voice = found;
      } else {
        const langPrefix = this.config.language === 'ta' ? 'ta' : 'en';
        const preferred = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));
        if (preferred) utterance.voice = preferred;
      }

      utterance.onstart = () => {
        this.isPlaying = true;
        this.isPaused = false;
        this.notify();
      };

      utterance.onend = () => {
        this.isPlaying = false;
        this.isPaused = false;
        this.notify();
        options?.onEnd?.();
      };

      utterance.onerror = (e) => {
        // Interrupted errors are benign during cancel()
        if (e.error !== 'interrupted') {
          console.warn('[VoiceGuidance] Utterance error:', e.error);
        }
        this.isPlaying = false;
        this.isPaused = false;
        this.notify();
        options?.onError?.();
      };

      this.currentUtterance = utterance;
      this.synth.speak(utterance);
      return true;
    } catch (err) {
      console.warn('[VoiceGuidance] Failed to speak:', err);
      this.isPlaying = false;
      this.isPaused = false;
      this.notify();
      options?.onError?.();
      return false;
    }
  }

  public replayCurrent(): boolean {
    if (this.lastSpokenInstruction) {
      return this.speak(this.lastSpokenInstruction);
    }
    if (this.currentCaption) {
      return this.speak(this.currentCaption);
    }
    return false;
  }

  public pause() {
    if (this.synth && this.isPlaying) {
      try {
        this.synth.pause();
        this.isPaused = true;
        this.notify();
      } catch {
        // Ignore
      }
    }
  }

  public resume() {
    if (this.synth && this.isPaused) {
      try {
        this.synth.resume();
        this.isPaused = false;
        this.notify();
      } catch {
        // Ignore
      }
    }
  }

  public stop() {
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch {
        // Ignore
      }
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.notify();
  }
}

export const voiceGuidance = new VoiceGuidanceService();

/**
 * Standard 10-step instructions database
 */
export const STANDARD_VOICE_STEPS: Record<string, VoiceInstruction> = {
  // Step 1: Welcome
  WELCOME: {
    id: 'step_1_welcome',
    category: 'WELCOME',
    textEn: 'Hi, friend! I am Bao. Let’s play together!',
    textTa: 'வணக்கம் நண்பா! நான் பவ் பாண்டா. Eye-play - நமது மூங்கில் தோட்டத்திற்கு நல்வரவு!',
  },
  // Step 2: Explain next activity
  EXPLAIN_BUTTERFLY: {
    id: 'step_2_butterfly',
    category: 'EXPLANATION',
    textEn: 'Look! A butterfly. Follow it with your eyes.',
    textTa: 'ஒரு வண்ணத்துப்பூச்சி பறக்கிறது. உங்கள் கண்களால் அதை பின்தொடருங்கள்!',
  },
  EXPLAIN_SPOT_IT: {
    id: 'step_2_spot_it',
    category: 'EXPLANATION',
    textEn: 'Can you find the bunny balloon? Look at it to pop it.',
    textTa: 'சிரிக்கும் முயல் பலூனைக் கண்டுபிடிக்க முடியுமா? அதைப் பார்த்து மகிழுங்கள்!',
  },
  EXPLAIN_JOINT: {
    id: 'step_2_joint',
    category: 'EXPLANATION',
    textEn: 'Look where Bao is looking.',
    textTa: 'பவ் எங்கு பார்க்கிறாரோ அங்கே நீங்களும் பாருங்கள்!',
  },
  EXPLAIN_MAZE: {
    id: 'step_2_maze',
    category: 'EXPLANATION',
    textEn: 'Look along the path to help the bamboo reach Bao’s basket.',
    textTa: 'சுவையான மூங்கிலை பவ்வின் கூடைக்கு வழிகாட்டி அழைத்துச் செல்லுங்கள்!',
  },
  EXPLAIN_LISTEN_DO: {
    id: 'step_2_listen_do',
    category: 'EXPLANATION',
    textEn: 'Listen to Bao. Then look for the matching friend.',
    textTa: 'பவ்வின் குரலைக் கேட்டு திரையில் உள்ள சரியான நண்பரைப் பாருங்கள்.',
  },
  // Step 3: Demonstrate
  DEMO: {
    id: 'step_3_demo',
    category: 'DEMO',
    textEn: 'Watch Bao. Sit comfortably and keep your head still.',
    textTa: 'பவ் எப்படி செய்கிறார் என்று பாருங்கள்! அமைதியாக தலையை நேராக வையுங்கள்.',
  },
  // Step 4: Wait until ready
  WAIT_READY: {
    id: 'step_4_wait_ready',
    category: 'READY_WAIT',
    textEn: 'When you are ready, choose the green play button.',
    textTa: 'நீங்கள் தயாராக இருக்கும்போது, விளையாட்டைத் தொடங்க பச்சை பொத்தானை அழுத்தவும்.',
  },
  // Step 5: Start instruction
  START: {
    id: 'step_5_start',
    category: 'START',
    textEn: 'Let’s play and explore together!',
    textTa: 'தொடங்குவோம்! நாம் ஒன்றாக மகிழ்ந்து விளையாடுவோம்.',
  },
  // Step 6: Gentle feedback
  FEEDBACK_GOOD: {
    id: 'step_6_good',
    category: 'FEEDBACK',
    textEn: 'Great looking! You are doing your best.',
    textTa: 'அற்புதம்! நீங்கள் மிகச் சிறப்பாக செய்கிறீர்கள்.',
  },
  // Step 7: Explain tracking in reassuring terms
  TRACKING_HELP_HEAD: {
    id: 'step_7_head',
    category: 'CALIBRATION',
    textEn: 'I can’t see your eyes yet. Please face the screen.',
    textTa: 'பவ்விற்கு உங்கள் கண்கள் சரியாக தெரியவில்லை. அமைதியாக திரையைப் பாருங்கள்.',
  },
  TRACKING_HELP_LIGHT: {
    id: 'step_7_light',
    category: 'CALIBRATION',
    textEn: 'Let’s turn on a little more light so I can see you.',
    textTa: 'அறையில் கொஞ்சம் வெளிச்சம் இருந்தால் பவ்விற்கு பார்க்க வசதியாக இருக்கும்.',
  },
  // Step 8: Offer replay or help
  HELP_OFFER: {
    id: 'step_8_help',
    category: 'HELP',
    textEn: 'Need help? You can use a finger or ask a grown-up.',
    textTa: 'உதவி வேண்டுமா? உங்கள் விரலால் தொடலாம் அல்லது பெரியவர்களிடம் கேட்கலாம்.',
  },
  // Step 9: Confirm completion
  CONFIRM_COMPLETE: {
    id: 'step_9_complete',
    category: 'COMPLETE',
    textEn: 'Hooray! You finished playing. Thanks for playing with me!',
    textTa: 'அருமை! நீங்கள் இன்று எல்லா விளையாட்டுகளையும் முடித்துவிட்டீர்கள்!',
  },
  // Step 10: Clear stop option
  STOP_CONFIRM: {
    id: 'step_10_stop',
    category: 'EXIT',
    textEn: 'You can pause or rest whenever you like.',
    textTa: 'எந்த நேரத்திலும் நீங்கள் ஓய்வெடுக்கலாம். உங்கள் சாதனைகள் பாதுகாப்பாக உள்ளன.',
  },
};
