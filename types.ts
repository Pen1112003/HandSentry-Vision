
export interface HandTrackerSettings {
  maxHands: number;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
  showLandmarks: boolean;
  showConnectors: boolean;
  mirror: boolean;
}

export enum ConnectionStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR'
}

export interface GameState {
  score: number;
  highScore: number;
  isGameOver: boolean;
  isPinching: boolean;
}
