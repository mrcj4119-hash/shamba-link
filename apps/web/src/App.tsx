import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck, BookOpen, Brain, CalendarDays, ClipboardCheck,
  Camera, Check, CheckCircle2, CircleHelp, ClipboardList,
  CloudSun, CreditCard, FileImage, Filter, FlaskConical, Gamepad2, HeartHandshake,
  Leaf, LogOut, MapPin, MessageCircle, Package, Plus, RotateCcw, Search, Users,
  ShieldCheck, ShoppingBag, ShoppingCart, Sparkles, Sprout, Stethoscope, Truck,
  UserRound, X, Wheat, Zap,
} from "lucide-react";
import brandLogo from "./assets/shamba-link-logo.jpg";
import farmerHomeBackground from "./assets/farmer-home-background.mp4";
import farmBarnBackground from "./assets/backgrounds/farm-barn.jpg";
import farmChickenBackground from "./assets/backgrounds/farm-chickens.jpg";
import cropIllustrationBackground from "./assets/backgrounds/crop-illustration.jpg";
import farmIrrigationBackground from "./assets/backgrounds/farm-irrigation.jpg";
import { ApiError, api, imageUrl } from "./api";
import { useAuth } from "./auth";
import { FarmerCasesPage, FarmerDashboard, FarmerFarmsPage, FarmerInputsPage } from "./FarmerWorkspace";
import { FarmerPlanningPage } from "./FarmerPlanning";
import { AdminCasesPage, AdminGuidesPage, AdminUsersPage } from "./AdminWorkspace";
import { readFunZoneScores, recordFunZoneScore } from "./fun-zone-score";
import type { FunZoneActivity, FunZoneScores } from "./fun-zone-score";
import { funZoneGames } from "./fun-zone-games";
import type { FunZoneGame, FunZoneQuestion } from "./fun-zone-games";
import { KnowledgeLibrary } from "./KnowledgeLibrary";
import { ExpertProfilePage, ExpertVerificationPage } from "./ExpertProfile";
import { LiveCameraCapture } from "./LiveCameraCapture";
import { PhotoPaymentGate, PhotoPaymentReviewPage, usePaymentReviewerCapability, usePhotoPaymentAccess } from "./PhotoPayment";
import type { Consultation, Diagnosis, Expert, Order, Page, Product, UserRole } from "./types";

const navItems: Record<UserRole, { to: string; label: string; icon: typeof Leaf }[]> = {
  farmer: [
    { to: "/app", label: "Overview", icon: Sprout },
    { to: "/app/cases", label: "Report & recovery", icon: HeartHandshake },
    { to: "/app/farms", label: "My farms & crops", icon: Wheat },
    { to: "/app/inputs", label: "Input journal", icon: ClipboardList },
    { to: "/app/planning", label: "Soil & crop planner", icon: FlaskConical },
    { to: "/app/marketplace", label: "Marketplace", icon: ShoppingBag },
    { to: "/app/consultations", label: "Expert visits", icon: CalendarDays },
    { to: "/app/orders", label: "My orders", icon: Package },
  ],
  agrovet: [
    { to: "/app", label: "Overview", icon: Sprout },
    { to: "/app/marketplace", label: "My products", icon: ShoppingBag },
    { to: "/app/orders", label: "Incoming orders", icon: Package },
  ],
  expert: [
    { to: "/app", label: "Overview", icon: Sprout },
    { to: "/app/consultations", label: "My schedule", icon: CalendarDays },
    { to: "/app/expert-profile", label: "Credentials & profile", icon: BadgeCheck },
  ],
  admin: [
    { to: "/app", label: "Overview", icon: ShieldCheck },
    { to: "/app/admin-users", label: "User management", icon: Users },
    { to: "/app/admin-cases", label: "Crop reports", icon: ClipboardCheck },
    { to: "/app/admin-guides", label: "Farming guides", icon: BookOpen },
    { to: "/app/expert-verification", label: "Expert vetting", icon: BadgeCheck },
    { to: "/app/payment-review", label: "Review payments", icon: ClipboardList },
  ],
};

const money = (amount: string | number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(Number(amount));
const supportPhone = "0704189723";
const supportPhoneHref = "tel:+254704189723";

function message(error: unknown): string {
  return error instanceof ApiError ? error.message : "We couldn't reach Shamba Link. Check your connection and try again.";
}

function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loader"><span className="loader" /> Getting your farm ready…</div>;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/app" replace /> : <WelcomePage />} />
      <Route path="/fun-zone" element={<FunZonePage />} />
      <Route path="/knowledge" element={<KnowledgeLibrary />} />
      <Route path="/login" element={user ? <Navigate to="/app" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/app" replace /> : <AuthPage mode="register" />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/app" element={user ? <AppShell /> : <Navigate to="/login" replace />}>
        <Route index element={user?.role === "admin" ? <AdminDashboard /> : user?.role === "farmer" ? <FarmerDashboard /> : <Dashboard />} />
        <Route path="farms" element={user?.role === "farmer" ? <FarmerFarmsPage /> : <Navigate to="/app" replace />} />
        <Route path="cases" element={user?.role === "farmer" ? <FarmerCasesPage /> : <Navigate to="/app" replace />} />
        <Route path="inputs" element={user?.role === "farmer" ? <FarmerInputsPage /> : <Navigate to="/app" replace />} />
        <Route path="planning" element={user?.role === "farmer" ? <FarmerPlanningPage /> : <Navigate to="/app" replace />} />
        <Route path="diagnosis" element={user?.role === "farmer" ? <DiagnosisPage /> : <Navigate to="/app" replace />} />
        <Route path="payment-review" element={<PhotoPaymentReviewPage />} />
        <Route path="admin-users" element={user?.role === "admin" ? <AdminUsersPage /> : <Navigate to="/app" replace />} />
        <Route path="admin-cases" element={user?.role === "admin" ? <AdminCasesPage /> : <Navigate to="/app" replace />} />
        <Route path="admin-guides" element={user?.role === "admin" ? <AdminGuidesPage /> : <Navigate to="/app" replace />} />
        <Route path="expert-profile" element={user?.role === "expert" ? <ExpertProfilePage /> : <Navigate to="/app" replace />} />
        <Route path="expert-verification" element={user?.role === "admin" ? <ExpertVerificationPage /> : <Navigate to="/app" replace />} />
        <Route path="marketplace" element={user?.role !== "admin" ? <MarketplacePage /> : <Navigate to="/app" replace />} />
        <Route path="consultations" element={user?.role !== "admin" ? <ConsultationsPage /> : <Navigate to="/app" replace />} />
        <Route path="orders" element={user?.role !== "admin" ? <OrdersPage /> : <Navigate to="/app" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link className={`brand ${inverse ? "brand-light" : ""}`} to="/">
      <img className="brand-mark" src={brandLogo} alt="" />
      <span>shamba<span className="brand-link">link</span></span>
    </Link>
  );
}

function WelcomePage() {
  return (
    <main className="welcome" style={{ backgroundImage: `linear-gradient(rgba(247, 248, 243, .72), rgba(247, 248, 243, .72)), url("${farmIrrigationBackground}")` }}>
      <header className="welcome-header"><Brand /><div className="welcome-action-stack"><div className="welcome-actions"><a href="#how-it-works" className="header-link">How it works</a><Link to="/login" className="header-link">Log in</Link><Link to="/register" className="button button-dark button-small">Join Shamba Link</Link></div><Link to="/fun-zone" className="fun-zone-promo"><Sparkles size={15} /> Fun Zone <Gamepad2 size={15} /></Link></div></header>
      <section className="welcome-hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-dot" /> A little help goes a long way</div>
          <h1>Growing a better<br />future, <em>together.</em></h1>
          <p>Good things grow when farmers have the right people in their corner. Get trusted crop advice, expert support and the supplies you need — all in one place.</p>
          <div className="hero-buttons"><Link to="/register" className="button button-dark">Get started for free</Link><Link to="/login" className="button button-light">I already have an account</Link></div>
          <Link to="/knowledge" className="welcome-library-link"><BookOpen size={16} /> Explore the farming knowledge library</Link>
          <div className="social-proof"><div className="avatar-stack"><span>A</span><span>M</span><span>J</span><span>+</span></div><div><strong>Your farming community</strong><small>Better seasons start with connection</small></div></div>
        </div>
        <div className="hero-visual">
          <video className="hero-photo" src={farmerHomeBackground} poster="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1400&q=85" autoPlay muted loop playsInline preload="metadata" aria-hidden="true" />
          <div className="photo-wash" />
          <div className="floating-note scan-note"><span className="note-icon"><Leaf size={17} /></span><span><strong>A healthier harvest</strong><small>Starts with a little know-how</small></span><CheckCircle2 className="note-check" size={18} /></div>
          <div className="floating-note weather-note"><span className="weather-icon"><CloudSun size={23} /></span><span><strong>Looking bright</strong><small>Good day to get growing</small></span></div>
          <div className="hero-seal"><Sprout size={22} /><span>Rooted<br />in community</span></div>
        </div>
      </section>
      <section className="trust-strip"><span><ShieldCheck size={17} /> Advice from real experts</span><i /><span><HeartHandshake size={17} /> A community that cares</span><i /><span><MapPin size={17} /> Support close to home</span></section>
      <section className="how-section" id="how-it-works"><div className="section-kicker">Everything in one place</div><h2>A good season takes a village.</h2><p>Whatever you’re growing, we’ll help you find the right next step.</p><div className="feature-grid">
        <Feature icon={<FlaskConical />} tone="sage" title="Know what’s growing" text="Share a crop photo and get a helpful starting point, with a real expert close by when you need one." />
        <Feature icon={<UsersIcon />} tone="peach" title="Talk to someone who knows" text="Book a friendly one-on-one with an agricultural expert who understands life on the farm." />
        <Feature icon={<ShoppingBag />} tone="gold" title="Find what you need" text="Shop seeds, supplies and more from agrovets serving your local community." />
      </div></section>
      <footer className="welcome-footer"><Brand /><span>Made for the people who help us all grow.</span><span>© {new Date().getFullYear()} Shamba Link</span></footer>
    </main>
  );
}

