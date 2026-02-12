"use client";

import { useState, useCallback, useRef, useEffect } from 'react';

// Web Speech API の型定義
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

export interface UseSpeechRecognitionReturn {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
  appendTranscript: (text: string) => void;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // ブラウザサポートチェック
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  // 認識インスタンスの初期化
  const initRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('お使いのブラウザは音声認識に対応していません');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'ja-JP';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // 音声が検出されたらリトライカウンターをリセット
      retryCountRef.current = 0;

      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        setTranscript(prev => {
          const separator = prev && !prev.endsWith('\n') ? '\n' : '';
          return prev + separator + finalText;
        });
      }
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[SPEECH] Error:', event.error, event.message || '');

      switch (event.error) {
        case 'not-allowed':
          setError('マイクの使用が許可されていません。ブラウザの設定でマイクを許可してください。');
          break;
        case 'no-speech':
          // no-speech は録音中に音声が検出されなかった場合のエラー
          // continuous モードでも Chrome は無音が続くとこのエラーを出す
          console.warn('[SPEECH] No speech detected - retry count:', retryCountRef.current);
          if (retryCountRef.current < maxRetries) {
            retryCountRef.current++;
            console.log('[SPEECH] Auto-retrying... attempt', retryCountRef.current);
            // 少し待ってから再試行
            setTimeout(() => {
              if (recognitionRef.current) {
                try {
                  recognitionRef.current.start();
                  setIsListening(true);
                } catch (e) {
                  console.error('[SPEECH] Retry failed:', e);
                }
              }
            }, 500);
            return; // エラーを表示せず、リスニング状態を維持
          }
          setError('音声が検出されませんでした。マイクに向かって話してください。');
          retryCountRef.current = 0;
          break;
        case 'audio-capture':
          setError('マイクが見つかりません。マイクが接続されているか確認してください。');
          break;
        case 'network':
          setError('ネットワークエラーが発生しました。インターネット接続を確認してください。');
          break;
        case 'aborted':
          // ユーザーが停止した場合はエラーとして扱わない
          console.log('[SPEECH] Recognition aborted by user');
          break;
        case 'service-not-allowed':
          setError('音声認識サービスが許可されていません。HTTPS接続が必要です。');
          break;
        default:
          setError(`音声認識エラー: ${event.error}${event.message ? ` - ${event.message}` : ''}`);
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      console.log('[SPEECH] Recognition ended, isListening was:', isListening);
      // continuous モードでユーザーが停止していない場合は自動再開
      // （no-speech等でChrome が勝手に終了した場合の対策）
      // ただし、recognitionRef.current が null なら停止要求されている
      if (recognitionRef.current && retryCountRef.current < maxRetries) {
        console.log('[SPEECH] Auto-restarting recognition...');
        retryCountRef.current++;
        setTimeout(() => {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error('[SPEECH] Auto-restart failed:', e);
              setIsListening(false);
              setInterimTranscript('');
            }
          }
        }, 300);
      } else {
        setIsListening(false);
        setInterimTranscript('');
        retryCountRef.current = 0;
      }
    };

    recognition.onstart = () => {
      console.log('[SPEECH] Recognition started');
      setIsListening(true);
      setError(null);
    };

    return recognition;
  }, []);

  const startListening = useCallback(async () => {
    if (isListening) {
      console.log('[SPEECH] Already listening, ignoring start request');
      return;
    }

    setError(null);
    retryCountRef.current = 0;
    console.log('[SPEECH] Starting recognition...');

    // マイク権限を事前確認（getUserMedia）
    try {
      console.log('[SPEECH] Checking microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('[SPEECH] Microphone permission granted');
      // 即座にストリームを解放（Web Speech API は独自にマイクを取得する）
      stream.getTracks().forEach(track => {
        track.stop();
        console.log('[SPEECH] Released temporary audio track');
      });
    } catch (mediaErr: any) {
      console.error('[SPEECH] getUserMedia error:', mediaErr);
      const errorMessage = mediaErr.name === 'NotAllowedError'
        ? 'マイクの使用が許可されていません。ブラウザの設定でマイクを許可してください。'
        : mediaErr.name === 'NotFoundError'
        ? 'マイクが見つかりません。マイクが接続されているか確認してください。'
        : `マイクエラー: ${mediaErr.message || mediaErr.name}`;
      setError(errorMessage);
      return;
    }

    const recognition = initRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      try {
        recognition.start();
        console.log('[SPEECH] Recognition.start() called');
      } catch (err: any) {
        console.error('[SPEECH] Start error:', err);
        setError(`音声認識の開始に失敗しました: ${err.message || err}`);
      }
    }
  }, [isListening, initRecognition]);

  const stopListening = useCallback(() => {
    console.log('[SPEECH] Stop listening requested');
    retryCountRef.current = maxRetries + 1; // 自動再開を防ぐ
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
    retryCountRef.current = 0;
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  const appendTranscript = useCallback((text: string) => {
    setTranscript(prev => {
      if (!prev) return text;
      const separator = prev.endsWith('\n') ? '' : '\n';
      return prev + separator + text;
    });
  }, []);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
    appendTranscript,
  };
}
