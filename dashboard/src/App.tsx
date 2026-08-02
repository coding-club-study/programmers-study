import { useEffect, useMemo, useState } from "react";
import {
  calculateStreak,
  createStreakCells,
  formatDuration,
  seoulToday,
  summarizeDay,
  summarizeMonth,
  type StreakCell,
  type UserData
} from "@coding-club/shared";

const DATA_URL = `${import.meta.env.BASE_URL}data/users/index.json`;

function formatDate(dateKey: string) {
  return dateKey.replaceAll("-", ".");
}

function StreakGraph({ user }: { user: UserData }) {
  const cells = useMemo(() => createStreakCells(user.days, 36), [user.days]);
  const [selected, setSelected] = useState<StreakCell | null>(null);

  function detail(cell: StreakCell) {
    const day = user.days[cell.dateKey];
    return (
      <div className="streak-tooltip" role="tooltip">
        <strong>{formatDate(cell.dateKey)}</strong>
        <span>{cell.problemCount}문제 · {formatDuration(summarizeDay(day).durationSeconds)}</span>
        {day?.problems.map((problem) => (
          <span key={`${cell.dateKey}-${problem.problemId}`}>
            {problem.title}<small>{problem.language} · {formatDuration(problem.durationSeconds)}</small>
            {problem.reflection && <small>♡ {problem.reflection}</small>}
          </span>
        ))}
        {day?.reflection && <blockquote>♡ {day.reflection}</blockquote>}
      </div>
    );
  }

  return (
    <>
      <div className="streak-grid" aria-label={`${user.displayName}님의 최근 36일 풀이 기록`}>
        {cells.map((cell) => (
          <button
            className="streak-cell"
            data-level={cell.level}
            data-today={cell.isToday || undefined}
            key={cell.dateKey}
            aria-label={`${cell.dateKey}, ${cell.problemCount}문제`}
            onClick={() => setSelected(cell)}
          >
            {cell.problemCount > 0 && detail(cell)}
          </button>
        ))}
      </div>
      {selected && (
        <div className="mobile-detail">
          <button aria-label="상세 닫기" onClick={() => setSelected(null)}>×</button>
          {detail(selected)}
        </div>
      )}
    </>
  );
}

function UserCard({ user }: { user: UserData }) {
  const todayKey = seoulToday();
  const today = user.days[todayKey];
  const daily = summarizeDay(today);
  const monthly = summarizeMonth(user.days, todayKey.slice(0, 7));
  const streak = calculateStreak(user.days);

  return (
    <article className="user-card">
      <header className="profile">
        <img src={user.profileImageUrl} alt="" />
        <div>
          <strong>{user.displayName}</strong>
          <span>@{user.githubId}</span>
        </div>
        <mark className={daily.problemCount ? "complete" : "waiting"}>
          {daily.problemCount ? "TODAY ★" : streak.awaitingToday ? "WAITING" : "REST"}
        </mark>
      </header>

      <div className="streak-heading">
        <strong>STREAK</strong>
        <span>현재 <b>{streak.current}일</b> · 최고 {streak.best}일</span>
      </div>
      <StreakGraph user={user} />
      <div className="streak-legend"><span>LESS</span><b>MORE</b></div>

      <h2>TODAY'S RECORD</h2>
      {today?.problems.length ? (
        <>
          <ol className="problems">
            {today.problems.map((problem) => (
              <li key={problem.problemId}>
                <div className="problem-record">
                  <a href={problem.url} target="_blank" rel="noreferrer">{problem.title}</a>
                  <small><b>{formatDuration(problem.durationSeconds)}</b><i aria-hidden="true">|</i>{problem.language}</small>
                  {problem.reflection && <p>♡ {problem.reflection}</p>}
                </div>
              </li>
            ))}
          </ol>
          {today.reflection && <p className="reflection">♡ {today.reflection}</p>}
        </>
      ) : (
        <p className="empty">아직 오늘의 기록이 없어요 · · ·</p>
      )}

      <footer className="summary">
        <div><b>{daily.problemCount}</b><span>오늘 문제</span></div>
        <div><b>{monthly.problemCount}</b><span>이번 달</span></div>
        <div><b>{streak.current}</b><span>스트릭</span></div>
      </footer>
    </article>
  );
}

export function App() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${DATA_URL}?refresh=${Date.now()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(`데이터를 불러오지 못했습니다. (${response.status})`);
        return response.json() as Promise<UserData[]>;
      })
      .then(setUsers)
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "알 수 없는 오류가 발생했습니다."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main>
      <section className="page-heading">
        <div>
          <h1>CODING CLUB!</h1>
          <p>한 문제씩, 오래오래 ✦</p>
        </div>
        <div className="sticker" aria-hidden="true">★<small>KEEP GO!</small></div>
      </section>

      {error && <p className="error">{error}</p>}
      {!error && loading && <p className="loading">기록을 불러오는 중 · · ·</p>}
      {!error && !loading && users.length === 0 && (
        <section className="club-empty">
          <span aria-hidden="true">✦</span>
          <strong>아직 첫 기록을 기다리고 있어요!</strong>
          <p>확장 프로그램에서 첫 문제를 업로드하면 여기에 자동으로 나타납니다.</p>
        </section>
      )}
      <section className="member-grid" aria-label="스터디 참여자 기록">
        {users.map((user) => <UserCard key={user.githubId} user={user} />)}
      </section>
    </main>
  );
}
