import { useEffect, useMemo, useState } from 'react'
import { AskUrjaPanel } from './AskUrjaPanel'
import { TEACHING_APPROACHES, type ChatMessage, type LessonLanguage, type LessonPrefs, type TeachingApproach } from './urja/contract'

type Screen =
  | 'landing' | 'auth' | 'onboarding' | 'dashboard' | 'explore' | 'chapter'
  | 'setup' | 'classroom' | 'quiz' | 'results' | 'progress' | 'notes' | 'profile'

const Icon = ({ name, size = 20 }: { name: string; size?: number }) => {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10M9 20v-6h6v6"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z"/></>,
    chart: <><path d="M4 20V10m6 10V4m6 16v-7m5 7H2"/></>,
    note: <><path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4 3.3-6 8-6s7.3 2 8 6"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    moon: <path d="M20 15.4A8 8 0 0 1 8.6 4 8.5 8.5 0 1 0 20 15.4Z"/>,
    arrow: <><path d="M5 12h14m-5-5 5 5-5 5"/></>,
    play: <path d="m9 6 9 6-9 6V6Z"/>,
    pause: <><path d="M8 6v12M16 6v12"/></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>,
    send: <><path d="m3 4 18 8-18 8 3-8-3-8Z"/><path d="M6 12h15"/></>,
    close: <path d="m6 6 12 12M18 6 6 18"/>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
    back: <><path d="M19 12H5m5 5-5-5 5-5"/></>,
    eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    spark: <path d="m12 2 1.4 6.6L20 12l-6.6 3.4L12 22l-3.4-6.6L2 12l6.6-3.4L12 2Z"/>,
    book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v18H7.5A3.5 3.5 0 0 0 4 23V5.5ZM20 5.5A3.5 3.5 0 0 0 16.5 2H13v18h3.5A3.5 3.5 0 0 1 20 23V5.5Z"/></>,
    redo: <><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8"/><path d="M4 3v5h5"/></>,
    chevron: <path d="m9 6 6 6-6 6"/>,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

const Button = ({ children, onClick, variant = 'primary', icon, disabled = false, type = 'button', title }: {
  children: React.ReactNode; onClick?: () => void; variant?: 'primary'|'secondary'|'ghost'|'soft'; icon?: string; disabled?: boolean; type?: 'button'|'submit'; title?: string
}) => <button type={type} disabled={disabled} onClick={onClick} title={title} className={`btn btn-${variant}`}>{children}{icon && <Icon name={icon}/>}</button>

const ThemeButton = ({ dark, toggle }: { dark: boolean; toggle: () => void }) =>
  <button className="icon-btn theme-btn" onClick={toggle} aria-label="Toggle theme"><Icon name={dark ? 'sun' : 'moon'}/></button>

const Brand = () => <div className="brand"><span className="brand-mark"><i/><i/><i/></span><span>URJA</span></div>

const Orb = ({ small = false }: { small?: boolean }) => <div className={`orb ${small ? 'orb-small' : ''}`}>
  <div className="orb-ring"/><div className="orb-core"/><span className="orb-dot dot-a"/><span className="orb-dot dot-b"/>
</div>

const Progress = ({ value, label }: { value: number; label?: string }) => <div className="progress-wrap">
  {label && <div className="progress-label"><span>{label}</span><b>{value}%</b></div>}
  <div className="progress"><span style={{ width: `${value}%` }}/></div>
</div>

const subjects = [
  { name: 'Physics', code: 'PHY', art: 'orbit', text: 'Motion, forces & the universe', progress: 68, chapters: 14 },
  { name: 'Chemistry', code: 'CHE', art: 'molecule', text: 'Matter, reactions & bonds', progress: 42, chapters: 16 },
  { name: 'Mathematics', code: 'MAT', art: 'curve', text: 'Patterns, logic & structure', progress: 54, chapters: 18 },
  { name: 'Biology', code: 'BIO', art: 'cell', text: 'Life, systems & evolution', progress: 25, chapters: 15 },
]
const lessonLanguages: LessonLanguage[] = ['English', 'Hinglish', 'Hindi']

function SubjectArt({ type }: { type: string }) {
  return <div className={`subject-art art-${type}`}>
    <span/><span/><span/><b>{type === 'curve' ? '∫' : type === 'cell' ? 'DNA' : type === 'molecule' ? 'C' : 'F'}</b>
  </div>
}

function Landing({ go, dark, toggle }: { go: (s: Screen) => void; dark: boolean; toggle: () => void }) {
  return <div className="landing">
    <header className="topbar landing-nav">
      <Brand/>
      <nav><a href="#product">Product</a><a href="#how">How it works</a><a href="#subjects">Subjects</a></nav>
      <div className="top-actions"><button className="text-btn" onClick={() => go('auth')}>Sign in</button><ThemeButton dark={dark} toggle={toggle}/><Button onClick={() => go('onboarding')}>Get started</Button></div>
    </header>
    <main>
      <section className="hero" id="product">
        <div className="hero-copy">
          <div className="eyebrow"><span/>A classroom that understands you</div>
          <h1>Learning should feel like <em>understanding.</em></h1>
          <p>Meet your personal AI teacher. Learn through conversations, live visual explanations, and lessons that move at your pace.</p>
          <div className="hero-actions"><Button onClick={() => go('onboarding')} icon="arrow">Start learning</Button><Button variant="secondary" onClick={() => go('classroom')} icon="play">Explore the classroom</Button></div>
          <div className="hero-trust"><span className="mini-avatars"><i/><i/><i/></span><span><b>12,000+ curious minds</b><br/>learning without hesitation</span></div>
        </div>
        <div className="hero-stage">
          <div className="float-pill pill-one">inertia <span>→</span></div>
          <div className="float-pill pill-two">F = ma</div>
          <div className="hero-orb"><Orb/></div>
          <div className="classroom-preview">
            <div className="preview-top"><span><i/> Live classroom</span><span>Newton's laws · 12:18</span></div>
            <div className="preview-board">
              <span className="scribble-label">Why do we move forward?</span>
              <div className="bus-drawing"><span className="bus-body"/><i/><i/><b>→</b></div>
              <div className="force-line"/>
              <div className="preview-equation">An object continues in its state of motion...</div>
            </div>
            <div className="preview-footer"><div className="teacher-mini"><Orb small/><span><b>URJA AI classroom preview</b><small>Audio narration coming soon</small></span></div><button disabled aria-label="Voice input coming soon" title="Voice input is not available yet."><Icon name="mic"/></button></div>
          </div>
        </div>
      </section>

      <section className="statement section-pad" id="how">
        <div className="section-index">01 — A new way to learn</div>
        <h2>Not answers on demand.<br/><em>Understanding, built together.</em></h2>
        <div className="steps">
          {[
            ['01','Choose what you want to understand','Start from your syllabus, a weak concept, or simply a question.'],
            ['02','Learn with questions and visuals','Ask URJA AI for real, context-aware help and learn with clear classroom visuals.'],
            ['03','Practice until it clicks','Small checkpoints turn passive listening into lasting understanding.'],
          ].map(x => <article key={x[0]}><span>{x[0]}</span><h3>{x[1]}</h3><p>{x[2]}</p></article>)}
        </div>
      </section>

      <section className="feature-section dark-feature">
        <div className="feature-visual teacher-visual"><Orb/><span className="orbit-word word-one">ask</span><span className="orbit-word word-two">see</span><span className="orbit-word word-three">understand</span></div>
        <div className="feature-copy"><div className="eyebrow light"><span/>Meet URJA AI</div><h2>A teacher who notices when you need a different explanation.</h2><p>URJA AI teaches step by step, answers follow-ups, and changes approach when a concept isn't landing.</p><ul><li><Icon name="check"/> Ask questions at any moment</li><li><Icon name="check"/> Switch from theory to an example</li><li><Icon name="check"/> Learn in English, Hindi, or Hinglish</li></ul><Button variant="soft" onClick={() => go('classroom')} icon="arrow">Meet your teacher</Button></div>
      </section>

      <section className="editorial-grid section-pad">
        <article className="editorial-lead"><div className="section-index">02 — Learning, made visible</div><h2>See an idea <em>take shape.</em></h2><p>From forces to functions, your classroom draws each thought as it explains.</p></article>
        <article className="visual-card equation-card"><span className="card-tag">LIVE BOARD</span><div className="graph"><i/><b>v</b><em>t</em><span/></div><h3>Diagrams build as you learn</h3></article>
        <article className="visual-card question-card"><span className="quote">“</span><h3>Ask without hesitation.</h3><p>There are no awkward questions here—only new ways to make it click.</p><div className="question-input">Why does this happen? <Icon name="send"/></div></article>
        <article className="visual-card quiz-card"><span className="card-tag">QUICK CHECK</span><h3>Which property explains this motion?</h3><div className="fake-option">Momentum</div><div className="fake-option selected"><Icon name="check"/> Inertia</div><span className="tiny-note">Exactly. Your understanding is building.</span></article>
      </section>

      <section className="subjects-showcase section-pad" id="subjects">
        <div className="section-head"><div><div className="section-index">03 — Your subjects</div><h2>Explore ideas,<br/><em>not just chapters.</em></h2></div><p>Built for CBSE Class 10–12 and students preparing for JEE and NEET.</p></div>
        <div className="subject-strip">{subjects.map(s => <article key={s.name} onClick={() => go('explore')}><SubjectArt type={s.art}/><span>{s.code}</span><h3>{s.name}</h3><p>{s.text}</p><button><Icon name="arrow"/></button></article>)}</div>
      </section>

      <section className="final-cta"><div className="cta-shape"><Orb/></div><div className="eyebrow"><span/>Your next question starts here</div><h2>Ready to understand<br/><em>something new?</em></h2><p>Build confidence one clear explanation at a time.</p><Button onClick={() => go('onboarding')} icon="arrow">Start learning free</Button></section>
    </main>
    <footer><Brand/><p>Learn at the speed of understanding.</p><div><span title="Privacy information coming soon">Privacy</span><span title="Terms coming soon">Terms</span><span title="Contact details coming soon">Contact</span></div><span>© 2026 URJA Learning</span></footer>
  </div>
}

function Auth({ go, dark, toggle }: { go:(s:Screen)=>void; dark:boolean; toggle:()=>void }) {
  const [login, setLogin] = useState(true)
  const [show, setShow] = useState(false)
  return <div className="auth-page">
    <div className="auth-brand"><Brand/><ThemeButton dark={dark} toggle={toggle}/></div>
    <aside className="auth-art"><div className="auth-quote"><span>“</span><h2>The beautiful thing about learning is that nobody can take it away from you.</h2><p>— B.B. King</p></div><div className="auth-orb"><Orb/></div></aside>
    <main className="auth-form">
      <button className="back-link" onClick={() => go('landing')}><Icon name="back"/> Back to home</button>
      <div className="form-inner">
        <div className="eyebrow"><span/>Welcome to URJA</div><h1>{login ? 'Continue your learning.' : 'Begin with curiosity.'}</h1><p>{login ? 'Your classroom is right where you left it.' : 'Create an account and meet your personal teacher.'}</p>
        <button className="google-btn" disabled title="Account sign-in is not available yet."><b>G</b> Continue with Google</button>
        <div className="or"><span/>or continue with email<span/></div>
        <p role="status">Account sign-in and registration are not available yet. You can explore the classroom without an account.</p>
        <label>Email address<input type="email" placeholder="you@example.com"/></label>
        <label>Password<div className="input-icon"><input type={show ? 'text' : 'password'} placeholder="At least 8 characters"/><button onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}><Icon name="eye"/></button></div></label>
        {login && <button className="forgot" disabled title="Password recovery is not available yet.">Forgot password?</button>}
        <Button disabled title="Account sign-in and registration are not available yet." icon="arrow">{login ? 'Sign in' : 'Create account'}</Button>
        <p className="switch-auth">{login ? "New to URJA?" : 'Already have an account?'} <button onClick={() => setLogin(!login)}>{login ? 'Create an account' : 'Sign in'}</button></p>
        <small>By continuing, you agree to our <u>Terms</u> and <u>Privacy Policy</u>.</small>
      </div>
    </main>
  </div>
}

