import { LESSON_ID, LANGUAGES, TEACHING_APPROACHES, type LessonLanguage, type TeachingApproach } from '../src/urja/contract'

export type LessonRecord = {
  id: typeof LESSON_ID
  subject: string
  grade: string
  examTrack: string
  chapter: string
  lessonTitle: string
  concept: string
  boardMoment: string
  anchorFacts: string[]
}

/** Phase 1 teaches this lesson only. The catalog lives on the server so the client cannot invent the syllabus. */
export const CURRENT_LESSON: LessonRecord = {
  id: LESSON_ID,
  subject: 'Physics',
  grade: 'Class 11',
  examTrack: 'CBSE, with JEE foundations',
  chapter: 'Laws of Motion',
  lessonTitle: 'Inertia in everyday life',
  concept: "Inertia and Newton's first law",
  boardMoment: 'A standing passenger when a moving bus stops suddenly',
  anchorFacts: [
    "Newton's first law: a body continues in its state of rest, or of uniform motion in a straight line, unless a net external force compels it to change that state.",
    'Inertia is the tendency of a body to resist a change in its state of rest or motion. It is not a force. Mass is a measure of inertia: more mass means more inertia.',
    'In the bus example, the bus and the passenger are already moving together. Brakes apply a backward force to the bus, so the bus slows. Friction at the feet may slow the lower body, while the upper body tends to keep moving forward. The passenger therefore lurches forward relative to the bus.',
    'A seatbelt helps by exerting a backward force on the passenger so the body slows with the bus.',
    'If no net external force acts, a moving object keeps moving at the same velocity. It does not need a continuous forward force to maintain constant velocity.',
    'Do not invent numerical data, exam dates, or formulas that are not part of this law. F = ma belongs to Newton\'s second law and should only be mentioned if the student asks, with a clear note that it is the next idea, not the definition of inertia.',
  ],
}

const approaches = new Set<string>(TEACHING_APPROACHES)
const languages = new Set<string>(LANGUAGES)

export function isTeachingApproach(value: unknown): value is TeachingApproach {
  return typeof value === 'string' && approaches.has(value)
}

export function isLanguage(value: unknown): value is LessonLanguage {
  return typeof value === 'string' && languages.has(value)
}