function shuffled<T,>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function createScrambledLetters(word: string): string {
  const letters = shuffled(word.split(""));
  if (letters.join("") === word && letters.length > 1) {
    [letters[0], letters[1]] = [letters[1], letters[0]];
  }
  return letters.join("");
}

interface CropMemoryCard {
  id: string;
  pairId: number;
  label: string;
}

function FunZonePage() {
  const [activity, setActivity] = useState<"quiz" | "crop-memory" | "word-scramble" | null>(null);
  const [selectedGame, setSelectedGame] = useState<FunZoneGame | null>(null);
  const [choosingGame, setChoosingGame] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [questionDeck, setQuestionDeck] = useState<FunZoneQuestion[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [memoryDeck, setMemoryDeck] = useState<CropMemoryCard[]>([]);
  const [revealedCards, setRevealedCards] = useState<string[]>([]);
  const [matchedCards, setMatchedCards] = useState<string[]>([]);
  const [memoryAttempts, setMemoryAttempts] = useState(0);
  const [scrambleGuess, setScrambleGuess] = useState("");
  const [scrambleLetters, setScrambleLetters] = useState("");
  const [scrambleFeedback, setScrambleFeedback] = useState<"correct" | "incorrect" | "">("");
  const [savedScores, setSavedScores] = useState<FunZoneScores>({});
  const [scoreError, setScoreError] = useState("");
  const currentQuestion = questionDeck[questionIndex];
  const currentScramble = selectedGame?.kind === "scramble" ? selectedGame.words[questionIndex] : undefined;
  const memoryPairCount = selectedGame?.kind === "memory" ? selectedGame.pairs.length : 0;
  const activityLength = activity === "quiz" ? questionDeck.length : selectedGame?.kind === "scramble" ? selectedGame.words.length : 0;
  const memoryFinished = activity === "crop-memory" && memoryDeck.length > 0 && matchedCards.length === memoryDeck.length;
  const scrambleFinished = activity === "word-scramble" && selectedGame?.kind === "scramble" && questionIndex === selectedGame.words.length;
  const finished = activity === "quiz" && questionDeck.length > 0 && questionIndex === questionDeck.length
    || scrambleFinished
    || memoryFinished;

  useEffect(() => {
    try {
      setSavedScores(readFunZoneScores(window.localStorage));
    } catch {
      setScoreError("Saved scores are unavailable in this browser.");
    }
  }, []);

  useEffect(() => {
    if (!finished || !activity) return;
    const activityKey: FunZoneActivity = activity === "quiz"
      ? "quiz"
      : activity === "crop-memory" ? "memory" : "scramble";
    try {
      setSavedScores(recordFunZoneScore(window.localStorage, activityKey, score));
      setScoreError("");
    } catch {
      setScoreError("This browser could not save your score. Check your storage settings and try again.");
    }
  }, [finished, activity, score]);

  useEffect(() => {
    if (revealedCards.length !== 2) return undefined;
    const first = memoryDeck.find((card) => card.id === revealedCards[0]);
    const second = memoryDeck.find((card) => card.id === revealedCards[1]);
    if (first?.pairId === second?.pairId) {
      setMatchedCards((previous) => [...previous, ...revealedCards]);
      setRevealedCards([]);
      setScore((previous) => previous + 1);
      return undefined;
    }
    const timer = window.setTimeout(() => setRevealedCards([]), 850);
    return () => window.clearTimeout(timer);
  }, [revealedCards, memoryDeck]);

  function start(game: FunZoneGame) {
    setSelectedGame(game);
    setActivity(game.kind === "quiz" ? "quiz" : game.kind === "memory" ? "crop-memory" : "word-scramble");
    setChoosingGame(false);
    setQuestionIndex(0);
    setQuestionDeck(game.kind === "quiz"
      ? shuffled(game.questions).map((question) => ({ ...question, options: shuffled(question.options) }))
      : []);
    setSelectedAnswer("");
    setScore(0);
    setScrambleGuess("");
    setScrambleFeedback("");
    setScrambleLetters(game.kind === "scramble" ? createScrambledLetters(game.words[0].word) : "");
    setRevealedCards([]);
    setMatchedCards([]);
    setMemoryAttempts(0);
    if (game.kind === "memory") {
      setMemoryDeck(shuffled(game.pairs.flatMap((pair, pairId) => [
        { id: `${game.id}-${pairId}-left`, pairId, label: pair.left },
        { id: `${game.id}-${pairId}-right`, pairId, label: pair.right },
      ])));
    } else {
      setMemoryDeck([]);
    }
  }

  function returnToActivities() {
    setActivity(null);
    setSelectedGame(null);
    setChoosingGame(false);
    setRevealedCards([]);
  }

  function flipMemoryCard(cardId: string) {
    if (revealedCards.length >= 2 || revealedCards.includes(cardId) || matchedCards.includes(cardId)) return;
    setMemoryAttempts((previous) => previous + (revealedCards.length === 1 ? 1 : 0));
    setRevealedCards((previous) => [...previous, cardId]);
  }

  function answer(option: string) {
    if (selectedAnswer) return;
    setSelectedAnswer(option);
    if (option === currentQuestion.answer) setScore((previous) => previous + 1);
  }

  function continueActivity() {
    const nextIndex = questionIndex + 1;
    setQuestionIndex(nextIndex);
    setSelectedAnswer("");
    setScrambleGuess("");
    setScrambleFeedback("");
    if (selectedGame?.kind === "scramble" && selectedGame.words[nextIndex]) {
      setScrambleLetters(createScrambledLetters(selectedGame.words[nextIndex].word));
    }
  }

  function checkScramble() {
    if (!currentScramble || scrambleFeedback) return;
    const correct = scrambleGuess.trim().toUpperCase() === currentScramble.word;
    setScrambleFeedback(correct ? "correct" : "incorrect");
    if (correct) setScore((previous) => previous + 1);
  }

  return <main className="fun-zone-page">
    <header className="fun-zone-header"><Brand /><Link to="/" className="header-link">Back to home</Link></header>
    <section className="fun-zone-content">
      <span className="fun-zone-kicker"><Sparkles size={16} /> LEARN A LITTLE · HAVE SOME FUN</span>
      <h1>Welcome to the Fun Zone!</h1>
      <p className="fun-zone-intro">Pick from 20 quick farm-themed games for curious minds of every age. No timers, just play at your own pace.</p>
      {!activity && !choosingGame && <div className="fun-zone-choices">
        <button type="button" className="fun-zone-choice" onClick={() => setChoosingGame(true)}>
          <span className="fun-zone-choice-icon game-icon"><Gamepad2 size={25} /></span><span className="fun-zone-choice-copy"><strong>Explore all 20 games</strong><small>Try quizzes, memory matches, and word scrambles across a range of farm topics.</small></span>
        </button>
      </div>}
      {!activity && !choosingGame && <div className="fun-zone-saved-scores" aria-live="polite">
        <strong>Your saved best scores</strong>
        <span>Quiz: {savedScores.quiz?.best ?? "—"} · Memory: {savedScores.memory?.best ?? "—"} pairs · Word scramble: {savedScores.scramble?.best ?? "—"}</span>
        {Object.values(savedScores).some((entry) => entry) && <small>{Object.values(savedScores).reduce((total, entry) => total + (entry?.totalPlays ?? 0), 0)} activities played on this device</small>}
      </div>}
      {scoreError && <p className="fun-zone-score-error" role="status">{scoreError}</p>}
      {choosingGame && !activity && <section className="fun-zone-activity" aria-label="Choose an agriculture game">
        <div className="fun-zone-activity-top"><button type="button" className="fun-zone-back" onClick={returnToActivities}>Activities</button><span>{funZoneGames.length} games · all ages</span></div>
        <div className="fun-zone-game-list">
          {funZoneGames.map((game) => <button type="button" className="fun-zone-choice" key={game.id} onClick={() => start(game)}>
            <span className={`fun-zone-choice-icon ${game.kind === "quiz" ? "quiz-icon" : "game-icon"}`}>{game.kind === "quiz" ? <Brain size={23} /> : <Gamepad2 size={23} />}</span>
            <span className="fun-zone-choice-copy"><strong>{game.title}</strong><small>{game.description}</small><small className="fun-zone-game-meta">{game.kind === "quiz" ? "Quick challenge" : game.kind === "memory" ? "Memory match" : "Word puzzle"} · All ages</small></span>
          </button>)}
        </div>
      </section>}
      {activity && selectedGame && <section className="fun-zone-activity" aria-label={selectedGame.title}>
        <div className="fun-zone-activity-top">
          <button type="button" className="fun-zone-back" onClick={returnToActivities}>All games</button>
          <span>{selectedGame.title}</span>
          {!finished && activity === "quiz" && <span>Question {questionIndex + 1} of {questionDeck.length}</span>}
          {!finished && activity === "word-scramble" && <span>Word {questionIndex + 1} of {activityLength}</span>}
          {activity === "crop-memory" && <span>{matchedCards.length / 2} of {memoryPairCount} pairs · {memoryAttempts} tries</span>}
        </div>
        {finished
          ? <div className="fun-zone-finished" aria-live="polite"><span className="fun-zone-finished-icon"><Sparkles size={28} /></span><h2>{activity === "crop-memory" ? "All pairs matched!" : score === activityLength ? "Fantastic farming!" : "Nice work!"}</h2><p>{activity === "crop-memory" ? `You found all ${memoryPairCount} pairs in ${memoryAttempts} tries.` : `You got ${score} out of ${activityLength} correct. Keep learning and growing!`}</p><div><button type="button" className="button button-dark" onClick={() => start(selectedGame)}><RotateCcw size={16} /> Play again</button><button type="button" className="button button-light" onClick={returnToActivities}>Choose another game</button></div></div>
          : activity === "crop-memory"
            ? <><div className="fun-zone-progress" aria-label={`${matchedCards.length / 2} of ${memoryPairCount} pairs matched`}><span style={{ width: `${(matchedCards.length / memoryDeck.length) * 100}%` }} /></div><h2>Find the matching pairs</h2><div className="fun-zone-memory-grid">{memoryDeck.map((card) => {
              const isVisible = revealedCards.includes(card.id) || matchedCards.includes(card.id);
              return <button type="button" key={card.id} className={`fun-zone-memory-card${isVisible ? " is-visible" : ""}${matchedCards.includes(card.id) ? " is-matched" : ""}`} onClick={() => flipMemoryCard(card.id)} aria-label={isVisible ? card.label : "Hidden card"} aria-pressed={isVisible} disabled={matchedCards.includes(card.id) || revealedCards.length === 2}>{isVisible ? card.label : "?"}</button>;
            })}</div></>
            : activity === "word-scramble" && currentScramble
              ? (
                <div>
                  <div className="fun-zone-progress" aria-label={`Word ${questionIndex + 1} of ${activityLength}`}><span style={{ width: `${((questionIndex + 1) / activityLength) * 100}%` }} /></div>
                  <h2>Unscramble the word</h2>
                  <p className="fun-zone-scramble-clue">{currentScramble.clue}</p>
                  <div className="fun-zone-scramble-word" aria-label={`Scrambled letters ${scrambleLetters.split("").join(" ")}`}>{scrambleLetters.split("").join("  ")}</div>
                  <form className="fun-zone-scramble-form" onSubmit={(event) => { event.preventDefault(); checkScramble(); }}>
                    <label htmlFor="crop-word-answer">Your answer</label>
                    <input id="crop-word-answer" value={scrambleGuess} onChange={(event) => { setScrambleGuess(event.target.value); setScrambleFeedback(""); }} disabled={Boolean(scrambleFeedback)} autoComplete="off" />
                    <button className="button button-dark" type="submit" disabled={!scrambleGuess.trim() || Boolean(scrambleFeedback)}>Check word</button>
                  </form>
                  {scrambleFeedback && <div className={`fun-zone-feedback ${scrambleFeedback === "correct" ? "is-correct" : "is-incorrect"}`} aria-live="polite">
                    <strong>{scrambleFeedback === "correct" ? "You got it!" : "Good try!"}</strong>
                    <span>{scrambleFeedback === "correct" ? ` ${currentScramble.word} — ${currentScramble.clue}.` : `The answer was ${currentScramble.word}. ${currentScramble.clue}.`}</span>
                    <button type="button" className="button button-dark" onClick={continueActivity}>{questionIndex === activityLength - 1 ? "See my score" : "Next word"}</button>
                  </div>}
                </div>
              )
              : currentQuestion ? (
                <>
                  <div className="fun-zone-progress" aria-label={`Question ${questionIndex + 1} of ${questionDeck.length}`}><span style={{ width: `${((questionIndex + 1) / questionDeck.length) * 100}%` }} /></div>
                  <h2>{currentQuestion.prompt}</h2>
                  <div className="fun-zone-options">{currentQuestion.options.map((option) => {
                    const isCorrect = option === currentQuestion.answer;
                    const isSelected = option === selectedAnswer;
                    const answerClass = selectedAnswer && isCorrect ? " correct" : isSelected ? " incorrect" : "";
                    return <button type="button" key={option} className={`fun-zone-option${answerClass}`} onClick={() => answer(option)} disabled={Boolean(selectedAnswer)}>{option}{selectedAnswer && isCorrect && <CheckCircle2 size={17} />}{isSelected && !isCorrect && <X size={17} />}</button>;
                  })}</div>
                  {selectedAnswer && <div className={`fun-zone-feedback ${selectedAnswer === currentQuestion.answer ? "is-correct" : "is-incorrect"}`} aria-live="polite">
                    <strong>{selectedAnswer === currentQuestion.answer ? "That’s right!" : "Good try!"}</strong>
                    <span>{currentQuestion.explanation}</span>
                    <button type="button" className="button button-dark" onClick={continueActivity}>{questionIndex === questionDeck.length - 1 ? "See my score" : "Next question"}</button>
                  </div>}
                </>
              ) : null}
      </section>}
    </section>
  </main>;
}

function UsersIcon() {
  return <MessageCircle />;
}

function Feature({ icon, tone, title, text }: { icon: ReactNode; tone: string; title: string; text: string }) {
  return <article className="feature-card"><span className={`feature-icon ${tone}`}>{icon}</span><h3>{title}</h3><p>{text}</p></article>;
}

function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const registering = mode === "register";
  const authBackground = registering ? farmIrrigationBackground : farmBarnBackground;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      if (registering) {
        const role = String(form.get("role")) as "farmer" | "agrovet" | "expert";
        await signUp({
          name: String(form.get("name")),
          email: String(form.get("email")),
          password: String(form.get("password")),
          role,
          phone: String(form.get("phone")),
          locationRegion: String(form.get("region")),
          preferredLanguage: String(form.get("language")) as "en" | "sw",
        });
        navigate(role === "expert" ? "/app/expert-profile" : "/app");
      } else {
        await signIn(String(form.get("email")), String(form.get("password")));
        navigate("/app");
      }
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-page" style={{ backgroundImage: `linear-gradient(rgba(255, 255, 255, .78), rgba(255, 255, 255, .78)), url("${authBackground}")` }}><div className="auth-side"><Brand inverse /><div className="auth-side-content"><span className="auth-quote-mark">“</span><h2>It takes a community to grow something good.</h2><p>We’re glad you’re here. Let’s make this season a little easier, together.</p><span className="auth-side-credit">SHAMBA LINK · GROWING TOGETHER</span></div><span className="auth-side-bottom">Better seasons start with connection.</span></div><section className="auth-form-side"><Link className={`back-home${registering ? "" : " login-back-home"}`} to="/">Back to home</Link><div className={`auth-form-wrap${registering ? "" : " login-form-wrap"}`}><div className="form-kicker">{registering ? "YOUR NEXT CHAPTER" : "WELCOME BACK"}</div><h1>{registering ? "Come on in." : "Good to see you."}</h1><p className="auth-subtitle">{registering ? "Let’s get you set up for a growing season." : "Your community and your next good season are waiting."}</p>
      <form className="auth-form" onSubmit={submit}>
        {registering && <><label>Your name<input name="name" placeholder="e.g. Amina Njeri" autoComplete="name" required minLength={2} /></label><label>I’m joining as<select name="role" defaultValue="farmer"><option value="farmer">A farmer</option><option value="agrovet">An agrovet / shop</option><option value="expert">A veterinary or agricultural expert</option></select></label><label>Preferred language<select name="language" defaultValue="en"><option value="en">English</option><option value="sw">Kiswahili</option></select></label></>}
        <label>Email address<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" placeholder={registering ? "At least 10 characters" : "Your password"} autoComplete={registering ? "new-password" : "current-password"} minLength={registering ? 10 : 1} required /></label>
        {registering && <><label>Phone number<input name="phone" type="tel" placeholder="+254 7xx xxx xxx" autoComplete="tel" required /></label><label>Your county / region<input name="region" placeholder="e.g. Kiambu" autoComplete="address-level1" required /></label></>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-dark auth-submit" disabled={busy}>{busy ? <><span className="button-spinner" /> One moment…</> : registering ? "Create my account" : "Log in to my account"}</button>
      </form>
      <div className="auth-switch">{registering ? "Already part of the community?" : "New to Shamba Link?"} <Link to={registering ? "/login" : "/register"}>{registering ? "Log in" : "Create an account"}</Link></div>
      {!registering && <><div className="demo-hint"><CircleHelp size={16} /><span>Demo account: <strong>demo.farmer@shambalink.test</strong><br />Password: <strong>ShambaDemo2026!</strong><br /><small>Demo credentials work after loading development seed data.</small></span></div><p className="auth-subtitle">Admin accounts are provisioned separately. Sign in with the admin email and password provided to you.</p></>}
      {!registering && <div className="auth-switch"><Link to="/forgot-password">Forgot your password?</Link></div>}
    </div></section></main>;
}

function RecoveryLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="recovery-page"><Link to="/" className="brand"><img className="brand-mark" src={brandLogo} alt="" /><span>shamba<span className="brand-link">link</span></span></Link><section className="recovery-card"><Link className="back-home" to="/login">Back to sign in</Link><div className="form-kicker">ACCOUNT RECOVERY</div><h1>{title}</h1><p>{description}</p>{children}<a className="recovery-support" href={supportPhoneHref}>Need help? Call Shamba Link support: {supportPhone}</a></section></main>;
}