const onboardingSteps = [
  { title:"Tell us what you're studying.", sub:'This helps us shape lessons around your syllabus.', options:['Class 10','Class 11','Class 12','Other'] },
  { title:'What are you learning towards?', sub:'Choose all that feel relevant right now.', options:['School studies','JEE','NEET','Board exams','Concept mastery','Improve weak subjects'] },
  { title:'Choose your subjects.', sub:'You can always add or remove subjects later.', options:['Physics','Chemistry','Mathematics','Biology'] },
  { title:'How do you like to learn?', sub:'URJA AI will adapt explanations to suit you.', options:['Visual explanations','Step-by-step teaching','Examples first','Practice first'] },
]

function Onboarding({ go, dark, toggle }: { go:(s:Screen)=>void; dark:boolean; toggle:()=>void }) {
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<Record<number,string[]>>({0:['Class 11'],1:['JEE','Concept mastery'],2:['Physics','Chemistry','Mathematics'],3:['Visual explanations']})
  const pick = (v:string) => setSelected(p => ({...p,[step]: step===0 ? [v] : p[step]?.includes(v) ? p[step].filter(x=>x!==v) : [...(p[step]||[]),v]}))
  const next = () => step < 4 ? setStep(step+1) : go('dashboard')
  return <div className="onboarding-page">
    <header><Brand/><div className="onboard-progress"><span>Step {step+1} of 5</span><Progress value={(step+1)*20}/></div><ThemeButton dark={dark} toggle={toggle}/></header>
    <main className="onboard-main">
      <div className="onboard-visual"><div className={`onboard-sculpt step-${step}`}><span/><i/><b>{step===0?'11':step===1?'↗':step===2?'∑':step===3?'◌':'✓'}</b></div><p>{['Your starting point.','A goal worth moving towards.','A world of ideas to explore.','A teaching style that fits.','Your space, your rhythm.'][step]}</p></div>
      <div className="onboard-content">
        <div className="eyebrow"><span/>A little about you</div>
        {step < 4 ? <><h1>{onboardingSteps[step].title}</h1><p>{onboardingSteps[step].sub}</p><div className="choice-grid">{onboardingSteps[step].options.map((x,i)=><button key={x} className={selected[step]?.includes(x)?'active':''} onClick={()=>pick(x)}><span>{String(i+1).padStart(2,'0')}</span>{x}<i>{selected[step]?.includes(x)&&<Icon name="check"/>}</i></button>)}</div></> :
        <><h1>Make learning fit your day.</h1><p>Just a few final preferences. You can change these anytime.</p><div className="preference-form"><label>When do you usually study?<select><option>Evening · 6–9 PM</option><option>Morning · 6–9 AM</option><option>Afternoon · 2–5 PM</option></select></label><label>How should lessons begin?<select><option>Meet me at my level</option><option>Start with the basics</option><option>Challenge me</option></select></label><label>One goal you'd love to reach <span>Optional</span><input placeholder="e.g. Feel confident with mechanics"/></label></div></>}
        <div className="onboard-actions">{step>0&&<Button variant="ghost" onClick={()=>setStep(step-1)}><Icon name="back"/> Back</Button>}<Button onClick={next} icon="arrow">{step===4?'Build my learning space':'Continue'}</Button></div>
      </div>
    </main>
  </div>
}

const navItems: { label:string; icon:string; screen:Screen }[] = [
  {label:'Home',icon:'home',screen:'dashboard'},{label:'Explore',icon:'compass',screen:'explore'},
  {label:'Progress',icon:'chart',screen:'progress'},{label:'Notes',icon:'note',screen:'notes'},{label:'Profile',icon:'user',screen:'profile'}
]

function AppShell({ children, screen, go, dark, toggle }: { children:React.ReactNode; screen:Screen; go:(s:Screen)=>void; dark:boolean; toggle:()=>void }) {
  return <div className="app-layout">
    <aside className="sidebar"><Brand/><nav>{navItems.map(x=><button key={x.label} className={screen===x.screen?'active':''} onClick={()=>go(x.screen)}><Icon name={x.icon}/><span>{x.label}</span></button>)}</nav><div className="sidebar-bottom"><div className="mini-focus"><span>7</span><p><b>Day rhythm</b><small>You're building momentum</small></p></div><ThemeButton dark={dark} toggle={toggle}/></div></aside>
    <div className="app-main"><header className="mobile-head"><Brand/><ThemeButton dark={dark} toggle={toggle}/></header>{children}</div>
    <nav className="bottom-nav">{navItems.map(x=><button key={x.label} className={screen===x.screen?'active':''} onClick={()=>go(x.screen)}><Icon name={x.icon}/><span>{x.label}</span></button>)}</nav>
  </div>
}

function Dashboard({ go, shell }: { go:(s:Screen)=>void; shell:(x:React.ReactNode)=>React.ReactNode }) {
  return shell(<main className="dash page">
    <header className="page-heading"><div><div className="eyebrow"><span/>Wednesday, 18 March</div><h1>Good evening, Arjun.</h1><p>Ready to understand something new?</p></div><div className="header-orb"><Orb small/></div></header>
    <section className="continue-card">
      <div className="continue-copy"><span className="tag">CONTINUE LEARNING · PHYSICS</span><h2>Laws of Motion</h2><p>You're exploring how inertia explains motion in everyday life.</p><Progress value={68} label="Chapter progress"/><Button onClick={()=>go('classroom')} icon="arrow">Continue classroom</Button></div>
      <div className="continue-art"><div className="motion-object"><span/><i/><b>F</b></div><div className="lesson-marker"><small>UP NEXT</small><b>Newton's First Law</b><span>12 min lesson</span></div></div>
    </section>
    <div className="dash-grid">
      <section className="today-panel panel"><div className="panel-head"><div><span className="tag">TODAY'S LEARNING</span><h3>A calm 35 minutes</h3></div><span className="circle-progress">2<small>/3</small></span></div><div className="today-item done"><i><Icon name="check"/></i><span><b>Review vectors</b><small>Completed · 8 min</small></span></div><div className="today-item"><i>02</i><span><b>Continue Laws of Motion</b><small>Recommended · 18 min</small></span><button onClick={()=>go('classroom')}><Icon name="play"/></button></div><div className="today-item"><i>03</i><span><b>5-question checkpoint</b><small>After your lesson · 9 min</small></span></div></section>
      <section className="activity-panel panel"><div className="panel-head"><div><span className="tag">THIS WEEK</span><h3>Your learning activity</h3></div><button className="link-btn" onClick={()=>go('progress')}>View progress <Icon name="arrow"/></button></div><div className="stat-row"><span><b>4h 20m</b><small>Focused learning</small></span><span><b>82%</b><small>Quiz accuracy</small></span><span><b>12</b><small>Concepts mastered</small></span></div><div className="week-chart">{[40,67,45,88,63,25,12].map((x,i)=><div key={i}><span style={{height:`${x}%`}}/><small>{'MTWTFSS'[i]}</small></div>)}</div></section>
    </div>
    <section className="dashboard-section"><div className="section-title"><div><span className="tag">YOUR LIBRARY</span><h2>Subjects</h2></div><button className="link-btn" onClick={()=>go('explore')}>Explore all <Icon name="arrow"/></button></div><div className="subject-grid">{subjects.map(s=><article key={s.name} onClick={()=>go('explore')}><SubjectArt type={s.art}/><span className="subject-code">{s.code}</span><h3>{s.name}</h3><p>{s.progress}% complete · {s.chapters} chapters</p><Progress value={s.progress}/></article>)}</div></section>
    <section className="dashboard-section"><div className="section-title"><div><span className="tag">CHOSEN FOR YOU</span><h2>A thoughtful next step</h2></div></div><div className="recommend-row"><article className="recommend-feature"><div><span className="tag">REVISION · 8 MIN</span><h3>Vectors could use one more look.</h3><p>A short visual recap will strengthen the ideas you'll use in every mechanics chapter.</p><Button variant="secondary" onClick={()=>go('chapter')} icon="arrow">Start gentle revision</Button></div><div className="vector-art">→<span>v</span></div></article><article><span className="tag">QUICK CHALLENGE</span><h3>Can you read a velocity graph?</h3><p>Five questions · medium</p><button onClick={()=>go('quiz')}><Icon name="arrow"/></button></article></div></section>
  </main>)
}

function Explore({ go, shell }: { go:(s:Screen)=>void; shell:(x:React.ReactNode)=>React.ReactNode }) {
  const [filter,setFilter]=useState('All subjects')
  const [search,setSearch]=useState('')
  return shell(<main className="page explore-page">
    <header className="page-heading"><div><div className="eyebrow"><span/>Explore the syllabus</div><h1>Follow your curiosity.</h1><p>Find a chapter, strengthen a concept, or begin somewhere new.</p></div></header>
    <div className="explore-tools"><div className="search"><Icon name="search"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search chapters or concepts"/></div><select disabled title="Class filters are coming soon"><option>Class 11</option><option>Class 10</option><option>Class 12</option></select><select disabled title="Exam filters are coming soon"><option>CBSE + JEE</option><option>CBSE</option><option>NEET</option></select></div>
    <div className="filter-tabs">{['All subjects','Physics','Chemistry','Mathematics','Biology'].map(x=><button className={filter===x?'active':''} onClick={()=>setFilter(x)} key={x}>{x}</button>)}</div>
    <section className="explore-feature"><div><span className="tag">RECOMMENDED START</span><h2>Mechanics begins with a simple question:</h2><p>Why do things move—and why do they stop?</p><Button onClick={()=>go('chapter')} icon="arrow">Explore Laws of Motion</Button></div><div className="mechanics-art"><span/><i/><b>→</b></div></section>
    <div className="chapter-list-head"><h2>{filter==='All subjects'?'Popular chapters':filter}</h2><span>Class 11 · 12 chapters</span></div>
    <div className="chapter-grid">{[
      ['Physics','Laws of Motion','7 concepts · 2h 20m','68','Foundational'],
      ['Physics','Work, Energy & Power','9 concepts · 2h 45m','22','Intermediate'],
      ['Chemistry','Chemical Bonding','11 concepts · 3h 10m','42','Foundational'],
      ['Mathematics','Limits & Derivatives','8 concepts · 2h 30m','54','Intermediate'],
      ['Biology','Cell: The Unit of Life','10 concepts · 2h 15m','25','Foundational'],
      ['Physics','Gravitation','8 concepts · 2h 05m','0','Intermediate'],
    ].filter(x=>(filter==='All subjects'||x[0]===filter)&&x[1].toLowerCase().includes(search.toLowerCase())).map((x,i)=><article key={x[1]} onClick={()=>go('chapter')}><div className={`chapter-index tone-${i%4}`}>{String(i+1).padStart(2,'0')}<i/></div><div className="chapter-info"><span>{x[0]}</span><h3>{x[1]}</h3><p>{x[2]}</p><div><small>{x[4]}</small>{+x[3]>0&&<small>{x[3]}% complete</small>}</div><Progress value={+x[3]}/></div><button><Icon name="chevron"/></button></article>)}</div>
  </main>)
}

function Chapter({ go, shell }: { go:(s:Screen)=>void; shell:(x:React.ReactNode)=>React.ReactNode }) {
  const lessons = ['Force and its effects',"Newton's First Law",'Inertia in everyday life',"Newton's Second Law","Newton's Third Law",'Applications and free-body diagrams','Chapter practice']
  return shell(<main className="page chapter-page">
    <button className="back-link" onClick={()=>go('explore')}><Icon name="back"/> Explore Physics</button>
    <section className="chapter-hero"><div><span className="tag">PHYSICS · CLASS 11 · CHAPTER 4</span><h1>Laws of Motion</h1><p>Understand why objects move, stop, and change direction—through the rules that govern every motion around us.</p><div className="meta-row"><span><b>2h 20m</b> Learning time</span><span><b>7</b> Concepts</span><span><b>Medium</b> Difficulty</span></div><div className="hero-actions"><Button onClick={()=>go('setup')} icon="play">Continue chapter</Button><Button variant="secondary" onClick={()=>go('quiz')}>Practice questions</Button></div></div><div className="chapter-hero-art"><div className="newton-orbit"><span/><i/><b>F</b><em>ma</em></div></div></section>
    <div className="chapter-content">
      <section><div className="section-title"><div><span className="tag">YOUR PATH</span><h2>Concepts in this chapter</h2></div><span>3 of 7 explored</span></div><div className="lesson-list">{lessons.map((x,i)=><article className={i<2?'complete':i===2?'current':''} key={x}><i>{i<2?<Icon name="check"/>:String(i+1).padStart(2,'0')}</i><div><h3>{x}</h3><p>{i===2?'How motion resists change · 14 min':i<2?'Lesson and checkpoint complete':i===6?'12 practice questions':`${10+i*2} min lesson`}</p></div>{i===2&&<Button onClick={()=>go('setup')} variant="soft" icon="arrow">Continue</Button>}{i!==2&&<button disabled title="This lesson is coming soon" aria-label={`${x} is coming soon`}><Icon name="chevron"/></button>}</article>)}</div></section>
      <aside><div className="objectives"><span className="tag">BY THE END</span><h3>You'll be able to...</h3><ul><li><Icon name="check"/> Explain inertia through real examples</li><li><Icon name="check"/> Relate force, mass and acceleration</li><li><Icon name="check"/> Draw and interpret force diagrams</li><li><Icon name="check"/> Apply Newton's laws to problems</li></ul></div><div className="revision-card"><span>↗</span><h3>Revision, when you need it</h3><p>Your notes and a short recap will be ready after each lesson.</p></div></aside>
    </div>
  </main>)
}

function LessonSetup({ go, dark, toggle, onEnter }: { go:(s:Screen)=>void; dark:boolean; toggle:()=>void; onEnter:(prefs:LessonPrefs)=>void }) {
  const [style,setStyle]=useState<TeachingApproach>('Examples first'), [duration,setDuration]=useState('Standard · 20 min'), [language,setLanguage]=useState<LessonLanguage>('English')
  return <div className="setup-page"><header><Brand/><div><span>Physics</span><b>·</b><span>Laws of Motion</span></div><ThemeButton dark={dark} toggle={toggle}/></header><main>
    <div className="setup-intro"><button className="back-link" onClick={()=>go('chapter')}><Icon name="back"/> Back to chapter</button><div className="setup-orb"><Orb/></div><div className="eyebrow"><span/>Your next classroom</div><h1>How would you like to learn <em>inertia?</em></h1><p>Set the pace and style. URJA AI will adapt as you go.</p></div>
    <div className="setup-form">
      <section><span className="form-number">01</span><div><h3>Teaching approach</h3><p>Choose how URJA AI should begin.</p><div className="option-grid">{TEACHING_APPROACHES.map(x=><button className={style===x?'active':''} onClick={()=>setStyle(x)} key={x}>{x}<i>{style===x&&<Icon name="check"/>}</i></button>)}</div></div></section>
      <section><span className="form-number">02</span><div><h3>Lesson depth</h3><p>How much time do you have?</p><div className="segmented">{['Quick · 10 min','Standard · 20 min','Deep · 35 min'].map(x=><button className={duration===x?'active':''} onClick={()=>setDuration(x)} key={x}>{x}</button>)}</div></div></section>
      <section><span className="form-number">03</span><div><h3>Language</h3><p>You can switch during class.</p><div className="segmented">{lessonLanguages.map(x=><button className={language===x?'active':''} onClick={()=>setLanguage(x)} key={x}>{x}</button>)}</div></div></section>
      <div className="setup-summary"><div><span className="tag">READY WHEN YOU ARE</span><p><b>{style}</b> · {duration} · {language}</p></div><Button onClick={()=>onEnter({ teachingApproach: style, language })} icon="arrow">Enter classroom</Button></div>
    </div>
  </main></div>
}

function Whiteboard({ step }: { step:number }) {
  return <div className={`whiteboard board-step-${step}`}>
    <div className="board-grid"/>
    <div className="board-heading"><small>NEWTON'S FIRST LAW</small><h2>Why does a passenger move <em>forward</em>?</h2></div>
    <div className="bus-scene">
      <div className="motion-arrows"><span>motion</span><i/><i/><i/></div>
      <div className="board-bus"><div className="passenger"><b/><span/></div><div className="windows"><i/><i/><i/></div><div className="bus-base"/><em/><em/></div>
      <div className="stop-mark">STOP</div>
      <div className="person-arrow">→ <span>body continues forward</span></div>
    </div>
    <div className="board-rule"><span>01</span><p>An object resists a change in its state of motion.</p><b>INERTIA</b></div>
    <div className="board-note">The bus stops. The passenger's body tends to keep moving.</div>
  </div>
}

function Classroom({ go, dark, toggle, prefs, messages, setMessages }: { go:(s:Screen)=>void; dark:boolean; toggle:()=>void; prefs:LessonPrefs; messages:ChatMessage[]; setMessages:(messages:ChatMessage[])=>void }) {
  const [step,setStep]=useState(1), [doubt,setDoubt]=useState(false), [notes,setNotes]=useState(false), [outline,setOutline]=useState(true)
  const [notesText,setNotesText]=useState("Newton's First Law\n\nAn object continues in its state of rest or uniform motion unless acted on by an external force.\n\nInertia = resistance to a change in motion.\n\nExample: Passenger moves forward when a bus suddenly stops.")
  return <div className="classroom-page">
    <header className="classroom-head"><div className="class-title"><button onClick={()=>go('chapter')}><Icon name="close"/></button><div><span>PHYSICS · LAWS OF MOTION</span><b>Inertia in everyday life</b></div></div><div className="lesson-time"><span/><b>Lesson in progress</b><small>14:32</small></div><div><ThemeButton dark={dark} toggle={toggle}/><button className="exit-btn" onClick={()=>go('dashboard')}>Exit classroom</button></div></header>
    <main className={`classroom-grid ${outline?'':'outline-closed'}`}>
      <section className="board-area">
        <div className="board-top"><div className="board-crumb"><span>03</span><b>Inertia in everyday life</b></div><div className="board-tools"><button onClick={()=>setStep(step===1?2:1)}><Icon name="redo"/> Replay visual</button><button onClick={()=>setNotes(!notes)}><Icon name="note"/> Notes</button></div></div>
        <Whiteboard step={step}/>
        <div className="teacher-strip"><div className="teacher-avatar"><Orb small/></div><div className="teacher-words"><span><b>URJA AI</b> · Your lesson-aware tutor</span><p>Ask a question or listen to a spoken explanation whenever you need another perspective.</p></div></div>
        <div className="class-controls">
          <button className="ask-btn" onClick={()=>setDoubt(true)}><Icon name="spark"/><span><b>Ask URJA AI</b><small>Interrupt anytime</small></span></button>
          <div className="transport"><button onClick={()=>setStep(1)} aria-label="Replay lesson visual"><Icon name="redo"/></button><button className="play-control" disabled title="Audio narration is coming soon" aria-label="Audio narration coming soon"><Icon name="play" size={24}/></button><button onClick={()=>setStep(2)} aria-label="Next visual"><Icon name="chevron"/></button></div>
          <div className="control-end"><button className="mic-control" onClick={()=>setDoubt(true)}><Icon name="mic"/><span>Ask by text</span></button><button onClick={()=>go('quiz')}>Checkpoint <Icon name="arrow"/></button></div>
        </div>
      </section>
      <aside className="outline-panel">
        <div className="outline-head"><div><span className="tag">LESSON OUTLINE</span><b>Newton's First Law</b></div><button onClick={()=>setOutline(false)}><Icon name="close"/></button></div>
        <Progress value={48} label="Lesson progress"/>
        <div className="outline-list">{[['01','What is force?','done'],['02',"Newton's First Law",'done'],['03','Understanding inertia','current'],['04','A real-world example',''],['05','Quick checkpoint','']].map(x=><div className={x[2]} key={x[0]}><i>{x[2]==='done'?<Icon name="check"/>:x[0]}</i><span><b>{x[1]}</b><small>{x[2]==='done'?'Explored':x[2]==='current'?'Now teaching':'Up next'}</small></span></div>)}</div>
        <div className="outline-foot"><span>Need a different approach?</span><button onClick={()=>go('setup')}>Change teaching style <Icon name="arrow"/></button></div>
      </aside>
      {!outline&&<button className="open-outline" onClick={()=>setOutline(true)}><Icon name="book"/> Lesson</button>}
    </main>
    <AskUrjaPanel open={doubt} prefs={prefs} messages={messages} setMessages={setMessages} onClose={()=>setDoubt(false)}/>
    {notes&&<div className="notes-drawer"><header><div><span className="tag">LESSON NOTES</span><h3>Inertia in everyday life</h3></div><button onClick={()=>setNotes(false)}><Icon name="close"/></button></header><textarea value={notesText} onChange={event=>setNotesText(event.target.value)}/><small>Notes stay in this lesson only; saving is coming soon.</small></div>}
  </div>
}

const quizQuestions = [
  {
    question: 'When a moving bus stops suddenly, why does a standing passenger tend to fall forward?',
    options: ['The passenger has no mass','The upper body retains its state of motion','The bus pushes the passenger forward','Gravity suddenly increases'],
    correctIndex: 1,
    explanation: "The passenger's feet stop with the bus, but the upper body tends to maintain its forward motion because of inertia.",
  },
  {
    question: 'Which object has the greatest inertia?',
    options: ['A tennis ball','A cricket ball','A loaded truck','A feather'],
    correctIndex: 2,
    explanation: 'Mass measures inertia. The loaded truck has much more mass, so it resists changes in motion more.',
  },
  {
    question: 'If no net external force acts on a moving object, what happens?',
    options: ['It gradually stops on its own','It speeds up automatically','It keeps moving at constant velocity','It changes direction'],
    correctIndex: 2,
    explanation: "By Newton's first law, the object keeps moving at constant velocity when no net external force acts.",
  },
]

function Quiz({ go, onComplete }: { go:(s:Screen)=>void; onComplete:(score:number)=>void }) {
  const [answer,setAnswer]=useState(''), [submitted,setSubmitted]=useState(false), [q,setQ]=useState(0), [correctCount,setCorrectCount]=useState(0)
  const currentQuestion=quizQuestions[q]
  const correct=answer===currentQuestion.options[currentQuestion.correctIndex]
  const next=()=>{
    const score=correctCount+(correct?1:0)
    if(q===quizQuestions.length-1){onComplete(score);go('results')}
    else{if(correct)setCorrectCount(score);setQ(q+1);setAnswer('');setSubmitted(false)}
  }
  return <div className="quiz-page"><header><button className="back-link" onClick={()=>go('classroom')}><Icon name="close"/> Leave checkpoint</button><div><span>LAWS OF MOTION</span><b>Concept checkpoint</b></div><span>{q+1} of {quizQuestions.length}</span></header><Progress value={Math.round((q+1)*100/quizQuestions.length)}/>
    <main><div className="quiz-meta"><span>QUESTION {String(q+1).padStart(2,'0')}</span><span>CONCEPTUAL · SINGLE ANSWER</span></div><h1>{currentQuestion.question}</h1>
      <div className="quiz-layout"><div className="quiz-options">{currentQuestion.options.map((x,i)=><button disabled={submitted} onClick={()=>setAnswer(x)} className={`${answer===x?'selected':''} ${submitted&&i===currentQuestion.correctIndex?'correct':''} ${submitted&&answer===x&&!correct?'wrong':''}`} key={x}><i>{String.fromCharCode(65+i)}</i><span>{x}</span>{submitted&&i===currentQuestion.correctIndex&&<Icon name="check"/>}</button>)}</div><div className="quiz-diagram"><div className="tiny-bus"><span/><i/><b>→</b></div><p>Bus moving → then stops</p></div></div>
      {submitted&&<div className={`feedback ${correct?'success':'gentle'}`}><span><Icon name={correct?'check':'redo'}/></span><div><h3>{correct?'Exactly right.':'Nearly—review the idea.'}</h3><p>{currentQuestion.explanation}</p></div></div>}
      <div className="quiz-actions"><span>{!submitted?'Choose one answer before submitting.':'Understanding grows with every explanation.'}</span>{!submitted?<Button disabled={!answer} onClick={()=>setSubmitted(true)}>Submit answer</Button>:<Button onClick={next} icon="arrow">{q===quizQuestions.length-1?'See results':'Next question'}</Button>}</div>
    </main>
  </div>
}

function Results({ go, score }: { go:(s:Screen)=>void; score:number }) {
  return <div className="results-page"><header><Brand/><span>Checkpoint complete</span><button onClick={()=>go('dashboard')}><Icon name="close"/></button></header><main><div className="result-hero"><div className="score-orbit"><span>{score}<small>/3</small></span><i/><i/></div><div><div className="eyebrow"><span/>{score>=2?'A strong foundation':'A good start'}</div><h1>You understand the <em>core idea.</em></h1><p>Your answers show where inertia is clicking and what to revisit next.</p><div className="result-stats"><span><b>{Math.round(score*100/3)}%</b>Accuracy</span><span><b>{score}/3</b>Correct answers</span><span><b>{score>=2?'Strong':'Revisit'}</b>Concept status</span></div></div></div><div className="results-grid"><section><span className="tag">WHAT CLICKED</span><h2>Understanding built</h2><div className="mastery-row"><i><Icon name="check"/></i><div><b>Inertia and motion</b><p>You can explain why an object resists changes in its motion.</p></div><span>{score>=2?'Strong':'Growing'}</span></div><div className="mastery-row revisit"><i>↗</i><div><b>Force and stopping motion</b><p>Take one more look at how external force changes velocity.</p></div><span>{score===3?'Strong':'Revisit'}</span></div></section><aside><span className="tag">A THOUGHTFUL NEXT STEP</span><h3>Review one visual explanation</h3><p>It'll take about 4 minutes and make the next concept easier.</p><Button variant="secondary" onClick={()=>go('classroom')} icon="redo">Review the visual</Button></aside></div><div className="result-actions"><Button variant="ghost" onClick={()=>go('quiz')}><Icon name="redo"/> Retry checkpoint</Button><Button variant="secondary" disabled title="Answer review is coming soon">Review answers</Button><Button onClick={()=>go('dashboard')} icon="arrow">Continue learning</Button></div></main></div>
}

function ProgressPage({ shell }: { shell:(x:React.ReactNode)=>React.ReactNode }) {
  return shell(<main className="page progress-page"><header className="page-heading"><div><div className="eyebrow"><span/>Your learning, in perspective</div><h1>Progress that feels like you.</h1><p>A calm look at what’s growing—and where a little attention could help.</p></div><select disabled title="Date-range filters are coming soon"><option>Last 30 days</option><option>This week</option></select></header>
    <div className="metric-grid">{[['12h 40m','Time learning','+2h from last month'],['18','Concepts mastered','Across 4 subjects'],['82%','Quiz accuracy','Steady and improving'],['4','Chapters active','At your own pace']].map((x,i)=><article key={x[1]}><span>0{i+1}</span><b>{x[0]}</b><h3>{x[1]}</h3><p>{x[2]}</p></article>)}</div>
    <div className="analytics-grid"><section className="panel learning-chart"><div className="panel-head"><div><span className="tag">WEEKLY RHYTHM</span><h2>Time spent understanding</h2></div><b>4h 20m <small>this week</small></b></div><div className="line-chart"><svg viewBox="0 0 700 180"><path className="area" d="M0 145 C80 130 90 80 175 105 S290 30 380 70 S500 130 560 65 S650 55 700 20 L700 180 L0 180Z"/><path d="M0 145 C80 130 90 80 175 105 S290 30 380 70 S500 130 560 65 S650 55 700 20"/><g><circle cx="0" cy="145" r="4"/><circle cx="175" cy="105" r="4"/><circle cx="380" cy="70" r="4"/><circle cx="560" cy="65" r="4"/><circle cx="700" cy="20" r="4"/></g></svg><div>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=><span key={x}>{x}</span>)}</div></div></section><section className="panel subject-progress"><span className="tag">SUBJECT PROGRESS</span><h2>How each world is growing</h2>{subjects.map(s=><div key={s.name}><span><b>{s.name}</b><small>{s.progress}%</small></span><Progress value={s.progress}/></div>)}</section></div>
    <section className="growth-section"><div><span className="tag">GENTLE FOCUS</span><h2>A little attention here will go far.</h2></div><div className="focus-cards"><article><span>Physics · Mechanics</span><h3>Free-body diagrams</h3><p>You understand the forces. Practice separating them visually.</p><button disabled title="This review is coming soon">Start 8-min review <Icon name="arrow"/></button></article><article><span>Mathematics · Calculus</span><h3>Limits from graphs</h3><p>One visual lesson can strengthen this before derivatives.</p><button disabled title="This lesson is coming soon">Open visual lesson <Icon name="arrow"/></button></article></div></section>
  </main>)
}

