import { useEffect, useRef, useState } from 'react'
import { askUrja, synthesizeUrjaVoice } from './urja/api'
import { LESSON_ID, type ChatMessage, type LessonPrefs, type UrjaReply } from './urja/contract'

const suggestions = [
  'Why does the passenger move forward?',
  'Would this happen in space?',
  'Can you explain this more simply?',
]

type SpeechRecognitionResultLike = ArrayLike<{ transcript: string }> & { isFinal?: boolean }
type SpeechRecognitionEventLike = Event & {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}
type SpeechRecognitionErrorLike = Event & { error: string }
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function speechRecognitionConstructor() {
  const browser = window as Window & {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition
}

export function AskUrjaPanel({
  open,
  prefs,
  messages,
  setMessages,
  onClose,
}: {
  open: boolean
  prefs: LessonPrefs
  messages: ChatMessage[]
  setMessages: (messages: ChatMessage[]) => void
  onClose: () => void
}) {
  const [question, setQuestion] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [listening, setListening] = useState(false)
  const [voiceDraft, setVoiceDraft] = useState('')
  const [tutorVoice, setTutorVoice] = useState(false)
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null)
  const sendingRef = useRef(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioUrlRef = useRef<string | null>(null)
  const voiceRequestRef = useRef(0)
  const recognitionAvailable = typeof window !== 'undefined' && Boolean(speechRecognitionConstructor())

  useEffect(() => {
    if (!open) return
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight })
  }, [open, messages, sending, error])

  useEffect(() => {
    if (open) return
    recognitionRef.current?.abort()
    recognitionRef.current = null
    setListening(false)
    setVoiceDraft('')
    stopSpeaking()
  }, [open])

  useEffect(() => () => {
    recognitionRef.current?.abort()
    audioRef.current?.pause()
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
  }, [])

  const stopSpeaking = () => {
    voiceRequestRef.current += 1
    audioRef.current?.pause()
    if (audioRef.current) audioRef.current.src = ''
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
    audioUrlRef.current = null
    setSpeakingIndex(null)
  }

  const speakReply = async (reply: UrjaReply, index: number) => {
    const text = [
      reply.explanation,
      ...reply.steps,
      reply.example,
      reply.takeaway,
      reply.followUp,
    ].filter(Boolean).join('. ')
    if (!text) return

    stopSpeaking()
    const requestId = voiceRequestRef.current
    setSpeakingIndex(index)
    setVoiceError('')
    try {
      const audio = await synthesizeUrjaVoice({ text, language: prefs.language })
      if (voiceRequestRef.current !== requestId) return
      const url = URL.createObjectURL(audio)
      audioUrlRef.current = url
      if (!audioRef.current) throw new Error('Audio playback is not available in this browser.')
      audioRef.current.src = url
      await audioRef.current.play()
    } catch (caught) {
      if (voiceRequestRef.current !== requestId) return
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
      if (audioRef.current) audioRef.current.src = ''
      setSpeakingIndex(null)
      setVoiceError(caught instanceof Error ? caught.message : 'URJA AI could not play this reply aloud. Try again.')
    }
  }

  const toggleListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }
    const Recognition = speechRecognitionConstructor()
    if (!Recognition) {
      setVoiceError('Voice questions are not supported in this browser. You can type your question instead.')
      return
    }

    try {
      const recognition = new Recognition()
      recognition.lang = prefs.language === 'English' ? 'en-IN' : 'hi-IN'
      recognition.interimResults = true
      recognition.continuous = false
      recognition.onresult = event => {
        let finalText = ''
        let interimText = ''
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index]
          const transcript = result[0]?.transcript ?? ''
          if (result.isFinal) finalText += transcript
          else interimText += transcript
        }
        setVoiceDraft(interimText)
        if (finalText.trim()) {
          setQuestion(previous => `${previous}${previous && !previous.endsWith(' ') ? ' ' : ''}${finalText.trim()}`)
          setVoiceDraft('')
        }
      }
      recognition.onerror = event => {
        const message = event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'Microphone access was denied. Allow it in your browser settings, then try again.'
          : event.error === 'no-speech'
            ? "I didn't hear a question. Try again or type it instead."
            : 'Voice input could not start. Check your microphone and try again.'
        setVoiceError(message)
        setListening(false)
        recognitionRef.current = null
      }
      recognition.onend = () => {
        setListening(false)
        setVoiceDraft('')
        recognitionRef.current = null
      }
      setVoiceError('')
      setVoiceDraft('')
      setListening(true)
      recognitionRef.current = recognition
      recognition.start()
    } catch {
      recognitionRef.current = null
      setListening(false)
      setVoiceError('Voice input could not start. Check your microphone and try again.')
    }
  }

  const reset = () => {
    if (sendingRef.current) return
    setMessages([])
    setQuestion('')
    setError('')
    setVoiceError('')
    stopSpeaking()
  }

  const send = async (raw?: string) => {
    const nextQuestion = (raw ?? question).trim()
    if (sendingRef.current) return
    if (!nextQuestion) {
      setError('Type a question before asking URJA AI.')
      return
    }

    const last = messages[messages.length - 1]
    const alreadyAsked = last?.role === 'user' && last.content === nextQuestion
    const historySource = alreadyAsked ? messages.slice(0, -1) : messages
    const history = historySource.slice(-8).map(message => ({ role: message.role, content: message.content }))

    sendingRef.current = true
    setSending(true)
    setError('')
    setQuestion('')
    if (!alreadyAsked) setMessages([...historySource, { role: 'user', content: nextQuestion }])
    try {
      const result = await askUrja({
        lessonId: LESSON_ID,
        teachingApproach: prefs.teachingApproach,
        language: prefs.language,
        question: nextQuestion,
        history,
      })
      const base = alreadyAsked ? historySource : [...historySource, { role: 'user' as const, content: nextQuestion }]
      setMessages([...base, { role: 'assistant', content: result.text, reply: result.reply }])
      if (tutorVoice) speakReply(result.reply, base.length)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'URJA AI could not answer just now. Please try again.')
      setQuestion(nextQuestion)
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void send()
    }
  }

  const lastAssistant = [...messages].reverse().find(message => message.role === 'assistant')
  const hasAnswer = messages.some(message => message.role === 'assistant')

  if (!open) return null

  return <div className="doubt-overlay">
    <button className="overlay-bg" onClick={onClose} aria-label="Close Ask URJA AI"/>
    <aside className="doubt-panel" aria-busy={sending}>
      <header>
        <div><span className="tag">ASK YOUR TEACHER</span><h2>Let's make it clear.</h2></div>
        <button onClick={onClose} aria-label="Close"><IconClose/></button>
      </header>
      <div className="doubt-context">
        <span>PAUSED AT</span>
        <p>Physics · Class 11 · Laws of Motion · Inertia in everyday life · {prefs.teachingApproach} · {prefs.language}</p>
        <button className="tutor-voice-toggle" type="button" aria-pressed={tutorVoice} title="Automatically play new tutor replies using Gemini AI voice" onClick={() => {
          setTutorVoice(value => !value)
          if (tutorVoice) stopSpeaking()
          setVoiceError('')
        }}>
          Tutor voice: {tutorVoice ? 'On' : 'Off'}
        </button>
        {messages.length > 0 && <button className="urja-reset" type="button" onClick={reset} disabled={sending}>Start this conversation over</button>}
      </div>
      <div className="urja-thread" ref={threadRef}>
        {messages.map((message, index) => message.role === 'user'
          ? <div className="student-question" key={`${message.role}-${index}`}><span>YOU ASKED</span><p>{message.content}</p></div>
          : <div className="teacher-answer" key={`${message.role}-${index}`}>
              <div className="answer-head"><div className="orb orb-small"><div className="orb-ring"/><div className="orb-core"/></div><span><b>URJA AI</b><small>Here's another way to see it</small></span></div>
              <p>{message.reply.explanation}</p>
              {message.reply.steps.length > 0 && <ol className="urja-steps">{message.reply.steps.map(step => <li key={step}>{step}</li>)}</ol>}
              {message.reply.example && <div className="urja-example"><span>EXAMPLE</span><p>{message.reply.example}</p></div>}
              {message.reply.takeaway && <p className="urja-takeaway"><b>Remember. </b>{message.reply.takeaway}</p>}
              <button className="urja-listen" type="button" disabled={speakingIndex !== null && speakingIndex !== index} onClick={() => speakingIndex === index ? stopSpeaking() : void speakReply(message.reply, index)}>
                {speakingIndex === index ? 'Stop voice reply' : 'Listen to this explanation'}
              </button>
              {message.reply.followUp && lastAssistant === message && <div className="follow-ups"><span>WANT TO GO FURTHER?</span><button type="button" disabled={sending} onClick={() => void send(message.reply.followUp)}>{message.reply.followUp}</button></div>}
            </div>)}
        {sending && <div className="teacher-answer urja-pending" aria-live="polite">
          <div className="answer-head"><div className="orb orb-small"><div className="orb-ring"/><div className="orb-core"/></div><span><b>URJA AI</b><small>Thinking this through</small></span></div>
          <p className="urja-thinking">URJA AI is thinking…</p>
        </div>}
        {error && <div className="urja-error" role="alert">
          <p>{error}</p>
          {messages[messages.length - 1]?.role === 'user' && <button type="button" onClick={() => void send(messages[messages.length - 1].content)} disabled={sending}>Try again</button>}
        </div>}
        {messages.length === 0 && !sending && <div className="suggestions"><span>YOU COULD ASK</span>{suggestions.map(item => <button type="button" onClick={() => void send(item)} key={item}>{item}</button>)}</div>}
      </div>
      {hasAnswer && <button className="btn btn-primary urja-resume" type="button" onClick={onClose}>Close and return to lesson</button>}
      <div className="doubt-compose">
        <textarea value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={onKeyDown} placeholder="Ask anything about this step..." maxLength={1200} disabled={sending}/>
        <div>
          <button type="button" className={listening ? 'voice-listening' : ''} aria-label={listening ? 'Stop voice question' : 'Ask a question by voice'} aria-pressed={listening} title={listening ? 'Stop listening' : recognitionAvailable ? 'Speak your question' : 'Voice input is not supported in this browser'} disabled={sending || !recognitionAvailable} onClick={toggleListening}><MicIcon/></button>
          <button className="btn btn-primary" type="button" onClick={() => void send()} disabled={sending || listening}>{sending ? 'Asking…' : listening ? 'Listening…' : 'Ask URJA AI'}<SendIcon/></button>
        </div>
        {listening && <p className="voice-status" aria-live="polite">Listening in {prefs.language}… {voiceDraft}</p>}
        {voiceError && <p className="voice-status voice-error" role="status">{voiceError}</p>}
      </div>
      <audio ref={audioRef} hidden onEnded={() => {
        setSpeakingIndex(null)
        if (audioRef.current) audioRef.current.src = ''
        if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current)
        audioUrlRef.current = null
      }} onError={() => {
        if (speakingIndex === null) return
        setSpeakingIndex(null)
        setVoiceError('Could not play this voice reply. Try again or continue reading.')
      }}/>
    </aside>
  </div>
}

function IconClose() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>
}

function SendIcon() {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m3 4 18 8-18 8 3-8-3-8Z"/><path d="M6 12h15"/></svg>
}

function MicIcon() {
  return <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>
}