function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const request = useMutation({
    mutationFn: (email: string) => api("/api/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
    onSuccess: () => { setError(""); setSubmitted(true); },
    onError: (cause) => setError(message(cause)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    setSubmitted(false);
    setError("");
    request.mutate(email);
  }

  return <RecoveryLayout title="Reset your password" description="Enter the email address on your account. If it matches an active account, we’ll email you a secure reset link.">
    <form className="auth-form recovery-form" onSubmit={submit}><label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>{error && <p className="form-error" role="alert">{error}</p>}{submitted && <p className="recovery-success" role="status">If an active account uses that email, a password reset link has been sent. The link expires in 30 minutes.</p>}<button className="button button-dark auth-submit" disabled={request.isPending}>{request.isPending ? "Sending reset link…" : "Send reset link"}</button></form>
  </RecoveryLayout>;
}

function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [error, setError] = useState("");
  const reset = useMutation({
    mutationFn: (password: string) => api("/api/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
    onSuccess: () => setError(""),
    onError: (cause) => setError(message(cause)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setError("The passwords do not match.");
      return;
    }
    setError("");
    reset.mutate(password);
  }

  return <RecoveryLayout title="Choose a new password" description="Create a strong password with at least 10 characters. Your other sessions will be signed out.">
    {!token ? <p className="form-error" role="alert">This reset link is incomplete. Request a new link to continue.</p>
      : reset.isSuccess ? <div className="recovery-success" role="status">Your password has been updated. <Link to="/login">Sign in with your new password.</Link></div>
        : <form className="auth-form recovery-form" onSubmit={submit}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></label><label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={10} maxLength={128} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-dark auth-submit" disabled={reset.isPending}>{reset.isPending ? "Updating password…" : "Update password"}</button></form>}
  </RecoveryLayout>;
}

function AppShell() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    return () => {
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);
  const reviewerCapability = usePaymentReviewerCapability();
  const visibleNavItems = reviewerCapability.data?.data.canReview && user!.role !== "admin"
    ? [...navItems[user!.role], { to: "/app/payment-review", label: "Review payments", icon: ClipboardList }]
    : navItems[user!.role];
  const current = visibleNavItems.find((item) => item.to === location.pathname);
  const pageBackground = location.pathname.startsWith("/app/farms")
    || location.pathname.startsWith("/app/consultations")
    ? farmBarnBackground
    : location.pathname.startsWith("/app/cases")
      || location.pathname.startsWith("/app/diagnosis")
      || location.pathname.startsWith("/app/marketplace")
      ? cropIllustrationBackground
      : location.pathname.startsWith("/app/inputs")
        || location.pathname.startsWith("/app/orders")
        ? farmChickenBackground
        : farmIrrigationBackground;
  const hasPreviousPage = Number(window.history.state?.idx ?? 0) > 0;
  function goBack() {
    if (hasPreviousPage) navigate(-1);
    else if (location.pathname !== "/app") navigate("/app", { replace: true });
  }
  return <div className="app-shell"><aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
    <div className="sidebar-brand"><Brand /><button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">Close</button></div>
    <div className="workspace-label">{user?.role === "admin" ? "ADMIN WORKSPACE" : "YOUR FARM SPACE"}</div>
    <div className="farm-switcher"><span className="farm-avatar"><Sprout size={17} /></span><span><strong>{user?.name}</strong><small>{roleLabel(user!.role)} · {user?.locationRegion}</small></span></div>
    <div className="side-caption">MENU</div>
    <nav className="side-nav">{visibleNavItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === "/app"} onClick={() => setMenuOpen(false)} className={({ isActive }) => `side-link ${isActive ? "active" : ""}`}>{label !== "Overview" && label !== "My farms & crops" && <Icon size={18} />}<span>{label}</span>{label === "Expert visits" && <span className="nav-dot" />}</NavLink>)}</nav>
    <div className="sidebar-bottom"><div className="help-card"><span className="help-spark"><Zap size={16} /></span><strong>A little help?</strong><p>Our friendly team is here for you.</p><a href={supportPhoneHref}>Call {supportPhone}</a></div><button className="side-link signout-link" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button><div className="side-profile"><span className="profile-avatar">{initials(user!.name)}</span><span><strong>{user?.name}</strong><small>{user?.email}</small></span></div></div>
  </aside>
  {menuOpen && <button className="mobile-scrim" onClick={() => setMenuOpen(false)} aria-label="Close navigation" />}
  <div className="main-shell" style={{ backgroundImage: `linear-gradient(rgba(247, 248, 243, .70), rgba(247, 248, 243, .70)), url("${pageBackground}")` }}><header className="topbar"><div className="topbar-leading"><button className="fun-zone-back back-button" onClick={goBack} disabled={!hasPreviousPage && location.pathname === "/app"} aria-label="Go back" title="Go back">Back</button><button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation">Menu</button><div className="breadcrumb"><span>{user?.role === "admin" ? "Admin" : "My farm"}</span><strong>{current?.label ?? "Overview"}</strong></div></div><div className="topbar-right"><span className={`connection-pill${online ? "" : " connection-pill-offline"}`} role="status"><span />{online ? "Online" : "Offline · saved guides available"}</span><button className="icon-button notification-button" aria-label="Notifications">Notifications</button><button className="topbar-signout" onClick={signOut}><LogOut size={16} /><span>Sign out</span></button></div></header><main className="app-content"><Outlet /></main><footer className="app-footer"><span>Growing together, one season at a time.</span><span>Need a hand? <a href={supportPhoneHref}>Call {supportPhone}</a></span></footer></div></div>;
}

function roleLabel(role: UserRole) {
  return role === "farmer" ? "Farmer" : role === "agrovet" ? "Agrovet" : role === "admin" ? "Administrator" : "Agricultural expert";
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="form-kicker">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const farmer = user?.role === "farmer";
  const diagnoses = useQuery({
    queryKey: ["diagnoses"],
    queryFn: () => api<Page<Diagnosis>>("/api/diagnoses?pageSize=3", {}, token),
    enabled: farmer,
  });
  const products = useQuery({
    queryKey: ["products", "featured"],
    queryFn: () => api<Page<Product>>("/api/products?pageSize=3", {}, token),
  });
  const consultations = useQuery({
    queryKey: ["consultations"],
    queryFn: () => api<{ data: Consultation[] }>("/api/consultations", {}, token),
    enabled: farmer || user?.role === "expert",
  });
  const firstName = user?.name.trim().split(/\s+/)[0] ?? "there";
  const scanCount = diagnoses.data?.total ?? 0;
  const nextVisit = consultations.data?.data.find((visit) => visit.status === "pending");

  return <div className="page-stack">
    <section className="dashboard-welcome"><div className="welcome-text"><span className="welcome-chip"><span /> YOUR FARM, YOUR COMMUNITY</span><h1>Good morning, {firstName}</h1><p>Every good season starts with a small step. Here’s what’s happening on your farm.</p><div className="welcome-ctas">{farmer && <Link className="button button-dark" to="/app/diagnosis">Check a crop</Link>}<Link className="button button-soft" to={farmer ? "/app/marketplace" : user?.role === "expert" ? "/app/consultations" : "/app/marketplace"}>{farmer ? "Browse the marketplace" : user?.role === "expert" ? "View my schedule" : "Manage my products"}</Link></div></div><div className="welcome-picture"><img src="https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=900&q=80" alt="The morning light across a thriving green field" /><span className="picture-caption"><Sprout size={15} /> A fresh start, every day.</span></div><div className="dashboard-leaf"><Leaf size={32} /></div></section>
    <section className="stat-grid">
      <StatCard icon={<FlaskConical />} tint="stat-sage" label={farmer ? "Crop check-ins" : "Today’s schedule"} value={farmer ? String(scanCount).padStart(2, "0") : String(consultations.data?.data.length ?? 0).padStart(2, "0")} meta={farmer ? "Your growing history" : "Appointments assigned"} />
      <StatCard icon={<CalendarDays />} tint="stat-lilac" label="Next expert visit" value={nextVisit ? new Date(nextVisit.scheduledTime).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "Any time"} meta={nextVisit ? new Date(nextVisit.scheduledTime).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" }) : "Book help when you need it"} />
      <StatCard icon={<MapPin />} tint="stat-peach" label="Your community" value={user?.locationRegion ?? "Your region"} meta="Good things grow nearby" />
      <StatCard icon={<HeartHandshake />} tint="stat-yellow" label="People in your corner" value="Always" meta="Farmers, experts & agrovets" />
    </section>
    {farmer && <section className="dashboard-columns"><article className="content-card latest-card"><div className="card-heading"><div><div className="form-kicker">A LOOK BACK</div><h2>Your crop check-ins</h2></div><Link to="/app/diagnosis" className="text-link">See all</Link></div>{diagnoses.isLoading ? <LoadingLines /> : diagnoses.data?.data.length ? diagnoses.data.data.map((item) => <DiagnosisRow key={item.id} diagnosis={item} />) : <EmptyState icon={<Leaf />} title="Your story starts here" body="Take a photo when something on your farm needs a closer look." action={<Link to="/app/diagnosis" className="text-link">Start a crop check</Link>} />}</article>
      <article className="content-card community-card"><div className="community-cover"><img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=700&q=75" alt="" /><span className="community-badge"><HeartHandshake size={14} /> AROUND YOU</span></div><div className="community-content"><span className="form-kicker">GROWING TOGETHER</span><h2>Good advice is closer than you think.</h2><p>Talk through a crop concern with someone who knows the land and cares about your harvest.</p><Link to="/app/consultations" className="button button-dark button-full">Meet an expert</Link></div></article></section>}
    <section className="market-preview"><div className="section-row"><div><div className="form-kicker">FROM LOCAL AGROVETS</div><h2>Little things for a big growing season.</h2></div><Link to="/app/marketplace" className="text-link">Visit marketplace</Link></div>{products.isError ? <ErrorPanel text={message(products.error)} /> : products.isLoading ? <LoadingCards /> : <div className="product-grid compact">{products.data?.data.slice(0, 3).map((product) => <ProductTile key={product.id} product={product} onAdd={() => navigate("/app/marketplace")} />)}</div>}</section>
  </div>;
}

function AdminDashboard() {
  const { token } = useAuth();
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => api<{ data: { users: { total: number; farmers: number; agrovets: number; experts: number }; pendingPaymentReviews: number } }>("/api/admin/overview", {}, token),
  });
  const stats = overview.data?.data;

  return <div className="page-stack">
    <PageHeading eyebrow="ADMINISTRATION" title="Platform overview" description="Review community activity, manage accounts and crop reports, and maintain farming guides." action={<Link className="button button-dark" to="/app/payment-review"><ClipboardList size={17} /> Review payments</Link>} />
    {overview.isError && <ErrorPanel text={message(overview.error)} />}
    <section className="stat-grid admin-stat-grid">
      <StatCard icon={<UserRound />} tint="stat-sage" label="Total accounts" value={stats ? String(stats.users.total) : overview.isLoading ? "…" : "—"} meta="Across all roles" />
      <StatCard icon={<Sprout />} tint="stat-lilac" label="Farmers" value={stats ? String(stats.users.farmers) : overview.isLoading ? "…" : "—"} meta="Registered accounts" />
      <StatCard icon={<ShoppingBag />} tint="stat-peach" label="Agrovets" value={stats ? String(stats.users.agrovets) : overview.isLoading ? "…" : "—"} meta="Registered accounts" />
      <StatCard icon={<Stethoscope />} tint="stat-yellow" label="Experts" value={stats ? String(stats.users.experts) : overview.isLoading ? "…" : "—"} meta="Registered accounts" />
      <StatCard icon={<ClipboardList />} tint="stat-lilac" label="Payment reviews" value={stats ? String(stats.pendingPaymentReviews) : overview.isLoading ? "…" : "—"} meta="Receipts awaiting review" />
    </section>
  </div>;
}

function StatCard({ icon, tint, label, value, meta }: { icon: ReactNode; tint: string; label: string; value: string; meta: string }) {
  return <article className="stat-card"><span className={`stat-icon ${tint}`}>{icon}</span><span className="stat-label">{label}</span><strong className="stat-value">{value}</strong><span className="stat-meta">{meta}</span></article>;
}

function LoadingLines() {
  return <div className="loading-lines"><span /><span /><span /></div>;
}

function LoadingCards() {
  return <div className="product-grid compact">{[1, 2, 3].map((item) => <div className="skeleton-product" key={item}><span /><i /><i /></div>)}</div>;
}

function ErrorPanel({ text }: { text: string }) {
  return <div className="inline-error"><CircleHelp size={17} /><span>{text}</span></div>;
}

function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><strong>{title}</strong><p>{body}</p>{action}</div>;
}