function Notes({ go, shell }: { go:(s:Screen)=>void; shell:(x:React.ReactNode)=>React.ReactNode }) {
  const [filter,setFilter]=useState('All')
  const [search,setSearch]=useState('')
  const [subject,setSubject]=useState('All')
  const matches=(category:string,title:string,noteSubject:string)=>(
    (filter==='All'||filter===category)
    && (subject==='All'||subject===noteSubject)
    && `${title} ${noteSubject}`.toLowerCase().includes(search.toLowerCase())
  )
  return shell(<main className="page notes-page"><header className="page-heading"><div><div className="eyebrow"><span/>Your learning library</div><h1>Everything worth remembering.</h1><p>Notes, diagrams, equations, and explanations—saved as you learn.</p></div></header><div className="notes-toolbar"><div className="search"><Icon name="search"/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search your notes"/></div><div className="filter-tabs">{['All','Notes','Diagrams','Equations','Lessons'].map(x=><button className={filter===x?'active':''} onClick={()=>setFilter(x)} key={x}>{x}</button>)}</div></div>
    <div className="notes-layout"><aside><span className="tag">SUBJECTS</span><button className={subject==='All'?'active':''} onClick={()=>setSubject('All')}>All subjects</button>{subjects.map((s,i)=><button key={s.name} className={subject===s.name?'active':''} onClick={()=>setSubject(s.name)}><i className={`tone-${i}`}/>{s.name}<span>{[8,5,6,3][i]}</span></button>)}</aside><section><div className="notes-section-head"><h2>Recent saves</h2><span>4 items</span></div><div className="saved-grid">
      <article className="saved-note" style={{display:matches('Notes','Inertia in everyday life','Physics')?'':'none'}} onClick={()=>go('chapter')}><div className="paper"><span>NEWTON'S FIRST LAW</span><h4>Inertia</h4><p>An object continues in its state of rest or uniform motion unless...</p><i>inertia = resistance to change</i></div><div><span>Lesson note</span><h3>Inertia in everyday life</h3><p>Physics · Today</p></div></article>
      <article className="saved-diagram" style={{display:matches('Diagrams','Passenger in a stopping bus','Physics')?'':'none'}}><div className="diagram-preview"><div className="tiny-bus"><span/><i/><b>→</b></div><span>body continues →</span></div><div><span>Saved diagram</span><h3>Passenger in a stopping bus</h3><p>Physics · Today</p></div></article>
      <article className="saved-equation" style={{display:matches('Equations',"Newton's Second Law",'Physics')?'':'none'}}><div className="equation-preview">F = ma<small>force = mass × acceleration</small></div><div><span>Equation</span><h3>Newton's Second Law</h3><p>Physics · Yesterday</p></div></article>
      <article className="saved-note" style={{display:matches('Lessons','Understanding hybrid orbitals','Chemistry')?'':'none'}}><div className="paper chemistry"><span>CHEMICAL BONDING</span><h4>Hybridisation</h4><p>Mixing atomic orbitals to form new hybrid orbitals...</p><i>sp³ → tetrahedral</i></div><div><span>Lesson summary</span><h3>Understanding hybrid orbitals</h3><p>Chemistry · 15 Mar</p></div></article>
    </div></section></div>
  </main>)
}

