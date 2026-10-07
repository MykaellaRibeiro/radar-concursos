"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { ArrowRight, Bookmark, BookmarkCheck, CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import { submitQuestionAttempt, toggleQuestionBookmark, type AttemptActionState } from "@/features/study/actions";

type Alternative = { letter: "A" | "B" | "C" | "D" | "E"; text: string | null };

const statusCopy = {
  CORRECT: { label: "Correta", icon: CheckCircle2 },
  INCORRECT: { label: "Incorreta", icon: CircleX },
  ANNULLED: { label: "Anulada", icon: CircleAlert },
} as const;

const initialAttemptState: AttemptActionState = {
  status: "IDLE", message: null, selectedOption: null, officialAnswer: null, attemptNumber: null,
};

export function QuestionInteraction({
  questionId,
  alternatives,
  authenticated,
  bookmarked: initialBookmarked,
  initialResult = initialAttemptState,
  nextQuestionId,
}: {
  questionId: string;
  alternatives: Alternative[];
  authenticated: boolean;
  bookmarked: boolean;
  initialResult?: AttemptActionState;
  nextQuestionId: string | null;
}) {
  const [state, formAction, pending] = useActionState(submitQuestionAttempt, initialResult);
  const [selected, setSelected] = useState(state.selectedOption ?? "");
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [bookmarkMessage, setBookmarkMessage] = useState("");
  const [bookmarkPending, startBookmarkTransition] = useTransition();
  const [startedAt] = useState(() => Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const revealed = state.status === "CORRECT" || state.status === "INCORRECT" || state.status === "ANNULLED";
  const outcome = state.status === "CORRECT" || state.status === "INCORRECT" || state.status === "ANNULLED" ? statusCopy[state.status] : null;
  const OutcomeIcon = outcome?.icon;

  function updateBookmark() {
    if (!authenticated) return;
    startBookmarkTransition(async () => {
      const result = await toggleQuestionBookmark(questionId, !bookmarked);
      setBookmarkMessage(result.message);
      if (result.ok) setBookmarked(result.saved);
    });
  }

  return <section className="question-answering" aria-label="Responder questão">
    <div className="question-answering__toolbar">
      {authenticated ? <button className="bookmark-button" type="button" onClick={updateBookmark} disabled={bookmarkPending} aria-pressed={bookmarked}>
        {bookmarked ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}{bookmarked ? "Salva" : "Salvar questão"}
      </button> : <Link className="bookmark-button" href={`/login?next=${encodeURIComponent(`/questoes/${questionId}`)}`}><Bookmark size={17} /> Salvar questão</Link>}
      <span className="question-answering__hint">O gabarito aparece somente após o registro da resposta.</span>
    </div>
    {bookmarkMessage && <p className="inline-message" role="status">{bookmarkMessage}</p>}
    <form action={formAction}>
      <input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="context" value="QUESTAO" />
      <input type="hidden" name="durationSeconds" value={elapsedSeconds} />
      <fieldset className="answer-fieldset">
        <legend className="sr-only">Escolha uma alternativa</legend>
        <div className="alternative-list">{alternatives.map((alternative) => {
          const selectedOption = selected === alternative.letter;
          const official = revealed && state.officialAnswer === alternative.letter;
          const wrongSelection = revealed && state.status === "INCORRECT" && state.selectedOption === alternative.letter;
          const className = ["alternative", selectedOption ? "alternative--selected" : "", official ? "alternative--correct" : "", wrongSelection ? "alternative--incorrect" : ""].filter(Boolean).join(" ");
          return <label className={className} key={alternative.letter}>
            <input className="sr-only" type="radio" name="selectedOption" value={alternative.letter} checked={selectedOption} onChange={() => { setSelected(alternative.letter); setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000))); }} />
            <span className="alternative__letter">{alternative.letter}</span>
            <span>{alternative.text ?? "Conteúdo visual não extraído. Consulte o caderno oficial."}</span>
            {official && <strong>Gabarito oficial</strong>}
            {wrongSelection && <strong>Sua resposta</strong>}
          </label>;
        })}</div>
      </fieldset>
      <div className="question-answering__actions">
        {authenticated ? <button className="button button--primary" type="submit" disabled={!selected || pending}>{pending ? "Salvando…" : revealed ? "Registrar nova tentativa" : "Responder"}</button>
          : <Link className="button button--primary" href={`/login?next=${encodeURIComponent(`/questoes/${questionId}`)}`}>Entrar para responder</Link>}
        {revealed && nextQuestionId && <Link className="button button--secondary" href={`/questoes/${nextQuestionId}`}>Próxima questão <ArrowRight size={16} /></Link>}
      </div>
    </form>
    {outcome && OutcomeIcon && <div className={`answer-feedback answer-feedback--${state.status.toLowerCase()}`} role="status" aria-live="polite">
      <OutcomeIcon size={22} />
      <div><strong>{outcome.label}</strong><p>{state.message}</p>{state.attemptNumber && <small>Tentativa {state.attemptNumber} preservada no histórico.</small>}</div>
    </div>}
    {state.status === "AUTH_REQUIRED" && <p className="form-message form-error" role="alert">{state.message}</p>}
    {state.status === "ERROR" && <p className="form-message form-error" role="alert">{state.message}</p>}
  </section>;
}