function DiagnosisRow({ diagnosis }: { diagnosis: Diagnosis }) {
  return <div className="diagnosis-row"><span className="diagnosis-thumb"><img src={imageUrl(diagnosis.imageUrl)} alt="" /></span><span className="diagnosis-row-main"><strong>{diagnosis.detectedDisease}</strong><small>{new Date(diagnosis.createdAt).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}</small>{diagnosis.videoUrl && <video className="diagnosis-video" controls src={imageUrl(diagnosis.videoUrl)}>Your browser cannot play this video.</video>}</span><span className={`severity severity-${diagnosis.severityLevel}`}>{diagnosis.severityLevel}</span></div>;
}

function DiagnosisPage() {
  const { token } = useAuth();
  const client = useQueryClient();
  const paymentAccess = usePhotoPaymentAccess();
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState<"crop" | "livestock">("crop");
  const [preview, setPreview] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [result, setResult] = useState<Diagnosis | null>(null);
  const [error, setError] = useState("");
  const [showPayment, setShowPayment] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const photoCameraInput = useRef<HTMLInputElement>(null);
  const photoFileInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const cameraStream = useRef<MediaStream | null>(null);
  const recordingTimeout = useRef<number | null>(null);
  const recordingInterval = useRef<number | null>(null);
  const history = useQuery({ queryKey: ["diagnoses"], queryFn: () => api<Page<Diagnosis>>("/api/diagnoses?pageSize=30", {}, token) });
  const mutation = useMutation({
    mutationFn: (form: FormData) => api<{ data: Diagnosis }>("/api/diagnoses", { method: "POST", body: form }, token),
    onSuccess: async (response) => {
      setResult(response.data);
      setError("");
      setShowPayment(false);
      await client.invalidateQueries({ queryKey: ["diagnoses"] });
    },
    onError: (cause) => setError(message(cause)),
  });

  useEffect(() => {
    if (!videoPreview) return undefined;
    return () => URL.revokeObjectURL(videoPreview);
  }, [videoPreview]);

  useEffect(() => () => {
    if (recordingTimeout.current !== null) window.clearTimeout(recordingTimeout.current);
    if (recordingInterval.current !== null) window.clearInterval(recordingInterval.current);
    if (recorder.current?.state === "recording") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    cameraStream.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    setResult(null);
    setError("");
    if (preview) URL.revokeObjectURL(preview);
    if (!selected) {
      setFile(null);
      setPreview("");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 8 * 1024 * 1024) {
      setFile(null);
      setPreview("");
      setError("Choose a JPEG, PNG or WebP photo smaller than 8 MB.");
      return;
    }
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  }

  async function startVideoRecording() {
    setError("");
    setResult(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Video recording is not supported in this browser. Try a recent browser or device.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "environment" } });
      cameraStream.current = stream;
      const mimeType = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const activeRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorder.current = activeRecorder;
      const chunks: BlobPart[] = [];
      activeRecorder.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      activeRecorder.onstop = () => {
        const type = activeRecorder.mimeType.startsWith("video/mp4") ? "video/mp4" : "video/webm";
        const extension = type === "video/mp4" ? "mp4" : "webm";
        const clip = new File(chunks, `farm-video.${extension}`, { type, lastModified: Date.now() });
        if (clip.size === 0) {
          setVideoFile(null);
          setVideoPreview("");
          setError("No video was captured. Please try recording again.");
        } else if (clip.size > 50 * 1024 * 1024) {
          setVideoFile(null);
          setVideoPreview("");
          setError("The video is larger than 50 MB. Record a shorter clip and try again.");
        } else {
          setVideoFile(clip);
          setVideoPreview(URL.createObjectURL(clip));
        }
        stream.getTracks().forEach((track) => track.stop());
        cameraStream.current = null;
        if (recordingTimeout.current !== null) window.clearTimeout(recordingTimeout.current);
        if (recordingInterval.current !== null) window.clearInterval(recordingInterval.current);
        setRecording(false);
      };
      setVideoFile(null);
      setVideoPreview("");
      setRecordingSeconds(0);
      activeRecorder.start();
      setRecording(true);
      const startedAt = Date.now();
      recordingInterval.current = window.setInterval(() => {
        setRecordingSeconds(Math.min(60, Math.floor((Date.now() - startedAt) / 1000)));
      }, 250);
      recordingTimeout.current = window.setTimeout(() => {
        if (activeRecorder.state === "recording") activeRecorder.stop();
      }, 60_000);
    } catch (cause) {
      cameraStream.current?.getTracks().forEach((track) => track.stop());
      cameraStream.current = null;
      setError(cause instanceof Error && cause.name === "NotAllowedError"
        ? "Allow camera access to record a farm video."
        : "We couldn't start the camera. Check your camera connection and try again.");
    }
  }

  function stopVideoRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Add a photo to get started.");
      return;
    }
    if (paymentAccess.data?.data.status !== "approved") {
      setShowPayment(true);
      return;
    }
    const body = new FormData();
    body.append("image", file);
    if (videoFile) body.append("video", videoFile);
    body.append("subject", subject);
    mutation.mutate(body);
  }

  return <div className="page-stack">
    <PageHeading eyebrow="A SECOND PAIR OF EYES" title="Let’s take a closer look." description="Share a clear photo of what’s worrying you. We’ll help you find a good next step." />
    <div className="diagnosis-layout">
      <section className="content-card upload-card">
        <div className="card-heading"><div><div className="form-kicker">ADD A CROP PHOTO</div><h2>What would you like help with?</h2></div><span className="privacy-note"><ShieldCheck size={16} /> Your photos stay private</span></div>
        <div className="subject-tabs" role="group" aria-label="Choose a subject">
          <button className={subject === "crop" ? "selected" : ""} type="button" onClick={() => setSubject("crop")}><Wheat size={17} /> A crop or plant</button>
          <button className={subject === "livestock" ? "selected" : ""} type="button" onClick={() => setSubject("livestock")}><HeartHandshake size={17} /> An animal</button>
        </div>
        <form onSubmit={submit}>
          <div className={`upload-zone ${preview ? "has-preview" : ""}`}>
            {preview ? <>
              <img className="upload-preview" src={preview} alt="Selected photo preview" />
              <span className="preview-overlay"><span><CheckCircle2 size={18} /> Photo ready</span><small>{file?.name} · {((file?.size ?? 0) / 1024 / 1024).toFixed(1)} MB</small></span>
              <button type="button" className="remove-photo" aria-label="Remove photo" onClick={(event) => { event.preventDefault(); setFile(null); setPreview(""); setResult(null); }}>Remove</button>
            </> : <>
              <span className="upload-icon"><Camera size={24} /></span><strong>Choose a photo for AI feedback</strong><span>Get close, find good light, and keep it in focus.</span><small>JPEG, PNG or WebP · up to 8 MB</small>
              <div className="upload-actions">
                <button type="button" className="button button-soft upload-choose" onClick={() => setCameraOpen(true)}><Camera size={16} /> Take a photo</button>
                <button type="button" className="button button-light upload-choose" onClick={() => photoFileInput.current?.click()}>Browse files</button>
              </div>
            </>}
          </div>
          <input ref={photoCameraInput} id="diagnosis-camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={selectFile} hidden />
          <input ref={photoFileInput} id="diagnosis-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile} hidden />
          <div className="farm-video-control">
            <div><strong>Optional: record a farm video</strong><small>Record up to one minute. AI feedback still uses your photo.</small></div>
            {!recording && !videoPreview && <button type="button" className="button button-light" onClick={startVideoRecording}>Record video</button>}
            {recording && <div className="farm-video-actions"><span className="recording-time" aria-live="polite">{recordingSeconds}s / 60s</span><button type="button" className="button button-dark" onClick={stopVideoRecording}>Stop recording</button></div>}
            {videoPreview && !recording && <button type="button" className="remove-photo" onClick={() => { setVideoFile(null); setVideoPreview(""); }}>Remove video</button>}
            {videoPreview && <video className="farm-video-preview" controls src={videoPreview}>Your browser cannot play this video.</video>}
          </div>
          <div className="form-hint"><CircleHelp size={15} /><span>A clear photo of the affected area helps an expert understand what’s going on.</span></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="button button-dark submit-wide" disabled={mutation.isPending}>
            {mutation.isPending ? <><span className="button-spinner" /> Looking a little closer…</> : <><FlaskConical size={17} /> Get a helpful starting point</>}
          </button>
        </form>
        {showPayment && paymentAccess.data?.data.status !== "approved" && <PhotoPaymentGate access={paymentAccess} />}
      </section>
      <aside className="diagnosis-side">
        <div className="promise-card"><span className="promise-icon"><HeartHandshake size={19} /></span><span className="form-kicker">PEOPLE IN YOUR CORNER</span><h3>Technology helps. People make the difference.</h3><p>Think something needs a closer look? Every check-in is a chance to connect with an agricultural expert.</p><Link to="/app/consultations" className="text-link">Find someone to talk to</Link><div className="promise-decoration"><Leaf size={48} /></div></div>
        <div className="tips-card"><span className="form-kicker">A FEW PHOTO TIPS</span><ul><li><Check size={15} /> Natural light works best</li><li><Check size={15} /> Focus on the affected area</li><li><Check size={15} /> Include the whole leaf or plant</li></ul></div>
      </aside>
    </div>
    {cameraOpen && <LiveCameraCapture onClose={() => setCameraOpen(false)} onChooseFile={() => photoCameraInput.current?.click()} onCapture={(captured) => {
      if (preview) URL.revokeObjectURL(preview);
      setFile(captured);
      setPreview(URL.createObjectURL(captured));
      setResult(null);
      setError("");
    }} />}
    {result && <section className="result-card"><div className="result-title"><span className="result-icon"><Sprout size={19} /></span><div><div className="form-kicker">AI PHOTO ASSESSMENT</div><h2>{result.detectedDisease}</h2></div><span className={`severity severity-${result.severityLevel}`}>{result.severityLevel}</span></div>{result.videoUrl && <video className="diagnosis-video" controls src={imageUrl(result.videoUrl)}>Your browser cannot play this video.</video>}<div className="result-notice"><ShieldCheck size={16} /><span>Assessment based on the photo you shared · AI confidence estimate: {Math.round(result.confidenceScore * 100)}%</span></div><div className="result-columns"><div><strong>A helpful next step</strong><p>{result.treatmentRecommendations}</p></div><div><strong>Looking ahead</strong><p>{result.preventiveMeasures}</p></div></div><Link to="/app/consultations" className="button button-dark">Talk it through with an expert</Link></section>}
    <section className="history-section"><div className="section-row"><div><div className="form-kicker">YOUR FARM JOURNAL</div><h2>Previous check-ins</h2></div><span className="history-count">{history.data?.total ?? 0} {history.data?.total === 1 ? "check-in" : "check-ins"}</span></div>{history.isError ? <ErrorPanel text={message(history.error)} /> : history.isLoading ? <LoadingLines /> : history.data?.data.length ? <div className="content-card history-list">{history.data.data.map((diagnosis) => <DiagnosisRow key={diagnosis.id} diagnosis={diagnosis} />)}</div> : <EmptyState icon={<FileImage />} title="No check-ins just yet" body="Your crop journal will be here whenever you need it." />}</section>
  </div>;
}

