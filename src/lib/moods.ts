import type { MoodType, MoodConfig } from './types';

export const MOOD_CONFIGS: Record<MoodType, MoodConfig> = {
  happy: {
    label: '开心',
    emoji: '\u2600\uFE0F',
    color: '#B8860B',
    bgColor: '#FFD166',
  },
  calm: {
    label: '平静',
    emoji: '\uD83C\uDF24\uFE0F',
    color: '#2E6B7B',
    bgColor: '#A8D8EA',
  },
  anxious: {
    label: '焦虑',
    emoji: '\uD83C\uDF38',
    color: '#8B3A3A',
    bgColor: '#FFB3BA',
  },
  irritated: {
    label: '烦躁',
    emoji: '\uD83C\uDF05',
    color: '#8B4513',
    bgColor: '#FF9B7A',
  },
  sad: {
    label: '低落',
    emoji: '\uD83C\uDF27\uFE0F',
    color: '#3B5068',
    bgColor: '#B8C4D8',
  },
  excited: {
    label: '兴奋',
    emoji: '\uD83C\uDF3A',
    color: '#5B3A86',
    bgColor: '#C3B1E1',
  },
};

export const MOOD_LIST: MoodType[] = ['happy', 'calm', 'anxious', 'irritated', 'sad', 'excited'];