function Profile({ shell, dark, toggle }: { shell:(x:React.ReactNode)=>React.ReactNode; dark:boolean; toggle:()=>void }) {
  return shell(<main className="page profile-page"><header className="page-heading"><div><div className="eyebrow"><span/>Your space</div><h1>Profile & preferences</h1><p>Keep your learning experience feeling right for you.</p></div></header><div className="profile-layout"><aside><div className="profile-card"><div className="avatar">AM</div><h3>Arjun Mehta</h3><p>Class 11 · JEE</p><button disabled title="Profile editing is coming soon">Edit profile</button></div>{['Learning profile','Teaching preferences','Notifications','Account & privacy'].map(x=><button key={x} disabled title="Profile sections are coming soon">{x}<Icon name="chevron"/></button>)}</aside><section className="settings-panel"><div><span className="tag">LEARNING PROFILE</span><h2>Learning profile</h2><p>Profile preferences are a preview and aren't saved yet.</p></div><div className="settings-row"><div><h3>Class & learning goal</h3><p>Used to choose the right syllabus and difficulty.</p></div><select disabled title="Profile editing is coming soon"><option>Class 11 · JEE</option><option>Class 12 · JEE</option></select></div><div className="settings-row"><div><h3>Your subjects</h3><p>Subjects shown in your learning space.</p></div><div className="subject-chips"><span>Physics ×</span><span>Chemistry ×</span><span>Mathematics ×</span><button disabled title="Subject editing is coming soon">+ Add</button></div></div><div className="settings-row"><div><h3>Teaching language</h3><p>URJA AI can switch anytime during a lesson.</p></div><select disabled title="Profile editing is coming soon"><option>English</option><option>Hinglish</option><option>Hindi</option></select></div><div className="settings-row"><div><h3>Default teaching style</h3><p>Your preferred way to begin new concepts.</p></div><select disabled title="Profile editing is coming soon"><option>Examples first</option><option>Explain from basics</option><option>Conceptual deep dive</option></select></div><div className="settings-row"><div><h3>Appearance</h3><p>Choose a calm light or dark learning space.</p></div><button className="theme-setting" onClick={toggle}><Icon name={dark?'moon':'sun'}/>{dark?'Warm dark':'Soft light'}<span>{dark?'Switch to light':'Switch to dark'}</span></button></div><div className="save-row"><span>Profile changes aren't saved yet.</span><Button disabled title="Profile saving is coming soon">Save preferences</Button></div></section></div></main>)
}