interface CartLine {
  product: Product;
  quantity: number;
}

function MarketplacePage() {
  const { user, token } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState(user?.locationRegion ?? "");
  const [category, setCategory] = useState("All");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const farmer = user?.role === "farmer";
  const isVendor = user?.role === "agrovet";
  const query = useQuery({
    queryKey: ["products", search, category, region],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: "30" });
      if (search) params.set("search", search);
      if (category !== "All") params.set("category", category);
      if (region) params.set("region", region);
      return api<{ data: Product[] }>(
        `${isVendor ? "/api/products/mine" : "/api/products"}?${params}`,
        {},
        token,
      );
    },
  });
  const addProduct = useMutation({
    mutationFn: (body: unknown) => api<{ data: Product }>("/api/products", { method: "POST", body: JSON.stringify(body) }, token),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["products"] });
      setNotice("Your new product is ready in the marketplace.");
      setFormError("");
    },
    onError: (error) => setFormError(message(error)),
  });
  const checkout = useMutation({
    mutationFn: (input: { vendorId: string; items: { productId: string; quantity: number }[] }) =>
      api<{ data: Order }>("/api/orders", { method: "POST", body: JSON.stringify(input) }, token),
    onSuccess: async (result) => {
      setCart([]);
      setCartOpen(false);
      setNotice(`Order placed — total ${money(result.data.totalAmount)}. Your agrovet will be in touch.`);
      await client.invalidateQueries({ queryKey: ["products"] });
      await client.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (error) => setFormError(message(error)),
  });
  const categories = useMemo(() => ["All", ...new Set((query.data?.data ?? []).map((item) => item.category))], [query.data]);
  const total = cart.reduce((sum, line) => sum + Number(line.product.price) * line.quantity, 0);
  const mixedVendors = new Set(cart.map((line) => line.product.vendorId)).size > 1;

  function addToCart(product: Product) {
    setCart((current) => {
      const found = current.find((line) => line.product.id === product.id);
      if (found) return current.map((line) => line.product.id === product.id ? { ...line, quantity: Math.min(line.quantity + 1, product.stockQuantity) } : line);
      return [...current, { product, quantity: 1 }];
    });
    setNotice("");
    setCartOpen(true);
  }

  function changeQuantity(productId: string, amount: number) {
    setCart((current) => current.flatMap((line) => {
      if (line.product.id !== productId) return [line];
      const quantity = line.quantity + amount;
      return quantity < 1 ? [] : [{ ...line, quantity: Math.min(quantity, line.product.stockQuantity) }];
    }));
  }

  function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFormError("");
    addProduct.mutate({
      name: data.get("name"), category: data.get("category"),
      price: Number(data.get("price")), stockQuantity: Number(data.get("stock")),
      description: data.get("description"), imageUrl: data.get("imageUrl") || undefined,
    });
    event.currentTarget.reset();
  }

  return <div className="page-stack"><PageHeading eyebrow={isVendor ? "YOUR LOCAL SHOP" : "GOOD THINGS, CLOSE TO HOME"} title={isVendor ? "Your little corner of the market." : "Find what your farm needs."} description={isVendor ? "Keep your products up to date and help local farms find you." : "Useful seeds, supplies and a friendly local agrovet — all in one place."} action={farmer && <button className="button button-dark cart-top-button" onClick={() => setCartOpen(true)}><ShoppingCart size={17} /> Your basket <span className="cart-count">{cart.reduce((sum, line) => sum + line.quantity, 0)}</span></button>} />
    {notice && <div className="success-banner"><CheckCircle2 size={17} /> {notice}<button onClick={() => setNotice("")} aria-label="Dismiss">Dismiss</button></div>}
    {isVendor && <form className="content-card product-create-form" onSubmit={createProduct}><div className="card-heading"><div><div className="form-kicker">ADD SOMETHING NEW</div><h2>List a product</h2></div><Plus size={20} /></div><div className="product-form-grid"><label>Product name<input name="name" placeholder="e.g. Quality maize seed" required minLength={2} /></label><label>Category<select name="category"><option>Seeds</option><option>Fertilizer</option><option>Crop care</option><option>Equipment</option><option>Livestock</option><option>Other</option></select></label><label>Price in KES<input name="price" type="number" min="0.01" step="0.01" placeholder="850" required /></label><label>Units in stock<input name="stock" type="number" min="0" step="1" placeholder="20" required /></label><label className="wide-field">A short description<input name="description" placeholder="What should farmers know about this product?" required minLength={5} /></label><label className="wide-field">Photo URL (optional)<input name="imageUrl" type="url" placeholder="https://…" /></label></div>{formError && <p className="form-error">{formError}</p>}<button className="button button-dark" disabled={addProduct.isPending}>{addProduct.isPending ? "Adding…" : "Add to the marketplace"}</button></form>}
    <section className="catalog-toolbar"><label className="search-box"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find seeds, supplies, and more…" aria-label="Search products" /></label><label className="region-filter"><MapPin size={17} /><input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Your region" aria-label="Filter by region" /></label><button className="filter-button"><Filter size={16} /><span>Filters</span></button></section>
    <div className="category-pills">{categories.map((item) => <button key={item} className={category === item ? "selected" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
    {formError && !isVendor && <p className="form-error">{formError}</p>}
    {query.isError ? <ErrorPanel text={message(query.error)} /> : query.isLoading ? <LoadingCards /> : query.data?.data.length ? <div className="product-grid">{query.data.data.map((product) => <ProductTile key={product.id} product={product} onAdd={() => farmer ? addToCart(product) : undefined} />)}</div> : <EmptyState icon={<ShoppingBag />} title="Nothing on the shelves just yet" body="Try another search or choose a different region." />}
    <div className="shop-promise"><span><ShieldCheck size={17} /> Shop from local agrovets</span><i /><span><Truck size={17} /> Confirm delivery with your vendor</span><i /><span><CreditCard size={17} /> Your order, your call</span></div>
    {cartOpen && <div className="drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}><aside className="cart-drawer" aria-label="Shopping basket"><div className="drawer-heading"><div><span className="form-kicker">A FEW GOOD THINGS</span><h2>Your basket <span>{cart.reduce((sum, line) => sum + line.quantity, 0)}</span></h2></div><button className="icon-button" onClick={() => setCartOpen(false)} aria-label="Close basket">Close</button></div>{cart.length ? <><div className="cart-items">{cart.map((line) => <div className="cart-line" key={line.product.id}><img src={imageUrl(line.product.imageUrl)} alt="" /><div className="cart-line-detail"><strong>{line.product.name}</strong><small>{money(line.product.price)} each</small><div className="quantity-control"><button onClick={() => changeQuantity(line.product.id, -1)} aria-label="Decrease quantity">−</button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.product.id, 1)} aria-label="Increase quantity">+</button></div></div><strong className="cart-line-total">{money(Number(line.product.price) * line.quantity)}</strong></div>)}</div><div className="cart-summary"><p><span>Subtotal</span><strong>{money(total)}</strong></p><small>Delivery details can be arranged directly with your agrovet.</small>{mixedVendors && <p className="form-error">Place one order per agrovet. Remove items from another shop to continue.</p>}{formError && <p className="form-error">{formError}</p>}<button className="button button-dark button-full" disabled={mixedVendors || checkout.isPending} onClick={() => checkout.mutate({ vendorId: cart[0].product.vendorId, items: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity })) })}>{checkout.isPending ? "Placing your order…" : "Place my order"}</button></div></> : <EmptyState icon={<ShoppingBag />} title="A basket with room to grow" body="Find something useful in the marketplace and it will be waiting here." />}</aside></div>}
  </div>;
}

function ProductTile({ product, onAdd }: { product: Product; onAdd?: () => void }) {
  return <article className="product-card"><div className="product-photo"><img src={imageUrl(product.imageUrl)} alt={product.name} loading="lazy" /><span className="product-category">{product.category}</span><button className="favorite-button" aria-label={`Save ${product.name}`}>Save</button></div><div className="product-info">{product.vendorName && <span className="product-vendor"><BadgeCheck size={13} /> {product.vendorName}{product.vendorRegion ? ` · ${product.vendorRegion}` : ""}</span>}<h3>{product.name}</h3><p>{product.description}</p><div className="product-footer"><span><strong>{money(product.price)}</strong><small>{product.stockQuantity} in stock</small></span>{onAdd && <button className="add-button" onClick={onAdd} aria-label={`Add ${product.name} to basket`}>Add</button>}</div></div></article>;
}

function ConsultationsPage() {
  const { user, token } = useAuth();
  const client = useQueryClient();
  const location = useLocation();
  const consultationNotes = typeof location.state === "object" && location.state !== null
    && "consultationNotes" in location.state && typeof location.state.consultationNotes === "string"
    ? location.state.consultationNotes
    : "";
  const isFarmer = user?.role === "farmer";
  const appointments = useQuery({
    queryKey: ["consultations"],
    queryFn: () => api<{ data: Consultation[] }>("/api/consultations", {}, token),
  });
  const experts = useQuery({
    queryKey: ["experts"],
    queryFn: () => api<{ data: Expert[] }>("/api/experts"),
    enabled: isFarmer,
  });
  const [error, setError] = useState("");
  const booking = useMutation({
    mutationFn: (input: { expertId: string; scheduledTime: string; notes: string }) =>
      api<{ data: Consultation }>("/api/consultations", { method: "POST", body: JSON.stringify(input) }, token),
    onSuccess: async () => {
      setError("");
      await client.invalidateQueries({ queryKey: ["consultations"] });
      setError("Your consultation request was recorded. The professional has not yet confirmed availability.");
    },
    onError: (cause) => setError(message(cause)),
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "completed" | "cancelled" }) =>
      api(`/api/consultations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token),
    onSuccess: () => client.invalidateQueries({ queryKey: ["consultations"] }),
    onError: (cause) => setError(message(cause)),
  });

  function book(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const local = String(form.get("time"));
    if (!local) {
      setError("Choose a time that works for you.");
      return;
    }
    booking.mutate({
      expertId: String(form.get("expertId")),
      scheduledTime: new Date(local).toISOString(),
      notes: String(form.get("notes") ?? ""),
    });
  }

  const active = appointments.data?.data.filter((item) => item.status === "pending") ?? [];
  const past = appointments.data?.data.filter((item) => item.status !== "pending") ?? [];

  return <div className="page-stack"><PageHeading eyebrow={isFarmer ? "A FRIENDLY FACE, A GOOD CONVERSATION" : "YOUR EXPERT PRACTICE"} title={isFarmer ? "Let’s talk it through." : "Your time makes a difference."} description={isFarmer ? "Request a conversation with a professional whose credentials have been reviewed by Shamba Link. A request still needs confirmation." : "See the farmers who would like a little of your time and know-how."} />
    {error && <div className={error.startsWith("Your consultation") ? "success-banner" : "inline-error"}>{error.startsWith("Your consultation") ? <CheckCircle2 size={17} /> : <CircleHelp size={17} />}{error}<button className="dismiss-inline" onClick={() => setError("")} aria-label="Dismiss">Dismiss</button></div>}
    {isFarmer && <section className="booking-layout"><form className="content-card booking-form" onSubmit={book}><div className="form-kicker">REQUEST A CONVERSATION</div><h2>Choose a time that works for you.</h2><p className="muted-copy">A request is recorded in your account. The professional must confirm before it is an appointment.</p><label>Who would you like to talk with?<select name="expertId" required defaultValue=""><option value="" disabled>Select a verified professional</option>{experts.data?.data.map((expert) => <option key={expert.id} value={expert.id}>{expert.name} · {expert.expertise ?? "Agricultural expert"} · {expert.locationRegion}{expert.consultationRateKes !== null ? ` · KES ${expert.consultationRateKes}` : ""}</option>)}</select>{experts.data?.data.length === 0 && <small>No verified professionals are currently listed. New profiles are shown after an administrator checks their documents and availability.</small>}</label><label>When works for you?<input type="datetime-local" name="time" min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)} required /></label><label>What would you like help with? <small>(optional)</small><textarea name="notes" rows={3} maxLength={2000} placeholder="A little about what's happening on your farm…" defaultValue={consultationNotes} /></label><button className="button button-dark" disabled={booking.isPending || !experts.data?.data.length}>{booking.isPending ? "Sending your request…" : "Request this appointment"}</button></form><aside className="expert-info-card"><div className="expert-photo expert-photo-placeholder"><Stethoscope size={30} /><span><BadgeCheck size={14} /> CREDENTIAL REVIEW REQUIRED</span></div><div className="expert-info-copy"><div className="form-kicker">PROFESSIONAL SUPPORT</div><h3>A listening ear makes all the difference.</h3><p>Professional documents are checked by an administrator before a new expert profile is listed.</p><div className="expert-benefit"><span><Check size={15} /></span><span><strong>Share your question and context</strong><small>Your farm, your goals, your conversation.</small></span></div><div className="expert-benefit"><span><Check size={15} /></span><span><strong>Request status stays in your account</strong><small>A request is not a confirmed appointment.</small></span></div></div></aside></section>}
    <section className="appointments-section"><div className="section-row"><div><div className="form-kicker">{isFarmer ? "YOUR PLANS" : "COMING UP"}</div><h2>{isFarmer ? "Your expert visits" : "Upcoming conversations"}</h2></div><span className="history-count">{active.length} upcoming</span></div>{appointments.isError ? <ErrorPanel text={message(appointments.error)} /> : appointments.isLoading ? <LoadingLines /> : active.length ? <div className="appointment-list">{active.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} expert={experts.data?.data.find((item) => item.id === appointment.expertId)} onUpdate={(status) => updateStatus.mutate({ id: appointment.id, status })} updating={updateStatus.isPending} isFarmer={isFarmer} />)}</div> : <EmptyState icon={<CalendarDays />} title="A little space in the calendar" body={isFarmer ? "When you’re ready for a conversation, book a time above." : "There are no conversations on your schedule just now."} />}</section>
    {past.length > 0 && <section className="appointments-section"><div className="section-row"><div><div className="form-kicker">A LOOK BACK</div><h2>Past conversations</h2></div></div><div className="appointment-list">{past.map((appointment) => <AppointmentRow key={appointment.id} appointment={appointment} expert={experts.data?.data.find((item) => item.id === appointment.expertId)} isFarmer={isFarmer} />)}</div></section>}
  </div>;
}

function AppointmentRow({ appointment, expert, onUpdate, updating, isFarmer }: { appointment: Consultation; expert?: Expert; onUpdate?: (status: "completed" | "cancelled") => void; updating?: boolean; isFarmer: boolean }) {
  const date = new Date(appointment.scheduledTime);
  return <article className="appointment-card"><span className="appointment-date"><strong>{date.toLocaleDateString("en-KE", { day: "2-digit" })}</strong><small>{date.toLocaleDateString("en-KE", { month: "short" })}</small></span><span className="appointment-avatar"><UserRound size={19} /></span><div className="appointment-main"><strong>{isFarmer ? expert?.name ?? "Your agricultural expert" : "Farmer consultation"}</strong><small>{date.toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" })} · {date.toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" })}</small>{appointment.notes && <p>{appointment.notes}</p>}</div><span className={`status-pill status-${appointment.status}`}>{appointment.status}</span>{appointment.status === "pending" && onUpdate && <div className="appointment-actions"><button className="text-link" onClick={() => onUpdate("cancelled")} disabled={updating}>Cancel</button>{!isFarmer && <button className="complete-button" onClick={() => onUpdate("completed")} disabled={updating}><Check size={14} /> Done</button>}</div>}</article>;
}

function OrdersPage() {
  const { user, token } = useAuth();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const orders = useQuery({
    queryKey: ["orders"],
    queryFn: () => api<{ data: Order[] }>("/api/orders", {}, token),
  });
  const isVendor = user?.role === "agrovet";
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "processing" | "delivered" }) =>
      api(`/api/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, token),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders"] }),
    onError: (cause) => setError(message(cause)),
  });
  return <div className="page-stack"><PageHeading eyebrow={isVendor ? "A GOOD DAY AT THE SHOP" : "FROM YOUR FARM"} title={isVendor ? "Orders from your community." : "Your orders."} description={isVendor ? "Keep track of what local farmers have ordered from you." : "Everything you’ve ordered from your local agrovets, all together."} />{error && <ErrorPanel text={error} />}{orders.isError ? <ErrorPanel text={message(orders.error)} /> : orders.isLoading ? <LoadingLines /> : orders.data?.data.length ? <div className="content-card order-list">{orders.data.data.map((order) => <article className="order-row" key={order.id}><span className="order-icon"><Package size={18} /></span><span className="order-main"><strong>Order #{order.id.slice(0, 8).toUpperCase()}</strong><small>{new Date(order.createdAt).toLocaleDateString("en-KE", { dateStyle: "medium" })} · {order.status}</small></span><strong className="order-total">{money(order.totalAmount)}</strong>{isVendor && (order.status === "pending" || order.status === "processing") ? <button className="complete-button" disabled={updateStatus.isPending} onClick={() => updateStatus.mutate({ id: order.id, status: order.status === "pending" ? "processing" : "delivered" })}>{order.status === "pending" ? "Start" : "Mark delivered"}</button> : <span className={`status-pill status-${order.status}`}>{order.status}</span>}</article>)}</div> : <EmptyState icon={<Package />} title="Room for a first order" body="When something good catches your eye in the marketplace, your order will show up here." action={<Link className="text-link" to="/app/marketplace">Visit the marketplace</Link>} />}</div>;
}

export default App;