export default function App() {
  const [screen,setScreen]=useState<Screen>('landing')
  const [dark,setDark]=useState(()=>localStorage.getItem('urja-theme')==='dark')
  const [lessonPrefs,setLessonPrefs]=useState<LessonPrefs>({ teachingApproach: 'Examples first', language: 'English' })
  const [urjaMessages,setUrjaMessages]=useState<ChatMessage[]>([])
  const [quizScore,setQuizScore]=useState(0)
  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';localStorage.setItem('urja-theme',dark?'dark':'light')},[dark])
  const go=(s:Screen)=>{setScreen(s);window.scrollTo({top:0,behavior:'smooth'})}
  const toggle=()=>setDark(x=>!x)
  const shell=useMemo(()=> (content:React.ReactNode)=><AppShell screen={screen} go={go} dark={dark} toggle={toggle}>{content}</AppShell>,[screen,dark])
  const pages:Record<Screen,React.ReactNode>={
    landing:<Landing go={go} dark={dark} toggle={toggle}/>, auth:<Auth go={go} dark={dark} toggle={toggle}/>,
    onboarding:<Onboarding go={go} dark={dark} toggle={toggle}/>, dashboard:<Dashboard go={go} shell={shell}/>,
    explore:<Explore go={go} shell={shell}/>, chapter:<Chapter go={go} shell={shell}/>,
    setup:<LessonSetup go={go} dark={dark} toggle={toggle} onEnter={prefs=>{setLessonPrefs(prefs);go('classroom')}}/>, classroom:<Classroom go={go} dark={dark} toggle={toggle} prefs={lessonPrefs} messages={urjaMessages} setMessages={setUrjaMessages}/>,
    quiz:<Quiz go={go} onComplete={setQuizScore}/>, results:<Results go={go} score={quizScore}/>, progress:<ProgressPage shell={shell}/>,
    notes:<Notes go={go} shell={shell}/>, profile:<Profile shell={shell} dark={dark} toggle={toggle}/>,
  }
  return <>{pages[screen]}</>
}
